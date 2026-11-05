# API data model v2 history

Historical migration, release and cutover notes from the former API design. The [current API contract](../design/api.md) supersedes these notes.

**Original line 3:** Status: **design contract**, for the single v2 + new UI release. This is not a description of the currently deployed API. All tasks in [data-model-v2.md §17](data-model-v2-history.md#17-task-breakdown) must be complete. Releases remain frozen until that release; the old feature UI is removed by B03, not adapted to these contracts.

**Original line 5:** This document owns procedure names, request/response shapes and the MCP projection. [data-model-v2.md](../design/data-model.md) owns tables, invariants, calculations (§12), event projections (§13), migration and task order. [game-lineups.md](../design/game-lineups.md) owns immutable lineups, rule versions, version-write semantics and the game/rule tasks (B05, B07, B08, B11, B13, B20). There is one API generation: removed names have no aliases. Historical findings live in SA2-334 and the spec's [§17.1 finding table](data-model-v2-history.md#171-finding-to-task-resolution), not here.

**Original line 25:** The D1 budget is Workers Paid's 1,000 queries per Worker invocation, including authentication/session reads and each batch statement (spec §20.1 item 10). B08 derives/enforces tournament levels × lineup groups/prices maxima and B16 manual playSessions/payments maxima; each records its fixed bounds here. Every mutation's owning task proves with a real D1 integration test counting statements that its maximum admitted input stays within the budget, with nested rule bodies at B07/B08's maxima and days/payments at B16's: entry.create/update B16; live.create B17; tag writes and reorder B18; hand detail writes B21; overrideRule/applyMasterRule/pushRuleToMaster/relink/restoreRule and live.createAndAssignRingGame/Tournament B20; master writes B07/B08. When a combined input exceeds the budget at those maxima, the owning task sets a tighter limit on its own procedure; it never changes another task's maxima. No independent fixed array maximum overrides this budget.

**Original line 27:** B18 bounds reorder at 500 tag ids and owner `tagIds` at 100; the integration coverage is in `tag-router.test.ts` (reorder) and the existing owner tests.

**Original line 29:** B21 bounds hand.update at 10 seats, 200 actions, 4 boards and 100 `tagIds`/`tagReviews`; at those maxima a call prepares 39 statements besides authentication, counted against the budget in `hand.test.ts`.

**Original line 31:** Ring-game rule writes plan one lineup: a newly created lineup spans at most 12 game groups (`MAX_LINEUP_GROUPS`, shared with tournament levels), so a save writes at most 12 stakes. A named mix regrouped by its variants' live game structure beyond that bound is rejected; an existing `lineupId` is reused as stored. The statement-count proof is part of the ring-game D1 integration coverage (`ring-game-rules.test.ts`).

**Original line 51:** Do not offer Undo for an Undo (no redo), hard deletes (`*.delete`, `live.discard`), non-persisting operations (`location`, `aiExtract`) or read tracking (`markViewed`). Hard deletes use only a confirmation Dialog, as required by `web-theme.md`; no API can restore them exactly (user decision, 2026-10-16). An `entry.update` whose `playSessions` omits an existing Day deletes that Day with its hands, so the UI treats it as a hard delete: confirmation Dialog, no Undo.

**Original line 162:** For newly written stake rows, the server rejects a null/omitted blind marked Required by its game group, or a value in a blind field without a label (`BAD_REQUEST`, B11 / SA2-396). Every stake row of a new rule version counts as newly written, including values carried forward from the previous version when `stakes` is omitted. Ante is outside this requirement system. Reusing an existing immutable rule version does not revalidate its stakes. B07/B08's shared rule-write service enforces this, including writes through B13.

**Original line 185:** Table size is 2–10; minBuyIn <= maxBuyIn. Tournament rule maxima (B08): at most 100 levels, 12 stakes per level (one per lineup group; a new lineup may span at most 12 game groups) and 20 prices. The worst admitted save — 100 levels each on a distinct new 30-game, 12-group lineup, 1,200 stakes and 20 prices — measured 382 statements including reads on D1 (`tournament-rule.test.ts`), inside the 1,000-query budget with the auth reads; label maximum 100 characters; houseRules maximum 50,000. Price amount/fee/chips are nonnegative integers (amount/fee <=10^12); assetId is required even for a free price. A ticket price is an item asset, not a special branch. Breaks have no stakes/game override. Supplied levels/prices replace the **whole** collection; each structural edit writes one immutable version, never parallel per-row edits.

**Original line 195:** | `create` M | Discriminator `kind:cash|tournament`; `playedOn:DateOnly`, `playSessions?:ManualPlay[]` (nonempty; days/payments maxima derived from the invocation budget by B16), `payments?:Payment[]` (single play), `roomId?,assetId?,title?:string<=100,memo?:string<=5000,tagIds?:Id[]`; cash: `ringGameId?,rule?:CashRuleInput,evDiff?:signed integer`; tournament: `tournamentId?,rule?:TournamentRuleInput,placement?:positive integer,totalEntries?:positive integer,beforeDeadline?:boolean=false` | EntryOutput, source manual | placement > totalEntries unless beforeDeadline; inconsistent playedOn/plays: BAD_REQUEST | `entry_create_cash`, `entry_create_tournament` |

**Original line 206:** B16 maxima, measured against the 1000-statement invocation budget (10 reserved for authentication) with a maximal B08 tournament rule written in the same request: one entry holds at most 100 playSessions, 1000 payments in total and 100 tagIds; list pages hold at most 100 entries. At these maxima create runs 534 statements and update 259 (`entry.test.ts`). Update reads the rule version only for output and price checks; it never takes `ringGameId`, `tournamentId` or `rule`. A ManualPlay `id` must name an existing Day of that entry (else FORBIDDEN); kept Days keep their id and hands, Days left out are deleted with their hands, and Days without id are inserted, so an update that keeps every Day is undone by sending the previous values. Days before the last end held (cash) or bagged (tournament) with endStack; the last ends cashed_out/finished (cash) or busted/finished (tournament); placement is not cross-checked against the end state. A synthesized Day ends cashed_out (cash), finished when placement is 1, busted otherwise (tournament). Payment priceIds must belong to the entry's rule version or already be used by the entry, with the price's asset and a role its kind pays (entry: buy_in/fee, reentry: reentry/fee, addon: chip_purchase/fee). Live entries accept only roomId, assetId, title, memo and tagIds. Delete removes the entry, its Days, hands, lines and tag links; its standalone rule version stays.

**Original line 210:** `restoreRule` restores the entry's master link and existing rule version in one batch; when supplied, `masterRuleVersionId` also restores that master's current version in the same batch. Every version must belong to that master; with `masterId:null`, the entry version must be standalone. No new version is created. Archived masters and versions are allowed because this only restores saved values. Live entries also apply the tableSize/active player and self-seat validation. This is the inverse of overrideRule, applyMasterRule, pushRuleToMaster and relink; to undo createAndAssign*, follow restoreRule with deletion of the created master. With a B08-maximal tournament rule (100 levels on distinct 12-group lineups, 20 prices) and 100 tagIds, the live calls measured on D1 (`entry-rule-operations.test.ts`): createAndAssignTournament 397 statements, overrideRule 165, keepRule relink copying the version 155, and pushRuleToMaster, applyMasterRule, adopting relink and restoreRule under 30 each, so B20 keeps B08's limits and adds none of its own. Unlinking always keeps the content as a parentless standalone copy, whatever keepRule says, and the seat check folds tablePlayer seats, Hero included.

**Original line 216:** All reads and successful entry mutations return EntryOutput, never game_session/sessionDate/completed/evCashOut output. Live tournament records additionally return `progress:{currentStack:number|null,remainingPlayers:number|null,totalEntries:number|null,chipTotal:number,averageStack:number|null}`; live cash records return `progress:null`. The server fold and formula are owned by spec §13.2 and checked by A-6; charts consume these values without recomputing them. `getById` additionally returns `{events:PlayEvent[],currentPlaySessionId:Id|null,currentButtonSeat:number|null}`. Every by-id procedure rejects a manual or imported entry with BAD_REQUEST. All procedures are **Excluded: cockpit** in MCP, including reads and rule operations, except `restoreRule` (**Excluded: screen**).

**Original line 222:** | `create` M | `kind:cash|tournament,roomId?,assetId?,memo?,startedAt?:Instant,localDate?:DateOnly,label?:string<=50,payments:Payment[]`; matching `ringGameId?`/`tournamentId?`, `rule?`; tournament `initialStack?:nonnegative integer,timerStartedAt?:Instant,startLevel?:positive integer` | EntryOutput + tournament progress | Existing active/paused play: CONFLICT; initialStack writes the first update_stack in the creation batch; payments at most 1000 (cash buy_in; tournament buy_in/fee); with a B08-maximal inline rule and 1000 payments the call issues 539 D1 statements (`live.test.ts`); B17 |

**Original line 242:** `PlayEvent = {id,entryId,playSessionId,eventType,occurredAt,sortOrder,payload,schemaVersion:2,createdAt,updatedAt}`. Payload is a validated **object**, never serialized JSON. Writers explicitly set schema version 2; there is no caller version/default 1 or v1 reader after B15. Event ids are the only event identity. All procedures are **Excluded: cockpit**.

**Original line 258:** | session_end | `{endState?:cashed_out|busted|finished,payments:Payment[],beforeDeadline?,placement?,totalEntries?}`; live.complete stores the endState it was given, and a stored row without one (migrated) derives cashed_out for cash, finished for placement 1, else busted | Live lifecycle only |

**Original line 271:** Price links and self-player ids in migrated payloads are resolved by B15 from their actual stored relationships (price from that event's ledger line), not synthesized old ids. Every append, including memo/seats, writes version 2. Output/event snapshots use the same schemas as writers.

**Original line 320:** Archived assets retain references, rates and balances. New selections must be active; unchanged historical references remain readable/editable. No special Unassigned asset behavior survives B23.

**Original line 388:** `Metrics = {winCount,lossCount,winRate,playMinutes,handCount,cashEntryCount,tournamentEntryCount,itmCount,itmRate,averagePlacement,roi,bbPerHour,bb100,handsPerHour,evRecordedEntryCount,evDiff,evProfitLoss}` (B24 added `bb100` and `handsPerHour`, formulas in [statistics.md](../design/statistics.md#hands)). Undefined ratios/EV are null, not zero. Monetary fields in normalized mode are null; `normalized:{cash:{unit:'bb',entryCount,unavailableEntryCount,profitLoss,evProfitLoss}|null,tournament:{unit:'bi',entryCount,unavailableEntryCount,profitLoss}|null}` carries the dimensionless alternatives. Other modes return `amounts:Amounts` in the selected asset/base and `normalized:null`. Coverage reports exclusions for each normalized branch as well as overall.

**Original line 452:** Builtin defaults: Limit requires Small Bet and Big Bet; Stud requires Small Bet and Big Bet, with Bring-in Optional. Big Bet has only SB and BB, both Required: the Straddle field is removed. B11 adds the required flags, sets these builtin defaults, and clears Big Bet's former Straddle label; its migration aborts if any Big Bet stake has a blind3 value, and B13's end check applies the same condition (game-lineups.md).

**Original line 480:** B05 retains guarded hard delete only for unreferenced game masters, alongside archive/restore; no MCP delete is exposed. New selections reject archived composition members; echoing an unchanged stored lineup keeps history valid.

**Original line 498:** B16 introduced the entry tag tables and procedures; B18 replaced its router with the factory, added reorder and introduced the other three kinds.

**Original line 506:** Same five Tag procedures, shapes, constraints and errors as §19, instantiated as `handTag.list/create/update/delete/reorder`. MCP `hand_tag_list`, `hand_tag_create`; update/reorder excluded tag maintenance/screen ordering, delete excluded destructive. Since B18, hand.list/getById return `tags: {id,name,reviewedAt}[]` from `hand_tag_link`. B21 adds to hand.update `tagIds` for attachment and `tagReviews?:{tagId:Id,reviewedAt:Instant|null}[]`; reviews must name attached owned tags, otherwise BAD_REQUEST. Link `reviewedAt` does not mutate the tag itself.

**Original line 570:** B22 migrates stored **keys and values**: `from/to -> dateFrom/dateTo` (UTC-midnight seconds become calendar dates), `type -> kind`, cash_game -> cash, all -> omitted; `currencyId` **and** statistics `currency -> assetId`, statistics `room -> roomId`; display currency/norm off -> normalized false, display/norm normalized -> normalized true with obsolete native mode field removed. Both payload variants lose legacy keys. Existing ids remain ids; invalid/dangling stored selections are removed with a documented migration count, never retained as labels. Converted-mode keys and both tag filters persist unchanged on save/read.

**Original line 572:** B22 also rebuilds this leaf table with `CHECK (json_valid(payload))`; equal row counts and foreign_key_check are migration gates (spec §10).

**Original line 587:** Both **Excluded: extraction**: MCP clients can interpret images themselves. Inputs share `sources:{kind:'image',data:nonempty base64 string,mediaType:image/jpeg|image/png|image/gif|image/webp}[]`, length 1–5. These procedures return **untrusted extraction suggestions**, not persisted rules/payments; callers choose owned asset/game/tag ids before writing. Legacy OCR vocabulary in the suggestion is not an alternative persisted tournament contract.

**Original line 596:** `healthCheck` Q: no input, output literal `"OK"`, public; MCP **Excluded: infrastructure**. Retained by B25. `privateData` is deleted by B16, not a protected debug API in the final router.

**Original line 627:** Each row is an exact registry mapping; a comma-separated tool list corresponds positionally to the procedure list. All other procedures above are present in `DELIBERATELY_EXCLUDED` with their stated reasons. Every API-owning task updates registry, schema identity/coupling tests, tool descriptions, `docs/mcp.md` and `docs/mcp.ja.md` in the **same PR**. Handlers call `appRouter.createCaller`, never the database. JSON is returned untrimmed; errors pass through mapToolError, whose forbidden/not-found texts are fixed and id-free.

**Original line 686:** Each union branch tool uses the router's exact branch schema object, not an MCP-specific schema wrapper. Tool descriptions state array replacement, archive recovery, date/quantity units and all cross-field constraints JSON Schema cannot express. Creates are non-idempotent/non-destructive; in-place referenced-master edits are idempotent/destructive; archive/restore are idempotent/non-destructive. No delete or toggle tool is exposed. The new UI consumes this same API; cache-buster and screen work belong to the UI v3 phases (U01–U12), not a second backend contract.

## Removed procedures and input generations

These procedures and fields have been removed together with their MCP registrations. The table records the completed cutovers and their replacements; it is not a compatibility layer.

| Retired procedure / field family | Final replacement | Removed in | Replacement |
| --- | --- | --- | --- |
| session.list/getById/create/update/delete | entry counterparts with final schemas | B06 | B16 |
| session.profitLossSeries | stats.profitLossSeries only | B06 | B22 |
| privateData | None | B16 | — |
| liveCashGameSession.*, liveTournamentSession.* | Unified live router (§4) | B06 | B17 |
| live*.reopen | live.undoEndPlay / undoStartNextPlay for mistakes; startNextPlay for continuation | B06 | B19 |
| live*.updateSnapshot | entry/live.overrideRule | B06 | B20 |
| live*.updateHeroSeat | tablePlayer.add/updateSeat/remove with self player | B06 | B17 |
| live*.update handCount/dealerSeat | hand.add/undoLast; derived button | B06 | B10 |
| sessionEvent.* | playEvent.*, one entry/play identity, object v2 payload | B06 | B17/B15 |
| sessionTablePlayer.* | tablePlayer.* | B06 | B17 |
| currency.* | asset.* | B12 | B12 |
| currencyTransaction.listByCurrency/create/update/delete | ledger.listByAsset/createAdjustment/update/delete; exchange uses createExchange | B14 | B14 |
| transactionType.* | ledgerCategory.*; no reserved result category | B14 | B14 |
| sessionTag.* | entryTag.* | B16 | B16 |
| tournament.addTag/removeTag | tournament update tagIds | B18 | B18 |
| blindLevel.* | tournament.getById / whole-version WithLevels writes | B08 | B08 |
| tournamentChipPurchase.* | tournament rule.prices read/write | B08 | B08 |
| keepSnapshot | relink.keepRule | B06 | B20 |
| variant/mixGames labels, flat master blinds, level games | game ids / stakes / immutable ruleVersion + lineups | B07/B08 (masters), B06 (entry/live), B22 (stats filters/presets) | B07/B08 (masters), B16/B17/B20 (entry/live), B22 (stats/presets) |
| currencyId, sessionDate seconds, type cash_game, evCashOut, flat money inputs/outputs | assetId / defaultAssetId, playedOn, kind cash, evDiff, payments and lines/totals/valuation | B07/B08 (master currencyId), B12 (currency router), B06 (entry/live), B22 (stats inputs/preset keys) | B07/B08, B12, B16/B17, B22 |

## Renamed MCP tools

Renamed tools, **old → new, without aliases**:

| Removed tool | Final tool | Task |
| --- | --- | --- |
| session_list | entry_list | B16 |
| session_get_by_id | entry_get_by_id | B16 |
| session_create_cash_game | entry_create_cash | B16 |
| session_create_tournament | entry_create_tournament | B16 |
| session_update | entry_update | B16 |
| currency_list | asset_list | B12 |
| session_tag_list | entry_tag_list | B16 |
| session_tag_create | entry_tag_create | B16 |
