# Game Master Data

> The v2 data model ([data-model-v2.md](data-model-v2.md)) replaces parts of this design in stages. For the game masters, [`game-lineups.md`](game-lineups.md) is the target model (SA2-242) that moves rule masters and sessions from self-freezing labels to id-referenced lineups. This file describes the running code until those phases land.

This document describes the per-user `game_group` / `game_variant` / `game_mix` tables, self-freezing label semantics, signup seeding, and the web-layer invariants guarding frozen snapshots. Chunking, batch atomicity and label-conflict error mapping live in [`data-integrity.md`](data-integrity.md); statistics semantics in [`statistics.md`](statistics.md); test/CI mechanics in [`testing-and-tooling.md`](testing-and-tooling.md).

## The three master tables

All game master data is **per-user DB rows**. Both the built-in entries and any user-created ones live as rows in the same tables — the code constants in [`packages/db/src/constants/game-variants.ts`](../../packages/db/src/constants/game-variants.ts) (`DEFAULT_GAME_GROUPS`, `DEFAULT_GAME_VARIANTS`, `DEFAULT_GAME_MIXES`) are **seed data only, never a runtime fallback**. The DB rows are the runtime source of truth.

| Table | Built-ins seeded per user | `builtinKey` values for seeded rows |
|---|---|---|
| [`game_group`](../../packages/db/src/schema/game-group.ts) | 3 groups | `'bigbet' \| 'limit' \| 'stud'` |
| [`game_variant`](../../packages/db/src/schema/game-variant.ts) | 21 variants | `'nlh' \| 'plo' \| …` |
| [`game_mix`](../../packages/db/src/schema/game-mix.ts) | 3 named mixes | `'horse' \| '8game' \| '10game'` |

`builtinKey` is null for user-created rows and **immutable**: it is intentionally absent from every update input schema, so a seeded row's `builtinKey` survives label/blind-label edits unchanged.

A mix is a reusable mixed-game definition — label + ordered game composition — not a session/game record itself. Composition is read and written exclusively through `game_mix_variant`, ordered by `position`, with ownership and references enforced by foreign keys. The retired `game_mix.games` column is written as `'[]'` and never read; SA2-418 removes it.

### Canonical ordering

Ordering is builtin-first everywhere, produced by the shared `compareBuiltinFirst` comparator factory in [`packages/api/src/routers/_game-masters.ts`](../../packages/api/src/routers/_game-masters.ts): groups `limit → stud → bigbet` (structure-sheet convention), mixes `HORSE → 8-Game → 10-Game`, then user-created rows alphabetically by label; variant `sortOrder` is the `DEFAULT_GAME_VARIANTS` array index at seed time. The web treats the server list order as canonical and never re-sorts.

## Self-freezing labels: two reference styles

This is the load-bearing invariant of the whole model, and the one [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) (rule 7) sends tool-description authors here for. The game masters are referenced in **two different ways**, and getting them confused produces edits that are silently non-retroactive (or silently retroactive):

| Reference style | Where | Behavior on master edit |
|---|---|---|
| **Real foreign key** | `gameVariant.groupId` → `game_group.id`; `game_mix_variant` rows → `game_variant.id` | Resolved live. Editing the referenced row changes what every reader sees. |
| **Frozen label copy (self-freezing)** | Legacy `variant` columns (`tournament`, `session_cash_detail`, `session_tournament_detail`, …) | Stores the master row's display **label verbatim at write time**. Editing or deleting the master row never touches past sessions/games. |

Consequences, stated completely:

