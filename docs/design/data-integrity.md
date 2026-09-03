# D1 / SQLite Data Integrity

Why writes against Cloudflare D1 are shaped the way they are: the 100-bound-parameter cap and chunk math, the `db.batch()` atomicity contract and its statement-ordering rules, keyset pagination cursors, N+1 collapse on list endpoints, TOCTOU backstops and unique-constraint error shapes, write==read schema identity, and the UTC round-trip rules. The enforceable imperatives live in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md) (and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) for dates); this doc holds the mechanics and the incident history behind them.

## The 100-bound-parameter cap and chunking (SA2-115)

D1 rejects any single statement binding more than 100 parameters. A multi-row `INSERT` binds `columnsPerRow × rowCount` parameters, so a large batch — e.g. a 14-level blind structure at 10 columns = 140 params — overflows a single statement and fails at runtime.

The cap constant `D1_MAX_BOUND_PARAMS` and `chunkForInsert` live in [`packages/api/src/lib/batch.ts`](../../packages/api/src/lib/batch.ts), not in the session router, so a `services/` module can size its own `IN (…)` list against the same number without importing from a router — importing the other way would close an import cycle (`routers/session.ts` already imports `services/game-mix.ts`). The helper has exactly one implementation, shared by [`session.ts`](../../packages/api/src/routers/session.ts) (which re-exports it) and [`packages/api/src/services/seed-game-data.ts`](../../packages/api/src/services/seed-game-data.ts) (c40).

### The `session_blind_level` 10 × 10 = 100 coupling

`session_blind_level` is at exactly **10 columns → 10 rows per INSERT (10 × 10 = 100)**. The `games` column took it from 9 to 10 columns; at 10 columns the safe max is **floor(100 / 10) = 10 rows/INSERT**, which leaves **zero headroom**: adding an 11th column requires dropping the chunk size to 9, or the re-INSERT overflows.

The failure mode is what makes this the most dangerous coupling in the schema: the blind-structure writes are DELETE-then-reINSERT, so a single unchunked INSERT of ≥11 levels (≥110 params) throws at runtime **after the DELETE has already committed**, permanently wiping the session's blind structure (SA2-115). Deriving the width from the row shape (`Object.keys(rows[0]).length`, per the rule file) is what keeps a future column from silently reintroducing the overflow.

Paths governed by this cap:

| Path | Shape |
|---|---|
| `persistSessionBlindLevels` / `buildTournamentStructureStatements` in [`session.ts`](../../packages/api/src/routers/session.ts) | 10-column blind rows, 10 rows/INSERT |
| `updateSnapshot` in [`live-tournament-session.ts`](../../packages/api/src/routers/live-tournament-session.ts) | same blind-row re-seed via the shared helper |
| chip-purchase result upsert in [`live-session-pl.ts`](../../packages/api/src/services/live-session-pl.ts) | 2 params per result row, all chunks in one batch |
| `selectInChunks` callers (event / chip-purchase / blind-level maps) | 1 param per id — see below |

### Chunked `IN (…)` selects

A one-column `IN` binds one param per id, so a batched lookup across more than 100 sessions overflows exactly like a wide multi-row INSERT — 101 session ids in a single `inArray` binds 101 params, which is the outage the SA2 chip-purchase batched lookup hit. `selectInChunks` (in session.ts) reuses `chunkForInsert` with a single "column". Rows from every chunk are concatenated in chunk order; callers bucket by id afterward, and because each id lands in exactly one chunk, per-id ordering (`sortOrder` / `level`) survives the concatenation.

## `db.batch()` atomicity (SA2-116)

The repo-wide contract: **every multi-statement write in the api package commits through a single `db.batch([...])`**, so a mid-sequence failure can no longer leave a DELETE committed with its re-INSERT missing (permanent data loss) or a parent row committed without its children (orphan). Sequential awaited statements auto-commit one by one — that is the root cause of the headline data-loss bug: `tournament.updateWithLevels` ran a bare DELETE followed by a separate `Promise.all(insert…)` as independent auto-commits, so a failed re-INSERT could permanently wipe the tags / chip purchases / blind structure.

`runBatch` in [`packages/api/src/lib/batch.ts`](../../packages/api/src/lib/batch.ts) is the funnel: D1's `db.batch` requires a non-empty tuple, so an empty statement array is treated as a no-op. Every caller builds its statements first, then hands the whole group to a single `batch`. [`packages/api/src/__tests__/db-batch-atomicity.test.ts`](../../packages/api/src/__tests__/db-batch-atomicity.test.ts) drives the real helpers against a descriptor-recording mock db and asserts the statements land together in one batch call.

