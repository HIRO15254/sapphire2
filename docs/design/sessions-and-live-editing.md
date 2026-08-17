# Sessions & Live Editing

Design reference for the session domain: the event-sourced live-session model, event payload invariants, frozen rule snapshots, ownership contracts, the live reopen flow, P/L math (`chipRemoveTotal`), the web session wizard, the live-linked edit sheet, and the optimistic-update layer. EV semantics (recording gate, cash-out fallback, population rules) are owned by [`statistics.md`](statistics.md); D1 batching/atomicity mechanics by [`data-integrity.md`](data-integrity.md); game-master semantics (mix buckets, self-freezing labels) by [`game-masters.md`](game-masters.md); the generic filter-preset system by [`web-platform.md`](web-platform.md).

## The event-sourced session model

A live-recorded session is not a form submission — it is an event stream. The session row's derived columns (`startedAt`, `cashOut`, `placement`, buy-in, break minutes, P/L, …) are recalculated from the events by the server on every event write, so the columns and the events can never drift apart. **The live session id and the recorded session id are the same row**: `session.getById` / `session.list` render state recalculated from the same events the live scene edits (SA2-167).

### Session state machine

State is derived from the stream, never stored ([`packages/db/src/constants/session-event-types.ts`](../../packages/db/src/constants/session-event-types.ts), `getSessionCurrentState`):

- **completed** — a `session_end` exists.
- **paused** — the latest lifecycle/pause/resume event is `session_pause`.
- **active** — otherwise (`session_start` or `session_resume` is latest).

`isEventAllowedInState` checks which event types a session in a given state may accept; lifecycle events (`session_start`) are never manually created, so they are not checked there. The derived state comes from the **first** `session_start` and the **last** `session_end` — a reopened cash session carries more than one of each — and the web's [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) picks its lifecycle events by the same rule, matching `computeSessionStateFromEvents` on the server.

### Event time: `occurredAt` fallback and ordering

- When the caller omits a timestamp, `occurredAt` resolves to **`now`** — never to a fixed value like `sessionDate`, which would collapse every default-timestamped event onto a single instant ([`packages/api/src/utils/session-event-time.ts`](../../packages/api/src/utils/session-event-time.ts)). This regressed once: a `sessionDate` default stacked all default-timestamped events on the same timestamp.
- Events are read ordered by `(occurredAt, sortOrder, id)`. `session_resume` must sort **strictly after** `session_pause` so `computeSessionStateFromEvents` sees the pair in order and break-minute calculation can close the pause.
- The cross-field rule "exactly one session id" on event procedures is enforced at runtime via `validateExactlyOneSessionId`, not by the Zod schema — the schema accepts any combination.

### Minute-granularity time comparison (trap)

The server compares event times **by minute** (`floorToMinute` + `assertOccurredAtOrdering`). Every client-side bound check must do the same — [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) floors to the minute before comparing against neighbours, and "both editors landed on the same minute" is treated as nothing left to write. A client comparing at second granularity would accept edits the server rejects (or vice versa); keep the two in lockstep whenever either side's comparison changes.

## Event payload invariants

All payload schemas live in [`packages/db/src/constants/session-event-types.ts`](../../packages/db/src/constants/session-event-types.ts).

### Seat bounds (SA2-131)

Seats are 0-indexed. A 10-max table (the largest `tableSize` selectable in the ring-game / tournament / cash-game forms) uses seat positions 0–9, so the last valid seat is **9**. Every server-side `seatPosition` / `heroSeatPosition` bound derives from the single constant `MAX_SEAT_POSITION = 9`, so the client's `MAX_SEAT_COUNT` (10) and the server's validation can never drift apart again (SA2-131).

### `chips_add_remove`: signed amount

`amount` is a **signed** integer by design (a deliberate deviation from the `.int().min(0)` convention in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md)): positive = chips added (add-on / top-up), negative = chips removed (early cash-out). Zero is rejected so no-op events are never stored. The negative half feeds `chipRemoveTotal` (below).

### `all_in`: fractional wins and `wins <= trials` (SA2-156)

`wins` is the number of favorable all-in run-outs across `trials`, counted as a **fraction** when the pot is chopped (a split counts as a partial win). It is therefore a non-negative number — **not** necessarily an integer — that never exceeds `trials`. The object-level `wins <= trials` refine blocks the real bug: a payload like `{ potSize: 1000, trials: 1, wins: 5 }` used to validate and let the EV math compute a wins-share larger than the pot, corrupting `evCashOut` / `evDiff` (SA2-156).

The web mirrors this with a single shared `superRefine` in [`all-in-validation.ts`](../../apps/web/src/features/live-sessions/utils/all-in-validation.ts), attached by **both** the create sheet (`use-all-in-form`) and the timeline editor (`use-all-in-editor`) so the invariant cannot drift between them. Only the upper bound is enforced there; empty / non-numeric input is left to the field-level rule to avoid stacking a second confusing error on the same field.

### `purchase_chips`: denormalized rule snapshot

