# API data model v2 history

Historical migration, release and cutover notes from the former API design. The [current API contract](../design/api.md) supersedes these notes.

**Original line 3:** Status: **design contract**, for the single v2 + new UI release. This is not a description of the currently deployed API. All tasks in [data-model-v2.md §17](data-model-v2-history.md#17-task-breakdown) must be complete. Releases remain frozen until that release; the old feature UI is removed by B03, not adapted to these contracts.

The v2 cutover removed the old feature UI rather than adapting it. The rollout tasks established bounds for tag reorder, hand details, lineups, tournament levels and prices, and manual plays and payments; integration tests measured the largest admitted D1 writes against the invocation budget.

The release plan introduced required blind flags and changed the built-in Big Bet group to two blinds. Its migration rejected existing Big Bet stakes with a third blind value.

The event migration resolved price links and self-player identities from stored relationships. The preset migration renamed legacy filter keys, converted UTC-midnight timestamps to calendar dates, removed dangling selections and added JSON validity checks.

The hand detail and tag phases added per-link review timestamps. The entry-tag router was replaced by the shared tag factory, which also introduced the other tag kinds.

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
