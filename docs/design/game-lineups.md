# Game Lineups and Rule Versions

Historical context is preserved in the [archive](../archive/game-lineups-history.md).

This document describes lineups and immutable rule versions. [`data-model.md`](data-model.md) owns the shared invariants; [`api.md`](api.md) owns procedure schemas and the MCP map.

## Purpose and final shape

A **lineup** answers which games are played, grouped by blind structure. A **rule version** adds stakes, scalar rules and, for a tournament, levels and prices. An entry shares its master's immutable version until it overrides it. Editing a master advances its current version without changing any historical entry.

```text
game_mix ── game_lineup ── game_lineup_group ── game_lineup_variant ── game_variant
                              │ game_group_id (structure frozen when written)
ring_game ── current_rule_id → cash_rule ── cash_rule_stake
                                  ↑ entry_cash.cash_rule_id
tournament ─ current_rule_id → tournament_rule ── tournament_rule_price
                                  │                     ↑ ledger_line.price_id
                                  └─ tournament_rule_level ── tournament_rule_level_stake
                                  ↑ entry_tournament.tournament_rule_id
```

Names resolve through ids, including archived rows. A rename changes the displayed name, not the historical composition or the statistics bucket. Moving a variant to another game group does not change the structure stored on existing lineup groups.

## Tables and database constraints

Unless stated otherwise, every row carries `user_id NOT NULL`; id-bearing rows use `id TEXT PRIMARY KEY`, `created_at`, and `UNIQUE (id, user_id)`. References to owned entities include `user_id`. User deletion cascades; children of an aggregate cascade from their parent. References across aggregates use NO ACTION, never RESTRICT or SET NULL. Declare each parent's referenced UNIQUE key before creating its children. Register the tables in `packages/db/src/schema.ts` and keep the Drizzle schema and migration metadata aligned.

### Lineups

| Table | Columns and keys | References |
| --- | --- | --- |
| `game_lineup` | `id`, `user_id`, nullable `game_mix_id`, `created_at` | `(game_mix_id, user_id) → game_mix(id, user_id)` NO ACTION |
| `game_lineup_group` | `id`, `user_id`, `lineup_id`, `position`, `game_group_id`, nullable `name`; UNIQUE `(lineup_id, position)`, `(lineup_id, id)`, `(id, user_id)` | `(lineup_id, user_id) → game_lineup` CASCADE; `(game_group_id, user_id) → game_group` NO ACTION |
| `game_lineup_variant` | `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`; PK `(lineup_group_id, variant_id)`, UNIQUE `(lineup_group_id, position)`, `(lineup_id, variant_id)` | `(lineup_group_id, user_id) → game_lineup_group` CASCADE; `(lineup_id, lineup_group_id) → game_lineup_group(lineup_id, id)` CASCADE; `(variant_id, user_id) → game_variant` NO ACTION |

Positions are nonnegative integers. `lineup_id` on the variant junction makes “a variant occurs at most once in a lineup” an enforceable UNIQUE constraint, not a cross-group API convention. `game_group(id, user_id)` must have a UNIQUE key before these references exist.

A lineup has at least one group and each group at least one variant (API validation plus the structural audits of data-model.md §16). A newly assembled group contains variants whose current group matches `game_group_id`; existing compositions are not revalidated against later variant moves. There is no frozen-label exemption.

Built-in structures define these blind fields and required flags (`blind1Required`, `blind2Required`, `blind3Required`):

| Structure | blind1 | blind2 | blind3 |
| --- | --- | --- | --- |
| Limit | Small Bet — Must | Big Bet — Must | No label — Optional |
| Stud | Small Bet — Must | Big Bet — Must | Bring-in — Optional |
| Big Bet | SB — Must | BB — Must | No label — Optional |

Big Bet has only SB and BB; there is no Straddle field. User-created structures default all three flags to false (Optional). Ante is outside this requirement.

Only a labeled field may be Required (BAD_REQUEST otherwise). Rule writes reject a NULL required blind or a value in an unlabeled field using the lineup group’s stored `game_group_id`. Reusing an existing version does not revalidate its stakes. Clearing a label while saved stakes still contain a value in that field returns CONFLICT.

### Cash versions

`cash_rule` contains nullable `ring_game_id`, nullable `parent_rule_id`, required `lineup_id`, nullable `min_buy_in`, `max_buy_in`, `table_size`, and `house_rules`, besides the common columns.

