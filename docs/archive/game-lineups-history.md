> Historical snapshot. Current guidance: [game-lineups](../design/game-lineups.md).

# Game Lineups and Rule Versions

The data-model cutover introduced lineups and immutable versions in stages while production remained on its previous release. The completed implementation and migration plan follows; current behavior is documented in [game lineups](../design/game-lineups.md).

The required-blinds migration removed the built-in Big Bet straddle field and gated existing stakes before cutover. A production check on 2026-10-17 found no Big Bet blind3 values among the surveyed ring games, cash and tournament sessions, and master levels.

## Implementation path (completed history)

These are implementation dependencies, not separate release steps. The authoritative full graph is data-model-v2.md §18.

| Task | Deliverable | Direct prerequisites |
| --- | --- | --- |
| B01 | Final empty lineup/rule DDL, entry rule and ledger price composites, G1/G2/G7 keys and indexes | None |
| B02 | Final asset DDL before any v2 backfill | None |
| B05 | API-only game-master archive/restore, guarded delete, includeArchived and MCP; rebuild game_variant with the composite group FK and expression label UNIQUE indexes; remove JSON/compatibility triggers | B03, B04 |
| B07 | Ring-game lineup/version backfill, master rebuild and final ringGame API/MCP | B05 |
| B08 | Tournament versions, levels, stakes and prices; master rebuild; final tournament API/MCP; delete row routers | B05 |
| B11 | Required blind flags, built-in defaults and Straddle removal; shared new-stake validation | B08 |
| B13 | Entry versions and ledger price mapping; NOT NULL leaf-detail rebuild; rule creation/read services and drift, without router wiring | B07, B08, B09 |
| B20 | Entry/live rule-operation APIs, including restoreRule and live.createAndAssignRingGame/Tournament | B17 |

Canceled tasks have explicit destinations: L3 / SA2-246 → B07, B08, B13, B22, B16, B17; L4a / SA2-247 → U06, L4b / SA2-248 → U08, L4c / SA2-249 → U07, plus U02's shared editors; L5 / SA2-250 → B07, B08, B13, B05, B16, B17, B25. SA2-242 is the completed design, not an additional implementation gate. B11 owns Must/Optional blind-field validation after B08; its screens are U02 (shared stakes components) and the phases that use them.

## Migration choreography and traps (completed history)

### DDL first, then populated master rebuilds

D1 keeps FKs enabled and streams migration files statement by statement. A file is **not** one transaction; `DROP TABLE` fires inbound CASCADE and SET NULL actions. Do not use `PRAGMA foreign_keys = OFF`, assume a file-wide deferral, or rely on triggers for invariants.

B01 rebuilds the still-empty v2 tables with their final constraints before B06, except the explicitly interim nullable entry rule ids. B02 supplies final asset DDL in the same foundation period. Afterwards, B05 rebuilds `game_variant`, B07 rebuilds `ring_game`, B08 rebuilds `tournament`, and B13 rebuilds the two entry leaf details with NOT NULL rule ids. Master/variant rebuilds stage inbound children; B13 has none. These are not single-column ADD COLUMN exceptions. Never rebuild a rule table after it has rows: it would cascade-delete stakes/levels/prices or fail against master/entry NO ACTION references.

The staging inventory below is derived from the Drizzle schema at `origin/dev` 5ddc2cf0. At implementation, enumerate inbound FKs again, including any dependencies merged meanwhile; the inventory is a required input to the migration, not a sample list.

| Rebuild | Stage before DROP; preserve or detach as appropriate |
| --- | --- |
| B05 `game_variant` | Full `game_mix_variant` rows; `hand.variant_id` links if B10 has populated hands; any `game_lineup_variant` rows (must be empty before B07/B08); preserve variant ids/ownership/archive metadata. Existing junction FK is NO ACTION, so detach/stage its rows before DROP. |
| B07 `ring_game` | Full legacy master rows including rules; `session_cash_detail.ring_game_id` (SET NULL), `entry_cash.ring_game_id` (NO ACTION); `cash_rule` rows (must be empty for this master backfill). Preserve ids and all metadata. |
| B08 `tournament` | Full legacy master rows including rules; `session_tournament_detail.tournament_id` (SET NULL), `entry_tournament.tournament_id` (NO ACTION); full `blind_level`, `tournament_chip_purchase`, `tournament_tag` rows (CASCADE); `tournament_rule` rows (must be empty for this backfill). Preserve ids, sort order, tag links and all metadata. |

