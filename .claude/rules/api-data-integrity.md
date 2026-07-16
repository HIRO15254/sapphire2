---
paths:
  - "packages/api/**"
  - "packages/db/**"
---

# API Data Integrity (Zod Inputs & D1 Writes)

Why this file exists: the Fable review found a cluster of data-corruption bugs from permissive input schemas and D1-specific write hazards (SA2-115, 116, 136, 148, 150, 151, 156, 161, 165).

## Zod input conventions

- **Money, chip, and count fields default to `z.number().int().min(0)`.** A bare `z.number()` let negative chip costs inflate P/L (SA2-136) and non-integer `wins` corrupt EV stats (SA2-156). Deviate only with a comment saying why.
- **Cross-field constraints go on `create` AND `update`.** `placement <= totalEntries` existed only on create, so update could persist "50th of 10" (SA2-161). When adding a `.refine`, grep for the sibling procedure and apply it there too.
- **Write-side and read-side schemas must be the same object.** `initialBuyIn` was accepted as a decimal on create but re-read through a payload schema requiring `.int()`, making the session permanently unreadable (SA2-148). If a stored payload is later re-`parse`d, validate the write with that exact schema — never a looser inline copy.

## D1 write hazards

- **100 bound parameters per statement.** A multi-row `.insert().values(rows)` binds `rows × columns` params; ≥12 blind-level rows blew the limit and — because the preceding DELETE had already committed — destroyed the data (SA2-115). Use the shared helpers in [`packages/api/src/routers/session.ts`](../../packages/api/src/routers/session.ts): `chunkForInsert` for inserts, `selectInChunks` for `IN (…)` selects.
- **Multi-statement writes go through `db.batch()`** so they commit atomically. Sequential awaited statements auto-commit one by one and a mid-way failure strands partial state (SA2-116). DELETE-then-reINSERT is the highest-risk shape — always batch it.
- **Session-event append order is allocated inside the INSERT.** Use `nextAppendSortOrderSql` from [`packages/api/src/utils/session-event-time.ts`](../../packages/api/src/utils/session-event-time.ts); never `SELECT MAX(sortOrder)` and then INSERT, because concurrent appenders can choose the same value (SA2-196). The `(session_id, sort_order)` unique index is the backstop. Fixed sort-order ranges are allowed only within one atomic replacement batch, such as cash-session reopen.
- **Cascade-aware deletes.** Before writing a `delete` procedure, read the schema for `onDelete: "cascade"` on referencing FKs. Deleting a currency silently cascade-deleted session-generated transactions (SA2-165). Either guard ("in use → reject") or make the cascade an explicit, documented decision.

## List endpoints

- **No N+1.** Fetch child rows for a page with one `inArray(parentId, ids)` query (chunked via `selectInChunks`), not one query per row — per-query latency dominates on D1 (SA2-151).
- **Keyset pagination** uses `paginate` from [`packages/api/src/routers/_pagination.ts`](../../packages/api/src/routers/_pagination.ts) and its comparison must (a) survive the cursor row being deleted (a subquery returning `NULL` silently ends paging, SA2-150), (b) break ties on `id`, and (c) carry the caller's ownership scope (see [`api-security.md`](api-security.md)).