- `(ring_game_id, user_id) → ring_game(id, user_id)` CASCADE. A NULL master is valid only for an unlinked rule.
- `(lineup_id, user_id) → game_lineup(id, user_id)` NO ACTION.
- `(parent_rule_id, user_id) → cash_rule(id, user_id)` NO ACTION and `(parent_rule_id, ring_game_id) → cash_rule(id, ring_game_id)` NO ACTION. The second FK prevents a child belonging to another non-NULL master (G1); the API also validates NULL-master cases, which SQLite's nullable composites cannot compare.
- UNIQUE `(id, ring_game_id)` and `(id, lineup_id)`, in addition to `(id, user_id)`.
- CHECK: buy-in bounds are nonnegative and `min_buy_in <= max_buy_in` when both exist; table size is 2–10. Text validation limits are owned by the API reference §2, not destructive DDL gates.

`cash_rule_stake` has PK `(rule_id, lineup_group_id)` and columns `user_id`, `lineup_id`, nullable `blind1`, `blind2`, `blind3`, `ante`, `ante_type`.

- `(rule_id, user_id) → cash_rule` CASCADE and `(rule_id, lineup_id) → cash_rule(id, lineup_id)` CASCADE.
- `(lineup_group_id, user_id) → game_lineup_group` NO ACTION and `(lineup_id, lineup_group_id) → game_lineup_group(lineup_id, id)` NO ACTION.
- All amounts are nonnegative integers; `ante_type` is NULL or `none | all | bb`. It is explicit, never inferred from the amount.

Exactly one stake row exists for every group of the version's lineup, even if every amount is NULL. The FKs prevent stakes from being attached to another lineup; API validation and a coverage audit prevent missing rows.

### Tournament versions, levels and prices

`tournament_rule` has nullable `tournament_id`, nullable `parent_rule_id`, required default `lineup_id`, nullable `starting_stack`, `table_size`, `bounty_amount`, and `house_rules`.

Its owner, lineup and parent references follow `cash_rule`: the master reference cascades; parent/lineup references use NO ACTION. Declare UNIQUE `(id, tournament_id)`, `(id, lineup_id)` and `(id, user_id)`. Parent references include both `(parent_rule_id, user_id)` and `(parent_rule_id, tournament_id)`. Stack and bounty are nonnegative; table size is 2–10. Text validation limits are owned by the API reference §2.

`tournament_rule_level` contains `id`, `user_id`, `rule_id`, `ordinal` (starting at 1), nullable displayed `level`, `is_break` (0/1), nullable `minutes` (at least 1), required effective `lineup_id`, `inherits_lineup` (0/1), and nullable `inherited_lineup_id`.

- `(rule_id, user_id) → tournament_rule` CASCADE; `(lineup_id, user_id) → game_lineup` NO ACTION.
- UNIQUE `(rule_id, ordinal)`, `(id, lineup_id)` and `(id, user_id)`.
- G2 is enforced by a **mirror column**, not by an API-only comparison:

  ```sql
  CHECK (
    (inherits_lineup = 1 AND inherited_lineup_id IS NOT NULL
      AND inherited_lineup_id = lineup_id)
    OR (inherits_lineup = 0 AND inherited_lineup_id IS NULL)
  )
  FOREIGN KEY (rule_id, inherited_lineup_id)
    REFERENCES tournament_rule(id, lineup_id) ON DELETE CASCADE
  ```

  An inheriting level therefore cannot store a lineup different from its version's default. An overriding level keeps its effective lineup but has no inheritance mirror. API `game: null` expresses inheritance; it never makes the persisted effective `lineup_id` NULL.

`tournament_rule_level_stake` has PK `(level_id, lineup_group_id)` and otherwise the cash stake shape. Its owner FKs are `(level_id, user_id) → tournament_rule_level` CASCADE and `(level_id, lineup_id) → tournament_rule_level(id, lineup_id)` CASCADE; its lineup-group references match the cash table. A non-break level has exactly one row per effective lineup group; a break has none. Tournament ante type is per **level × group**, with legacy missing values remaining NULL.

`tournament_rule_price` contains `id`, `user_id`, `rule_id`, `kind`, `asset_id`, `amount`, `fee`, nullable `chips`, `label`, and `ordinal`.