- `gameGroup.update` re-labels live: a variant's blind-slot labels are resolved at render time through its owning group (`use-variant-labels.ts` / `labelsFor`), so renaming a group's slot labels changes how past sessions render.
- `gameVariant.update` / `gameMix.update` rewrite **no stored text**: past rows keep the old label. "Nothing stored changed" is still not "nothing changed" — a frozen copy is resolved back to its master **by the copied text**, so a rename orphans the old rows. `labelsFor` in [`apps/web/src/shared/hooks/use-game-groups.ts`](../../apps/web/src/shared/hooks/use-game-groups.ts) then serves the fallback blind-slot labels (SB / BB / Straddle), which silently re-labels past Limit / Stud sessions and gives a Limit session a third blind slot its group does not have. A rename also splits one variant into two [`stats_breakdown`](statistics.md) buckets.
- **Deletion is guarded**: frozen labels do not themselves reference masters, but normalized composition, lineups and hands do. Referenced masters cannot be hard-deleted; archive them instead (see [Deletion guards](#archive-and-deletion-guards)).
- Legacy session/rule columns retain frozen labels and value-object JSON (`session_cash_detail.mix_games`, `blind_level.games`, `session_blind_level.games`). Ring games instead reference immutable rule versions and lineups by id.
- Frozen values are full display labels ("8-Game", "NL Hold'em") — the UI renders them as-is; uppercasing would mangle them.

### The mix pseudo-variant

`mix` is a **mode, not a row**: the fixed key `MIX_VARIANT = "mix"` with display label `MIX_VARIANT_LABEL = "Mixed Game"` ([`packages/db/src/constants/game-variants.ts`](../../packages/db/src/constants/game-variants.ts)). It is the only exception to "frozen values are labels" — it is stored as the fixed key, frozen into old rows before named mix masters existed, and remains valid without a master row. `variantDisplayLabel` maps only this key; every other stored value is already a display label. `DEFAULT_VARIANT_LABEL` (the form default) is the **label** of the seeded NLH row, not a legacy key — forms freeze display labels, so the default must be one.

Ring-game writes select a variant, named mix, or existing lineup by id; the former cash-rule label resolution and sentinel paths are removed.

## Label namespace

- **Per-table namespace**: expression UNIQUE indexes enforce `(user_id, lower(trim(label)))` separately for groups, variants and mixes, including archived rows. A variant and a mix may share a label; `"mix"` and `"Mixed Game"` are not reserved by the API.
- **Conflict reporting**: `runLabelWrite` maps index conflicts to `CONFLICT`, guiding the caller to restore an archived holder where applicable. See [`data-integrity.md`](data-integrity.md).
- **Builtin uniqueness (c08)**: each table also has a unique index on `(userId, builtinKey)`. SQLite treats NULLs as distinct, so this never constrains user-created rows against each other — it only guards the seeded builtin rows per user against a concurrent double-seed duplicating them.

## Shared write==read schemas and the group-span limit

[`packages/db/src/schemas/game.ts`](../../packages/db/src/schemas/game.ts) holds the legacy shared write=read Zod schemas for mixed-game groups, including `mixGamesSchema` and `levelGamesSchema` for the remaining legacy session and tournament paths. Ring-game rule writes instead use id-based lineups and stakes.

Legacy level-game writes use [`packages/api/src/services/game-structure.ts`](../../packages/api/src/services/game-structure.ts) to enforce one resolved game group per stored group (SA2-224). Existing stored groups are exempt when variants have subsequently moved groups, allowing unchanged compositions to be retained.

**`MAX_MIX_GROUPS = 12` (c58)** is defined once in `schemas/game.ts` and shared by `mixGamesSchema`/`levelGamesSchema` *and* by the game-mix router's master-mix group-span guard, so the two limits cannot drift apart. The reason the master side must enforce it too: a mix built from variants spanning more than `MAX_MIX_GROUPS` distinct game groups can never be turned into a session's `mixGames` (that array is itself capped at `MAX_MIX_GROUPS` groups), so `assertGroupSpanWithinLimit` rejects at the master-mix level instead of producing a mix that silently truncates or fails later.

`validateGamesOwnership` guards the `games` array (ordered `game_variant` ids) on mix create/update: one `WHERE id IN (…) AND userId = caller` query; if the owned count differs from the requested count → uniform FORBIDDEN (SA2-177, SA2-183). Callers must reject duplicate ids first (`assertNoDuplicateGames`) so the count comparison is meaningful; `groupId` is returned so the caller can also bound the group span (c58).

## Archive and deletion guards

Lists exclude archived rows by default; `includeArchived` includes them. Group archive conflicts while it has active variants, and variant archive conflicts while an active mix contains it. Mix archive is unguarded. Restoring a variant with an archived group or a mix with an archived member returns `BAD_REQUEST`. New selections of archived groups or variants require restoring them first; retaining an existing mix composition is allowed.

Hard deletes use a single `DELETE` with `NOT EXISTS` reference guards and return `CONFLICT` directing users to archive referenced rows. Group references include variants and `game_lineup_group`; variant references include mix composition, `game_lineup_variant` and hands; mix references include `game_lineup.game_mix_id`.

## Seeding (`seedDefaultGameData`)

[`packages/api/src/services/seed-game-data.ts`](../../packages/api/src/services/seed-game-data.ts) seeds the built-in game groups + variants + named mixes for a user. Each seeded mix's ordered `game_mix_variant` rows reference **this user's** freshly seeded variant ids — `DEFAULT_GAME_MIXES.variantKeys` map to `DEFAULT_GAME_VARIANTS` keys purely as seed-time lookups; the keys themselves are never persisted as memberships.

**Idempotency guard (c09)**: if the user owns any group, variant or mix row, including archived rows, the seed is a no-op. Archiving or deleting builtins therefore never causes them to be re-seeded. Migration `0066` keeps this guard valid: an owner with legacy ring games and no game masters receives the complete default set before any stand-in is created, so stand-ins never land on an unseeded account.

**Call sites**:

- Once from better-auth's `user.create` hook (`onUserCreated` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts)). The hook body wraps it in try/catch: **signup must succeed even if seeding fails** (c13) — every `list` procedure self-seeds on next read, so a seed failure here would otherwise take down account creation entirely for an unrelated, retriable side effect.
- Defensively from `gameVariant.list` / `gameGroup.list` / `gameMix.list` (c32), for legacy accounts. The seed checks all three tables, including archived rows, before inserting.

**Race design (stable per-user ids)**: deterministic ids and `onConflictDoNothing` inserts make concurrent seeds converge. All statements run in one `runBatch`; seed errors are not swallowed.

**Fail-closed data-entry guards**: a `groupKey` with no matching seeded group fails closed instead of inserting a dangling `groupId`; a mix with no resolvable `variantKey` seeds an empty composition rather than handing Drizzle `values([])` (which throws — and would turn all three `list` procedures into a 500 for that user). Membership inserts are chunked through the same helper as the mix router ([Normalized composition reads](#normalized-composition-reads)) so a future builtin mix wide enough to overflow D1's bind-param cap is split, not rejected at runtime.

**Atomicity (SA2-116)**: the seed statements commit as one atomic batch, so a failure cannot leave partial built-in game data. Batch mechanics: [`data-integrity.md`](data-integrity.md).

## Normalized composition reads

[`packages/api/src/services/game-mix.ts`](../../packages/api/src/services/game-mix.ts) reconstructs the public `games: string[]` contract from the normalized junction rows with owner-scoped queries. `chunkForInsert` splits membership rows across INSERTs that stay under D1's bind-param cap, with the width computed from the **row shape rather than a literal**, so adding a column to `gameMixVariant` cannot silently overflow the cap. It is shared by the mix router and the seed so both size their INSERTs the same way. The D1 bind-param arithmetic itself is owned by [`data-integrity.md`](data-integrity.md).

## Web: frozen-snapshot invariants

The ring-game form ([`apps/web/src/features/rooms/components/ring-game-form/use-ring-game-form.ts`](../../apps/web/src/features/rooms/components/ring-game-form/use-ring-game-form.ts)) holds the frozen mix snapshot and the editor state. The invariants that guard the frozen data:

- **Gate on editor state, never a live master lookup (c02/c02b)**: a deleted or renamed mix master must not wipe the frozen snapshot on an unrelated edit. Correspondingly, edit `defaultValues` must carry the frozen `mixGames` snapshot — omitting it made every edit of a mix ring game submit `mixGames: null` and wipe it (c02).
- **Mode-switch clearing (c04/c02/c03)**: entering a mix clears the flat blind/ante fields — a mix submit carries its amounts inside `mixGames`, so the flat fields must go out empty, not with stale pre-switch values (c04). Leaving mixes clears the editor rows so they stay the single submit-time authority (c02). A variant whose group has no third blind slot drops a stale blind3 (c03) — enforced both on variant change and belt-and-braces at submit.
- **Stale-list race (c19)**: resolve just-created variants against the live `gameVariant.list` cache or the labels handed over by the mix sheet (`gameLabels`), never a possibly-stale `variants` list — a just-created variant id missing from a stale list must not silently drop its game.
- **Cell validation (c31, SA2-103)**: amount cells mirror the server's `.int().min(0)`; enforced by a `scripts/check-rules.ts` ban plus the server schema — not restated here.

## Web: blind structure editor traps

- **Level numbering**: next level number = one past the **highest** existing `level`, not `levels.length + 1`. The server-backed inline editor does not renumber on delete, so it legitimately holds gappy data (e.g. `[1, 2, 4, 5]`), and `length + 1` then collides with a still-present higher level, leaving two rows with the same `level` in undefined order under the server's `ORDER BY level ASC` (a shipped bug). The rule lives in [`blind-level-helpers.ts`](../../apps/web/src/features/rooms/utils/blind-level-helpers.ts)' `nextLevelNumber`, shared so both editors number identically.
- **Whole-list updates**: `updateWithLevels` re-creates every level (DELETE + INSERT); omitting `games` from the payload silently wiped stored per-level game sets on room-page edits (a shipped bug). The with-levels create/update path is driven directly from its single call site (`use-tournament-tab.ts` via `trpcClient.tournament.*WithLevels`) and forwards per-level `games` — a duplicate wrapper in `use-tournaments.ts` previously dropped `games` and, being unused, drifted out of sync.
- **Variant switches**: switching a tournament to a plain variant strips per-level game sets — otherwise they linger invisibly on local levels and get saved as ghost games. Mix→mix keeps stored games.
- **Serialized blur edits** ([`use-blind-levels.ts`](../../apps/web/src/features/rooms/hooks/use-blind-levels.ts)): blur-driven edits to one structure are serialized, and the list is invalidated only for the final queued edit — a failed rollback cannot revert a later successful cell, an intermediate refetch cannot wipe the optimistic base the next cell derives from, and each game-set edit derives from the previous optimistic result.
