# Sessions & Live Editing

Design reference for the session domain: the event-sourced live-session model, event payload invariants, frozen rule snapshots, ownership contracts, the live reopen flow, P/L math (`chipRemoveTotal`), and the live-linked edit sheet. EV semantics (recording gate, cash-out fallback, population rules) are owned by [`statistics.md`](statistics.md); D1 batching/atomicity mechanics by [`data-integrity.md`](data-integrity.md); game-master semantics by [`game-masters.md`](game-masters.md); the generic filter-preset system by [`web-platform.md`](web-platform.md).

## The event-sourced session model

A live-recorded session is an event stream, not a form submission. The session row's derived columns (`startedAt`, `cashOut`, `placement`, buy-in, break minutes, P/L, …) are recalculated from the events on every event write, so columns and events can never drift. **The live session id and the recorded session id are the same row** (SA2-167).

- State is derived, never stored ([`session-event-types.ts`](../../packages/db/src/constants/session-event-types.ts), `getSessionCurrentState`): **completed** = a `session_end` exists; **paused** = the latest lifecycle/pause/resume event is `session_pause`; **active** otherwise. Derived state uses the **first** `session_start` and the **last** `session_end` — a reopened cash session carries more than one of each — and the web's [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) picks lifecycle events by the same rule, matching `computeSessionStateFromEvents`.
- An omitted `occurredAt` resolves to **`now`**, never a fixed value like `sessionDate` ([`session-event-time.ts`](../../packages/api/src/utils/session-event-time.ts)) — a `sessionDate` default once stacked every default-timestamped event on a single instant.
- Events are read ordered by `(occurredAt, sortOrder, id)`; `session_resume` must sort **strictly after** `session_pause` or break-minute calculation cannot close the pause.
- The cross-field rule "exactly one session id" on event procedures is enforced at runtime via `validateExactlyOneSessionId` — the Zod schema accepts any combination.
- **Minute-granularity trap**: the server compares event times **by minute** (`floorToMinute` + `assertOccurredAtOrdering`). Every client-side bound check must floor the same way — [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) does, and treats "both editors landed on the same minute" as nothing left to write. Keep the two in lockstep whenever either side's comparison changes.

## Event payload invariants

Payload schemas live in [`session-event-types.ts`](../../packages/db/src/constants/session-event-types.ts).

- **Seat bounds (SA2-131)** — seats are 0-indexed; a 10-max table uses positions 0–9. Every server-side `seatPosition` / `heroSeatPosition` bound derives from the single constant `MAX_SEAT_POSITION = 9`, so it can never again drift from the client's `MAX_SEAT_COUNT` (10).
- **`chips_add_remove.amount` is signed** — a deliberate deviation from the `.int().min(0)` convention in [`api-data-integrity.md`](../../.claude/rules/api-data-integrity.md): positive = chips added, negative = chips removed (feeds `chipRemoveTotal`). Zero is rejected so no-op events are never stored.
- **`all_in`: `wins <= trials` (SA2-156)** — `wins` counts favorable run-outs as a **fraction** on chopped pots, so it is a non-negative number, not necessarily an integer. The object-level refine blocks the real bug: `{ potSize: 1000, trials: 1, wins: 5 }` once validated and let EV math compute a wins-share larger than the pot, corrupting `evCashOut` / `evDiff`. The web mirrors the bound with a single shared `superRefine` ([`all-in-validation.ts`](../../apps/web/src/features/live-sessions/utils/all-in-validation.ts)) attached by **both** the create sheet and the timeline editor so it cannot drift between them.
- **`purchase_chips`** keeps `name` / `cost` / `chips` as a **denormalized snapshot** for display and P/L math even if the linked rule (`sessionChipPurchaseId`) changes later.
- **`update_stack`**: `averageStack = (startingStack × totalEntries + chipTotal) / remainingPlayers` is **derived on read**, never stored — storing it would let it drift from its inputs.

