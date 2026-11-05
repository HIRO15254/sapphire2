# D1 / SQLite Data Integrity

Historical context is preserved in the [archive](../archive/data-integrity-history.md).

The current model is specified in [data-model.md](data-model.md).

Why writes against Cloudflare D1 are shaped the way they are: the 100-bound-parameter cap and chunk math, the `db.batch()` atomicity contract and its statement-ordering rules, keyset pagination cursors, N+1 collapse on list endpoints, TOCTOU backstops and unique-constraint error shapes, write==read schema identity, and the UTC round-trip rules. The enforceable imperatives live in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md) (and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) for dates); this document explains the mechanics behind them.

## The 100-bound-parameter cap and chunking

D1 rejects any single statement binding more than 100 parameters. A multi-row `INSERT` binds `columnsPerRow × rowCount` parameters, so a large batch — e.g. a 14-level blind structure at 10 columns = 140 params — overflows a single statement and fails at runtime.

The cap constant `D1_MAX_BOUND_PARAMS` and `chunkForInsert` live in [`packages/api/src/lib/batch.ts`](../../packages/api/src/lib/batch.ts), so services can size their own `IN (…)` lists against the same number without importing from a router. The helper has exactly one implementation.

Current multi-row writers use `chunkForInsert`, including ledger, hand, mix and tag-link writes. ID-list lookups use `selectInChunks`.

### Chunked `IN (…)` selects

A one-column `IN` binds one param per id, so a batched lookup across more than 100 sessions overflows exactly like a wide multi-row INSERT — 101 session ids in a single `inArray` bind 101 params. `selectInChunks` (in [`batch.ts`](../../packages/api/src/lib/batch.ts)) sizes chunks using the shared cap, reserving space for any extra bound parameters. Rows from every chunk are concatenated in chunk order; callers bucket by id afterward, and because each id lands in exactly one chunk, per-id ordering (`sortOrder` / `level`) survives the concatenation.

## `db.batch()` atomicity

The repo-wide contract: **every multi-statement write in the api package commits through a single `db.batch([...])`**, so a mid-sequence failure can no longer leave a DELETE committed with its re-INSERT missing (permanent data loss) or a parent row committed without its children (orphan). Sequential awaited statements auto-commit one by one.

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
- **Validate every link and tag ownership, and resolve every rule snapshot, before any write**, so the batch never starts if it cannot finish.
- **A ledger change rides the batch of the entry it belongs to**, so failure cannot move the ledger independently of its source.
- **A pure copy never deletes**: only replacement flows carry a DELETE.

### FK-checked upserts as concurrency guards

A create path that links a new master to an existing parent keeps an FK-checked child write (an upsert rather than select-then-update/insert) **inside** the batch: if the parent disappears between the authorization read and the write (a concurrent deletion), the FK violation rolls the master insert back instead of committing an orphan ring game / tournament.

## Keyset pagination cursors

Entry and live lists order by `(playedOn, id)` descending, and opaque cursors carry the whole ordering tuple ([`api.md`](api.md) §1). Cursor implementations follow two invariants:

- **The boundary is derived purely from the cursor value — never a subquery on the raw cursor id.** The cursor's tuple goes directly into both the `<` and the `=`-tiebreak arms.
- **A malformed cursor is never read as a filter.** The API rejects it with `BAD_REQUEST` ([`api.md`](api.md) §1).

`nextCursor` is the **last returned** item's composite, not the sentinel (limit+1) row's, so the next page starts strictly after it. Cursor subqueries must also carry the caller's ownership scope — that half is [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md)'s ownership rule.

## N+1 collapse on list endpoints

`live.list` fetches page events in chunks and buckets them by id (`attachProgress` in `packages/api/src/services/live-entry.ts`).

Two details of the design are load-bearing:

- **Ordering `(occurredAt asc, sortOrder asc, id asc)`** is the order the event consumers fold in. Each bucket is **re-sorted in application code**, because `selectInChunks` concatenates chunk results (and a mocked db may ignore `ORDER BY`).
- **Sessions with no events are absent from the map** — callers treat a missing key as "no events", not an error.

### The Drizzle unqualified-column subquery trap

[`room.ts`](../../packages/api/src/routers/room.ts) computes active (non-archived) game counts via correlated subqueries so the list card avoids an N+1 per room — and its column refs are written as **literal qualified names** on purpose. Interpolating Drizzle column objects into a raw `` sql`…` `` subquery renders them *unqualified* (`room_id` / `id`); inside the child-table `FROM`, those names resolve to the child table's **own** columns and the count silently yields 0. There is no error — the query is valid SQL that answers a different question.

