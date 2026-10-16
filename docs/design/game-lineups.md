# Game Lineups and Rule Versions

This document defines the final lineup and immutable rule-version model and the L-series implementation path. [`data-model-v2.md`](data-model-v2.md) owns the shared invariants, migration framework, audit identifiers and complete task graph; its §5 summarizes these tables. [`api-after-data-model-v2.md`](api-after-data-model-v2.md) owns procedure schemas and the MCP map.

Production remains on its current release until data model v2 and the new UI ship together. Each API task implements its final contract and removes the replaced contract in the same PR. There are no compatibility aliases, label-based rule inputs, parallel representations or intermediate public API generations. All screen requirements belong to NEW-UI outside this project.

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

T38 creates all nine lineup/rule tables with their final DDL **before T07 backfills any v2 rows**. It also creates the rule and price reference columns on the still-empty entry and ledger tables with full composite FKs. L2 fills those columns; it does not add them.

Unless stated otherwise, every row carries `user_id NOT NULL`; id-bearing rows use `id TEXT PRIMARY KEY`, `created_at`, and `UNIQUE (id, user_id)`. References to owned entities include `user_id`. User deletion cascades; children of an aggregate cascade from their parent. References across aggregates use NO ACTION, never RESTRICT or SET NULL. Declare each parent's referenced UNIQUE key before creating its children. Register the tables in `packages/db/src/schema.ts` and keep the Drizzle schema and migration metadata aligned.

### Lineups

| Table | Columns and keys | References |
| --- | --- | --- |
| `game_lineup` | `id`, `user_id`, nullable `game_mix_id`, `created_at` | `(game_mix_id, user_id) → game_mix(id, user_id)` NO ACTION |
| `game_lineup_group` | `id`, `user_id`, `lineup_id`, `position`, `game_group_id`, nullable `name`; UNIQUE `(lineup_id, position)`, `(lineup_id, id)`, `(id, user_id)` | `(lineup_id, user_id) → game_lineup` CASCADE; `(game_group_id, user_id) → game_group` NO ACTION |
| `game_lineup_variant` | `user_id`, `lineup_id`, `lineup_group_id`, `variant_id`, `position`; PK `(lineup_group_id, variant_id)`, UNIQUE `(lineup_group_id, position)`, `(lineup_id, variant_id)` | `(lineup_group_id, user_id) → game_lineup_group` CASCADE; `(lineup_id, lineup_group_id) → game_lineup_group(lineup_id, id)` CASCADE; `(variant_id, user_id) → game_variant` NO ACTION |

Positions are nonnegative integers. `lineup_id` on the variant junction makes “a variant occurs at most once in a lineup” an enforceable UNIQUE constraint, not a cross-group API convention. `game_group(id, user_id)` must have a UNIQUE key before these references exist.

A lineup has at least one group and each group at least one variant (API validation plus the structural audits of data-model-v2.md §16). A newly assembled group contains variants whose current group matches `game_group_id`; existing compositions are not revalidated against later variant moves. There is no frozen-label exemption.

Built-in structures define these blind fields and required flags (`blind1Required`, `blind2Required`, `blind3Required`):

| Structure | blind1 | blind2 | blind3 |
| --- | --- | --- | --- |
| Limit | Small Bet — Must | Big Bet — Must | No label — Optional |
| Stud | Small Bet — Must | Big Bet — Must | Bring-in — Optional |
| Big Bet | SB — Must | BB — Must | No label — Optional |

Big Bet has only SB and BB; there is no Straddle field. User-created structures default all three flags to false (Optional). Ante is outside this requirement. T47 adds `game_group.blind{1,2,3}_required` as INTEGER NOT NULL DEFAULT 0, sets the built-in flags, and clears the built-in Big Bet Straddle label. Its migration aborts if any Big Bet stake has a blind3 value.

Only a labeled field may be Required (BAD_REQUEST otherwise). Shared L1/L1b stake-write validation, also used by L2, rejects a newly written stake with a NULL required blind or a value in an unlabeled field with BAD_REQUEST, using the lineup group's stored `game_group_id`. Reusing an existing version does not revalidate its stakes. Clearing a label while saved stakes still contain a value in that field returns CONFLICT.

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

L1 rebuilds `ring_game`; L1b separately rebuilds `tournament`. Each final master has `current_rule_id NOT NULL` and nullable `default_asset_id`:

- `(current_rule_id, user_id) → cash_rule(id, user_id)` / `tournament_rule(id, user_id)` NO ACTION. The API and A-13's master half additionally require the current version to belong to that master; T45 runs this check on every dev deploy and at release. The migration bootstrap below explains why the current reference uses ownership rather than a cyclic master-id FK.
- `(default_asset_id, user_id) → asset(id, user_id)` NO ACTION (C2). Deleting an asset never silently clears a master's default.
- Existing owner and room composites remain intact. Metadata such as name, memo and archive state stays on the master; every rule field moves to its current version.

T38 creates `(cash_rule_id, user_id) → cash_rule` and `(cash_rule_id, ring_game_id) → cash_rule(id, ring_game_id)` on `entry_cash`, and the equivalent tournament pair on `entry_tournament`, all NO ACTION (G1). The rule-id columns are nullable only in T38's interim shape, because T07 populates details before versions exist. L2 backfills every rule id and rebuilds both leaf tables with NOT NULL; no inbound FKs require child staging. An unlinked entry still has a standalone rule. NULL-master parity requires API validation and A-14, not an ownership exception.

G7 indexes include `entry_cash(cash_rule_id)`, `entry_tournament(tournament_rule_id)`, `ledger_line(price_id)`, both masters' `(current_rule_id)`, version `(ring_game_id)` / `(tournament_id)` and `(parent_rule_id)`, and child `(rule_id)` / `(level_id)` indexes where not already the leading columns of a key. Index the asset and lineup reference columns used for deletion guards and hydration too.

## Immutable writes and reuse

Lineups, versions, levels, stakes and prices are INSERT-only after migration. No procedure patches an existing version or deletes its children to edit a structure. Parent master deletion may cascade through its unused aggregate; account deletion must also work.

`game` is exactly one of `{ variantId }`, `{ gameMixId }`, `{ lineupId }`; on a tournament level, `null` means inherit. Each stakes element names its `gameGroupId`, which the server checks against the resulting ordered group. Omitted stakes carry forward by `(game_group_id, ordinal among groups of that structure)`, never by absolute position.

- A variant produces one group with one variant.
- A mix buckets its ordered variants by their current group, with groups ordered by the first appearance of that structure in the mix. Renames cannot reorder them.
- A lineup id reuses the immutable composition, including legacy custom mixes with several groups of the same structure.
- On create, omitted game inherits from the linked master or uses the user's builtin NLH when unlinked. No API manufactures an archived stand-in master.

Reuse a lineup with the same signature (`game_mix_id`, ordered structures and ordered variant ids) from the request, current rule's whole structure, or linked master's whole structure. Do not globally deduplicate or garbage-collect lineups. Reuse an unchanged rule version only within the same master identity: its signature includes lineup, scalar fields, stakes, levels with inheritance and effective lineups, and prices. Saving unchanged content must not churn ids.

All referenced ids are ownership-checked with uniform FORBIDDEN, including asset, lineup, rule, level and price ids. Bulk ownership lookups are chunked, not N+1 queries. A new selection cannot introduce archived masters; reusing an existing lineup preserves archived games. A variant used by a non-archived mix cannot be archived.

A rule write is one `db.batch()`: insert lineups and their children, insert the new version, insert stakes/levels/level stakes/prices, then repoint the master and/or entry. If the default lineup changes, inheriting levels in the **new** version receive the new default and mirror; stakes carry forward by structure plus ordinal. Old versions remain untouched. Whole tournament writes replace the supplied structure atomically; levels have an explicit input maximum and inserts derive their chunk width from the declared row shape to stay under D1's 100-bind limit.

Tournament writes obey the D1 invocation budget in data-model-v2.md §20.1 item 10: Workers Paid allows 1,000 queries per Worker invocation, including auth/session reads and each batch statement. L1b derives/enforces the levels × groups/prices maxima and records them in the API reference; createAndAssignTournament includes L2's relink cost. A real D1 integration test counts statements at the maximum admitted input.

`blindLevel` and `tournamentChipPurchase` routers are deleted in L1b (C8). There is no row-level edit facade over immutable versions. `tournament.create/update` and `createWithLevels/updateWithLevels` all use complete version bodies; the latter pair is exposed by MCP. Procedure details and omission semantics live in the API reference.

### Master ↔ entry operations

L2b implements these operations on `entry` and `live`, using L2's shared version service:

| Procedure | Atomic effect |
| --- | --- |
| `overrideRule { id, rule }` | Build/reuse a child version under the entry's existing master (or an unlinked child when unlinked), with the entry's current version as parent, and repoint only the entry. No `updateSnapshot` alias. |
| `applyMasterRule { id }` | Repoint the entry to its linked master's current version. |
| `pushRuleToMaster { id }` | Require a linked master; point its current rule at the entry's version when already under that master. If content must be copied under the destination master, insert an equal version with that master's current rule as parent, and repoint both. |
| `relink { id, ringGameId | tournamentId, keepRule }` | Validate the destination's ownership and kind. With `keepRule: false`, adopt its current version. With `keepRule: true`, copy the entry's complete version under the new master (parent = new master's current version), then change the master link and rule id in the same batch. Unlinking with keepRule creates an unlinked version; never leave a version owned by the previous master attached to a different link. |
| `restoreRule { id, masterId: Id \| null, ruleVersionId, masterRuleVersionId? }` | Restore the entry's master link and existing version in one batch; when supplied, also restore the master's current version in that batch. Versions must belong to that master (or be standalone when masterId is NULL), otherwise BAD_REQUEST. Archived masters and versions are allowed. |

Drift is **version id comparison**, not normalized field comparison: for a linked entry, `ruleDrift = ruleVersionId !== currentMasterRuleId`; an unlinked entry has no master drift. Applying or pushing rules makes the ids equal. Relinking with keepRule may intentionally leave drift even when some values happen to match. Delete the copy paths and `house-rules.ts` normalization used by the old column-by-column comparison.

`restoreRule` only repoints to existing versions; it creates no version and therefore restores the original ids and drift. It reverses overrideRule/applyMasterRule/pushRuleToMaster/relink; reversing createAndAssign also deletes the created master afterward. `ringGame.restoreRule` and `tournament.restoreRule` similarly repoint the master's current selection to an existing version owned by that master, without creating a version. These screen-only Undo operations are excluded from MCP.

L2b rejects a live overrideRule/applyMasterRule/relink/restoreRule with BAD_REQUEST before any write if lowering tableSize would put an active table player or the self player outside the new seat range. Validate the resulting version and folded seats together, not only the supplied partial rule.

## Reads, statistics and MCP

Master outputs include `defaultAssetId`, `currentRuleId`, nested `ruleVersion` and a `lineups` map. Entry/live outputs expose `ruleVersionId`, `currentMasterRuleId`, `ruleDrift`, nested `ruleVersion` and the same map. There are no legacy label I/O fields or parallel flat rule fields.

Hydrate each lineup once, keyed by id: `gameMixId`, display name, ordered groups (`gameGroupId`, optional stored name, ordered variants with id/label/shortLabel). Levels return inheritance (`game: null`) separately from their effective lineup. Names resolve through user-scoped joins, archived rows included. The display name is the saved mix's current label, the lone variant's label for one group/one variant, or the groups' short labels. Unnamed groups use the live game-group name and an ordinal when structures repeat. Hydration is batched.

T17 owns final statistics. Variant buckets use `mix:<id>` when a saved mix is present, `variant:<id>` for one group/one variant, and one Custom mix bucket otherwise. Tournaments use their version's default lineup, not a particular level's. A lineup with exactly **one group** has a usable BB from its stake row, including single-structure mixes such as NLH/PLO; multi-group lineups have no single BB. See data-model-v2.md §12 for the formulas and population.

Every API task updates `TOOL_DEFINITIONS` / `DELIBERATELY_EXCLUDED`, coupling tests and `docs/mcp.md` / `docs/mcp.ja.md` in the same PR. Tools use the exact router schemas. Game inputs follow list-then-id via `game_variant_list` / `game_mix_list`; descriptions explain the group/stakes coupling, whole tournament replacement, inherited levels, required price assets and per-level/group ante type. No master delete is exposed through MCP. The API reference owns the final tool names and exposure decisions.

## Archive and deletion

L0 adds archive/restore and `includeArchived` on game-master lists. Default lists exclude archived rows; existing rule hydration always resolves them. Labels remain unique among archived rows too. A conflicting create can guide the caller to restore. Delete returns CONFLICT when a variant, mix or group is referenced; group guards count both variants and stored lineup groups. Archived rows are not offered for new selections.

A ring game or tournament referenced by an entry, by an entry's version, or through a historical price cannot be deleted; archive it instead. An unused master may be deleted: versions belong to its aggregate and cascade with their children. API guards prevent raw FK errors; the NO ACTION references remain the DB backstop. Room deletion must check referenced descendants as well. Account deletion succeeds because references use NO ACTION rather than RESTRICT.

## Implementation path

These are implementation dependencies, not separate release steps. The authoritative full graph is data-model-v2.md §18.

| Task | Deliverable | Direct prerequisites |
| --- | --- | --- |
| T38 | Final empty lineup/rule DDL, entry rule and ledger price composites, G1/G2/G7 keys and indexes | None |
| T42 | Final asset DDL before any v2 backfill | None |
| L0 | API-only game-master archive/restore, guarded delete, includeArchived and MCP | T44 |
| L6 | Rebuild game_variant; composite group FK; expression label UNIQUE indexes; remove JSON/compatibility triggers | L0 |
| L1 | Ring-game lineup/version backfill, master rebuild and final ringGame API/MCP | T38, T42, L6, T44, T45 |
| L1b | Tournament versions, levels, stakes and prices; master rebuild; final tournament API/MCP; delete row routers | T38, T42, L6, T44, T45 |
| L2 | Entry versions and ledger price mapping; NOT NULL leaf-detail rebuild; rule creation/read services and drift, without router wiring | L1, L1b, T12, T45 |
| L2b | Entry/live rule-operation APIs, including restoreRule | L2, T40, T41 |
| T47 | Required blind flags, built-in defaults and Straddle removal; shared new-stake validation | L1b |

Canceled tasks have explicit destinations: L3 / SA2-246 → L1, L1b, L2, T17, T40, T41; L4a / SA2-247, L4b / SA2-248 and L4c / SA2-249 → NEW-UI; L5 / SA2-250 → L1, L1b, L2, L6, T40, T41, T35. SA2-242 is the completed design, not an additional implementation gate. T47 owns Must/Optional blind-field validation after L1b; its screen requirements and related Cryst screens go to NEW-UI.

## Migration choreography and traps

### DDL first, then populated master rebuilds

D1 keeps FKs enabled and streams migration files statement by statement. A file is **not** one transaction; `DROP TABLE` fires inbound CASCADE and SET NULL actions. Do not use `PRAGMA foreign_keys = OFF`, assume a file-wide deferral, or rely on triggers for invariants.

T38 rebuilds the still-empty v2 tables with their final constraints before T07, except the explicitly interim nullable entry rule ids. T42 supplies final asset DDL in the same foundation period. Afterwards, L6 rebuilds `game_variant`, L1 rebuilds `ring_game`, L1b rebuilds `tournament`, and L2 rebuilds the two entry leaf details with NOT NULL rule ids. Master/variant rebuilds stage inbound children; L2 has none. These are not single-column ADD COLUMN exceptions. Never rebuild a rule table after it has rows: it would cascade-delete stakes/levels/prices or fail against master/entry NO ACTION references.

The staging inventory below is derived from the Drizzle schema at `origin/dev` 5ddc2cf0. At implementation, enumerate inbound FKs again, including any dependencies merged meanwhile; the inventory is a required input to the migration, not a sample list.

| Rebuild | Stage before DROP; preserve or detach as appropriate |
| --- | --- |
| L6 `game_variant` | Full `game_mix_variant` rows; `hand.variant_id` links if T22 has populated hands; any `game_lineup_variant` rows (must be empty before L1/L1b); preserve variant ids/ownership/archive metadata. Existing junction FK is NO ACTION, so detach/stage its rows before DROP. |
| L1 `ring_game` | Full legacy master rows including rules; `session_cash_detail.ring_game_id` (SET NULL), `entry_cash.ring_game_id` (NO ACTION); `cash_rule` rows (must be empty for this master backfill). Preserve ids and all metadata. |
| L1b `tournament` | Full legacy master rows including rules; `session_tournament_detail.tournament_id` (SET NULL), `entry_tournament.tournament_id` (NO ACTION); full `blind_level`, `tournament_chip_purchase`, `tournament_tag` rows (CASCADE); `tournament_rule` rows (must be empty for this backfill). Preserve ids, sort order, tag links and all metadata. |

Stage any cascading children's descendants too whenever a child itself must be removed. `session_chip_purchase_result` references `session_chip_purchase`, not `tournament_chip_purchase`, so the master rebuild does not delete that independent snapshot chain. NULL an optional NO ACTION link, or remove a staged junction row, before dropping its parent; do not delete an entry aggregate to clear a master reference. Restore links and rows after restoring parents, with named columns throughout. Keep counts for every staged table and every detached link.

The new masters omit retired rule columns **in the rebuild itself**. L1 omits `variant`, `mix_games`, `blind1–3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`, `table_size`, `house_rules`; L1b omits `variant`, `buy_in`, `entry_fee`, `starting_stack`, `bounty_amount`, `table_size`, `house_rules`. Their staged values are still the backfill source and A-13 comparison source, and are discarded only after checks.

A non-NULL `current_rule_id` and the reverse rule→master FK form a bootstrap cycle. Use the ownership composite described above, without FK deferral:

1. Migration: stage and detach children; insert complete versions with their nullable master id temporarily NULL; rebuild the empty final master and insert restored masters pointing at those existing versions; UPDATE the versions' master ids; restore staged children. Run A-13's master half before discarding stages.
2. Runtime master creation: in one `db.batch()`, insert the version with NULL master id, insert the master with its required current rule id, then set the version's master id. No request can observe the intermediate state. A failure rolls back the whole batch.

The final master assignment is the sole construction-time exception to INSERT-only versions, never an operation on an already published version. API validation and A-13 require same-master current ownership after construction. Neither path needs deferred FKs or triggers, and `current_rule_id` never becomes nullable.

L6 creates `(group_id, user_id) → game_group(id, user_id)` NO ACTION on rebuilt variants (C11). Replace **all** label-uniqueness triggers on game_group/game_variant/game_mix with per-table expression UNIQUE indexes `(user_id, lower(trim(label)))` (C12); the separate variant/mix namespace and retirement of cross-table application checks are defined in data-model-v2.md §5.2. Drop the JSON-reference and 0049 synchronization triggers before subsequent writes rely solely on `game_mix_variant`. Write retired NOT NULL `game_mix.games` as `'[]'` until T35 removes it. Do not recreate integrity triggers after the rebuild.

### Backfill rules

1. **Versions per master.** L1 creates `cr:<ring_game_id>` and L1b `tr:<tournament_id>`. L2 shares the master's version for an equal stored snapshot; differing snapshots become children `cr:e:<entry_id>` / `tr:e:<entry_id>` under that same master. Equal snapshots under one master share the first deterministic child's version. Unlinked entries get parentless, NULL-master versions. Equality uses the old house-rule normalization once in the migration, never as ongoing drift logic.
2. **Deterministic child ids.** Lineups use `lu:<version id>` / `lu:<level id>`; groups derive from lineup id and position; levels use `trl:<blind_level id>` or `trl:e:<session_blind_level id>`; prices use `trp:<tournament_chip_purchase id>`, `trp:e:<session_chip_purchase id>` or `trp:<version id>:entry`. When versions are shared, all price mappings use the shared version's actual price ids, not a guessed entry-prefixed id.
3. **Guard every JSON level.** Validate outer arrays, nested group arrays, object elements and string labels before `json_each` or extraction. A WHERE predicate outside a table-valued JSON function does not guard malformed input. Resolve only owned rows and collapse duplicate variants before UNIQUE constraints.
4. **Label resolution is migration-only.** Resolve normalized labels, then builtin keys (pre-0039 keys may remain inside JSON), then archived stand-ins. L6 has already removed the shared namespace triggers: insert junction rows directly, write `'[]'` to `game_mix.games`, and obey the per-table expression UNIQUE indexes. SQLite lower/trim only implement ASCII folding and space trimming; audit non-ASCII mismatches instead of silently treating application normalization as identical.
5. **Stand-ins preserve history.** Only the SQL backfill creates them. A placeholder variant takes a resolved sibling's structure, otherwise builtin Big Bet, otherwise a deterministic existing owned group; if none exists, create the missing builtin Big Bet group first. Collapse normalized duplicates deterministically. Seed builtin data must not mistake stand-ins for its own rows; T43 removes the seed placeholder exception and reviews stand-ins with the user.
6. **Mix composition.** Cash `"mix"` becomes an unnamed lineup without game_mix_id. A named mix retains game_mix_id but uses the saved composition, even if the master composition changed. A tournament `"mix"` derives its default from its levels in first-appearance structure order; an unresolved tournament label uses an archived mix with that composition, or a placeholder variant if no level has games.
7. **Levels and stakes.** A level with the default composition inherits, including the G2 mirror; other compositions get their own lineup. Match a saved mix id when the composition agrees. Move group stakes from JSON, otherwise flat columns. A level without games under a multi-group default copies its flat values to every group. Drop hidden flat blinds on levels with games. Automatic group names become NULL; legacy groups spanning structures take the first game's structure. Missing legacy ante types remain NULL.
8. **Prices and payments.** Build entry prices from buy-in/fee and addon prices from legacy chip purchases; reentry prices are supported by the final API without inventing historical rows. Resolve each price's asset from the master or entry's actual paying asset, using the migration's Unassigned asset only where the source truly has none. L2 maps T12 payment lines to the entry version's prices by stored purchase position and actual source identity. T39 takes the price id from the ledger line for the same event, not from an entry-id formula; projector replay must preserve it.

Optional pre-audits record the counts that affect treatment: malformed JSON at every level, unresolved/non-ASCII labels, shared labels, duplicate variants, hidden flat values that will be dropped, tournaments without composition, groups spanning structures, and snapshots differing from masters. The backfill still has to handle each case without aborting.

### End checks and regression protection

Each migration ends with failing checks, not a log-only report. Use temporary NOT NULL check-table inserts to fail when a violation query returns rows; SQLite RAISE is not available outside triggers. Do not introduce invariant triggers to implement checks.

- Every staged row and detached reference is accounted for; compare per-table row counts and source-id sets after restoration. Run `PRAGMA foreign_key_check` and fail on any returned row (F7).
- L6 proves preserved variant/junction/hand references, owner-correct group links and per-table normalized label uniqueness.
- L1/L1b prove no NULL current rule, current rule belongs to its master, complete lineup/level stake coverage, valid inheritance mirrors, and A-13's master half **against stages before those sources are removed**.
- L2 proves equal source/target detail row counts, no NULL rule ids on any entry, same-master/standalone versions, correct payment-price mapping, complete stake coverage, foreign_key_check and A-13's entry half. A NULL-count-only check cannot detect missing stake rows.
- T45 runs the structural audits and A-6 projector replay on every dev deploy's fresh production copy and again before release. A-7 is retired as a single-column ownership exception audit; these FKs now enforce ownership. The remaining API-only relationships have named audits in data-model-v2.md §16.

Migration and API/DB integration tests must protect plausible losses: account deletion must not fail halfway through a NO ACTION cascade; cross-owner and wrong-master entry/parent links must be rejected; another-lineup stakes and a mismatched inheritance mirror must fail in SQL; staged master rebuilds must not erase entries, levels, prices or tags; ticket entry/reentry/addon prices must persist with their asset; relink keepRule must never retain the old master's version; a failed version write must leave the previous current version and children intact. Tests also cover unchanged-version reuse, stored structure surviving a variant move, drift clearing on apply/push, and projector replay retaining migrated price ids. Use real D1 for batch atomicity and API ownership behavior, not DB mocks. Update migration history/trigger tests and preview seed-restore coverage when L6 removes triggers; keep runner discovery intact.

## Retired storage and cleanup

L1/L1b omit the master rule columns immediately; there is no later task to remove those same columns. Legacy `blind_level`, `tournament_chip_purchase`, session detail rule copies, `session_blind_level`, `session_chip_purchase` and their results remain only as migration/audit sources until their readers have moved. T35 drops **all** remaining retired tables/columns, `game_mix.games`, the game_session anchor and fixed-value writes. No compatibility view or pending-drop escape remains.

Delete obsolete mechanisms in their owning API tasks: `MIX_VARIANT`, `MIX_VARIANT_LABEL`, `RESERVED_LABELS`, label-resolution input paths, cross-table namespace checks, frozen-composition exemptions, `cashMixFlatFieldClearPatch`, rule snapshot copy paths, `updateSnapshot`, and normalized per-column drift comparisons. T17 switches statistics directly to id-based versions. T37 brings related design/rule documents to the final state and walks the SA2-334 resolution table.

SA2-239's custom-mix retirement is represented by lineups without a saved mix id. SA2-214's four legacy game JSON columns disappear with the relevant master rebuild or T35; do not add replacement JSON storage. The release rehearsal and Time Travel restore procedure are defined once in data-model-v2.md §16.