Stage any cascading children's descendants too whenever a child itself must be removed. `session_chip_purchase_result` references `session_chip_purchase`, not `tournament_chip_purchase`, so the master rebuild does not delete that independent snapshot chain. NULL an optional NO ACTION link, or remove a staged junction row, before dropping its parent; do not delete an entry aggregate to clear a master reference. Restore links and rows after restoring parents, with named columns throughout. Keep counts for every staged table and every detached link.

The new masters omit retired rule columns **in the rebuild itself**. B07 omits `variant`, `mix_games`, `blind1–3`, `ante`, `ante_type`, `min_buy_in`, `max_buy_in`, `table_size`, `house_rules`; B08 omits `variant`, `buy_in`, `entry_fee`, `starting_stack`, `bounty_amount`, `table_size`, `house_rules`. Their staged values are still the backfill source and A-13 comparison source, and are discarded only after checks.

A non-NULL `current_rule_id` and the reverse rule→master FK form a bootstrap cycle. Use the ownership composite described above, without FK deferral:

1. Migration: stage and detach children; insert complete versions with their nullable master id temporarily NULL; rebuild the empty final master and insert restored masters pointing at those existing versions; UPDATE the versions' master ids; restore staged children. Run A-13's master half before discarding stages.
2. Runtime master creation: in one `db.batch()`, insert the version with NULL master id, insert the master with its required current rule id, then set the version's master id. No request can observe the intermediate state. A failure rolls back the whole batch.

The final master assignment is the sole construction-time exception to INSERT-only versions, never an operation on an already published version. API validation and A-13 require same-master current ownership after construction. Neither path needs deferred FKs or triggers, and `current_rule_id` never becomes nullable.

The rebuilt variant table has `(group_id, user_id) → game_group(id, user_id)` NO ACTION (C11). Per-table expression UNIQUE indexes `(user_id, lower(trim(label)))` enforce labels (C12); variants and mixes have separate namespaces. Composition uses `game_mix_variant`; writes put `'[]'` in the retired `game_mix.games` column until its removal.

### Backfill rules

1. **Versions per master.** B07 creates `cr:<ring_game_id>` and B08 `tr:<tournament_id>`. B13 shares the master's version for an equal stored snapshot; differing snapshots become children `cr:e:<entry_id>` / `tr:e:<entry_id>` under that same master. Equal snapshots under one master share the first deterministic child's version. Unlinked entries get parentless, NULL-master versions. Equality uses the old house-rule normalization once in the migration, never as ongoing drift logic.
2. **Deterministic child ids.** Lineups use `lu:<version id>` / `lu:<level id>`; groups derive from lineup id and position; levels use `trl:<blind_level id>` or `trl:e:<session_blind_level id>`; prices use `trp:<tournament_chip_purchase id>`, `trp:e:<session_chip_purchase id>` or `trp:<version id>:entry`. When versions are shared, all price mappings use the shared version's actual price ids, not a guessed entry-prefixed id.
3. **Guard every JSON level.** Validate outer arrays, nested group arrays, object elements and string labels before `json_each` or extraction. A WHERE predicate outside a table-valued JSON function does not guard malformed input. Resolve only owned rows and collapse duplicate variants before UNIQUE constraints.
4. **Label resolution is migration-only.** Resolve normalized labels, then builtin keys (pre-0039 keys may remain inside JSON), then archived stand-ins. B05 has already removed the shared namespace triggers: insert junction rows directly, write `'[]'` to `game_mix.games`, and obey the per-table expression UNIQUE indexes. SQLite lower/trim only implement ASCII folding and space trimming; audit non-ASCII mismatches instead of silently treating application normalization as identical.
5. **Stand-ins preserve history.** Only the SQL backfill creates them. A placeholder variant takes a resolved sibling's structure, otherwise builtin Big Bet, otherwise a deterministic existing owned group; if none exists, create the missing builtin Big Bet group first. Collapse normalized duplicates deterministically. Seed builtin data must not mistake stand-ins for its own rows; B23 removes the seed placeholder exception and reviews stand-ins with the user.
6. **Mix composition.** Cash `"mix"` becomes an unnamed lineup without game_mix_id. A named mix retains game_mix_id but uses the saved composition, even if the master composition changed. A tournament `"mix"` derives its default from its levels in first-appearance structure order; an unresolved tournament label uses an archived mix with that composition, or a placeholder variant if no level has games.
7. **Levels and stakes.** A level with the default composition inherits, including the G2 mirror; other compositions get their own lineup. Match a saved mix id when the composition agrees. Move group stakes from JSON, otherwise flat columns. A level without games under a multi-group default copies its flat values to every group. Drop hidden flat blinds on levels with games. Automatic group names become NULL; legacy groups spanning structures take the first game's structure. Missing legacy ante types remain NULL.
8. **Prices and payments.** Build entry prices from buy-in/fee and addon prices from legacy chip purchases; reentry prices are supported by the final API without inventing historical rows. Resolve each price's asset from the master or entry's actual paying asset, using the migration's Unassigned asset only where the source truly has none. B13 maps B09 payment lines to the entry version's prices by stored purchase position and actual source identity. B15 takes the price id from the ledger line for the same event, not from an entry-id formula; projector replay must preserve it.