Writes governed by the contract (all in [`session.ts`](../../packages/api/src/routers/session.ts) unless noted):

| Write | Batch shape |
|---|---|
| Chip purchases + result counts (`create`/`update`) | DELETE leads; the `session_chip_purchase` delete cascades to old result rows, so only the inserts are added; counts are written against the freshly generated purchase ids |
| Blind-structure re-seed | DELETE leads so the whole re-seed commits or rolls back as one unit |
| Currency-ledger sync (`syncCurrencyTransaction`) | stale ledger DELETE + re-INSERT for the new currency in a single batch |
| Ledger create (`buildCurrencyTransactionStatements`) | returns only ledger statements so parent/session/tag writes stay atomic; the persistent transaction-type master is ensured **before** the batch |
| Tournament structure copy (`buildTournamentStructureStatements`) | returns the statement list **un-executed** so callers commit it alongside any preceding DELETEs |
| Structure re-snapshot (`resnapshotTournamentStructure`) | both DELETEs and the re-copied structure in one batch — a failed re-snapshot can no longer leave the old structure wiped with nothing written back |
| `session.create` | session row, type detail, tag links, and currency-ledger row land together |
| `session.update` tag replacement | DELETE + re-INSERT batched (the create path's shape) |
| `tournament.createWithLevels` / `updateWithLevels` ([`tournament.ts`](../../packages/api/src/routers/tournament.ts)) | tournament row/UPDATE first, then each clear-and-reseed group |
| Cash-session reopen events | fixed contiguous sort-orders, allowed only because the replacement is one batch — see [`sessions-and-live-editing.md`](sessions-and-live-editing.md) |

### Batch composition rules

The ordering inside a batch is load-bearing, not stylistic:

- **The DELETE leads the group.** "Clear then re-seed" must run as one atomic unit; a DELETE that commits separately can strand the table empty on a later failure.
- **The parent row precedes child rows**, so FK checks pass inside the transaction.
- **Ensure-persistent-master runs outside (before) the batch.** The shared transaction-type ensure commits first; the accepted consequence is that an unused master may remain when the parent batch fails — an orphan master is harmless, an orphan session is not.
- **Validate every link and tag ownership before any write** (`session.create`), so the batch never starts if it cannot finish.
- **Single-statement branches are deliberately unbatched** — clearing a currency is a lone DELETE, an amount refresh on the same currency is a lone UPDATE; a one-statement batch adds nothing.
- **A pure copy never deletes** (`snapshotTournamentStructure`): only replacement flows carry a DELETE.

### FK-checked upserts as concurrency guards

The live-session create paths use an upsert (rather than select-then-update/insert) precisely to keep an FK-checked session-detail write **inside** the batch: if the live session disappears between the authorization read and the write (a concurrent deletion), the FK violation rolls the master insert back instead of committing an orphan ring game / tournament ([`live-cash-game-session.ts`](../../packages/api/src/routers/live-cash-game-session.ts), [`live-tournament-session.ts`](../../packages/api/src/routers/live-tournament-session.ts)).

## Keyset pagination cursors (SA2-150)

The session list orders by `sessionOrderKey DESC, id DESC`, so paginating on `id` alone is wrong — id order (random UUIDs) is unrelated to that order, which made the second page drop or duplicate rows and stop early ("Load more" only worked once). The cursor therefore encodes both the order key (epoch ms) and the id as `"<ms>_<id>"` (`encodeSessionCursor` in [`session.ts`](../../packages/api/src/routers/session.ts)).

The SA2-150 regression defined the two invariants every cursor implementation here follows:

- **The boundary is derived purely from the cursor value — never a subquery on the raw cursor id.** The old keyset ran `SELECT started_at FROM game_session WHERE id = cursor`; once the cursor row was deleted, that subquery returned `NULL`, `started_at < NULL` matched nothing, and the whole page silently emptied. `sessionKeysetCondition` embeds the cursor's `(timestamp, id)` directly into both the `<` and the `=`-tiebreak arms. The order key is stored in seconds (sqlite `timestamp` mode), so the cursor's ms value is floored (5,000,000 ms → 5,000 s in both arms).
- **A malformed cursor degrades to "no cursor", never to a filter.** `parseSessionCursor` returns `null` for a missing separator, an empty / non-integer / out-of-range timestamp, or an empty id, so the caller starts from the beginning instead of crashing or dropping every row. It splits on the first separator only, so ids containing `_` survive.

`nextCursor` is the **last returned** item's composite, not the sentinel (limit+1) row's, so the next page starts strictly after it. The live cash-game and live-tournament lists use the same composite `(startedAt, id)` keyset with the same degrade-to-no-cursor behavior, kept deliberately in lockstep with `session.list`. Cursor subqueries must also carry the caller's ownership scope — that half is [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md)'s SA2-182 rule.

## N+1 collapse on list endpoints (SA2-151)

The live-session `list` endpoints used to fetch `session_event` with one `WHERE session_id = ?` query per page item — up to limit+1 ≈ 100 extra round-trips, and on D1 per-query latency dominates, so the N+1 was the whole cost of the page. `getSessionEventMap` in [`session.ts`](../../packages/api/src/routers/session.ts) collapses it: collect the page's session ids, fetch every event in one `inArray` query (chunked via `selectInChunks`), then bucket rows by session id.

Two details of the design are load-bearing:

- **Ordering `(occurredAt asc, sortOrder asc, id asc)`** is the exact order the per-session query used before the collapse, and both consumers depend on it — the cash list's reverse scan and the tournament list's `computeStackStats` stack derivation. Each bucket is **re-sorted in application code**, because `selectInChunks` concatenates chunk results (and a mocked db may ignore `ORDER BY`).
- **Sessions with no events are absent from the map** — callers treat a missing key as "no events", not an error.

### The Drizzle unqualified-column subquery trap

[`room.ts`](../../packages/api/src/routers/room.ts) computes active (non-archived) game counts via correlated subqueries so the list card avoids an N+1 per room — and its column refs are written as **literal qualified names** on purpose. Interpolating Drizzle column objects into a raw `` sql`…` `` subquery renders them *unqualified* (`room_id` / `id`); inside the child-table `FROM`, those names resolve to the child table's **own** columns and the count silently yields 0. There is no error — the query is valid SQL that answers a different question.

## TOCTOU races and unique-constraint backstops (c14)

Every uniqueness rule here is enforced twice, by design: an app-level pre-check (case-insensitive label availability via `assertLabelNamespaceAvailable`; the filter-preset name check) gives the user a friendly CONFLICT, and a DB-level unique constraint or trigger is the backstop for the window where that check races a concurrent identical write (c14, TOCTOU). The backstop's D1 error is caught and converted to **the same CONFLICT the pre-check throws**, so callers cannot tell which layer fired. Sites: `create`/`update` (rename) on game-group, game-variant, and game-mix; `create`/`update` on [`filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts); and the concurrent-seed no-op in seed-game-data (c09 — see [`game-masters.md`](game-masters.md)).

### The two shapes of a label collision

A label collision on `game_group` / `game_variant` / `game_mix` surfaces in **two different shapes**, and anything reacting to it must recognize both ([`packages/api/src/lib/db-errors.ts`](../../packages/api/src/lib/db-errors.ts)):

1. The `(user_id, label)` UNIQUE indexes → a generic `Error` whose message contains `UNIQUE constraint failed` (e.g. `D1_ERROR: UNIQUE constraint failed: game_group.user_id, game_group.label: SQLITE_CONSTRAINT`).
2. The [migration-0041](../../packages/db/src/migrations/0041_amazing_amphibian.sql) BEFORE INSERT/UPDATE triggers, which `RAISE(ABORT, 'game master label already exists')` / `'game_group label already exists'`. **SQLite evaluates a BEFORE trigger ahead of the unique index** (and ahead of `ON CONFLICT` resolution), so in practice the trigger's custom message — *not* `UNIQUE constraint failed` — is the one that surfaces for any real duplicate.

Matching only shape (1) let the trigger-aborted race fall through to a 500 instead of the intended CONFLICT / seed no-op; `isLabelConflictError` matches both. The mix-**reference** trigger (a variant still referenced by a mix) is *not* a label collision and must not be swallowed as one.

### The `filter_preset` name conflict names all three columns

`isFilterPresetNameConflictError` matches `filter_preset.user_id, filter_preset.screen_key, filter_preset.name` explicitly. The table carries two **other** unique constraints — the partial `(user_id, screen_key) WHERE is_default = 1` default index and the `id` primary key — and matching the table name alone would report either of those to the user as a duplicate *name*. Only the name index may be surfaced as "you already have a preset with this name".

## Write == read schema identity (SA2-148)

The rule ("if a stored payload is later re-`parse`d, validate the write with that exact schema") is in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md); the failure mode that created it is worth keeping vivid: `initialBuyIn` was accepted as a decimal on create but re-read through `cashSessionStartPayload`'s `z.number().int().min(0)`, so the value parsed on create and then threw a ZodError on **every subsequent `getById`** — the session became permanently unreadable (SA2-148). Write-side permissiveness is not a compatibility feature; it is a delayed read-side outage.

