# Game Master Data

This document is the reference for the game master-data model: the per-user `game_group` / `game_variant` / `game_mix` tables, the self-freezing label semantics that every other table builds on, the migration-0049 expand/contract state of the `game_mix.games` compatibility mirror, signup seeding, and the web-layer invariants that guard the frozen snapshots. Chunking, batch atomicity and the TOCTOU/label-conflict error-mapping mechanics live in [`data-integrity.md`](data-integrity.md); statistics semantics in [`statistics.md`](statistics.md); test/CI mechanics in [`testing-and-tooling.md`](testing-and-tooling.md).

## The three master tables

All game master data is **per-user DB rows**. Both the built-in entries and any user-created ones live as rows in the same tables — the code constants in [`packages/db/src/constants/game-variants.ts`](../../packages/db/src/constants/game-variants.ts) (`DEFAULT_GAME_GROUPS`, `DEFAULT_GAME_VARIANTS`, `DEFAULT_GAME_MIXES`) are **seed data only, never a runtime fallback**. The DB rows are the runtime source of truth.

| Table | Built-ins seeded per user | `builtinKey` values for seeded rows |
|---|---|---|
| [`game_group`](../../packages/db/src/schema/game-group.ts) | 3 groups | `'bigbet' \| 'limit' \| 'stud'` |
| [`game_variant`](../../packages/db/src/schema/game-variant.ts) | 21 variants | `'nlh' \| 'plo' \| …` |
| [`game_mix`](../../packages/db/src/schema/game-mix.ts) | 3 named mixes | `'horse' \| '8game' \| '10game'` |

`builtinKey` is null for user-created rows and **immutable**: it is intentionally absent from every update input schema, so a seeded row's `builtinKey` survives label/blind-label edits unchanged.