## Frozen rule snapshots (self-freezing sessions)

Snapshot fields on [`session_cash_detail`](../../packages/db/src/schema/session-cash-detail.ts) / [`session_tournament_detail`](../../packages/db/src/schema/session-tournament-detail.ts) (plus `session_blind_level` / `session_chip_purchase` rows) are copied from the parent `ring_game` / `tournament` at session-create time and frozen — parent rename / blind / config changes never propagate. Web reads must come from the **session** snapshot (`getById` returns it); only `tags` / `memo` / `currencyId` fall back to the master, since they are not part of the rule snapshot.

- **Create**: explicit snapshot fields override the parent's values; with no master referenced they define the rule wholesale (manual and wizard sessions need no master row). `variant` on the cash create schema is **plain optional** — a schema-level default would coerce an omitted variant *before* `mergeCashSnapshotWithParent`, permanently defeating inheritance from the ring game (c10); the `"NL Hold'em"` fallback lives solely in `defaultCashSnapshot`. Every chip purchase is seeded with a count-0 result row.
- **Update**: overrides go to the detail row, **never the parent**. Changing the parent link re-snapshots from the new parent, with explicit inputs still winning. `null` for blind levels / chip purchases **keeps** the frozen snapshot; explicit arrays **override** it — the explicit-array write runs *after* the re-snapshot in the same batch, so arrays win when both apply. `kind` is fixed: the update keys off the persisted kind. For live sessions, `session.update` **refuses every event-derived field** (times, cash-out, placement, buy-in, catalogs, blind structure) — those change only through event edits (below).
- **`updateSnapshot` mutations** edit the frozen snapshot for this session only (the tournament variant includes full-list replacement of blind levels / chip purchases); the master `ring_game` / `tournament` row is **never touched**.
- Mix-game rendering: `null` ≈ `undefined` for ante type must stay normalized the same way as [`snapshot-diff.ts`](../../apps/web/src/features/live-sessions/utils/snapshot-diff.ts), or the diff counts an ante the display silently drops. The structural "group" type in [`game-scene-formatters.ts`](../../apps/web/src/features/live-sessions/utils/game-scene-formatters.ts) is local on purpose — reconcile with the game-group zod schema when that phase lands.

## Ownership contracts

The blanket rules (object-level authorization, scoped bulk WHEREs, write-IDOR row scoping) live in [`api-security.md`](../../.claude/rules/api-security.md); the session-domain guard inventory:

- **Uniform FORBIDDEN (SA2-183)** — `validateEntityOwnership` ([`session.ts`](../../packages/api/src/routers/session.ts)) treats "missing" and "owned by someone else" identically; shared by the game-group / game-variant / game-mix routers.
- **Filter ownership (SA2-183)** — `validateSessionFilterOwnership` validates every optional FK filter at the resolver boundary, before an owner-scoped query can turn a foreign id into an empty result.
- **Live-link ownership (SA2-102)** — `validateLiveLinkOwnership` guards the room / currency links of the live routers. Falsy (`undefined` = omitted, `null` = clear, `""` = empty) skips; a provided id must exist AND belong to the caller. Prevents IDOR on the money-ledger links.
- **Tag-set ownership (SA2-177)** — `validateTagsOwnership` compares the distinct owned count against the requested distinct count in one scoped query; any mismatch → FORBIDDEN. No-ops on empty/omitted ids.
- **Ring game (SA2-174 / SA2-181)** — a ring game carries its **own `userId`**; a `null` userId is an unprovable orphan → FORBIDDEN. Ownership is verified **before any `ring_game` read**, so a caller cannot probe another user's config via the buy-in bounds. (The nullability trade-off is covered in [`data-integrity.md`](data-integrity.md).)
- **Tournament** — no own `userId`; ownership derives from its room, validated **before** `snapshotTournamentStructure` reads anything (IDOR on another user's blind structure otherwise).
- **Transaction type (SA2-179)** — ownership verified before the type is linked to a transaction (read-IDOR otherwise).

## Session lifecycle: reopen and deletion

- **Live reopen (SA2-211)** — `persistCashSessionReopenEvents` deletes the `session_end` and re-stamps the closing stack as an `update_stack` plus a `session_pause`/`session_resume` pair. Event replacement, row reopen, and ledger-entry removal share **one `db.batch`**, so any failure rolls back the entire reopen (SA2-116; batch mechanics in [`data-integrity.md`](data-integrity.md)). Replacement events use contiguous sortOrders (the deleted end's order, +1, +2) — the "fixed sort-order ranges only within one atomic replacement batch" case of [`api-data-integrity.md`](../../.claude/rules/api-data-integrity.md); the pause→resume ordering matters because break minutes close a pause only when the resume sorts strictly after it.
- **Deletion** also unwinds the linked currency transaction server-side — the confirmation copy stays explicit about permanence because the ledger entry disappears with it.

## Seated players: event-sourced stints

Seated players are not stored in a table — every read folds the `player_join` / `player_leave` stream ([`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts)):

- Only events carrying a `playerId` are folded; the hero's seat has no `playerId` and is derived by `computeHeroSeatPositionFromEvents`.
- Each `player_join` opens a **stint**, each `player_leave` closes the latest open one; a leave with no open stint is a no-op. Each player appears once, full history on `stints`, top-level fields reflecting the most recent stint.
- The seat lives on the player's **most recent `player_join` event**; patching that event keeps the seat fully event-sourced.

## P/L and `chipRemoveTotal` (SA2-124)

**Cash P/L is `cashOut + chipRemoveTotal − totalBuyIn`, identical at every site that computes it.** Chips racked off mid-session are already-pocketed value, not a loss; the chip-remove-blind `cashOut − buyIn` undercounts by exactly the removed chips. `session_cash_detail.chipRemoveTotal` (Σ of the negative `chips_add_remove` amounts) is persisted separately from `cashOut` so completed-session P/L (list / detail / stats) can add it back in.

The four formula sites that must never drift:

1. Server: [`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts) (also surfaces `chipRemoveTotal` for the live header).
2. Chart: [`session-timeline.ts`](../../apps/web/src/features/live-sessions/utils/session-timeline.ts).
3. Optimistic layer: [`optimistic-session-event.ts`](../../apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) (`session_end`: `cashOutAmount` drives `profitLoss` via the same formula).
4. Live header: [`use-cash-game-compact-summary.ts`](../../apps/web/src/features/live-sessions/pages/active-session-page/cash-game-compact-summary/use-cash-game-compact-summary.ts) (`stack + chipRemoveTotal − totalBuyIn`).

Recalculation runs on **every** event write, so editing an unrelated field (e.g. memo) must not regress the currency ledger to the chip-remove-blind value. The same figure feeds the fallback EV so `evDiff` stays isolated to all-in equity (EV semantics: [`statistics.md`](statistics.md)).

## Chip purchases and result sync

- `session_chip_purchase_result` stores one row per `session_chip_purchase` (`sessionChipPurchaseId` doubles as the primary key); cost is derived on read from the linked rule, never duplicated.
- Recalculation **upserts** the event-derived counts — **every** purchase gets a row (count 0 when never bought), chunked and batched under D1's bind-parameter cap so a failed upsert cannot leave a partially refreshed set ([`data-integrity.md`](data-integrity.md)).
- `count` is deliberately kept out of the shared `ChipPurchaseRow` type — it is shared with the Rooms tournament form, where a result count is meaningless.

## Session timeline chart

[`session-timeline.ts`](../../apps/web/src/features/live-sessions/utils/session-timeline.ts) plots only stack records; buy-in-affecting events, all-ins (`evDiff`), and chip purchases feed running state, reflected at the next stack point. **Tournament start counts as a stack record equal to the starting stack**, so the curve begins there. The opening point is the first `update_stack` because the create flow ([`use-create-session.ts`](../../apps/web/src/features/live-sessions/hooks/use-create-session.ts)) logs one with the starting stack — the two are coupled; changing the create flow breaks the chart's opening point. Related timer contract: **zero-minute blind rows are accepted** by the structure schema (skipped placeholders, not indeterminate durations), so the tournament timer advances over them instead of pinning.

## Live-linked session editing

The sync layer between the session edit form and the live event history: [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) and its page hook [`use-live-linked-session-edit.ts`](../../apps/web/src/features/sessions/pages/session-detail-page/use-live-linked-session-edit.ts).

### The field → event map

Most of a live session's edit form is read-only (derived columns). Editable fields are exactly those determined by one value of one event; anything aggregated over several events (cash buy-in, EV cash-out, break minutes, chip-purchase counts) stays read-only, and `sessionDate` is never editable (below).

| Form field                                   | Event         | Value                  |
|----------------------------------------------|---------------|------------------------|
| `startTime`                                  | session_start | `occurredAt` (time)    |
| `endTime`                                    | session_end   | `occurredAt` (time)    |
| `cashOut`                                    | session_end   | `payload.cashOutAmount`|
| `beforeDeadline` / `placement` / `totalEntries` / `prizeMoney` / `bountyPrizes` | session_end | `payload` |

These write through `sessionEvent.update` (which `session.update` refuses): the server revalidates the payload, enforces neighbour ordering, and recalculates the session. `sessionEvent.update` **replaces the payload wholesale**, so an unchanged payload is simply not sent. Rules-step catalogs and the blind structure are likewise event-derived and disabled for live sessions.

### The locked date and the day-stretch hazard

Both times are edited **within their own event's calendar day**, never recombined with the form's single `sessionDate` — which is why the date input is locked. Moving a lifecycle event to another day leaves every other event in place, so the session silently stretches: a start dragged one day back once turned a 5-hour session into a **29-hour** one, feeding phantom play time into statistics. A day move would mean moving the whole event stream — not a single-event edit — so a stale submitted date must never move an event. Same semantics as the Events-section editors, and the reason a session spanning more than a day survives an edit.

Day hints (SA2-145): the displayed date can disagree with a time's actual day — the session crossed midnight, or `sessionDate` is the start timestamp rendered with UTC getters while the times render locally (for JST, every session starting 00:00–09:00). Each time field therefore spells out its actual calendar day whenever it differs from the form's date.

### Required and disabled field sets (SA2-113)

Two disjoint sets govern live result fields. **Disabled** = the backing event does not exist yet (no `session_end` while running) or has not loaded — the form never offers an edit the server would reject. **Required** = the backing event exists, so the payload requires a value and a blank is either a rejection or — worse — a silent 0. The shared schema marks these optional for manual sessions, hence the separate live-only set. On submit, values compare 0-normalized so an untouched blank on a bounty-less session is a no-op, but a *cleared* non-zero value stays `undefined` and is **rejected** — a blank saved as 0 silently corrupts P/L (SA2-113).

### Seed snapshot vs. current events

The edit sheet embeds the Events section, which edits the same events live. The invariant: the form diffs against **`seedEvents`** (the events as of sheet-open), and per key the merge is **last-write-wins between the two editors** — a key the form left at its seed keeps whatever the event holds now, so an Events-side prize edit and a form-side placement edit both survive. The actual writes go against the **current** events. `FormSheet` unmounts on close, so the form re-seeds exactly when the snapshot clears; the date is seeded at the same moment, so the day hints must compare against the **frozen** date — an Events-side start-time edit can change the session's UTC calendar day while the form keeps showing the old one.

### Building and applying the edits

- **Bounds**: a new time must respect its neighbours — substituting the other lifecycle event's *pending* time when it is the neighbour, or moving start and end together would be rejected against a time about to change.
- **Order**: edits are returned in application order — **when the end moves later it goes first**, so a start moving past the end's *old* time never trips the server's neighbour check (and vice versa). Validation errors abort before anything is written.
- **Application is sequential on purpose** — each edit satisfies the neighbour check against the state the previous one left behind. A rejected edit keeps the sheet open; only the failed step is unapplied, since the server recalculates after every event write.

## Session display contract

Whether a row shows an EV figure is decided in exactly one function — `displayableEvProfitLoss` in [`session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts) — read by the list card, the detail hero, and the share text, so the three surfaces cannot disagree. Gate semantics: [`statistics.md`](statistics.md).

## Session wizard: live vs. manual schema split

A live session is created before it ends, so the result-only `cashOut` is unknown and the live form never renders it — keeping the shared `cashOut` requirement made ✓ Confirm silently fail (the always-empty field failed validation and routed to a Result step the live form doesn't render). The live cash schema therefore drops `cashOut` (the initial buy-in stays required), and live mode drops the Result step entirely.

Mix-editor invariants ([`use-session-form-state.ts`](../../apps/web/src/features/sessions/components/session-wizard/use-session-form-state.ts)):

- Every all-levels value **clears** per-level game assignments so hidden per-level games cannot leak into the snapshot; entering a mix clears the flat blind/ante fields, leaving clears the editor rows — the editor rows are the single submit-time authority (c02/c04).
- Gates read the **editor state, never a live master lookup**: a deleted or renamed mix master must not wipe the frozen snapshot on an unrelated edit (c02/c02b).
- The one-shot reseed from the stored snapshot stands down once the user touches the mix editor, so it can never clobber their edits (c05).

Room geolocation (SA2-100): `room.latitude` / `longitude` are nullable on purpose — **(0, 0) is a valid coordinate** and cannot mean "unset". The "you are at this venue" radius is **500 m** (venue footprint + GPS jitter, without matching across town). The suggested nearest room applies only while the user hasn't picked one; a manual choice or explicit clear always wins.

## Render-time reset (SA2-171)

`SessionFormProvider` is mounted once at app-shell scope; its state is keyed to the active session id ([`use-authenticated-shell.ts`](../../apps/web/src/shared/components/authenticated-shell/use-authenticated-shell.ts)), and [`use-session-form.tsx`](../../apps/web/src/features/live-sessions/hooks/use-session-form.tsx) resets every cash + tournament field whenever it changes, **including when it clears to null** — otherwise a finished tournament's `chipPurchaseCounts` carry into the next session's `update_stack` payload, corrupting the average-stack calculation (SA2-171). The reset adjusts state **during render** (React's "reset on prop change" pattern): no extra effect pass or stale-value flash, and no `key` remounting the whole shell.

## Optimistic updates

The mandated helper API and its pitfalls: [`web-data-fetching.md`](../../.claude/rules/web-data-fetching.md) + [`optimistic-update.ts`](../../apps/web/src/utils/optimistic-update.ts). Server couplings of the feature-level wrapper [`optimistic-session-event.ts`](../../apps/web/src/features/live-sessions/utils/optimistic-session-event.ts):

- `chips_add_remove` affects `totalBuyIn` **server-side**, so the optimistic layer skips the stack update rather than guessing.
- `session_end` P/L uses the SA2-124 formula (above).
- EV parity: the layer mirrors the server's `resolveEvCashOut` (omitted EV cash-out → EV equals the actual result, diff 0), kept identical to what the server returns so nothing shifts when the mutation settles; whether a row *shows* an EV line is decided by the raw `evCashOut`, not these two (fallback semantics: [`statistics.md`](statistics.md)).

Invalidation contracts: the no-input `session.list` key **prefix-matches every filtered list variant**, so one invalidation covers all filter combinations. Editing an event must also invalidate `session.getById` / `session.list` — the live and recorded session ids are the same row, and without it the detail page keeps showing pre-edit numbers (SA2-167).
