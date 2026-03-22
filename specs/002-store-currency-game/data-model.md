# Data Model: 002-store-currency-game

## Entity Relationship Diagram

```
User (auth.user)
├── 1:N → Store
│        ├── 1:N → RingGame ──→ N:1 Currency (optional)
│        └── 1:N → Tournament ─→ N:1 Currency (optional)
│                 ├── 1:N → BlindLevel
│                 └── 1:N → TournamentTag
├── 1:N → Currency
│        └── 1:N → CurrencyTransaction → N:1 TransactionType
└── 1:N → TransactionType
```

## Entities

### Store

| Field     | Type              | Constraints              | Notes                    |
|-----------|-------------------|--------------------------|--------------------------|
| id        | text              | PK                       | crypto.randomUUID()      |
| userId    | text              | FK → user.id, NOT NULL   | cascade delete           |
| name      | text              | NOT NULL                 |                          |
| memo      | text              | nullable                 |                          |
| createdAt | integer(timestamp) | NOT NULL, default now    |                          |
| updatedAt | integer(timestamp) | NOT NULL, auto-update    |                          |

**Indexes**: `store_userId_idx` on userId
**Relations**: user (many-to-one), currencies (one-to-many), ringGames (one-to-many), tournaments (one-to-many)

---

### Currency

| Field     | Type              | Constraints              | Notes                    |
|-----------|-------------------|--------------------------|--------------------------|
| id        | text              | PK                       | crypto.randomUUID()      |
| userId    | text              | FK → user.id, NOT NULL   | cascade delete           |
| name      | text              | NOT NULL                 |                          |
| unit      | text              | nullable                 | 表示用単位 (例: "chips") |
| createdAt | integer(timestamp) | NOT NULL, default now    |                          |
| updatedAt | integer(timestamp) | NOT NULL, auto-update    |                          |

**Indexes**: `currency_userId_idx` on userId
**Relations**: user (many-to-one), transactions (one-to-many)
**Note**: 残高はCurrencyTransactionのSUM集計で算出（保存しない）。店舗に依存せず、ユーザー直属。リングゲーム・トーナメントから店舗をまたいで参照可能。

---

### TransactionType

| Field     | Type              | Constraints              | Notes                    |
|-----------|-------------------|--------------------------|--------------------------|
| id        | text              | PK                       | crypto.randomUUID()      |
| userId    | text              | FK → user.id, NOT NULL   | cascade delete           |
| name      | text              | NOT NULL                 | "Purchase", "Bonus", "Other" |
| createdAt | integer(timestamp) | NOT NULL, default now    |                          |
| updatedAt | integer(timestamp) | NOT NULL, auto-update    |                          |

**Indexes**: `transactionType_userId_idx` on userId
**Relations**: user (many-to-one), transactions (one-to-many)
**Validation**: 参照するトランザクションが存在する場合、削除ブロック
**Default data**: ユーザー作成時に3種（Purchase, Bonus, Other）を自動挿入

---

### CurrencyTransaction

| Field             | Type              | Constraints                     | Notes                    |
|-------------------|-------------------|---------------------------------|--------------------------|
| id                | text              | PK                              | crypto.randomUUID()      |
| currencyId        | text              | FK → currency.id, NOT NULL      | cascade delete           |
| transactionTypeId | text              | FK → transactionType.id, NOT NULL | restrict delete        |
| amount            | integer           | NOT NULL                        | 正=増加, 負=減少         |
| transactedAt      | integer(timestamp) | NOT NULL                       | ユーザー指定日時         |
| memo              | text              | nullable                        |                          |
| createdAt         | integer(timestamp) | NOT NULL, default now           |                          |

**Indexes**: `currencyTransaction_currencyId_idx` on currencyId
**Relations**: currency (many-to-one), transactionType (many-to-one)
**Note**: 履歴取得はカーソルベースページネーション（`nextCursor`）を使用。編集（update）操作をサポート。

---

### RingGame

| Field     | Type              | Constraints              | Notes                        |
|-----------|-------------------|--------------------------|------------------------------|
| id        | text              | PK                       | crypto.randomUUID()          |
| storeId   | text              | FK → store.id, NOT NULL  | cascade delete               |
| name      | text              | NOT NULL                 | ユーザー定義ラベル           |
| variant   | text              | NOT NULL                 | "nlh" (初期はNLHのみ)       |
| blind1    | integer           | nullable                 | NLH: SB                     |
| blind2    | integer           | nullable                 | NLH: BB                     |
| blind3    | integer           | nullable                 | NLH: Straddle                |
| anteType  | text              | nullable                 | "none" / "bb" / "all"       |
| ante      | integer           | nullable                 |                              |
| minBuyIn  | integer           | nullable                 |                              |
| maxBuyIn  | integer           | nullable                 |                              |
| tableSize | integer           | nullable                 | 最大着席人数。バッジ表示     |
| currencyId | text             | FK → currency.id, nullable | set null on delete          |
| memo      | text              | nullable                 |                              |
| archivedAt | integer(timestamp) | nullable                | null=アクティブ              |
| createdAt | integer(timestamp) | NOT NULL, default now    |                              |
| updatedAt | integer(timestamp) | NOT NULL, auto-update    |                              |

