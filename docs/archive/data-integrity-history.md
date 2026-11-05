> Historical snapshot. Current guidance: [data-integrity](../design/data-integrity.md).

# D1 / SQLite Data Integrity

The current model is specified in [data-model-v2.md](../design/data-model.md).

Why writes against Cloudflare D1 are shaped the way they are: the 100-bound-parameter cap and chunk math, the `db.batch()` atomicity contract and its statement-ordering rules, keyset pagination cursors, N+1 collapse on list endpoints, TOCTOU backstops and unique-constraint error shapes, write==read schema identity, and the UTC round-trip rules. The enforceable imperatives live in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md) (and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) for dates); this doc holds the mechanics and the incident history behind them.

## The 100-bound-parameter cap and chunking (SA2-115)

D1 rejects any single statement binding more than 100 parameters. A multi-row `INSERT` binds `columnsPerRow × rowCount` parameters, so a large batch — e.g. a 14-level blind structure at 10 columns = 140 params — overflows a single statement and fails at runtime.

The cap constant `D1_MAX_BOUND_PARAMS` and `chunkForInsert` live in [`packages/api/src/lib/batch.ts`](../../packages/api/src/lib/batch.ts), so services can size their own `IN (…)` lists against the same number without importing from a router. The helper has exactly one implementation.

### Historical blind-level incident

The retired `session_blind_level` writer had ten columns and could insert at most ten rows per statement. An unchunked replacement failed after deleting the existing structure (SA2-115). B06 removed that writer and B25 dropped its source table. Derive chunk widths from the row shape rather than hardcoding them.

Current multi-row writers use `chunkForInsert`, including ledger, hand, mix and tag-link writes. ID-list lookups use `selectInChunks`.

### Chunked `IN (…)` selects

A one-column `IN` binds one param per id, so a batched lookup across more than 100 sessions overflows exactly like a wide multi-row INSERT — 101 session ids in a single `inArray` binds 101 params, which is the outage the SA2 chip-purchase batched lookup hit. `selectInChunks` (in [`batch.ts`](../../packages/api/src/lib/batch.ts)) sizes chunks using the shared cap, reserving space for any extra bound parameters. Rows from every chunk are concatenated in chunk order; callers bucket by id afterward, and because each id lands in exactly one chunk, per-id ordering (`sortOrder` / `level`) survives the concatenation.

## `db.batch()` atomicity (SA2-116)

The repo-wide contract: **every multi-statement write in the api package commits through a single `db.batch([...])`**, so a mid-sequence failure can no longer leave a DELETE committed with its re-INSERT missing (permanent data loss) or a parent row committed without its children (orphan). Sequential awaited statements auto-commit one by one — that is the root cause of the headline data-loss bug: `tournament.updateWithLevels` ran a bare DELETE followed by a separate `Promise.all(insert…)` as independent auto-commits, so a failed re-INSERT could permanently wipe the tags / chip purchases / blind structure.

`runBatch` in [`packages/api/src/lib/batch.ts`](../../packages/api/src/lib/batch.ts) is the funnel: D1's `db.batch` requires a non-empty tuple, so an empty statement array is treated as a no-op. Every caller builds its statements first, then hands the whole group to a single `batch`.

Writes governed by the contract:

| Write | Batch shape |
|---|---|
| Tournament rule writes | Create an immutable rule structure and assign its master in a single batch |
| Entry and live writes | Validate first, then write entry, events and projected ledger lines atomically |

### Batch composition rules

The ordering inside a batch is load-bearing, not stylistic:

- **The DELETE leads the group.** "Clear then re-seed" must run as one atomic unit; a DELETE that commits separately can strand the table empty on a later failure.
- **The parent row precedes child rows**, so FK checks pass inside the transaction.
- **Validate every link and tag ownership, and resolve every rule snapshot, before any write**, so the batch never starts if it cannot finish. A cash session update whose rule was rejected used to have already saved its session fields.
- **A ledger change rides the batch of the entry it belongs to**, so failure cannot move the ledger independently of its source.
- **A pure copy never deletes**: only replacement flows carry a DELETE.