`sessionChipPurchaseId` links the event to the rule-defined chip purchase (a `session_chip_purchase` row). `name` / `cost` / `chips` are kept as a **denormalized snapshot** on the payload for display and P/L math even if the rule changes later. Web-side event editing carries the original link through and only changes the denormalized name/cost/chips and the time.

### `update_stack` and the average-stack formula

`update_stack` is shared between cash and tournament sessions. For tournaments the payload may optionally carry remaining players, total entries, and chip purchase counts, so a single event captures both the stack snapshot and tournament-progress metadata. `averageStack` is intentionally **derived on read**, never stored on the payload:

```
averageStack = (startingStack × totalEntries + chipTotal) / remainingPlayers
```

where `chipTotal` is the chips added by purchases. Storing it would let it drift from its inputs.

## Frozen rule snapshots (self-freezing sessions)

A session freezes its rule at creation. Snapshot fields on `session_cash_detail` / `session_tournament_detail` (plus `session_blind_level` and `session_chip_purchase` rows) are copied from the parent `ring_game` / `tournament` at session-create time and frozen thereafter — **parent rename / blind change / config change does not propagate** ([`session-cash-detail.ts`](../../packages/db/src/schema/session-cash-detail.ts), [`session-tournament-detail.ts`](../../packages/db/src/schema/session-tournament-detail.ts)).

### Create-time semantics

- On the create schemas, snapshot fields are written through to the detail row. When a parent id (`ringGameId` / `tournamentId`) is also provided they **override** the parent's values; when no master is referenced they **define the rule wholesale** — manual and wizard-driven sessions need no master row.
- `variant` on the cash create schema is **plain optional**, mirroring `tournamentCreateSchema.variant` — a schema-level default would coerce an omitted variant to a fixed string *before* it reaches `mergeCashSnapshotWithParent`, permanently defeating inheritance from the ring game (c10). The `"NL Hold'em"` fallback for the true no-parent case lives solely in `defaultCashSnapshot`.
- The live cash insert sets the variant fallback **explicitly** rather than relying on the column default (F5/c12), overridden by the ring-game snapshot's variant when one exists.
- Every chip purchase starts with a **result row at count 0** so the result table always has a row to update.

### Update semantics: null keeps, explicit arrays win

`session.update` (and the live-tournament equivalent):

- Snapshot field overrides are written to the detail row, **never propagated to the parent** master.
- When the parent link changes, the structure is **re-snapshotted from the new parent**, while explicit input fields still override the copied values.
- `null` for blind levels / chip purchases **keeps the existing snapshot** (frozen); explicit arrays (with result counts) **override** it. The explicit-array write runs **after** the re-snapshot, in the same batch, so the explicit arrays win when both apply.
- The session's `kind` is fixed: the update procedure keys off the persisted kind, so the edit form never switches a session's type.
- For live sessions, `session.update` **refuses every field derived from events** (times, cash-out, placement, buy-in, catalogs, blind structure) — those change only through event edits (see live-linked editing below).

Both `list` and `getById` go through one shared enriched SELECT (aliased fields + the cash / tournament snapshot scalars), so the detail page receives exactly the same shape as a list item — display logic and the edit-wizard's Rules-step pre-fill both rely on those aliases.

### `updateSnapshot` mutations

`liveCashGameSession.updateSnapshot` edits the session's frozen rule snapshot on `session_cash_detail`; the tournament variant edits scalar fields on `session_tournament_detail` plus optional **full-list replacements** of `session_blind_level` / `session_chip_purchase`. In both, the master `ring_game` / `tournament` row is **NEVER touched** — these mutations exist so the live-session edit dialog can override snapshot data for this session only. Chip-purchase counts are derived from `purchase_chips` events, so each chip purchase is (re)seeded with a count-0 result row and `recalculateTournamentSession` overwrites the counts on completion.

### Web-side snapshot reads

Display in the live scene must read snapshot fields from the detail row (`getById` returns them), so renames / blind edits on the master never propagate mid-session. The same isolation runs through the web layer:

- [`use-ring-game-scene-actions.ts`](../../apps/web/src/features/live-sessions/hooks/use-ring-game-scene-actions.ts) / [`use-tournament-scene-actions.ts`](../../apps/web/src/features/live-sessions/hooks/use-tournament-scene-actions.ts) write only to the session detail tables; per-session overrides do not leak back into the master template.
- The game-settings form is populated from the **session** snapshot; `tags` / `memo` / `currencyId` fall back to the master since they are not part of the rule snapshot.
- Chip purchase types come from the session-level snapshot ([`use-tournament-stack.ts`](../../apps/web/src/features/live-sessions/hooks/use-tournament-stack.ts)), so a live session keeps the add-on menu it was created with even if the parent tournament's rows are edited later; `id` is the `session_chip_purchase` id every `purchase_chips` event links to.
- Tournament structure values come from the snapshot tables and stay stable if the parent is renamed or its structure edited ([`use-session-tournament-structure.ts`](../../apps/web/src/features/live-sessions/hooks/use-session-tournament-structure.ts)); the edit wizard pre-fills from frozen levels / snapshot scalars.

