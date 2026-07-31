---
paths:
  - "packages/db/**"
---

# Database Migrations (Drizzle + Cloudflare D1)

Migrations live in [`packages/db/src/migrations`](../../packages/db/src/migrations) as numbered
`NNNN_name.sql` files, applied by `wrangler d1 migrations apply` (`bun run db:migrate:local` /
`db:migrate:remote`), which reads the `.sql` files directly and tracks applied migrations in D1's
own `d1_migrations` table. Wrangler never looks at Drizzle's `meta/` folder.

## How to author a migration

**`bun run db:generate` is the default path for schema-shape changes.** After the SA2-158
re-baseline the `meta/` ledger mirrors the live schema, so `drizzle-kit generate` produces a correct
diff and — critically — writes the updated snapshot for you, which is what keeps the ledger from
drifting again. Reach for it first for additive/structural changes: new column
(`ALTER TABLE … ADD COLUMN`), new table, new index. Drizzle's `--> statement-breakpoint` markers are
comments, so `wrangler` applies the generated SQL as-is.

**Hand-write (or heavily edit the generated SQL) only when `drizzle-kit generate` can't express the
change or would do it unsafely:**

- **Data backfills / transforms** — `UPDATE` / `INSERT` / event-model rewrites
  (`0018_backfill_session_start_timer`, `0034_backfill_day_crossing_session_end`, `0019`–`0022`).
  Drizzle emits schema diffs only.
- **Renames that must preserve data** — `0029_rename_store_to_room`. Drizzle tends to read a rename
  as drop-then-create (data loss) unless you answer its interactive prompts.
- **Column removal / type changes on SQLite/D1** — Drizzle emulates these by recreating the table
  (`__new_*` → copy → drop → rename); it works but review it carefully against foreign keys and data
  volume.

When you hand-write a migration, still run `db:generate` afterward (see below) so the snapshot stays
in sync — let it write the fresh snapshot, then replace/delete its auto `.sql` so `wrangler` applies
your intended SQL.

## A migration file is NOT one transaction in production

`wrangler d1 migrations apply` streams the statements of a file to D1; there is no file-wide
transaction, and `d1_migrations` only advances after the last statement succeeds. A statement that
fails halfway therefore leaves the earlier objects created **and** the migration unrecorded, so the
retry dies on `table already exists`. `migration-00NN.test.ts` helpers that wrap the file in
`BEGIN` / `ROLLBACK` model the local (`bun:sqlite`) behavior, not production — never cite them as
evidence that a migration rolls back.

Consequences for any migration that touches existing rows:

- **Make every statement re-runnable**: `CREATE TABLE / INDEX / TRIGGER IF NOT EXISTS`,
  `INSERT OR IGNORE` for backfills.
- **Make the retry self-healing, not merely non-destructive.** `INSERT OR IGNORE` only tops up
  missing rows. If the first attempt died after the backfill but before the compatibility triggers
  existed, `d1_migrations` never advanced, so the old Worker kept writing the legacy column with
  nothing syncing the new table: the rows left behind are stale, and the corrected ones collide on
  the ordering unique index and are dropped silently. While `d1_migrations` has not advanced no new
  code writes the new table — it is by definition derived from the legacy column — so a
  `DELETE FROM <new_table>;` immediately before the backfill rebuilds it correctly
  (`0049_normalize_game_mix_variants`). Check for dependents first; a table with children needs the
  cascade thought through instead.
- **Test a real mid-file failure, not a double apply.** Split the file on
  `--> statement-breakpoint`, apply only the first N statements WITHOUT a transaction, mutate the
  legacy column the way the still-running old Worker would, then apply the whole file and assert the
  result matches the legacy column (`applyThrough` in
  [`migration-0049.test.ts`](../../packages/db/src/__tests__/migration-0049.test.ts)). Applying the
  whole file twice only proves the statements are re-runnable.
- **Make backfills unable to abort.** Constraints introduced by the same migration are, by
  definition, not enforced on the legacy rows being backfilled. Resolve references with an
  `INNER JOIN` against the owning table, collapse duplicates with `GROUP BY`, renumber ordering
  columns with `ROW_NUMBER() OVER (PARTITION BY …)`, and read possibly-malformed JSON through
  `CASE WHEN json_valid(x) = 0 THEN '[]' WHEN json_type(x) <> 'array' THEN '[]' ELSE x END` —
  `json_each()` raises on malformed input, and a `WHERE` clause cannot guard it because the
  table-valued function is evaluated first.