## TOCTOU races and unique-constraint backstops

Game-master label uniqueness is enforced by per-table expression UNIQUE indexes on `(user_id, lower(trim(label)))`, including archived rows. `runLabelWrite` maps index conflicts to `CONFLICT` and guides users to restore an archived holder when applicable. The database constraint closes the concurrent-write race without an application namespace pre-check.

Filter presets use a name pre-check for a friendly error and a unique constraint as the concurrent-write backstop.

### The `filter_preset` name conflict names all three columns

`isFilterPresetNameConflictError` matches `filter_preset.user_id, filter_preset.screen_key, filter_preset.name` explicitly. The table carries two **other** unique constraints — the partial `(user_id, screen_key) WHERE is_default = 1` default index and the `id` primary key — and matching the table name alone would report either of those to the user as a duplicate *name*. Only the name index may be surfaced as "you already have a preset with this name".

## Write == read schema identity

The rule ("if a stored payload is later re-`parse`d, validate the write with that exact schema") is in [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md); write-side permissiveness can otherwise cause delayed read failures.

Instances of the pattern:

- **Filter presets** ([`filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts)): the input's discriminated union routes payload validation per screen and is built from `payloadSchemaForScreenKey`, so `create()` and `list()` use the same strict schemas from the db package. Both screens share the statistics filter fields, but only statistics requires a mode. `update()` cannot know which schema applies until the stored row's `screenKey` is loaded, so its input schema only proves the payload is valid for *some* screen; the handler **re-validates against the stored row's `screenKey`**, never the caller's assumption. Feature-level preset design (payload contents, apply paths) lives in [`web-platform.md`](web-platform.md).
- **Signed ledger amounts**: `ledger_line.quantity` is signed; role and effect determine the permitted sign and accounting semantics.

## Update payloads: `null` clears, `undefined` leaves unchanged

Update procedures distinguish a value (set), explicit `null` (clear a nullable field), and an omitted key (unchanged). JSON serialization drops `undefined`, so clients must send `null` to clear.

## UTC round-trip drift and day crossing

The imperatives (UTC getters for date-only values, day-crossing handling, backfill duty) are in [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md). The mechanics this doc adds:

- Date-only entry and play-session values are calendar strings; do not convert them through local getters. Event timestamps are instants. Per-day durations subtract that day's breaks; negative durations are invalid.

## Room archive and deletion

Rooms use nullable `archived_at`. `room.list` excludes archived rows by default and `includeArchived: true` includes both active and archived rows. Historical references remain resolvable.

`room.delete` checks owned references from entries, ring games and tournaments, including archived masters, in the delete predicate. Referenced rooms return `CONFLICT` with archive guidance. The atomic predicate prevents a check/write race. MCP exposes archive and restore, not hard delete.

## Schema-level integrity anchors

- **Owned masters support composite foreign keys**: `room`, `ring_game`, `tournament`, `player`, `player_tag`, and `asset` have `UNIQUE (id, user_id)` indexes, following the existing `game_variant_id_user_id_unique` and `game_mix_id_user_id_unique` naming convention. Children reference `(parent_id, user_id)` so they cannot point at another user's row. Without the parent unique index, SQLite reports `foreign key mismatch`, including on parent deletion.
- **Tag names are unique per owner and kind**: each tag definition table has a `UNIQUE (user_id, lower(trim(name)))` expression index. Its separate `UNIQUE (id, user_id)` supports owned composite foreign keys.
- **Masters carry their owner**: `ring_game` and `tournament` have non-null `user_id` and composite room ownership foreign keys; see [API security](../../.claude/rules/api-security.md).
- **Entry ownership and state**: `entry`, `entry_cash`, `entry_tournament`, `play_session` and `play_event` use composite ownership foreign keys. A play event belongs to a play session of its entry, and a partial UNIQUE allows one unfinished play session per user. See [data-model.md](data-model.md) for the full contract.
- **Asset and ledger integrity**: assets, entries, play sessions, events and ledger categories use composite ownership foreign keys. Ledger CHECKs enforce quantity, role, effect and transfer rules; referenced assets and categories cannot be deleted. See [data-model.md](data-model.md).
- **Asset descriptions are plain text**: `asset.description` is stored unchanged and rendered as text, not trusted HTML.
