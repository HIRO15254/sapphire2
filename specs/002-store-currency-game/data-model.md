# Data Model: 002-store-currency-game

## Relationship Overview

```
User
├─ 1:N Store
│  ├─ 1:N RingGame ── N:1 Currency (optional, set null on delete)
│  └─ 1:N Tournament ─ N:1 Currency (optional, set null on delete)
│      ├─ 1:N BlindLevel
│      ├─ 1:N TournamentChipPurchase
│      └─ 1:N TournamentTag
├─ 1:N Currency
│  └─ 1:N CurrencyTransaction ─ N:1 TransactionType
└─ 1:N TransactionType
```

## Entities

### Store

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| userId | text | FK to `user.id`, cascade delete |
| name | text | required |
| memo | text | optional |
| createdAt | timestamp | default now |
| updatedAt | timestamp | auto-update |

**Index**: `store_userId_idx`

### Currency

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| userId | text | FK to `user.id`, cascade delete |
| name | text | required |
| unit | text | optional display unit |
| createdAt | timestamp | default now |
| updatedAt | timestamp | auto-update |

**Index**: `currency_userId_idx`
**Note**: balance is derived from `CurrencyTransaction.amount` and is not stored.

### TransactionType

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| userId | text | FK to `user.id`, cascade delete |
| name | text | required |
| createdAt | timestamp | default now |
| updatedAt | timestamp | auto-update |

**Index**: `transactionType_userId_idx`
**Note**: the first `list` call seeds `Purchase`, `Bonus`, `Session Result`, `Other`.

### CurrencyTransaction

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| currencyId | text | FK to `currency.id`, cascade delete |
| transactionTypeId | text | FK to `transactionType.id` |
| sessionId | text | optional session link |
| amount | integer | positive or negative |
| transactedAt | timestamp | required |
| memo | text | optional |
| createdAt | timestamp | default now |

**Indexes**: `currencyTransaction_currencyId_idx`, `currencyTransaction_sessionId_idx`
**Note**: session-generated rows are protected in the API and cannot be edited/deleted from the currency UI.

### RingGame

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| storeId | text | nullable in schema, required by API/UI |
| name | text | required |
| variant | text | default `nlh` |
| blind1 | integer | optional |
| blind2 | integer | optional |
| blind3 | integer | optional |
| ante | integer | optional |
| anteType | text | optional |
| minBuyIn | integer | optional |
| maxBuyIn | integer | optional |
| tableSize | integer | optional |
| currencyId | text | optional, set null on currency delete |
| memo | text | optional |
| archivedAt | timestamp | optional |
| createdAt | timestamp | default now |
| updatedAt | timestamp | auto-update |

**Index**: `ringGame_storeId_idx`
**Note**: UI label is `Cash Game`.

### Tournament

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| storeId | text | required, cascade delete |
| name | text | required |
| variant | text | default `nlh` |
| buyIn | integer | optional |
| entryFee | integer | optional |
| startingStack | integer | optional |
| bountyAmount | integer | optional |
| tableSize | integer | optional |
| currencyId | text | optional, set null on currency delete |
| memo | text | optional |
| archivedAt | timestamp | optional |
| createdAt | timestamp | default now |
| updatedAt | timestamp | auto-update |

**Index**: `tournament_storeId_idx`

### BlindLevel

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| tournamentId | text | FK to `tournament.id`, cascade delete |
| level | integer | ordered level number |
| isBreak | boolean | default false |
| blind1 | integer | optional |
| blind2 | integer | optional |
| blind3 | integer | optional |
| ante | integer | optional |
| minutes | integer | optional |

**Index**: `blindLevel_tournamentId_idx`

### TournamentChipPurchase

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| tournamentId | text | FK to `tournament.id`, cascade delete |
| name | text | required |
| cost | integer | required |
| chips | integer | required |
| sortOrder | integer | default 0 |

**Index**: `tournamentChipPurchase_tournamentId_idx`

### TournamentTag

| Field | Type | Notes |
|---|---|---|
| id | text | PK, UUID |
| tournamentId | text | FK to `tournament.id`, cascade delete |
| name | text | required |
| createdAt | timestamp | default now |

**Index**: `tournamentTag_tournamentId_idx`

## Application Constants

- `GAME_VARIANTS`: currently only `nlh`
- `DEFAULT_TRANSACTION_TYPES`: `Purchase`, `Bonus`, `Session Result`, `Other`
