> Historical snapshot. Current guidance: [game-masters](../design/game-masters.md).

# Game Master Data

The current model uses id-referenced lineups and immutable rule versions; see [game-lineups.md](../design/game-lineups.md) and [data-model-v2.md](../design/data-model.md). This document describes per-user game masters, seeding and normalized composition.

## The three master tables

All game master data is **per-user DB rows**. Both the built-in entries and any user-created ones live as rows in the same tables — the code constants in [`packages/db/src/constants/game-variants.ts`](../../packages/db/src/constants/game-variants.ts) (`DEFAULT_GAME_GROUPS`, `DEFAULT_GAME_VARIANTS`, `DEFAULT_GAME_MIXES`) are **seed data only, never a runtime fallback**. The DB rows are the runtime source of truth.

| Table | Built-ins seeded per user | `builtinKey` values for seeded rows |
|---|---|---|
| [`game_group`](../../packages/db/src/schema/game-group.ts) | 3 groups | `'bigbet' \| 'limit' \| 'stud'` |
| [`game_variant`](../../packages/db/src/schema/game-variant.ts) | 21 variants | `'nlh' \| 'plo' \| …` |
| [`game_mix`](../../packages/db/src/schema/game-mix.ts) | 3 named mixes | `'horse' \| '8game' \| '10game'` |

`builtinKey` is null for user-created rows and **immutable**: it is intentionally absent from every update input schema, so a seeded row's `builtinKey` survives label/blind-label edits unchanged.

A mix is a reusable mixed-game definition, not a participation record. Composition is read and written exclusively through `game_mix_variant`, ordered by `position`, with ownership and references enforced by foreign keys. B25 dropped the retired `game_mix.games` column.

### Canonical ordering

Ordering is builtin-first everywhere, produced by the shared `compareBuiltinFirst` comparator factory in [`packages/api/src/routers/_game-masters.ts`](../../packages/api/src/routers/_game-masters.ts): groups `limit → stud → bigbet` (structure-sheet convention), mixes `HORSE → 8-Game → 10-Game`, then user-created rows alphabetically by label; variant `sortOrder` is the `DEFAULT_GAME_VARIANTS` array index at seed time. The web treats the server list order as canonical and never re-sorts.

## References and historical rules

Variants reference groups and mix membership references variants by id. Immutable lineups preserve composition by id, while group and variant labels are resolved from their masters. Renaming a master changes its displayed label, not the referenced lineup or rule version. Referenced masters cannot be hard-deleted; archive them instead.

The former frozen-label and mixed-game sentinel representation was retired in favor of id-based lineups and rule versions. No runtime label-resolution or compatibility mirror remains.

## Label namespace

- **Per-table namespace**: expression UNIQUE indexes enforce `(user_id, lower(trim(label)))` separately for groups, variants and mixes, including archived rows. A variant and a mix may share a label; `"mix"` and `"Mixed Game"` are not reserved by the API.
- **Conflict reporting**: `runLabelWrite` maps index conflicts to `CONFLICT`, guiding the caller to restore an archived holder where applicable. See [`data-integrity.md`](../design/data-integrity.md).
- **Builtin uniqueness (c08)**: each table also has a unique index on `(userId, builtinKey)`. SQLite treats NULLs as distinct, so this never constrains user-created rows against each other — it only guards the seeded builtin rows per user against a concurrent double-seed duplicating them.

## Mix membership validation

Mixes contain ordered variant ids. Rule writes use id-based lineups and stakes ([`game-lineup.ts`](../../packages/api/src/services/game-lineup.ts), [`rule-stakes.ts`](../../packages/api/src/services/rule-stakes.ts)); a lineup group holds variants of one game group by construction.

`validateGamesOwnership` guards the `games` array (ordered `game_variant` ids) on mix create/update: one `WHERE id IN (…) AND userId = caller` query; if the owned count differs from the requested count → uniform FORBIDDEN (SA2-177, SA2-183). Callers must reject duplicate ids first (`assertNoDuplicateGames`) so the count comparison is meaningful; `groupId` is returned so the caller can also bound the group span (c58).

## Archive and deletion guards

Lists exclude archived rows by default; `includeArchived` includes them. Group archive conflicts while it has active variants, and variant archive conflicts while an active mix contains it. Mix archive is unguarded. Restoring a variant with an archived group or a mix with an archived member returns `BAD_REQUEST`. New selections of archived groups or variants require restoring them first; retaining an existing mix composition is allowed.

Hard deletes use a single `DELETE` with `NOT EXISTS` reference guards and return `CONFLICT` directing users to archive referenced rows. Group references include variants and `game_lineup_group`; variant references include mix composition, `game_lineup_variant` and hands; mix references include `game_lineup.game_mix_id`.

## Seeding (`seedDefaultGameData`)

[`packages/api/src/services/seed-game-data.ts`](../../packages/api/src/services/seed-game-data.ts) seeds the built-in game groups + variants + named mixes for a user. Each seeded mix's ordered `game_mix_variant` rows reference **this user's** freshly seeded variant ids — `DEFAULT_GAME_MIXES.variantKeys` map to `DEFAULT_GAME_VARIANTS` keys purely as seed-time lookups; the keys themselves are never persisted as memberships.

**Idempotency guard (c09)**: if the user owns any group, variant or mix row, including archived rows, the seed is a no-op. Archiving or deleting builtins therefore never causes them to be re-seeded. Migration `0067_ring_game_rule_versions.sql` keeps this guard valid: an owner with legacy ring games and no game masters receives the complete default set before any stand-in is created, so stand-ins never land on an unseeded account.

**Call sites**:

- Once from better-auth's `user.create` hook (`onUserCreated` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts)). The hook body wraps it in try/catch: **signup must succeed even if seeding fails** (c13) — every `list` procedure self-seeds on next read, so a seed failure here would otherwise take down account creation entirely for an unrelated, retriable side effect.
- Defensively from `gameVariant.list` / `gameGroup.list` / `gameMix.list` (c32), for legacy accounts. The seed checks all three tables, including archived rows, before inserting.

**Race design (stable per-user ids)**: deterministic ids and `onConflictDoNothing` inserts make concurrent seeds converge. All statements run in one `runBatch`; seed errors are not swallowed.

**Fail-closed data-entry guards**: a `groupKey` with no matching seeded group fails closed instead of inserting a dangling `groupId`; a mix with no resolvable `variantKey` seeds an empty composition rather than handing Drizzle `values([])` (which throws — and would turn all three `list` procedures into a 500 for that user). Membership inserts are chunked through the same helper as the mix router ([Normalized composition reads](#normalized-composition-reads)) so a future builtin mix wide enough to overflow D1's bind-param cap is split, not rejected at runtime.

**Atomicity (SA2-116)**: the seed statements commit as one atomic batch, so a failure cannot leave partial built-in game data. Batch mechanics: [`data-integrity.md`](../design/data-integrity.md).

## Normalized composition reads

[`packages/api/src/services/game-mix.ts`](../../packages/api/src/services/game-mix.ts) reconstructs the public `games: string[]` contract from the normalized junction rows with owner-scoped queries. `chunkForInsert` splits membership rows across INSERTs that stay under D1's bind-param cap, with the width computed from the **row shape rather than a literal**, so adding a column to `gameMixVariant` cannot silently overflow the cap. It is shared by the mix router and the seed so both size their INSERTs the same way. The D1 bind-param arithmetic itself is owned by [`data-integrity.md`](../design/data-integrity.md).

