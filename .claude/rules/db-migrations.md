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
snapshots do not exist and were not fabricated. Generated migrations 0035–0043 each added their
own snapshot; the current ledger tip is `0043_snapshot.json` (`0043_parched_northstar`).
`db:generate` reads this newest snapshot, so future migrations continue from the current schema.

> Caveat: `drizzle-kit check` (not currently in CI) validates that a snapshot exists for every
> journal entry and would flag the intentionally-absent 0013–0033 snapshots. Do not add it to CI
> without first regenerating a full snapshot chain (or dropping the unbacked journal entries) — the
> re-baseline above deliberately trades a complete snapshot history for a lean, honest ledger.

## Manual SQLite triggers are outside the Drizzle ledger

Migration `0041_amazing_amphibian` installs ten manual integrity triggers on `game_group`,
`game_variant`, and `game_mix` for normalized label uniqueness and JSON reference integrity.
Drizzle snapshots do not model triggers, and SQLite drops a table's triggers when a table-rebuild
migration drops that table. Therefore, any migration that recreates one of these three tables must
recreate its `0041` triggers in the same migration.

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