Mix-game specifics: group keys in the live scene use the variants signature — the shared schema forbids a game appearing in two groups, so the signature is unique and stable. The compact stakes string composes `formatBlindParts` + `formatAnteSuffix` so mix-group rendering can never drift from flat-blinds rendering (c15): same slot handling (no leading slash for a blind3-only group) and the same `anteType` rules (`"none"` shows no suffix even when a stale ante amount is stored — c57). `null` and `undefined` both mean "no explicit ante type" (level groups omit it; a mix group only ever stores `"none"`/`"all"`/`"bb"`) and default to showing the stored ante — matching [`snapshot-diff.ts`](../../apps/web/src/features/live-sessions/utils/snapshot-diff.ts), which normalizes `null` ≈ `undefined` and would otherwise count an ante the string silently dropped. Hidden ante amounts must not influence the compact-number tier used by the visible blinds (1/2 must not become 0k/0k). The structural "group" type in [`game-scene-formatters.ts`](../../apps/web/src/features/live-sessions/utils/game-scene-formatters.ts) is defined locally rather than imported from a zod schema — the game-group schema lands in a later phase, and the structural shape is designed to match it once it exists (reconcile when that phase lands). Named-mix label semantics (self-freezing snapshots surviving master rename/delete) are owned by [`game-masters.md`](game-masters.md).

## Ownership contracts

The blanket rules (object-level authorization, scoped bulk WHEREs) live in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md); this section records the session-domain guard inventory and its whys.

- **Uniform FORBIDDEN (SA2-183)** — `validateEntityOwnership` in [`session.ts`](../../packages/api/src/routers/session.ts) fetches by id only, then treats "missing" and "owned by someone else" **identically**. Shared by the game-group / game-variant / game-mix routers, which previously hand-rolled the exact same check three times (c39); each entity type's check is factored into its own `validate*OwnershipBranch` helper so the dispatcher stays simple.
- **Filter ownership (SA2-183)** — `validateSessionFilterOwnership` validates every optional foreign-key filter at the resolver boundary. A missing or foreign row must fail uniformly **before** an otherwise owner-scoped query can turn it into an empty result.
- **Live-link ownership (SA2-102)** — `validateLiveLinkOwnership` guards the room / currency links shared by the live cash-game and live-tournament routers. A falsy value (`undefined` = omitted, `null` = clear, `""` = empty) skips validation; a provided id must exist AND belong to the caller, else FORBIDDEN. Prevents IDOR on the money-ledger links.
- **Tag-set ownership (SA2-177)** — `validateTagsOwnership` is generic over any tag table exposing `id` + `userId` (session_tag, player_tag, tournament_tag, …). It selects the caller-owned subset in a single `WHERE id IN (…) AND userId = caller` query; if the distinct owned count differs from the requested distinct count, at least one id is missing or foreign → FORBIDDEN. No-ops on empty / omitted ids so callers can pass `input.tagIds` directly. Foreign player tags are rejected before a player is created.
- **Ring game (SA2-174 / SA2-181)** — a ring game carries its **own `userId`** (SA2-181), so ownership is a direct comparison, no longer derived from the room. A `null` userId is a legacy/orphan row that cannot be proven owned → FORBIDDEN. This supersedes the room-join and keeps null-`roomId` auto-generated snapshot rows correctly owned after the backfill, closing the IDOR gap (SA2-174/SA2-181). Auto-generated snapshot rows anchor ownership on the creating user, since they have no room to derive it from. The live cash router re-checks `ring_game.userId` inside its own queries as defense-in-depth, mirroring the caller's pre-check and keeping the ownership model unified. Ring-game ownership is verified **before any `ring_game` read**, so a caller cannot probe another user's config via the buy-in bounds (SA2-174). (The DB-side nullability trade-off of `ring_game.userId` is covered in [`data-integrity.md`](data-integrity.md).)
- **Tournament** — a tournament has no `userId` of its own; ownership is derived from its room. Without the check a caller could pass another user's `tournamentId` to snapshot their blind structure / chip purchases (IDOR); ownership is validated **before** `snapshotTournamentStructure` reads anything.
- **Transaction type (SA2-179)** — `validateTransactionTypeOwnership` verifies the referenced transaction type belongs to the caller before it is linked to a transaction; without it a caller could attach another user's transaction-type id to their own transaction (read-IDOR). Mirrors the currency-ownership check in create / update.
- **Write-IDOR row scoping (SA2-176 / SA2-123)** — bulk / by-id writes bind both `id` AND `user_id` (or scope to the owned parent) so a foreign id matches nothing; mandated and detailed by [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md).

## Session lifecycle: completion, reopen, deletion

### Live reopen flow (SA2-211)

`persistCashSessionReopenEvents` atomically re-opens a completed live cash session: it **deletes the `session_end` event** and re-stamps the closing stack as an `update_stack` plus a `session_pause`/`session_resume` pair. Event replacement, reopening the session row, and removing the completed session's currency-ledger entry share **one `db.batch`**, so a conflict or write failure rolls back the entire reopen (SA2-116, SA2-211 — batch-atomicity mechanics in [`data-integrity.md`](data-integrity.md)).