### FK-checked upserts as concurrency guards

A create path that links a new master to an existing parent keeps an FK-checked child write (an upsert rather than select-then-update/insert) **inside** the batch: if the parent disappears between the authorization read and the write (a concurrent deletion), the FK violation rolls the master insert back instead of committing an orphan ring game / tournament. The live-session create paths that did this were removed in B06; B20's create-and-assign flow must keep the same guard.

## Keyset pagination cursors (SA2-150)

The legacy session list ordered by `sessionOrderKey DESC, id DESC`, so paginating on `id` alone was wrong — id order (random UUIDs) is unrelated to that order, which made the second page drop or duplicate rows and stop early ("Load more" only worked once). Its cursor therefore encoded both the order key and the id. That list was removed in B06 (SA2-391); the final entry and live lists order by `(playedOn, id)` descending, and their opaque cursors carry the whole ordering tuple ([`api-after-data-model-v2.md`](../design/api.md) §1).

The SA2-150 regression defined the two invariants every cursor implementation here follows:

- **The boundary is derived purely from the cursor value — never a subquery on the raw cursor id.** The old keyset ran `SELECT started_at FROM game_session WHERE id = cursor`; once the cursor row was deleted, that subquery returned `NULL`, `started_at < NULL` matched nothing, and the whole page silently emptied. The cursor's tuple goes directly into both the `<` and the `=`-tiebreak arms.
- **A malformed cursor is never read as a filter.** The legacy lists degraded it to "no cursor"; the final API rejects it with `BAD_REQUEST` ([`api-after-data-model-v2.md`](../design/api.md) §1).

`nextCursor` is the **last returned** item's composite, not the sentinel (limit+1) row's, so the next page starts strictly after it. Cursor subqueries must also carry the caller's ownership scope — that half is [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md)'s SA2-182 rule.

## N+1 collapse on list endpoints (SA2-151)

The legacy live-session `list` endpoints fetched `session_event` with one `WHERE session_id = ?` query per page item — up to limit+1 ≈ 100 extra round-trips, and on D1 per-query latency dominates, so the N+1 was the whole cost of the page. The fix collected the page's ids, fetched every event in one `inArray` query (chunked via `selectInChunks`), then bucketed rows by id. Those endpoints were removed in B06; `live.list` loads the progress events of its page the same way (`attachProgress` in `packages/api/src/services/live-entry.ts`).

Two details of the design are load-bearing:

- **Ordering `(occurredAt asc, sortOrder asc, id asc)`** is the order the event consumers fold in. Each bucket is **re-sorted in application code**, because `selectInChunks` concatenates chunk results (and a mocked db may ignore `ORDER BY`).
- **Sessions with no events are absent from the map** — callers treat a missing key as "no events", not an error.

### The Drizzle unqualified-column subquery trap

[`room.ts`](../../packages/api/src/routers/room.ts) computes active (non-archived) game counts via correlated subqueries so the list card avoids an N+1 per room — and its column refs are written as **literal qualified names** on purpose. Interpolating Drizzle column objects into a raw `` sql`…` `` subquery renders them *unqualified* (`room_id` / `id`); inside the child-table `FROM`, those names resolve to the child table's **own** columns and the count silently yields 0. There is no error — the query is valid SQL that answers a different question.

## TOCTOU races and unique-constraint backstops (c14)

Game-master label uniqueness is enforced by per-table expression UNIQUE indexes on `(user_id, lower(trim(label)))`, including archived rows. `runLabelWrite` maps index conflicts to `CONFLICT` and guides users to restore an archived holder when applicable. The database constraint closes the concurrent-write race without an application namespace pre-check.

Filter presets use a name pre-check for a friendly error and a unique constraint as the concurrent-write backstop.

### The `filter_preset` name conflict names all three columns

`isFilterPresetNameConflictError` matches `filter_preset.user_id, filter_preset.screen_key, filter_preset.name` explicitly. The table carries two **other** unique constraints — the partial `(user_id, screen_key) WHERE is_default = 1` default index and the `id` primary key — and matching the table name alone would report either of those to the user as a duplicate *name*. Only the name index may be surfaced as "you already have a preset with this name".