A mix is a reusable mixed-game definition — label + ordered game composition — not a session/game record itself. Its composition is read exclusively from the `game_mix_variant` junction table, where ownership and references use native foreign keys (but see [Migration 0049](#migration-0049-the-games-compatibility-mirror-expandcontract) for the transitional state).

### Canonical ordering

Ordering is builtin-first everywhere, produced by the shared `compareBuiltinFirst` comparator factory in [`packages/api/src/routers/_game-masters.ts`](../../packages/api/src/routers/_game-masters.ts): groups `limit → stud → bigbet` (structure-sheet convention), mixes `HORSE → 8-Game → 10-Game`, then user-created rows alphabetically by label; variant `sortOrder` is the `DEFAULT_GAME_VARIANTS` array index at seed time. [`packages/api/src/routers/session.ts`](../../packages/api/src/routers/session.ts) replicates the group ordering and must keep matching `gameGroup.list` / `useGameGroups`. The web treats the server list order as canonical and never re-sorts.

## Self-freezing labels: two reference styles

This is the load-bearing invariant of the whole model, and the one [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) (rule 7) sends tool-description authors here for. The game masters are referenced in **two different ways**, and getting them confused produces edits that are silently non-retroactive (or silently retroactive):

| Reference style | Where | Behavior on master edit |
|---|---|---|
| **Real foreign key** | `gameVariant.groupId` → `game_group.id`; `game_mix_variant` rows → `game_variant.id` | Resolved live. Editing the referenced row changes what every reader sees. |
| **Frozen label copy (self-freezing)** | Every `variant` column elsewhere in the schema (`ring_game`, `tournament`, `session_cash_detail`, `session_tournament_detail`, …) | Stores the master row's display **label verbatim at write time**. Editing or deleting the master row never touches past sessions/games. |

Consequences, stated completely:

- `gameGroup.update` re-labels live: a variant's blind-slot labels are resolved at render time through its owning group (`use-variant-labels.ts` / `labelsFor`), so renaming a group's slot labels changes how past sessions render.
- `gameVariant.update` / `gameMix.update` rewrite **no stored text**: past rows keep the old label. "Nothing stored changed" is still not "nothing changed" — a frozen copy is resolved back to its master **by the copied text**, so a rename orphans the old rows. `labelsFor` in [`apps/web/src/shared/hooks/use-game-groups.ts`](../../apps/web/src/shared/hooks/use-game-groups.ts) then serves the fallback blind-slot labels (SB / BB / Straddle), which silently re-labels past Limit / Stud sessions and gives a Limit session a third blind slot its group does not have. A rename also splits one variant into two [`stats_breakdown`](statistics.md) buckets.
- **Deletion is free**: `variant` columns store the display label verbatim rather than a foreign key into the master tables, so deleting a variant or mix definition row never corrupts past sessions/games — no in-use guard is needed for history's sake (groups are the exception; see [Deletion guards](#deletion-guards)).
- Historical session/rule columns intentionally keep frozen labels and value-object JSON (`ring_game.mix_games`, `session_cash_detail.mix_games`, `blind_level.games`, `session_blind_level.games`), so editing or deleting a master never rewrites past play. The session-side snapshot-freezing rule for detail rows is in [`sessions-and-live-editing.md`](sessions-and-live-editing.md).
- Frozen values are full display labels ("8-Game", "NL Hold'em") — the UI renders them as-is; uppercasing would mangle them.

### The mix pseudo-variant

`mix` is a **mode, not a row**: the fixed key `MIX_VARIANT = "mix"` with display label `MIX_VARIANT_LABEL = "Mixed Game"` ([`packages/db/src/constants/game-variants.ts`](../../packages/db/src/constants/game-variants.ts)). It is the only exception to "frozen values are labels" — it is stored as the fixed key, frozen into old rows before named mix masters existed, and remains valid without a master row. `variantDisplayLabel` maps only this key; every other stored value is already a display label. `DEFAULT_VARIANT_LABEL` (the form default) is the **label** of the seeded NLH row, not a legacy key — forms freeze display labels, so the default must be one.

`reconcileCashRuleSelection` in [`packages/api/src/routers/session.ts`](../../packages/api/src/routers/session.ts) keeps the frozen cash-rule discriminator and its optional mixed-game payload coherent at every write boundary: named mixes are labels of the caller's `game_mix` rows; the legacy `mix` sentinel remains valid without a master row; and because snapshots are deliberately self-freezing, re-submitting an unchanged named mix still works after that master is renamed or deleted.

## Label namespace

- **Reserved labels (c42)**: because the mix pseudo-variant is a mode rather than a per-user row, its key and display label (`"mix"`, `"Mixed Game"`) are reserved — a real game-variant/game-mix row can never collide with them. `RESERVED_LABELS` in [`packages/api/src/routers/_game-masters.ts`](../../packages/api/src/routers/_game-masters.ts) is the single copy shared by the game-group/game-variant/game-mix routers.
- **The namespace spans variants AND mixes (c42)**: a mix's label is chosen from the same client-side select as a plain game variant — both freeze into the same `variant` string once picked — so `assertLabelNamespaceAvailable` checks the caller's game variants, the caller's mixes, *and* the reserved mix-mode strings. It is shared by `game-variant.ts` (`self: "variant"`) and `game-mix.ts` (`self: "mix"`); excluding the row's own id is what lets an unchanged-label update through.
- **DB backstop (c14)**: each table carries an exact-case unique index on `(userId, label)` — a backstop for the app-level case-insensitive check against a TOCTOU race, **not** a replacement for it. The guard that actually fires under SQLite is the migration-0041 BEFORE trigger; that mechanic, and the two shapes of label collision, are documented in [`data-integrity.md`](data-integrity.md).
- **Builtin uniqueness (c08)**: each table also has a unique index on `(userId, builtinKey)`. SQLite treats NULLs as distinct, so this never constrains user-created rows against each other — it only guards the seeded builtin rows per user against a concurrent double-seed duplicating them.

## Shared write==read schemas and the group-span limit

[`packages/db/src/schemas/game.ts`](../../packages/db/src/schemas/game.ts) holds the shared write=read Zod schemas for mixed-game "game groups" — a group bundles the games that share one blind structure. Stored as JSON on `ring_game.mix_games` / `session_cash_detail.mix_games` (`mixGamesSchema`) and `blind_level.games` / `session_blind_level.games` (`levelGamesSchema` — NULL means a legacy single-structure level, and for ring games a non-mix game). `levelGameGroupSchema` reuses the group shape **minus `anteType`** (ante handling is uniform inside a level); minutes/isBreak stay on the level itself. db, api, and web all validate through these exact objects, per [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md).

**`MAX_MIX_GROUPS = 12` (c58)** is defined once in `schemas/game.ts` and shared by `mixGamesSchema`/`levelGamesSchema` *and* by the game-mix router's master-mix group-span guard, so the two limits cannot drift apart. The reason the master side must enforce it too: a mix built from variants spanning more than `MAX_MIX_GROUPS` distinct game groups can never be turned into a session's `mixGames` (that array is itself capped at `MAX_MIX_GROUPS` groups), so `assertGroupSpanWithinLimit` rejects at the master-mix level instead of producing a mix that silently truncates or fails later.

`validateGamesOwnership` guards the `games` array (ordered `game_variant` ids) on mix create/update: one `WHERE id IN (…) AND userId = caller` query; if the owned count differs from the requested count → uniform FORBIDDEN (SA2-177, SA2-183). Callers must reject duplicate ids first (`assertNoDuplicateGames`) so the count comparison is meaningful; `groupId` is returned so the caller can also bound the group span (c58).

## Deletion guards

- **Groups (SA2-165)**: a group in use by one of the caller's own game variants cannot be deleted out from under it — an explicit count check runs before the delete, backed by `gameVariant.groupId`'s `onDelete: "restrict"` FK as the DB backstop. The FK is the backstop, the router's count check is the primary guard (and produces the friendly CONFLICT).
- **Variants**: a variant referenced by one of the caller's mixes gets the same friendly CONFLICT instead of relying on the junction's `NO ACTION` foreign key to surface a database error; the reverse lookup is scoped to the caller as a defense-in-depth guard.
- **Mixes**: deletion is free — self-freezing labels mean no in-use guard is needed (same as `gameVariant.delete` with respect to history; see [Self-freezing labels](#self-freezing-labels-two-reference-styles)).

## Seeding (`seedDefaultGameData`)

[`packages/api/src/services/seed-game-data.ts`](../../packages/api/src/services/seed-game-data.ts) seeds the built-in game groups + variants + named mixes for a user. Each seeded mix's ordered `game_mix_variant` rows reference **this user's** freshly seeded variant ids — `DEFAULT_GAME_MIXES.variantKeys` map to `DEFAULT_GAME_VARIANTS` keys purely as seed-time lookups; the keys themselves are never persisted as memberships.

**Idempotency guard (c09)**: if the user already has ANY `gameGroup` row OR ANY `gameVariant` row OR ANY `gameMix` row, the seed is a no-op. That respects an intentional deletion — a user who cleared out their variant list (or just their mixes) stays empty rather than being re-seeded on the next read. Checking all three (not just group/variant) closes a gap where a user who deleted every group/variant but kept a custom mix would have had the builtins re-inserted underneath their remaining mix.

**Call sites**:

- Once from better-auth's `user.create` hook (`onUserCreated` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts)). The hook body wraps it in try/catch: **signup must succeed even if seeding fails** (c13) — every `list` procedure self-seeds on next read, so a seed failure here would otherwise take down account creation entirely for an unrelated, retriable side effect.
- Defensively from `gameVariant.list` / `gameGroup.list` / `gameMix.list` (c32), so legacy accounts that predate the auth-hook seed still get the builtin list on first read. Each router's self-seed is only reached when **that** table is empty; `seedDefaultGameData` still re-checks all three tables itself (c09), so a caller who deleted only their groups (but kept a variant/mix) is correctly left empty.

**Race design (stable per-user ids)**: seed ids are deterministic per user, so two racing seed batches (another `list` self-seed, or the auth-hook seed) point at the same group/variant ids — a losing group insert cannot leave its variant statements referencing group ids that never committed. `.onConflictDoNothing()` alone is NOT enough under the migration-0041 label triggers: a BEFORE trigger's `RAISE(ABORT)` fires before ON CONFLICT resolution and rejects the whole losing batch — so the race is caught by the swallow below, not by conflict resolution.

**The swallow and its soundness invariant**: when a concurrent seed committed the same builtin rows first, the 0041 label triggers `RAISE(ABORT)` on the losing batch. That is a benign "someone else already seeded" outcome, not a failure — the three `list` procedures call the seed WITHOUT a try/catch, so surfacing it would turn a routine first-load race into a 500 (c09). Any OTHER error is a real failure and must propagate. This swallow is **only sound while the builtin labels are mutually unique** under those triggers — two builtins sharing a normalized label would abort every seed batch deterministically and be silently hidden, no-opping the seed for EVERY new account. That invariant is pinned by `seed-game-data.test.ts` (see [`testing-and-tooling.md`](testing-and-tooling.md)); it fails loudly if a future edit breaks it.

**Fail-closed data-entry guards**: a `groupKey` with no matching seeded group fails closed instead of inserting a dangling `groupId`; a mix with no resolvable `variantKey` seeds an empty composition rather than handing Drizzle `values([])` (which throws — and would turn all three `list` procedures into a 500 for that user). Membership inserts are chunked through the same helper as the mix router ([Normalized composition reads](#normalized-composition-reads)) so a future builtin mix wide enough to overflow D1's bind-param cap is split, not rejected at runtime.

**Atomicity (SA2-116)**: every statement — 33 with the current constants (fewer if a mix resolves to no variants) — commits as one atomic `db.batch()`, so a failure cannot leave a user with partial built-in game data. Batch-atomicity mechanics: [`data-integrity.md`](data-integrity.md). The seed also keeps the physical `games` mirror column synchronized for the pre-0049 Worker — see the next section.

## Migration 0049: the `games` compatibility mirror (expand/contract)

`game_mix` is mid expand/contract. The composition's source of truth is the normalized `game_mix_variant` junction, but the legacy `game_mix.games` JSON column **remains temporarily as a rolling-deploy compatibility mirror for the pre-0049 Worker**. It is deprecated: **never use it to hydrate API responses.**

**Direction of truth during the expand phase**: [migration 0049](../../packages/db/src/migrations/0049_normalize_game_mix_variants.sql)'s `game_mix_variants_compat_*` triggers rebuild the normalized rows from `games` on every write that touches it — so while those triggers exist, the JSON column is the *effective derivation source* even though the API never reads it. The API already writes the junction rows explicitly, and both paths produce identical rows; the explicit writes are what keeps the routers correct once the contract migration drops the triggers, so that migration needs no further router change.

> **Ordering trap — mirror UPDATE must run LAST.** In `gameMix.create` and `gameMix.update` ([`packages/api/src/routers/game-mix.ts`](../../packages/api/src/routers/game-mix.ts)), and in `seedDefaultGameData`, the batch writes the normalized junction rows first and the `games` mirror UPDATE **last**. The compatibility triggers are DELETE-then-rebuild (they wipe the mix's junction rows and re-insert them from the JSON), so the final mirror UPDATE fires a trigger that **replaces** the explicitly written normalized rows with byte-identical ones — that is the intended steady state. Two details keep this correct and break if the ordering changes:
>
> - On create, the master INSERT deliberately carries `games: []` so the AFTER INSERT trigger's rebuild is a no-op; the mirror only gains its real value in the final UPDATE. If the mirror were written before the junction INSERTs, the trigger would materialize the full row set first and the explicit INSERTs would then collide with it (duplicate-key), aborting the whole batch.
> - Running the mirror UPDATE last is also what keeps the pre-0049 Worker contract valid during a rolling deployment or rollback: old Workers can still write the legacy column, and the trigger keeps the junction in sync from it.
>
> Delete the mirror statements together with the contract migration that drops the trigger.

A bulk restore is not an application write, so the preview/dev DB seed pipeline must stash the triggers around replaying the production dump (the trigger otherwise duplicates the dump's own junction rows — this took the db-migrate job down once). That pipeline, and the interrupted-apply/retry semantics of 0049 itself, are pinned by tests documented in [`testing-and-tooling.md`](testing-and-tooling.md); migration-authoring rules are in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md).

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