Instances of the pattern:

- **Filter presets** ([`filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts)): the input's discriminated union routes payload validation per screen and is built from `payloadSchemaForScreenKey`, so `create()` validates against the exact schema objects the db package (and any later read-side re-parse) uses — never a merged or loose shape. `update()` cannot know which payload shape applies until the stored row's `screenKey` is loaded, so its input schema only proves the payload is valid for *some* screen; the handler **re-validates against the stored row's `screenKey`**, never the caller's assumption. Feature-level preset design (payload contents, apply paths) lives in [`web-platform.md`](web-platform.md).
- **Schema identity is about meaning, not shape** (`tournament.removeTag`): its id input is deliberately not `tournamentIdInputSchema` — the id is a `tournamentTag.id` and the handler derives the tournament from it. Same shape, different meaning: sharing the const would make any future `.describe()` / `.uuid()` on it lie for one of the two uses.
- **Signed ledger amounts**: `currency_transaction.amount` is a deliberate deviation from the `.int().min(0)` default — a ledger transaction is signed (withdrawals and negative session P/L written through `syncCurrencyTransaction` are legitimate negatives). The deviation is documented at the schema site per the rule file's "deviate only with a comment saying why".

## Update payloads: `null` clears, `undefined` leaves unchanged

Update procedures distinguish three states per field: a value (set it), an explicit `null` (clear it), and an omitted key (leave it unchanged) — the `.nullable().optional()` pattern on the server. The client-side trap is that **JSON serialization drops `undefined` keys**, so a UI that clears a field must send an explicit `null`; sending `undefined` silently turns "clear" into "keep". The currency, room, and ring-game web hooks all encode this ([`use-currencies.ts`](../../apps/web/src/features/currencies/hooks/use-currencies.ts), [`use-rooms.ts`](../../apps/web/src/features/rooms/hooks/use-rooms.ts), [`use-ring-games.ts`](../../apps/web/src/features/rooms/hooks/use-ring-games.ts)).

## UTC round-trip drift and day crossing (SA2-145, SA2-157)

The imperatives (UTC getters for date-only values, day-crossing handling, backfill duty) are in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md). The mechanics this doc adds:

- **Round-trip drift is cumulative** (SA2-145): `sessionDate` is stored and returned as UTC midnight, and the create/update payloads re-encode a date-only string as UTC midnight, so the edit form must read back the **UTC** calendar day ([`session-form-helpers.ts`](../../apps/web/src/features/sessions/utils/session-form-helpers.ts)). Local getters shift the day back one for users west of UTC — and because the save re-encodes what was read, each edit-save drifts the stored date **one more day earlier**. The same UTC-forcing applies to share text, so the shared date is the calendar day the user saved.
- **Day crossing and the 0-length boundary** (SA2-157): `computeSessionTimes` in [`use-sessions.ts`](../../apps/web/src/features/sessions/hooks/use-sessions.ts) converts start/end clock times — both entered against a single `sessionDate` with no separate end-date field — into Unix seconds, rolling the end forward 24h when it lands **strictly before** the start (22:00 → 02:00 crossed midnight). Without the roll, the end was stored ~20h before the start: the UI showed a negative duration and the server clamped play time to 0, dropping the session out of every play-time statistic. The boundary decision: **equal start and end is a 0-length span, never a 24h one** — only a strictly earlier end means the session crossed midnight.

## Schema-level integrity anchors

- **`ring_game.userId` is the real ownership anchor** (SA2-181, [`packages/db/src/schema/ring-game.ts`](../../packages/db/src/schema/ring-game.ts)): nullable at the DB level so the `ADD COLUMN` migration is safe on populated tables, but the app sets it on every insert and ownership treats `null` as **not owned**. This closes the IDOR gap for auto-generated snapshot rows whose `roomId` is null and therefore had no ownership anchor under the old room-derived model. The router-side ownership contract is in [`sessions-and-live-editing.md`](sessions-and-live-editing.md) and [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md).
- **Stored rich text is sanitized HTML** (SA2-25, [`packages/db/src/schema/currency.ts`](../../packages/db/src/schema/currency.ts)): `currency.description` stores HTML that has already been sanitized on write. Consumers may render it trusting the stored form; anything that writes it must sanitize first — the column's contract is "sanitized at rest", not "sanitize on display".