## Write == read schema identity (SA2-148)

The rule ("if a stored payload is later re-`parse`d, validate the write with that exact schema") is in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md); the failure mode that created it is worth keeping vivid: `initialBuyIn` was accepted as a decimal on create but re-read through `cashSessionStartPayload`'s `z.number().int().min(0)`, so the value parsed on create and then threw a ZodError on **every subsequent `getById`** — the session became permanently unreadable (SA2-148). Write-side permissiveness is not a compatibility feature; it is a delayed read-side outage.

Instances of the pattern:

- **Filter presets** ([`filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts)): the input's discriminated union routes payload validation per screen and is built from `payloadSchemaForScreenKey`, so `create()` and `list()` use the same strict schemas from the db package. Both screens share the statistics filter fields, but only statistics requires a mode. `update()` cannot know which schema applies until the stored row's `screenKey` is loaded, so its input schema only proves the payload is valid for *some* screen; the handler **re-validates against the stored row's `screenKey`**, never the caller's assumption. Feature-level preset design (payload contents, apply paths) lives in [`web-platform.md`](../design/web-platform.md).
- **Signed ledger amounts**: `ledger_line.quantity` is signed; role and effect determine the permitted sign and accounting semantics.

## Update payloads: `null` clears, `undefined` leaves unchanged

Update procedures distinguish a value (set), explicit `null` (clear a nullable field), and an omitted key (unchanged). JSON serialization drops `undefined`, so clients must send `null` to clear.

## UTC round-trip drift and day crossing (SA2-145, SA2-157)

The imperatives (UTC getters for date-only values, day-crossing handling, backfill duty) are in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md). The mechanics this doc adds:

- Date-only entry and play-session values are calendar strings; do not convert them through local getters. Event timestamps are instants. Per-day durations subtract that day's breaks; negative durations are invalid.

## Room archive and deletion (SA2-295)

Rooms use nullable `archived_at`. `room.list` excludes archived rows by default and `includeArchived: true` includes both active and archived rows. Historical references remain resolvable.

`room.delete` checks owned references from entries, ring games and tournaments, including archived masters, in the delete predicate. Referenced rooms return `CONFLICT` with archive guidance. The atomic predicate prevents a check/write race. MCP exposes archive and restore, not hard delete.

## Schema-level integrity anchors

- **Owned masters support composite foreign keys** (SA2-296): `room`, `ring_game`, `tournament`, `player`, `player_tag`, and `asset` have `UNIQUE (id, user_id)` indexes, following the existing `game_variant_id_user_id_unique` and `game_mix_id_user_id_unique` naming convention. Children reference `(parent_id, user_id)` so they cannot point at another user's row. Without the parent unique index, SQLite reports `foreign key mismatch`, including on parent deletion.
- **Tag names are unique per owner and kind** (SA2-404): each tag definition table has a `UNIQUE (user_id, lower(trim(name)))` expression index. Its separate `UNIQUE (id, user_id)` supports owned composite foreign keys.
- **`ring_game` and `tournament` carry their owner in the database** (SA2-181, SA2-296, [`packages/db/src/schema/ring-game.ts`](../../packages/db/src/schema/ring-game.ts), [`tournament.ts`](../../packages/db/src/schema/tournament.ts)): `user_id` is `NOT NULL`, and `(room_id, user_id)` is a composite FK to `room(id, user_id)` with the existing `ON DELETE CASCADE`, so a master cannot sit in another user's room. A roomless ring game (the auto-generated snapshot rows of manual cash sessions) is still owned: the FK is unchecked while `room_id` is NULL, but `user_id` is not. Migration `0054_stale_redwing` rebuilt both tables: it filled `tournament.user_id` from the room, gave an ownerless ring game its room's owner or the owner of the oldest session that links it, dropped ring games with neither (nothing linked them), and unlinked a ring game from a room owned by someone else. D1 enforces foreign keys during migrations, so the rebuild staged the inbound child rows (`blind_level`, `tournament_chip_purchase`, `tournament_tag`) and links (`session_cash_detail.ring_game_id`, `session_tournament_detail.tournament_id`) and restored them. The file can be replayed from any statement. Each table's `UNIQUE (id, user_id)` index is created last in its section and marks the rebuild as complete, and a stage is refreshed from its source only while the source is complete (the old shape, or the rebuilt shape with the marker), so a retry keeps the rows the old Worker wrote after a failed attempt. The exception is a failure inside one table's rebuild, between its CREATE and its marker: the retry rebuilds that table from the stage again, and writes the old Worker made to it in between are lost. The router-side ownership contract is in [`sessions-and-live-editing.md`](../design/sessions-and-live-editing.md) and [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md).
- **The v2 entry aggregate enforces ownership and its state rules in the database** (SA2-299, [`packages/db/src/schema/entry.ts`](../../packages/db/src/schema/entry.ts), migration `0056_nifty_george_stacy`): `entry`, `entry_cash`, `entry_tournament`, `play_session` and `play_event` reference every parent by a composite FK that includes `user_id`, so a row cannot point at another user's room, asset, ring game, tournament, entry or play session. `play_event` reaches its play session through `(play_session_id, entry_id, user_id)`, so an event cannot sit in a play session of another entry (INV-15). `play_session` carries its entry's `kind` through `(entry_id, kind, user_id)`, which lets a CHECK reject an end state of the other kind (INV-07). A partial UNIQUE allows one unfinished play session per user (INV-05). Masters and assets are referenced with NO ACTION, so one an entry uses cannot be deleted (INV-22), while deleting the user still removes both in one statement. The enumerated values and the CHECKs come from [`packages/db/src/constants/entry.ts`](../../packages/db/src/constants/entry.ts). The tables stay empty until B06 backfills them; B16/B17 add the only writers; the full contract is §6 and §8 of [`data-model-v2.md`](../design/data-model.md), and [`entry-tables.test.ts`](../../packages/api/src/__integration__/entry-tables.test.ts) pins it against D1.
- **The v2 asset and ledger tables enforce ownership and the ledger line rules in the database** (SA2-302, [`packages/db/src/schema/ledger.ts`](../../packages/db/src/schema/ledger.ts), migration `0057_hesitant_the_watchers`): `asset_rate`, `ledger_line` and `user_setting` reference assets, entries, play sessions, events and ledger categories by composite FKs that include `user_id`, and `ledger_line` reaches its play session through `(play_session_id, entry_id, user_id)` (INV-15). CHECKs reject a zero or out-of-range quantity, a sign that contradicts the role, a wallet line (adjustment / exchange) with an entry or a virtual effect, an entry line without an entry, and an exchange without a transfer id (INV-08 to INV-10). An asset or ledger category that a line or the base-currency setting uses cannot be deleted; deleting an asset removes its rates. B02 (SA2-386, migration `0060_rebuild_currency_as_asset`) rebuilt `currency` as [`asset`](../../packages/db/src/schema/asset.ts) with its kind, decimals and is_favorite CHECKs in Drizzle and a per-user name UNIQUE on `lower(trim(name))`; the migration renamed earlier duplicate names with the first free ` (n)` suffix and gates on restored rows, links and `foreign_key_check` ([`data-model-v2.md`](../design/data-model.md) §5.2, §16.2). The legacy `currency_id` columns keep their names until their tables are rebuilt or retired. `ledger_line` stays empty until B09 fills it, and `asset_rate` / `user_setting` until B12's API writes them; [`ledger-tables.test.ts`](../../packages/api/src/__integration__/ledger-tables.test.ts) pins the contract against D1.
- **Stored rich text is sanitized HTML** (SA2-25, [`packages/db/src/schema/asset.ts`](../../packages/db/src/schema/asset.ts)): `asset.description` stores HTML that has already been sanitized on write. Consumers may render it trusting the stored form; anything that writes it must sanitize first — the column's contract is "sanitized at rest", not "sanitize on display".
