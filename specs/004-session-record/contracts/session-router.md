# tRPC Router Contract: `session`

The `session` router is the historical session API used by `/sessions`.

## `session.create`

- **Type**: mutation
- **Input**: `type`, `sessionDate`, optional `storeId`, optional `ringGameId` or `tournamentId`, optional `currencyId`, optional cash-game or tournament fields, optional `startedAt` / `endedAt`, optional `memo`, optional `tagIds`
- **Behavior**:
  - Creates a `poker_session` record for either `cash_game` or `tournament`
  - Auto-creates a standalone `ring_game` when a cash game omits `ringGameId`
  - Creates one `currency_transaction` when `currencyId` is present
  - Creates `session_to_session_tag` rows for supplied tags

## `session.list`

- **Type**: query
- **Input**: optional `type`, `storeId`, `currencyId`, `dateFrom`, `dateTo`, `cursor`
- **Behavior**:
  - Returns sessions ordered by `sessionDate DESC, id DESC`
  - Supports cursor pagination by `id`
  - Returns a `summary` object alongside the paginated items

### Item shape

- `id`
- `type`
- `sessionDate`
- `buyIn`, `cashOut`, `evCashOut`
- `tournamentBuyIn`, `entryFee`, `placement`, `totalEntries`, `prizeMoney`, `rebuyCount`, `rebuyCost`, `addonCost`, `bountyPrizes`
- `storeId`, `storeName`
- `ringGameId`, `ringGameName`
- `tournamentId`, `tournamentName`
- `currencyId`, `currencyName`, `currencyUnit`
- `liveCashGameSessionId`, `liveTournamentSessionId`
- `startedAt`, `endedAt`, `memo`
- `profitLoss`, `evProfitLoss`, `evDiff`
- `tags`
- `createdAt`

### Summary shape

- `totalSessions`
- `totalProfitLoss`
- `winRate`
- `avgProfitLoss`
- `avgPlacement`, `totalPrizeMoney`, `itmRate` when filtered to tournaments
- `totalEvProfitLoss`, `totalEvDiff` when cash-game EV data exists

## `session.getById`

- **Type**: query
- **Input**: `{ id }`
- **Behavior**: returns the full session record, including linked entity names and tags.

## `session.update`

- **Type**: mutation
- **Input**: `id` plus optional updates for date, links, cash-game fields, tournament fields, time range, memo, ring-game config fields, and `tagIds`
- **Behavior**:
  - Type is immutable
  - Replaces tag links when `tagIds` is present
  - Updates or recreates the linked currency transaction when currency changes

## `session.delete`

- **Type**: mutation
- **Input**: `{ id }`
- **Behavior**: deletes the historical session record and relies on FK cascade for linked session transactions and tag links
