# Data Model: Live Session Recording

**Branch**: `006-session-recording`

## Live Session Tables

### `liveCashGameSession`

- `id`, `userId`, `status`, `storeId`, `ringGameId`, `currencyId`
- `startedAt`, `endedAt`, `heroSeatPosition`, `memo`
- `createdAt`, `updatedAt`
- Indexed by `userId`, `status`, and `storeId`

### `liveTournamentSession`

- `id`, `userId`, `status`, `storeId`, `tournamentId`, `currencyId`
- `buyIn`, `entryFee`
- `startedAt`, `endedAt`, `heroSeatPosition`, `memo`
- `createdAt`, `updatedAt`
- Indexed by `userId`, `status`, and `storeId`

## Shared Tables

### `sessionEvent`

Current event log for both live session types.

- `id`
- `liveCashGameSessionId` or `liveTournamentSessionId`
- `eventType`
- `occurredAt`
- `sortOrder`
- `payload`
- `createdAt`, `updatedAt`

The app layer enforces that exactly one live session id is present. Payloads are stored as JSON text.

Current event types:

- `chip_add`
- `stack_record`
- `tournament_stack_record`
- `tournament_result`
- `player_join`
- `player_leave`
- `session_start`
- `session_end`

### `sessionTablePlayer`

Current table-player state for both live session types.

- `id`
- `liveCashGameSessionId` or `liveTournamentSessionId`
- `playerId`
- `seatPosition`
- `isActive`
- `joinedAt`
- `leftAt`
- `createdAt`, `updatedAt`

## Reporting Compatibility

### `pokerSession`

The existing reporting table keeps nullable links back to live sessions.

- `liveCashGameSessionId`
- `liveTournamentSessionId`

That allows completed live sessions to continue feeding the existing sessions list and analysis views.

## Payload Notes

- Cash game `stack_record` stores `stackAmount` and `allIns`.
- Tournament `tournament_stack_record` stores `stackAmount`, `remainingPlayers`, `totalEntries`, `chipPurchases`, `chipPurchaseCounts`, and accepts legacy `averageStack` / `rebuy` / `addon` fields.
- `chip_add` is used for the initial buy-in and later add-ons in cash games.
- `tournament_result` stores `placement`, `totalEntries`, `prizeMoney`, and optional `bountyPrizes`.