**Indexes**: `ringGame_storeId_idx` on storeId
**Relations**: store (many-to-one), currency (many-to-one, nullable)
**Note**: UIでは "Cash Game" と表示する。

---

### Tournament

| Field          | Type              | Constraints              | Notes                    |
|----------------|-------------------|--------------------------|--------------------------|
| id             | text              | PK                       | crypto.randomUUID()      |
| storeId        | text              | FK → store.id, NOT NULL  | cascade delete           |
| name           | text              | NOT NULL                 |                          |
| variant        | text              | NOT NULL                 | "nlh" (初期はNLHのみ)   |
| buyIn          | integer           | nullable                 |                          |
| entryFee       | integer           | nullable                 | レーキ/手数料            |
| startingStack  | integer           | nullable                 |                          |
| rebuyAllowed   | integer(boolean)  | NOT NULL, default false  |                          |
| rebuyCost      | integer           | nullable                 |                          |
| rebuyChips     | integer           | nullable                 |                          |
| addonAllowed   | integer(boolean)  | NOT NULL, default false  |                          |
| addonCost      | integer           | nullable                 |                          |
| addonChips     | integer           | nullable                 |                          |
| bountyAmount   | integer           | nullable                 |                          |
| tableSize      | integer           | nullable                 |                          |
| currencyId     | text              | FK → currency.id, nullable | set null on delete      |
| memo           | text              | nullable                 |                          |
| archivedAt     | integer(timestamp) | nullable                | null=アクティブ          |
| createdAt      | integer(timestamp) | NOT NULL, default now    |                          |
| updatedAt      | integer(timestamp) | NOT NULL, auto-update    |                          |

**Indexes**: `tournament_storeId_idx` on storeId
**Relations**: store (many-to-one), currency (many-to-one, nullable), blindLevels (one-to-many), tags (one-to-many)

---

### TournamentTag

| Field        | Type              | Constraints                   | Notes               |
|--------------|-------------------|-------------------------------|---------------------|
| id           | text              | PK                            | crypto.randomUUID() |
| tournamentId | text              | FK → tournament.id, NOT NULL  | cascade delete      |
| name         | text              | NOT NULL                      |                     |
| createdAt    | integer(timestamp) | NOT NULL, default now         |                     |

**Indexes**: `tournamentTag_tournamentId_idx` on tournamentId
**Relations**: tournament (many-to-one)

---

### BlindLevel

| Field        | Type              | Constraints                   | Notes                              |
|--------------|-------------------|-------------------------------|------------------------------------|
| id           | text              | PK                            | crypto.randomUUID()                |
| tournamentId | text              | FK → tournament.id, NOT NULL  | cascade delete                     |
| level        | integer           | NOT NULL                      | 昇順レベル番号                     |
| isBreak      | integer(boolean)  | NOT NULL, default false       | true=休憩、ブラインドフィールド無視 |
| blind1       | integer           | nullable                      | NLH: SB                           |
| blind2       | integer           | nullable                      | NLH: BB                           |
| blind3       | integer           | nullable                      | NLH: Straddle                      |
| ante         | integer           | nullable                      |                                    |
| minutes      | integer           | nullable                      | レベル/ブレイク時間（分）          |

**Indexes**: `blindLevel_tournamentId_idx` on tournamentId
**Relations**: tournament (many-to-one)
**Note**: レベル番号はアプリケーション層で並び替え管理

## Application Constants

### Game Variants

```typescript
export const GAME_VARIANTS = {
  nlh: {
    label: "NL Hold'em",
    blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
  },
  // 将来追加:
  // plo: { label: "PLO", blindLabels: { blind1: "SB", blind2: "BB", blind3: "3rd Blind" } },
} as const;
```

### Ante Types

```typescript
export const ANTE_TYPES = {
  none: { label: "No Ante" },
  bb: { label: "BB Ante" },
  all: { label: "All Ante" },
} as const;
```

### Default Transaction Types

```typescript
export const DEFAULT_TRANSACTION_TYPES = ["Purchase", "Bonus", "Other"] as const;
```