Optional pre-audits record the counts that affect treatment: malformed JSON at every level, unresolved/non-ASCII labels, shared labels, duplicate variants, hidden flat values that will be dropped, tournaments without composition, groups spanning structures, and snapshots differing from masters. The backfill still has to handle each case without aborting.

### End checks and regression protection

Each migration ends with failing checks, not a log-only report. Use temporary NOT NULL check-table inserts to fail when a violation query returns rows; SQLite RAISE is not available outside triggers. Do not introduce invariant triggers to implement checks.

- Every staged row and detached reference is accounted for; compare per-table row counts and source-id sets after restoration. Run `PRAGMA foreign_key_check` and fail on any returned row (F7).
- B05 proves preserved variant/junction/hand references, owner-correct group links and per-table normalized label uniqueness.
- B07/B08 prove no NULL current rule, current rule belongs to its master, complete lineup/level stake coverage, valid inheritance mirrors, and A-13's master half **against stages before those sources are removed**.
- B13 proves equal source/target detail row counts, no NULL rule ids on any entry, same-master/standalone versions, correct payment-price mapping, complete stake coverage, foreign_key_check, A-13's entry half, and no Big Bet stake row with blind3 in any cash or tournament version, master or entry (B11's condition). A NULL-count-only check cannot detect missing stake rows.
- B04 runs the structural audits and A-6 projector replay on every dev deploy's fresh production copy and again before release. A-7 is retired as a single-column ownership exception audit; these FKs now enforce ownership. The remaining API-only relationships have named audits in data-model-v2.md §16.

Migration and API/DB integration tests must protect plausible losses: account deletion must not fail halfway through a NO ACTION cascade; cross-owner and wrong-master entry/parent links must be rejected; another-lineup stakes and a mismatched inheritance mirror must fail in SQL; staged master rebuilds must not erase entries, levels, prices or tags; ticket entry/reentry/addon prices must persist with their asset; relink keepRule must never retain the old master's version; a failed version write must leave the previous current version and children intact. Tests also cover unchanged-version reuse, stored structure surviving a variant move, drift clearing on apply/push, and projector replay retaining migrated price ids. Use real D1 for batch atomicity and API ownership behavior, not DB mocks. Update migration history/trigger tests and preview seed-restore coverage when B05 removes triggers; keep runner discovery intact.

## Retired storage and cleanup

B25 dropped the remaining legacy session and rule source tables and `game_mix.games`. The older label-resolution, snapshot-copy and compatibility paths are retired; current reads and writes use id-based lineups and immutable rule versions. The choreography above is completed history, not a runtime contract.

SA2-239's custom-mix retirement is represented by lineups without a saved mix id. SA2-214's four legacy game JSON columns disappear with the relevant master rebuild or B25; do not add replacement JSON storage. The release rehearsal and Time Travel restore procedure are defined once in data-model-v2.md §16.