- **Audit production before merging** so the rows the backfill would drop are known, not
  discovered later. `0049_normalize_game_mix_variants` normalized `game_mix.games` (a JSON id
  array) into `game_mix_variant`; the shape below generalizes to any JSON-array → junction-table
  normalization (run with `bunx wrangler d1 execute <db> --remote --command "…"`):

  ```sql
  -- 1. malformed or non-array payloads — run this FIRST: json_each() below
  --    raises on malformed input, so a non-empty result invalidates 2 and 3.
  SELECT id FROM game_mix WHERE json_valid(games) = 0 OR json_type(games) <> 'array';

  -- 2. references that resolve to no variant owned by the same user
  SELECT m.id, m.user_id, g.value
  FROM game_mix AS m, json_each(m.games) AS g
  LEFT JOIN game_variant AS v
    ON v.id = CAST(g.value AS text) AND v.user_id = m.user_id
  WHERE v.id IS NULL;

  -- 3. the same id repeated inside one mix
  SELECT m.id, g.value, COUNT(*) FROM game_mix AS m, json_each(m.games) AS g
  GROUP BY m.id, g.value HAVING COUNT(*) > 1;
  ```

## The Drizzle `meta/` ledger

`bun run db:generate` (`drizzle-kit generate`) does **not** apply anything — it diffs the current
`src/schema/*.ts` against the newest snapshot in `meta/` and writes a migration + a new snapshot.
Besides scaffolding schema changes, it keeps the ledger's newest snapshot a faithful mirror of the
live schema (Drizzle Studio and any future diff read it).

The ledger drifted once (SA2-158): `meta/_journal.json` and the snapshots froze at
`0012_boring_vivisector` while 0013–0034 were added by hand. Diffing the real schema against a
20-migration-old snapshot made `db:generate` emit a giant, destructive migration under a filename
that collided with an existing one. It was re-baselined by registering 0013–0034 in
`_journal.json` and adding a tip snapshot (`0034_snapshot.json`) that captured the true schema at
that point, chained onto `0012`. There are intentionally no per-migration snapshots for
0013–0033 — those migrations were authored in bulk, outside Drizzle, so faithful intermediate
snapshots do not exist and were not fabricated. Generated migrations 0035–0049 each added their
own snapshot; the current ledger tip is `0049_snapshot.json` (`0049_normalize_game_mix_variants`).
`db:generate` reads this newest snapshot, so future migrations continue from the current schema.

> Caveat: `drizzle-kit check` (not currently in CI) validates that a snapshot exists for every
> journal entry and would flag the intentionally-absent 0013–0033 snapshots. Do not add it to CI
> without first regenerating a full snapshot chain (or dropping the unbacked journal entries) — the
> re-baseline above deliberately trades a complete snapshot history for a lean, honest ledger.

## Manual SQLite triggers are outside the Drizzle ledger

Migration `0041_amazing_amphibian` installed ten manual integrity triggers on `game_group`,
`game_variant`, and `game_mix`. Migration `0049_normalize_game_mix_variants` is the expand phase of
a rolling-safe normalization: it keeps those ten triggers and adds two `game_mix` →
`game_mix_variant` synchronization triggers. The physical `games` JSON column remains only as a
compatibility mirror because production migrations run before the new Worker is deployed; removing
it in 0049 would break the old Worker during that window and prevent a safe rollback. A later
contract migration may remove the mirror, its four JSON-reference triggers, and the two sync
triggers only after all deployed Workers have stopped reading or writing `games`, leaving the six
normalized-label triggers. Drizzle snapshots do not model triggers, and SQLite drops a table's
triggers when a table-rebuild migration drops that table. Therefore, any migration that recreates
one of these three tables must recreate every trigger that is still required in that deployment
phase.

[`migration-0041.test.ts`](../../packages/db/src/__tests__/migration-0041.test.ts) applies every
numbered migration from an empty database and asserts the final trigger names and target tables.
Keep this full-history guard intact and run it after touching these tables; `db:generate` reporting
no schema changes does not verify manual triggers.

## Keeping the ledger from drifting again

`bun run db:generate` must report **"No schema changes, nothing to migrate"** whenever
`src/schema/*.ts` and the migrations are in sync. The workflows:

- **Schema-shape change** — edit `src/schema/*.ts`, run `bun run db:generate`, keep the generated
  `.sql` + snapshot. Done.
- **Data / rename / destructive change** — hand-write the `.sql` (next `NNNN` prefix), then run
  `bun run db:generate`; let it write the fresh snapshot + journal entry, and **replace its
  auto-generated `.sql` with your hand-written migration** (or delete the auto `.sql` if yours
  already covers it) so `wrangler` applies the intended SQL. The goal is a `meta/` tip snapshot that
  matches the schema and a `.sql` that expresses the real (possibly data-carrying) change.

Either way, re-run `bun run db:generate` last and confirm it prints "No schema changes" — a
non-empty diff means the snapshot is out of sync and the ledger is drifting.

If you ever need to re-baseline again, generate a clean current-schema snapshot from an empty
`meta/` baseline (`drizzle-kit generate` with an empty `_journal.json` produces one snapshot of the
whole schema), then transplant its body into a new tip snapshot whose `prevId` chains onto the
previous tip's `id`.
