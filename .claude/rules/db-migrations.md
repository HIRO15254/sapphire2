---
paths:
  - "packages/db/**"
---

# Database Migrations (Drizzle + Cloudflare D1)

Migrations live in [`packages/db/src/migrations`](../../packages/db/src/migrations) as numbered
`NNNN_name.sql` files. **They are hand-written and applied by `wrangler d1 migrations apply`**
(`bun run db:migrate:local` / `db:migrate:remote`), which reads the `.sql` files directly and
tracks applied migrations in D1's own `d1_migrations` table. Wrangler never looks at Drizzle's
`meta/` folder.

## Why migrations are hand-authored

Many migrations do things `drizzle-kit generate` cannot express: data backfills
(`0018_backfill_session_start_timer`, `0034_backfill_day_crossing_session_end`), event-model
rewrites (`0013`, `0019`–`0022`), and table renames with data moves
(`0029_rename_store_to_room`). Those must be written by hand. Never assume a migration was
machine-generated.

## The Drizzle `meta/` ledger and `db:generate`

`bun run db:generate` (`drizzle-kit generate`) does **not** apply anything — it diffs the current
`src/schema/*.ts` against the newest snapshot in `meta/` and writes a candidate migration + a new
snapshot. It exists so schema-only changes can be scaffolded and, more importantly, so the ledger's
newest snapshot stays a faithful mirror of the live schema (Drizzle Studio and any future diff read
it).

The ledger drifted once (SA2-158): `meta/_journal.json` and the snapshots froze at
`0012_boring_vivisector` while 0013–0034 were added by hand. Diffing the real schema against a
20-migration-old snapshot made `db:generate` emit a giant, destructive migration under a filename
that collided with an existing one. It was re-baselined by registering 0013–0034 in
`_journal.json` and adding a single tip snapshot (`0034_snapshot.json`) that captures the true
current schema, chained onto `0012`. There are intentionally no per-migration snapshots for
0013–0033 — those migrations were authored in bulk, outside Drizzle, so faithful intermediate
snapshots do not exist and were not fabricated. `db:generate` only ever reads the newest snapshot,
so this is sufficient and correct.

## Keeping the ledger from drifting again

`bun run db:generate` must report **"No schema changes, nothing to migrate"** whenever
`src/schema/*.ts` and the migrations are in sync. Treat a non-empty diff as a signal, not a
finished migration:

1. Write (or edit) the migration `.sql` by hand — pick the next `NNNN` prefix.
2. Run `bun run db:generate`. If it reports changes, the newest snapshot is now stale relative to
   your schema edits. Let it write the fresh snapshot + journal entry, then **replace its
   auto-generated `.sql` with your hand-written migration** (or delete the auto `.sql` if your
   hand-written one already covers it) so `wrangler` still applies the intended SQL. The goal is a
   `meta/` tip snapshot that matches the schema and a `.sql` that expresses the real (possibly
   data-carrying) change.
3. Re-run `bun run db:generate` and confirm it prints "No schema changes".

If you ever need to re-baseline again, generate a clean current-schema snapshot from an empty
`meta/` baseline (`drizzle-kit generate` with an empty `_journal.json` produces one snapshot of the
whole schema), then transplant its body into a new tip snapshot whose `prevId` chains onto the
previous tip's `id`.
