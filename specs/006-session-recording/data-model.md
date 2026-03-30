# Data Model: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30

## Design Decision

キャッシュゲームとトーナメントのセッション記録は構造が大きく異なるため、別テーブルで管理する。既存のringGame/tournamentが別テーブルであるパターンと一致する。sessionEventとsessionTablePlayerは共有テーブルとし、両セッションへのnullable FKで参照する。

## New Tables

### liveCashGameSession

キャッシュゲームのライブセッション管理エンティティ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | セッション所有者 |
| status | text | NOT NULL | "active" \| "paused" \| "completed" |
| storeId | text | FK → store.id (set null) | 店舗 |
| ringGameId | text | FK → ringGame.id (set null) | キャッシュゲーム設定 |
| currencyId | text | FK → currency.id (set null) | 通貨 |
| startedAt | integer (timestamp) | NOT NULL | セッション開始時刻 |
| endedAt | integer (timestamp) | | セッション終了時刻 |
| memo | text | | メモ |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Indexes**: userId, status, storeId

**Relations**:
- user (many-to-one)
- store (many-to-one)
- ringGame (many-to-one)
- currency (many-to-one)
- sessionEvents (one-to-many)
- tablePlayers (one-to-many)
- pokerSession (one-to-one, via pokerSession.liveCashGameSessionId)

### liveTournamentSession

トーナメントのライブセッション管理エンティティ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | セッション所有者 |
| status | text | NOT NULL | "active" \| "paused" \| "completed" |
| storeId | text | FK → store.id (set null) | 店舗 |
| tournamentId | text | FK → tournament.id (set null) | トーナメント設定 |
| currencyId | text | FK → currency.id (set null) | 通貨 |
| startedAt | integer (timestamp) | NOT NULL | セッション開始時刻 |
| endedAt | integer (timestamp) | | セッション終了時刻 |
| memo | text | | メモ |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Indexes**: userId, status, storeId

**Relations**:
- user (many-to-one)
- store (many-to-one)
- tournament (many-to-one)
- currency (many-to-one)
- sessionEvents (one-to-many)
- tablePlayers (one-to-many)
- pokerSession (one-to-one, via pokerSession.liveTournamentSessionId)

### sessionEvent

セッション中の各操作を記録するイベントエンティティ。キャッシュゲーム・トーナメント両方のセッションで共有する。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| liveCashGameSessionId | text | FK → liveCashGameSession.id (cascade) | キャッシュゲームセッション（nullable） |
| liveTournamentSessionId | text | FK → liveTournamentSession.id (cascade) | トーナメントセッション（nullable） |
| eventType | text | NOT NULL | イベント種別（下記参照） |
| occurredAt | integer (timestamp) | NOT NULL | イベント発生時刻 |
| sortOrder | integer | NOT NULL | 同一時刻内の順序 |
| payload | text | NOT NULL | JSON文字列（イベント固有データ） |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Constraint**: liveCashGameSessionIdとliveTournamentSessionIdのいずれか一方のみがnon-null（アプリケーション層でバリデーション）

**Indexes**: liveCashGameSessionId, liveTournamentSessionId, eventType

**Relations**:
- liveCashGameSession (many-to-one, nullable)
- liveTournamentSession (many-to-one, nullable)

### sessionTablePlayer

セッション中の同卓プレイヤーの現在状態を管理する。キャッシュゲーム・トーナメント両方で共有。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| liveCashGameSessionId | text | FK → liveCashGameSession.id (cascade) | キャッシュゲームセッション（nullable） |
| liveTournamentSessionId | text | FK → liveTournamentSession.id (cascade) | トーナメントセッション（nullable） |
| playerId | text | NOT NULL, FK → player.id (cascade) | プレイヤー |
| isActive | integer | NOT NULL, default 1 | 現在同卓中か (0/1) |
| joinedAt | integer (timestamp) | NOT NULL | 参加時刻 |
| leftAt | integer (timestamp) | | 退席時刻 |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Constraint**: liveCashGameSessionIdとliveTournamentSessionIdのいずれか一方のみがnon-null

**Indexes**: liveCashGameSessionId, liveTournamentSessionId, playerId

**Relations**:
- liveCashGameSession (many-to-one, nullable)
- liveTournamentSession (many-to-one, nullable)
- player (many-to-one)

## Modified Tables

### pokerSession (既存テーブルへの追加)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| liveCashGameSessionId | text | FK → liveCashGameSession.id (set null) | キャッシュゲームLiveSessionへの参照（nullable） |
| liveTournamentSessionId | text | FK → liveTournamentSession.id (set null) | トーナメントLiveSessionへの参照（nullable） |

**Note**: 直接入力で作成されたpokerSessionは両方null。LiveSession経由の場合はいずれか一方がnon-null。

## Event Types & Payload Schemas

### 共通

全イベントは`eventType`でディスパッチし、`payload`のJSON構造をZodスキーマでバリデーションする。

### キャッシュゲーム専用イベント

#### cash_game_buy_in
```json
{ "amount": number }
```

#### cash_game_stack_record
```json
{
  "stackAmount": number,
  "allIns": [
    { "actualResult": number, "evResult": number }
  ],
  "addon": { "amount": number } | null
}
```

#### cash_out
```json
{ "amount": number }
```

### トーナメント専用イベント

#### tournament_stack_record
```json
{
  "stackAmount": number,
  "remainingPlayers": number | null,
  "averageStack": number | null,
  "rebuy": { "cost": number, "chips": number } | null,
  "addon": { "cost": number, "chips": number } | null
}
```

#### tournament_result
```json
{
  "placement": number,
  "totalEntries": number,
  "prizeMoney": number,
  "bountyPrizes": number | null
}
```

### 共通イベント

#### player_join
```json
{ "playerId": string }
```

#### player_leave
```json
{ "playerId": string }
```

#### session_pause
```json
{}
```

#### session_resume
```json
{}
```

## State Transitions

キャッシュゲーム・トーナメント共通:

```
[新規作成] → active
active → paused (中断)
active → completed (完了)
paused → active (再開)
paused → completed (中断から直接完了)
active → [破棄] (削除)
paused → [破棄] (削除)
```

## P&L Calculation (イベント集約)

### キャッシュゲーム
- **totalBuyIn** = Σ(cash_game_buy_in.amount) + Σ(cash_game_stack_record.addon.amount)
- **cashOut** = cash_out.amount
- **P&L** = cashOut - totalBuyIn
- **evCashOut** = cashOut + Σ(allIn.evResult - allIn.actualResult) across all cash_game_stack_records

### トーナメント
- **buyIn** = tournament.buyIn (設定値)
- **entryFee** = tournament.entryFee (設定値)
- **rebuyCount** = count(tournament_stack_records with rebuy)
- **rebuyCost** = Σ(tournament_stack_record.rebuy.cost)
- **addonCost** = Σ(tournament_stack_record.addon.cost)
- **prizeMoney** = tournament_result.prizeMoney
- **bountyPrizes** = tournament_result.bountyPrizes
- **P&L** = (prizeMoney + bountyPrizes) - (buyIn + entryFee + rebuyCost + addonCost)