The replacement events are inserted at **contiguous sortOrders** (the deleted end's order, +1, +2) so the pause/resume pair sorts after the re-stamped end state — this is the "fixed sort-order ranges only within one atomic replacement batch" case of [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md). The pause→resume ordering matters because break-minute calculation closes a pause only when the resume sorts strictly after it.

Web-side contract after completion: `useActiveSession` queries for `status=active` and returns nothing once the session completes, so the active-session page shows the no-session state; the user navigates to Sessions to find and **reopen** the completed session from there. When both kinds could match, `useActiveSession` returns the cash game first (`activeCash` takes priority) — tests must model that contract.

### Deletion

Deleting a session also unwinds its linked currency transaction server-side — the confirmation copy stays explicit about permanence because the ledger entry disappears with it.

## Seated players: event-sourced seating and stints

Seated players are **no longer stored in a table** — every read folds the `player_join` / `player_leave` event stream ([`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts)):

- Only events carrying a `playerId` are folded; the hero's own seat has no `playerId` and is derived separately by `computeHeroSeatPositionFromEvents`.
- The same player may join and leave repeatedly within one session. Each `player_join` opens a new **stint** (one uninterrupted period at the table); each `player_leave` closes the latest open one — a `player_leave` with no open stint (no join, or already left) is a no-op.
- Every player appears exactly once in the result, with the full in/out history preserved on `stints` (oldest first). The top-level `isActive` / `seatPosition` / `joinedAt` / `leftAt` reflect the most recent stint — the player's current state.
- Input events must already be ordered by `(occurredAt, sortOrder, id)`.
- The seat lives on the player's **most recent `player_join` event**; patching that event keeps the seat fully event-sourced.

## P/L and `chipRemoveTotal` (SA2-124)

**The cash P/L formula is `cashOut + chipRemoveTotal − totalBuyIn`, and it must stay identical at every site that computes it.** Chips racked off the table mid-session are already-pocketed value, not a loss: removing 100 in chips mid-session and cashing out 600 at the table nets the same 200 profit as never removing anything and cashing out 700. The chip-remove-blind formula `cashOut − buyIn` undercounts by exactly the removed chips.

- `session_cash_detail.chipRemoveTotal` is the Σ of chips racked off (the positive amount of every negative `chips_add_remove` event), **persisted separately from `cashOut`** so completed-session P/L (list / detail / stats) can add it back in.
- The four formula sites that must never drift (SA2-124):
  1. Server: [`packages/api/src/services/live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts) (also surfaces `chipRemoveTotal` so the live header can mirror the chart).
  2. Chart: [`session-timeline.ts`](../../apps/web/src/features/live-sessions/utils/session-timeline.ts).
  3. Optimistic layer: [`optimistic-session-event.ts`](../../apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) (`session_end`: `cashOutAmount` drives `profitLoss` via the same formula).
  4. Live header: [`use-cash-game-compact-summary.ts`](../../apps/web/src/features/live-sessions/pages/active-session-page/cash-game-compact-summary/use-cash-game-compact-summary.ts) (`stack + chipRemoveTotal − totalBuyIn`).
- Recalculation runs on **every** event write, so editing an unrelated field of a live-sourced session (e.g. its memo) must not regress the currency ledger to the chip-remove-blind value.
- The same figure is folded into the fallback EV so `evDiff` stays isolated to all-in equity — EV semantics, including `resolveEvCashOut`'s fallback and every EV gate, are owned by [`statistics.md`](statistics.md).

## Chip purchases and result sync

- `session_chip_purchase_result` stores how many times each rule-defined chip purchase was bought: one row per `session_chip_purchase`, so `sessionChipPurchaseId` doubles as the **primary key**. Cost is derived on read from the linked `session_chip_purchase.cost`, never duplicated.
- On recalculation the event-derived purchase counts are written onto the result table; **every** `session_chip_purchase` gets a row (count 0 when never bought), via an **upsert** so it is safe even when a result row was never seeded. The writes are chunked and batched under D1's bind-parameter cap so a failed upsert cannot leave a partially refreshed result set — cap math and batch semantics in [`data-integrity.md`](data-integrity.md).
- In the wizard, chip-purchase **counts** are recorded per rule-defined chip purchase (defined in the Rules step); cost is derived from the rule, never entered free-form in the Result step. `count` is deliberately kept out of the shared `ChipPurchaseRow` type because that type is shared with the Rooms tournament form, where a result count is meaningless.
- The shared [`chip-purchases-editor`](../../apps/web/src/shared/components/chip-purchases-editor/chip-purchases-editor.tsx) (Rooms tournament form + session wizard Rules step) is controlled: each row carries a stable `uid` so React keys survive edits, and numeric cells stay strings (parsed by the consuming form/schema) per the `inputMode="numeric"` convention.

## Session timeline chart

[`session-timeline.ts`](../../apps/web/src/features/live-sessions/utils/session-timeline.ts) plots only stack records; everything else feeds running state:

- Buy-in-affecting events are not stack records: they only update the running basis, reflected at the next `update_stack` / `session_end` point.
- All-ins only accumulate `evDiff`, reflected at the next stack point.
- **Tournament start counts as recording a stack equal to the starting stack**, so the curve begins there rather than at zero.
- Chip purchases fold their chips into the running stack but are not plotted as points.
- The starting stack is taken from the first `update_stack` because the create flow logs one first — [`use-create-session.ts`](../../apps/web/src/features/live-sessions/hooks/use-create-session.ts) creates an initial `update_stack` with the starting stack. These two are coupled; changing the create flow breaks the chart's opening point.

Related timer contract: **zero-minute blind rows are accepted** by the persisted structure schema — they represent a skipped placeholder, not an indeterminate duration, so the tournament timer advances over them instead of pinning.

## Live-linked session editing

The sync layer between the session edit form and the live event history lives in [`live-linked-edit.ts`](../../apps/web/src/features/sessions/utils/live-linked-edit.ts) and its page hook [`use-live-linked-session-edit.ts`](../../apps/web/src/features/sessions/pages/session-detail-page/use-live-linked-session-edit.ts).

### What is editable: the field → event map

A live-recorded session keeps every derived column recalculated from its events, so most of the edit form is read-only. The fields below are the exception: each is determined by exactly one value of exactly one event, so editing the field can be expressed as an edit of that event. Everything aggregated over several events (cash buy-in, EV cash-out, break minutes, chip-purchase counts) stays read-only — there is no single event to write it back to. `sessionDate` is never editable either (see below).

| Form field                                   | Event         | Value                  |
|----------------------------------------------|---------------|------------------------|
| `startTime`                                  | session_start | `occurredAt` (time)    |
| `endTime`                                    | session_end   | `occurredAt` (time)    |
| `cashOut`                                    | session_end   | `payload.cashOutAmount`|
| `beforeDeadline` / `placement` / `totalEntries` / `prizeMoney` / `bountyPrizes` | session_end | `payload` |

Because `session.update` refuses every event-derived field, these are written through `sessionEvent.update` instead — the server revalidates the payload, enforces the neighbour-ordering rule, and recalculates the session, so the session columns and the events can never disagree. On the server side, `sessionEvent.update` **replaces the payload wholesale** (both shapes are flat records of primitives), so an unchanged payload is simply not sent. Rules-step catalogs and the blind structure are likewise event-derived for live sessions and rejected by `session.update`; the form disables them (a disabled fieldset natively disables every control inside, a no-op when not live-linked).

### The locked date and the day-stretch hazard

Both times are edited **within their own event's calendar day**, never recombined with the form's single `sessionDate` — which is why the date input itself is locked. Moving a lifecycle event to another day leaves every other event where it is, so the session silently stretches: a start dragged one day back once turned a 5-hour session into a **29-hour** one, with the phantom play time feeding the statistics. Expressing a day move would mean moving the whole event stream, which is not a single-event edit — and the Events-section editors cannot do it either. A stale submitted date value must never move an event.

Each edit is therefore **time-only, anchored to the event's own calendar day** — the same semantics as the Events-section editors, and the reason a session spanning more than a day survives an edit.

### Day hints (SA2-145)

The Result step shows a single date plus two clock times, and they can disagree in two ways: the session crossed midnight, so the end sits on the next day; or the displayed date itself is off, because a live session's `sessionDate` is the start *timestamp* rendered with UTC getters (SA2-145's date-only rule) while the times are rendered locally — for JST that is every session starting between 00:00 and 09:00 local. Editing "02:00" without knowing which day it lands on silently stretches the session, so each time field spells its actual calendar day out (a hint rendered only when it differs from the form's date, `null` when they agree).

### Required and disabled field sets (SA2-113)

Two disjoint sets govern the result fields for a live session:

- **Disabled** — fields whose backing event does not exist yet (no `session_end` while the session is running) or has not loaded. The form never offers an edit the server would reject.
- **Required** — fields whose backing event **exists**: the payload requires a value, so a blank is either an outright rejection or — worse — a silent 0 (SA2-113). The shared schema marks these optional for manual sessions, hence the separate live-only set. A field is required exactly when its backing event exists, so the two sets never overlap; cash `cashOut` is absent from the live-required set because the shared schema already requires it.

On submit, values are compared 0-normalized so an untouched blank on a bounty-less session is a no-op, but a *cleared* non-zero value stays `undefined` and is **rejected** instead of silently saving 0 — a blank saved as 0 silently corrupts P/L (SA2-113).

### Seed snapshot vs. current events (two editors in one sheet)

The edit sheet embeds the Events section, which edits the same events live. The form is diffed against **`seedEvents`** — the events as they were when the sheet opened — not against the refreshed events: an untouched form field diffed against current events would make the save undo whatever the user just changed in the Events section. Per key, the merge is last-write-wins between the form and the Events section: a key the form left at its seeded value keeps whatever the event holds now, so editing the prize in the Events section and the placement in the form keeps both. The actual writes go against the **current** events (which may have moved on); `seedEvents` defaults to `events` for callers that cannot race with a second editor.

`FormSheet` unmounts its content on close, so the form re-seeds exactly when the snapshot is cleared. The date input is seeded from `session.sessionDate` at the same moment and never reset either, so the day hints must compare against the **frozen** value — an Events-side start-time edit can change the session's UTC calendar day while the form keeps showing the old one.

### Building and applying the edits

- **Bounds**: an event's new time must respect its neighbours, read by position — substituting the other lifecycle event's *pending* time when it is the neighbour, otherwise moving start and end together would be rejected against a time that is about to change.
- **Order**: edits are returned in the order they must be applied — when the end moves later it goes first, so a start moving past the end's *old* time is never rejected by the server's neighbour check (and vice versa). Validation errors abort the submit before anything is written.
- **Application**: the page hook applies the edits **sequentially on purpose** — each one satisfies the server's neighbour-ordering check against the state the previous one left behind. A rejected edit keeps the sheet open so the user can correct it; the failed step is the only one not applied, because the server recalculates the session after every event write. The shared mutation cache already toasts the server message; the catch only stops the remaining edits.
- **Query wiring**: for a live session the events query subscribes from the moment the detail page renders, not when the sheet opens. That costs nothing — the page's Timeline card already renders `SessionEventsScene` with the same query key, so react-query serves both from one request — and having the events in hand means the result fields are editable the instant the sheet opens instead of sitting disabled for a round trip. (An empty id keeps the query disabled for manual sessions.)

### Event-editor quirk (pinned)

In the session-events formatters, when the event-id lookup's `findIndex` returns −1, `index < events.length - 1` is still true and the function returns `events[0]` as `maxTime`. The behavior is pinned by test; callers must pre-check presence of the id.

## Session display contract

[`session-display.ts`](../../apps/web/src/features/sessions/utils/session-display.ts) is the single read-path for what a session shows:

- **EV line**: whether a row shows an EV figure is decided in exactly one function (`displayableEvProfitLoss`), read by the list card, the detail hero, and the share text, so the three surfaces cannot disagree. The gate's semantics (raw `evCashOut` vs. the `resolveEvCashOut` fallback, and its deliberate contrast with the statistics summary's all-or-nothing scope gate) are owned by [`statistics.md`](statistics.md).
- **EV precision**: realized P&L is always whole chips, but EV can be fractional (live all-in equity), so the EV value is rounded to the nearest integer before formatting — keeping the EV's displayed precision aligned with the P&L's in the card. In BB/BI mode both figures already share a fixed decimal count.
- **Backward-compat tolerance**: `session.list` consumers must tolerate `undefined` for tournament blind structure and frozen mix-game groups — a response from an older API build, or a cached pre-migration entry, can omit them. CTI fields are always present since the Phase 1 DB migration. (The general cache-rehydration/buster strategy is SA2-154, [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md).)

## Session wizard and form state

[`use-session-form-state.ts`](../../apps/web/src/features/sessions/components/session-wizard/use-session-form-state.ts) drives both the manual wizard and the live "Start Live Session" form.

### Live vs. manual schema split

A live session is created before it ends, so the result-only `cashOut` is unknown and the live form never renders it. Keeping the shared `cashOut` requirement made ✓ Confirm silently fail: the empty field always failed validation and the error routed to a "result" step the single-screen live form doesn't render. The live cash schema therefore drops `cashOut` (the initial buy-in stays required), and live mode drops the Result step entirely.

The live form also relies on **progressive disclosure**: rule overrides stay collapsed by default. A failed submit whose invalid field lives in the rules section (e.g. a tournament with no buy-in) would route the wizard's `currentStep` to `"rules"` — the single-screen live form has no step nav, so it reveals the collapsed section instead; otherwise ✓ Confirm looks like it does nothing. Field mapping into the live mutation: the Rules step's `buyIn` doubles as the live session's initial buy-in (`cashOut` is irrelevant at start), and `startingStack` is required by the live mutation, exposed via the tournament snapshot scalar.

### Required fields and placement bounds

- `requiredFields` lists what this particular form must not leave blank **on top of** the shared schema: a live-recorded session writes several result fields back to a single event, so a blank is rejected there while the same field stays optional for a manual session. The mark and the validator have to agree ([`.claude/rules/web-forms.md`](../../.claude/rules/web-forms.md) #6), and the error must land on the field, not in a submit-time toast.
- The step-schema wrapper reports the caller's extra required fields as field-level issues; `placement <= totalEntries` rides along because it is the server's own refine (SA2-161) and only applies where placement is required. The pair is neither rendered nor written once the session ended before registration close (`beforeDeadline` discriminates the result kind — categorical, not a rule).
- A blank side has no bound to compare against, and `Number("")` is 0 — which would report every filled placement as out of range on top of the real `Required` issue, lighting up two fields for one mistake. Cross-field bounds therefore skip blank sides.

### Rule vs. result taxonomy

Phase B (Rules) holds what describes the master rule — cost of entry (`buyIn` / `entryFee`) and the linked currency. Phase C (Result) holds session-level outcomes — `prizeMoney` / `placement` / rebuy / add-on / bounty counts.

### Mix-editor state machine (c02–c05, c31)

The tournament scope and variant controls share one path:

- Entering per-level mode keeps its game assignments, while every all-levels value **clears** them so hidden per-level games cannot leak into the snapshot.
- Picking a mix master reseeds the cash mix editor from its saved composition (overwriting whatever was there — switching mixes starts fresh); the legacy `"mix"` mode key has no composition, so existing rows are kept.
- Entering a mix clears the flat blind/ante fields so a later switch-back starts clean (c04) — a mix submit carries its amounts inside `mixGames`, and the flat fields must go out empty, not with stale pre-switch values.
- Leaving mixes clears the editor rows so they stay the single submit-time authority (c02). Gates read the **editor state, never a live master lookup**: a deleted or renamed mix master must not wipe the frozen snapshot on an unrelated edit (c02/c02b).
- A variant whose group has no third slot drops the stale `blind3` (c03) — belt-and-braces, since `onVariantChange` also clears the field.
- The one-shot initializer can run before the master lists load, resolving against the pending fallback with no real group identity; once loading settles the state is re-derived from the stored snapshot — but only while the user hasn't touched the mix editor, so the upgrade can never clobber their edits (c05). Every interactive write to the rows marks the editor touched so the reseed stands down.
- The mix cells live outside the flat form schema; the submit is blocked at the wrapper so invalid text is never coerced to `null` by the serializer — the editor cells already display the error (c31).

### Geolocation defaults and room location (SA2-100)

- `room.latitude` / `room.longitude` exist to default-select the nearest room when starting a live session. Nullable on purpose: existing/unset rooms have no location, and **(0, 0) is a valid coordinate** so it cannot mean "unset".
- The "you are at this venue" radius is **500 m** — comfortably covers a casino / poker-room footprint plus GPS jitter without matching a different venue across town.
- The suggested room is applied only while the user hasn't picked one — it seeds via an effect (it resolves asynchronously, so `defaultValues` can't carry it), a manual choice or explicit clear always wins, and a later suggestion never yanks the current selection.
- When the chosen room has no saved coordinates, the app offers to stamp the device's current location onto it (SA2-100): the pending session starter and target room are held while the confirmation prompt is open; "Not now" starts the session without saving; the save itself is fire-and-forget so the session start stays snappy, with a failure toast so a persistently failing save isn't silently swallowed.

## Active session scene (SA2-59) and the render-time reset (SA2-171)

The active-session page is a single-page scene (SA2-59): a display-only status summary on top, the lightweight seated-player list, and the collapsed event history. All event recording is consolidated into the "+" menu on the bottom-nav center button; lifecycle actions live in the header overflow menu. The seat list is speed-first: every seat from the game definition is a row; notes and tags are readable with zero taps (memo excerpt on the row), leaving is one tap, empty seats carry an always-on search/seat combobox inline, and an occupied row expands in place — never through a modal. The event history is collapsed by default and replaces the dedicated timeline route; the events scene (with its edit/delete flows) only mounts while expanded, so the page doesn't pay for 3-second polling nobody is looking at.

**SA2-171 — the render-time reset pattern.** The `SessionFormProvider` is mounted once at app-shell scope. Without keying its state to the active session id, its state would survive across sessions and prefill the next session's Record Stack sheet with the previous one's values — and carry a finished tournament's `chipPurchaseCounts` into the next `update_stack` payload, corrupting the average-stack calculation (SA2-171). The shell ([`use-authenticated-shell.ts`](../../apps/web/src/shared/components/authenticated-shell/use-authenticated-shell.ts)) exposes the active session id for exactly this; [`use-session-form.tsx`](../../apps/web/src/features/live-sessions/hooks/use-session-form.tsx) resets every cash + tournament field whenever it changes, **including when it clears to null** (session finished / discarded). The reset happens by adjusting state **during render** — React's recommended "reset on prop change" pattern — because it avoids the extra effect pass (and stale-value flash) of a `useEffect`, and it keeps children mounted (a `key` on the provider would remount the whole app shell).

## Optimistic updates (SA2-162 family)

The mandated helper API and its pitfalls are in [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md); [`optimistic-update.ts`](../../apps/web/src/utils/optimistic-update.ts) design intent beyond the rule:

- Every list/entity updater **no-ops when the cache is empty or unfetched** — it never fabricates an entity or page out of nothing; the mutation's `onSettled` invalidate populates the cache instead. `updateQueryItems` has one deliberate escape hatch: `fallbackItems` supplies the optimistic list to create.
- The infinite-query updaters preserve the page envelope (`nextCursor`, `pageParams`, …) and touch only `page.items`; the optimistic change lives in the cache and survives the next refetch, unlike an in-memory list that gets wiped. `prependInfiniteQueryItem` targets create flows whose new row sorts to the top.
- `updateQueryEntity`'s `patch` may be a **function of the current entity** for patches whose new fields depend on the previous value; pair with `snapshotQuery` + `restoreSnapshots` for rollback.
- `updateQueryData` covers cache shapes that are neither a plain array nor shallow-patchable (the updater receives `undefined` for an unfetched entry so the caller can intentionally construct data); `updateQueriesData` fans one updater out across every matching key after `snapshotQueries`.

### The optimistic-session-event flow

[`optimistic-session-event.ts`](../../apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) is the sanctioned feature-level wrapper for the event timeline. Its server-coupling contracts:

- `chips_add_remove` affects `totalBuyIn` **server-side**, so the optimistic layer skips the stack update rather than guessing. `memo`, `session_pause`, `session_resume`, `purchase_chips`, `player_join`, `player_leave` have no summary fields to update optimistically.
- `session_end` P/L uses the SA2-124 formula (see above).
- Pinned quirk: `session_end` applies the cash-out branch (if `cashOutAmount` present) AND the tournament branch (if `beforeDeadline === false`) independently — a hybrid payload overwrites `profitLoss` twice.
- EV parity: the optimistic layer mirrors the server's `resolveEvCashOut` — an omitted EV cash-out means EV equals the actual result and the EV difference is 0 — and is kept identical to what the server will return so nothing shifts when the mutation settles. Whether a row *shows* an EV line is decided by the raw `evCashOut`, not these two. (Fallback semantics: [`statistics.md`](statistics.md).)

### Invalidation contracts

- The no-input `session.list` query key **prefix-matches every filtered list variant** — one invalidation covers all filter combinations ([`use-session-detail.ts`](../../apps/web/src/features/sessions/hooks/use-session-detail.ts), [`use-session-events.ts`](../../apps/web/src/features/live-sessions/hooks/use-session-events.ts)).
- Editing an event must also invalidate `session.getById` / `session.list`: the recorded session renders state the server recalculates from the events (start/end, buy-in, cash-out, placement, P/L), and the live session id and recorded session id are the same row — without it the detail page keeps showing pre-edit numbers (SA2-167).

## Sessions list: ordering, filters, presets

- **List order**: sessions are ordered by the moment they actually started, not by the date-only `sessionDate` — with no time component, same-day sessions used to tie-break on `id` (a random UUID) and came out in a seemingly arbitrary order. `startedAt` is optional (older / quick-add sessions may lack one), so `sessionOrderKeySql` falls back to `sessionDate`.
- **Period filter**: the sessions list reuses the shared Period domain (preset windows + custom range) so its filter header behaves identically to statistics (SA2-74) — preset windows snap to UTC day boundaries; `custom` passes the from/to bounds straight through. Period-domain details: [`statistics.md`](statistics.md).
- **Preset payload (sessions-screen specifics)** — the generic preset system (payload union, scoping, storage) is owned by [`web-platform.md`](web-platform.md); what is session-specific:
  - A sessions preset stores the filter values **plus** the Display (BB/BI) mode. Display is not a `SessionFilterValues` key — it is a page-level boolean that changes how amounts are rendered, not what the list queries — so joining and splitting it needs an explicit helper pair in [`session-filters-helpers.ts`](../../apps/web/src/features/sessions/utils/session-filters-helpers.ts). Without them, saving "Cash / Room X / BB view" restored the filters but silently dropped the view (review finding 7). **Every apply path — the default-preset auto-apply in `use-sessions-page.ts` and the manual apply in `use-session-filter-bar.ts` — must go through these two helpers, never an inline join/split**, or the paths drift apart.
  - The split strips `display` from the filter half on purpose: `patch`'s `{ ...filters, ...next }` spread would otherwise carry it along forever and re-save it into every later preset. A returned `display` of `undefined` means "this preset has no opinion" — presets saved before the field existed omit it, and the caller must leave the current view alone rather than resetting it.
  - `period` is only a bounded string in the shared db schema (packages/db cannot import the fuller `Period` vocabulary), so a structural assignment does not narrow; the cast is safe because sessions presets are only ever written from this screen's own `SESSION_PERIODS`.
- **The "untouched" verdict for default-preset auto-apply**: "untouched" must mean "no field holds a real value", not "the object has no keys" — the filter bar's `patch` helper spreads `{ ...filters, ...next }` and several handlers deliberately write `undefined` (Type → "All", Room / Currency → cleared), so those keys linger forever; counting keys made a single cleared chip look like an active filter and silently suppressed the default preset (review finding 1). The Display chip is part of the same verdict even though `bbBiMode` is not a `filters` key: a user who picks BB/BI before the presets query resolves would otherwise still count as pristine and have their view silently overwritten. The auto-apply's own write uses a raw setter so it does not mark the Display control touched (the hook would be flagging itself); every external write is an explicit view choice and records the touch even when the value is unchanged (review finding 3). The default-preset hook latches on the first **successful** answer, not on `!isLoading` — an exhausted query stops loading without ever answering and must not spend the one-shot attempt.