- `kind` is `entry | reentry | addon` (U7). Old `chip_purchase` is not a final price kind.
- `asset_id` is NOT NULL: `(asset_id, user_id) → asset(id, user_id)` NO ACTION. There is no implicit “entry's currency” fallback.
- `(rule_id, user_id) → tournament_rule(id, user_id)` CASCADE; UNIQUE `(rule_id, ordinal)` and `(id, user_id)`.
- `amount` and `fee` are nonnegative integers in the paying asset's smallest unit; fee defaults to 0. `chips` is NULL or nonnegative. Label validation and omission semantics are owned by the API reference §2.
- A cash price and a ticket price are separate rows, even when both are `kind: entry`. Prices are written only as part of a whole tournament version.

The API reference §2 owns price inputs and generated-id semantics; clients do not assign price ids. `ledger_line.price_id` references `(id, user_id)` of this table with NO ACTION. Counts of purchases come from payment lines carrying a price id, not a stored count. Changing a rule does not rewrite prices on historical payment lines: those may keep the previous immutable version's price ids, while new payments select prices from the entry's current version. An addon price produces the canonical `chip_purchase` ledger role (and a fee line when needed); price kinds and ledger roles are distinct enums. Manual payments may omit priceId.

### Master and entry reference columns

Each master has `current_rule_id NOT NULL` and nullable `default_asset_id`:

- `(current_rule_id, user_id) → cash_rule(id, user_id)` / `tournament_rule(id, user_id)` NO ACTION. The API and structural audits additionally require the current version to belong to that master.
- `(default_asset_id, user_id) → asset(id, user_id)` NO ACTION. Deleting an asset never silently clears a master's default.
- Existing owner and room composites remain intact. Metadata such as name, memo and archive state stays on the master; every rule field moves to its current version.

Entry details reference their cash or tournament rule by ownership and master composites. Rule ids are required, including for unlinked entries, which have standalone rules. NULL-master parity is validated by the API and structural audits.

G7 indexes include `entry_cash(cash_rule_id)`, `entry_tournament(tournament_rule_id)`, `ledger_line(price_id)`, both masters' `(current_rule_id)`, version `(ring_game_id)` / `(tournament_id)` and `(parent_rule_id)`, and child `(rule_id)` / `(level_id)` indexes where not already the leading columns of a key. Index the asset and lineup reference columns used for deletion guards and hydration too.

## Immutable writes and reuse

Published lineups, versions, levels, stakes and prices are immutable. Master creation assigns the new rule to its master within the same batch. No procedure patches an existing version or deletes its children to edit a structure. Parent master deletion may cascade through its unused aggregate; account deletion must also work.

`game` is exactly one of `{ variantId }`, `{ gameMixId }`, `{ lineupId }`; on a tournament level, `null` means inherit. Each stakes element names its `gameGroupId`, which the server checks against the resulting ordered group. Omitted stakes carry forward by `(game_group_id, ordinal among groups of that structure)`, never by absolute position.

- A variant produces one group with one variant.
- A mix buckets its ordered variants by their current group, with groups ordered by the first appearance of that structure in the mix. Renames cannot reorder them.
- A lineup id reuses the immutable composition, including legacy custom mixes with several groups of the same structure.
- On create, omitted game inherits from the linked master or uses the user's builtin NLH when unlinked. No API manufactures an archived stand-in master.

Reuse a lineup with the same signature (`game_mix_id`, ordered structures and ordered variant ids) from the request, current rule's whole structure, or linked master's whole structure. Do not globally deduplicate or garbage-collect lineups. Reuse an unchanged rule version only within the same master identity: its signature includes lineup, scalar fields, stakes, levels with inheritance and effective lineups, and prices. Saving unchanged content must not churn ids.

All referenced ids are ownership-checked with uniform FORBIDDEN, including asset, lineup, rule, level and price ids. Bulk ownership lookups are chunked, not N+1 queries. A new selection cannot introduce archived masters; reusing an existing lineup preserves archived games. A variant used by a non-archived mix cannot be archived.

A rule write is one `db.batch()`: insert lineups and their children, insert the new version, insert stakes/levels/level stakes/prices, then repoint the master and/or entry. If the default lineup changes, inheriting levels in the **new** version receive the new default and mirror; stakes carry forward by structure plus ordinal. Old versions remain untouched. Whole tournament writes replace the supplied structure atomically; levels have an explicit input maximum and inserts derive their chunk width from the declared row shape to stay under D1's 100-bind limit.

Tournament writes must stay within the D1 invocation budget, including auth/session reads and each batch statement; see [data-model.md](data-model.md).

There is no row-level edit facade over immutable versions. `tournament.create/update` and `createWithLevels/updateWithLevels` all use complete version bodies; the latter pair is exposed by MCP. Procedure details and omission semantics live in the API reference.

### Master ↔ entry operations

