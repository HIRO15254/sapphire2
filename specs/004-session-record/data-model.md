# Data Model: Session Post-Recording

## Entity: `session`

Single table with type discriminator. All type-specific fields are nullable.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | TEXT | NO | — | Primary key (UUID) |
| userId | TEXT | NO | — | FK → user.id (CASCADE) |
| type | TEXT | NO | — | `cash_game` or `tournament` |
| sessionDate | INTEGER | NO | — | Calendar date as unix timestamp |
| storeId | TEXT | YES | NULL | FK → store.id (SET NULL) |
| ringGameId | TEXT | YES | NULL | FK → ringGame.id (SET NULL) |
| tournamentId | TEXT | YES | NULL | FK → tournament.id (SET NULL) |
| currencyId | TEXT | YES | NULL | FK → currency.id (SET NULL) |
| **Cash game fields** | | | | |
| buyIn | INTEGER | YES | NULL | Total buy-in amount (cash game) |
| cashOut | INTEGER | YES | NULL | Cash-out amount (cash game) |
| evCashOut | INTEGER | YES | NULL | EV-adjusted cash-out (cash game only) |
| **Tournament fields** | | | | |
| tournamentBuyIn | INTEGER | YES | NULL | Tournament buy-in |
| entryFee | INTEGER | YES | NULL | Tournament entry fee |
| placement | INTEGER | YES | NULL | Finishing position |
| totalEntries | INTEGER | YES | NULL | Total tournament entries |
| prizeMoney | INTEGER | YES | NULL | Prize money won |
| rebuyCount | INTEGER | YES | NULL | Number of rebuys |
| rebuyCost | INTEGER | YES | NULL | Cost per rebuy |
| addonCost | INTEGER | YES | NULL | Addon cost |
| bountyPrizes | INTEGER | YES | NULL | Bounty prizes earned |
| **Common optional fields** | | | | |
| startedAt | INTEGER | YES | NULL | Session start timestamp |
| endedAt | INTEGER | YES | NULL | Session end timestamp |
| memo | TEXT | YES | NULL | Free-text notes |
| **Timestamps** | | | | |
| createdAt | INTEGER | NO | unixepoch() | Record creation |
| updatedAt | INTEGER | NO | — | Last update ($onUpdate) |

### Indexes

- `session_userId_idx` on (userId)
- `session_sessionDate_idx` on (sessionDate)
- `session_storeId_idx` on (storeId)
- `session_currencyId_idx` on (currencyId)

### Computed Fields (application-level)

**Cash game**:
- `profitLoss` = cashOut - buyIn
- `evProfitLoss` = evCashOut - buyIn (when evCashOut is set)
- `evDiff` = evProfitLoss - profitLoss

**Tournament**:
- `totalCost` = tournamentBuyIn + entryFee + (rebuyCount × rebuyCost) + addonCost
- `profitLoss` = (prizeMoney + bountyPrizes) - totalCost

### Relations

```
session.userId → user.id (many-to-one)
session.storeId → store.id (many-to-one, optional)
session.ringGameId → ringGame.id (many-to-one, optional)
session.tournamentId → tournament.id (many-to-one, optional)
session.currencyId → currency.id (many-to-one, optional)
session → currencyTransaction (one-to-many, via currencyTransaction.sessionId)
```

### Validation Rules

- `type` must be `cash_game` or `tournament`
- Cash game: `buyIn` and `cashOut` required, both ≥ 0
- Tournament: `tournamentBuyIn` and `entryFee` required, both ≥ 0
- Tournament: `placement` > 0 and `placement` ≤ `totalEntries` (when both provided)
- All monetary amounts ≥ 0
- `ringGameId` only set when type = `cash_game`
- `tournamentId` only set when type = `tournament`
- `evCashOut` only set when type = `cash_game`
- `startedAt` ≤ `endedAt` (when both provided)

---

## Modification: `currencyTransaction` (existing table)

Add one nullable column:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| sessionId | TEXT | YES | NULL | FK → session.id (CASCADE) |

### New Index

- `currencyTransaction_sessionId_idx` on (sessionId)

### Behavior

- When `sessionId` is NOT NULL, the transaction is session-generated and read-only from the currency page
- CASCADE delete: if session is deleted, its auto-generated transaction is also deleted
- The transaction uses a dedicated transactionType "Session Result" (auto-seeded, similar to existing default types)

### Updated Relations

```
currencyTransaction.sessionId → session.id (many-to-one, optional)
```

---

## Modification: `transactionType` (existing table, data only)

Seed a new default transactionType:

| name | description |
|------|-------------|
| Session Result | Auto-generated from session P&L |

This follows the existing pattern of seeding default transaction types (Purchase, Bonus, Other).

---

## Summary Statistics (computed, not stored)

### Overall Summary

```sql
SELECT
  COUNT(*) as totalSessions,
  COALESCE(SUM(profitLoss), 0) as totalProfitLoss,
  AVG(profitLoss) as avgProfitLoss,
  COUNT(CASE WHEN profitLoss > 0 THEN 1 END) * 100.0 / COUNT(*) as winRate
FROM (computed session P&L subquery)
WHERE userId = ? AND [optional filters]
```

### Tournament-specific Summary (when filtered to tournaments)

```sql
AVG(placement) as avgPlacement,
SUM(prizeMoney + bountyPrizes) as totalPrizeMoney,
COUNT(CASE WHEN prizeMoney > 0 THEN 1 END) * 100.0 / COUNT(*) as itmRate
```

### EV Summary (cash game sessions with EV data only)

```sql
SUM(evProfitLoss) as totalEvProfitLoss,
SUM(evDiff) as totalEvDiff
WHERE type = 'cash_game' AND evCashOut IS NOT NULL
```
