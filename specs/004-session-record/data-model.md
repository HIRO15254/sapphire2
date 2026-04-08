# Data Model: Live Session Recording

## Entity: `poker_session`

Historical session record used by the `/sessions` page.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| userId | TEXT | NO | FK to user, cascade delete |
| type | TEXT | NO | `cash_game` or `tournament` |
| sessionDate | INTEGER | NO | Session date |
| storeId | TEXT | YES | Optional store link, set null on delete |
| ringGameId | TEXT | YES | Optional cash-game config link |
| tournamentId | TEXT | YES | Optional tournament config link |
| currencyId | TEXT | YES | Optional currency link |
| liveCashGameSessionId | TEXT | YES | Link back to active cash session |
| liveTournamentSessionId | TEXT | YES | Link back to active tournament session |
| buyIn / cashOut / evCashOut | INTEGER | YES | Cash game fields |
| tournamentBuyIn / entryFee / placement / totalEntries / prizeMoney / rebuyCount / rebuyCost / addonCost / bountyPrizes | INTEGER | YES | Tournament fields |
| startedAt / endedAt | INTEGER | YES | Session time range |
| memo | TEXT | YES | Free text notes |
| createdAt / updatedAt | INTEGER | NO | Timestamps |

### Computed Fields

- Cash game `profitLoss = cashOut - buyIn`
- Cash game `evProfitLoss = evCashOut - buyIn`
- Cash game `evDiff = evProfitLoss - profitLoss`
- Tournament `profitLoss = (prizeMoney + bountyPrizes) - (tournamentBuyIn + entryFee + rebuyCount * rebuyCost + addonCost)`

## Entity: `live_cash_game_session`

Current live cash game state.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| userId | TEXT | NO | Owner |
| status | TEXT | NO | `active` or `completed` |
| storeId | TEXT | YES | Optional store link |
| ringGameId | TEXT | YES | Optional ring game link |
| currencyId | TEXT | YES | Optional currency link |
| startedAt | INTEGER | NO | Start time |
| endedAt | INTEGER | YES | Completion time |
| heroSeatPosition | INTEGER | YES | Current hero seat |
| memo | TEXT | YES | Notes |
| createdAt / updatedAt | INTEGER | NO | Timestamps |

## Entity: `live_tournament_session`

Current live tournament state.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| userId | TEXT | NO | Owner |
| status | TEXT | NO | `active` or `completed` |
| storeId | TEXT | YES | Optional store link |
| tournamentId | TEXT | YES | Optional tournament link |
| currencyId | TEXT | YES | Optional currency link |
| buyIn / entryFee | INTEGER | YES | Session defaults |
| startedAt | INTEGER | NO | Start time |
| endedAt | INTEGER | YES | Completion time |
| heroSeatPosition | INTEGER | YES | Current hero seat |
| memo | TEXT | YES | Notes |
| createdAt / updatedAt | INTEGER | NO | Timestamps |

## Entity: `session_event`

Ordered event log for a live session.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| liveCashGameSessionId | TEXT | YES | FK to live cash session |
| liveTournamentSessionId | TEXT | YES | FK to live tournament session |
| eventType | TEXT | NO | `chip_add`, `stack_record`, `player_join`, `player_leave`, `session_start`, `session_end`, `tournament_stack_record`, `tournament_result` |
| occurredAt | INTEGER | NO | Event time |
| sortOrder | INTEGER | NO | Stable ordering for same timestamp |
| payload | TEXT | NO | JSON payload |
| createdAt / updatedAt | INTEGER | NO | Timestamps |

## Entity: `session_table_player`

Seating and activity state for live sessions.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| liveCashGameSessionId | TEXT | YES | FK to live cash session |
| liveTournamentSessionId | TEXT | YES | FK to live tournament session |
| playerId | TEXT | NO | FK to player |
| seatPosition | INTEGER | YES | Seat index |
| isActive | INTEGER | NO | 0/1 active flag |
| joinedAt / leftAt | INTEGER | YES | Activity timestamps |
| createdAt / updatedAt | INTEGER | NO | Timestamps |

## Entity: `session_tag`

User-scoped session label.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | TEXT | NO | Primary key |
| userId | TEXT | NO | Owner |
| name | TEXT | NO | Tag name |
| createdAt | INTEGER | NO | Timestamp |

## Junction: `session_to_session_tag`

Many-to-many link between `poker_session` and `session_tag`.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| sessionId | TEXT | NO | FK to poker_session |
| sessionTagId | TEXT | NO | FK to session_tag |

## Related Entity: `currency_transaction`

- `sessionId` links read-only session-generated transactions back to their source `poker_session`.
- Currency-linked sessions create or update one transaction that mirrors the session P&L.

## Related Entity: `ring_game`

- `storeId` is nullable so session-created standalone ring game configurations can exist without a store.