The `entry` and `live` routers expose these operations:

| Procedure | Atomic effect |
| --- | --- |
| `overrideRule { id, rule }` | Build/reuse a child version under the entry's existing master (or an unlinked child when unlinked), with the entry's current version as parent, and repoint only the entry. No `updateSnapshot` alias. |
| `applyMasterRule { id }` | Repoint the entry to its linked master's current version. |
| `pushRuleToMaster { id }` | Require a linked master; point its current rule at the entry's version when already under that master. If content must be copied under the destination master, insert an equal version with that master's current rule as parent, and repoint both. |
| `relink { id, ringGameId \| tournamentId, keepRule }` | Validate the destination's ownership and kind. With `keepRule: false`, adopt its current version. With `keepRule: true`, copy the entry's complete version under the new master (parent = new master's current version), then change the master link and rule id in the same batch. Unlinking with keepRule creates a standalone copy with `parent_rule_id` NULL; never leave a version owned by the previous master attached to a different link. |
| `restoreRule { id, masterId: Id \| null, ruleVersionId, masterRuleVersionId? }` | Restore the entry's master link and existing version in one batch; when supplied, also restore the master's current version in that batch. Versions must belong to that master (or be standalone when masterId is NULL), otherwise BAD_REQUEST. Archived masters and versions are allowed. |

Drift is **version id comparison**, not normalized field comparison: for a linked entry, `ruleDrift = ruleVersionId !== currentMasterRuleId`; an unlinked entry has no master drift. Applying or pushing rules makes the ids equal. Relinking with keepRule may intentionally leave drift even when some values happen to match. The old column-by-column comparison and its normalization are no longer used.

`restoreRule` only repoints to existing versions; it creates no version and therefore restores the original ids and drift. It reverses overrideRule/applyMasterRule/pushRuleToMaster/relink; reversing createAndAssign also deletes the created master afterward. `ringGame.restoreRule` and `tournament.restoreRule` similarly repoint the master's current selection to an existing version owned by that master, without creating a version. These screen-only Undo operations are excluded from MCP.

The API rejects a live overrideRule/applyMasterRule/relink/restoreRule with BAD_REQUEST before any write if lowering tableSize would put an active table player or the self player outside the new seat range. Validate the resulting version and folded seats together, not only the supplied partial rule.

## Reads, statistics and MCP

Master outputs include `defaultAssetId`, `currentRuleId`, nested `ruleVersion` and a `lineups` map. Entry/live outputs expose `ruleVersionId`, `currentMasterRuleId`, `ruleDrift`, nested `ruleVersion` and the same map. There are no legacy label I/O fields or parallel flat rule fields.

Hydrate each lineup once, keyed by id: `gameMixId`, display name, ordered groups (`gameGroupId`, optional stored name, ordered variants with id/label/shortLabel). Levels return inheritance (`game: null`) separately from their effective lineup. Names resolve through user-scoped joins, archived rows included. The display name is the saved mix's current label, the lone variant's label for one group/one variant, or the groups' short labels. Unnamed groups use the live game-group name and an ordinal when structures repeat. Hydration is batched.

Variant buckets use `mix:<id>` when a saved mix is present, `variant:<id>` for one group/one variant, and one Custom mix bucket otherwise. Tournaments use their version's default lineup, not a particular level's. A lineup with exactly **one group** has a usable BB from its stake row, including single-structure mixes such as NLH/PLO; multi-group lineups have no single BB. See data-model.md §12 for the formulas and population.

Tools use the exact router schemas. Game inputs follow list-then-id via `game_variant_list` / `game_mix_list`; descriptions explain the group/stakes coupling, whole tournament replacement, inherited levels, required price assets and per-level/group ante type. No master delete is exposed through MCP. The API reference owns the final tool names and exposure decisions.

## Archive and deletion

Game-master lists support archive/restore and `includeArchived`. Default lists exclude archived rows; existing rule hydration always resolves them. Labels remain unique among archived rows too. A conflicting create can guide the caller to restore. Delete returns CONFLICT when a variant, mix or group is referenced; group guards count both variants and stored lineup groups. Archived rows are not offered for new selections.

A ring game or tournament referenced by an entry, by an entry's version, or through a historical price cannot be deleted; archive it instead. An unused master may be deleted: versions belong to its aggregate and cascade with their children. API guards prevent raw FK errors; the NO ACTION references remain the DB backstop. Room deletion must check referenced descendants as well. Account deletion succeeds because references use NO ACTION rather than RESTRICT.

