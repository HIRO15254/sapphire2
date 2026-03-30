# Data Model: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30

## New Tables

### liveSession

ライブセッションの管理エンティティ。進行中・中断中・完了の状態を持つ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | セッション所有者 |
| type | text | NOT NULL | "cash_game" \| "tournament" |
| status | text | NOT NULL | "active" \| "paused" \| "completed" |
| storeId | text | FK → store.id (set null) | 店舗 |
| ringGameId | text | FK → ringGame.id (set null) | キャッシュゲーム設定 |
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
- ringGame (many-to-one)
- tournament (many-to-one)
- currency (many-to-one)
- sessionEvents (one-to-many)
- tablePlayers (one-to-many)
- pokerSession (one-to-one, via pokerSession.liveSessionId)

### sessionEvent

セッション中の各操作を記録するイベントエンティティ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| liveSessionId | text | NOT NULL, FK → liveSession.id (cascade) | 所属セッション |
| eventType | text | NOT NULL | イベント種別（下記参照） |
| occurredAt | integer (timestamp) | NOT NULL | イベント発生時刻 |
| sortOrder | integer | NOT NULL | 同一時刻内の順序 |
| payload | text | NOT NULL | JSON文字列（イベント固有データ） |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Indexes**: liveSessionId, eventType

**Relations**:
- liveSession (many-to-one)

### sessionTablePlayer

セッション中の同卓プレイヤーの現在状態を管理する。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| liveSessionId | text | NOT NULL, FK → liveSession.id (cascade) | 所属セッション |
| playerId | text | NOT NULL, FK → player.id (cascade) | プレイヤー |
| isActive | integer | NOT NULL, default 1 | 現在同卓中か (0/1) |
| joinedAt | integer (timestamp) | NOT NULL | 参加時刻 |
| leftAt | integer (timestamp) | | 退席時刻 |
| createdAt | integer (timestamp) | NOT NULL, default unixepoch() | 作成日時 |
| updatedAt | integer (timestamp) | NOT NULL, $onUpdate | 更新日時 |

**Indexes**: liveSessionId, playerId

**Relations**:
- liveSession (many-to-one)
- player (many-to-one)

## Modified Tables

### pokerSession (既存テーブルへの追加)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| liveSessionId | text | FK → liveSession.id (set null) | LiveSessionへの参照（nullable） |

**Note**: 直接入力で作成されたpokerSessionはliveSessionIdがnull。

## Event Types & Payload Schemas

### 共通

全イベントは`eventType`でディスパッチし、`payload`のJSON構造をZodスキーマでバリデーションする。

### cash_game_buy_in
```json
{ "amount": number }
```

### stack_record (キャッシュゲーム)
```json
{
  "stackAmount": number,
  "allIns": [
    { "actualResult": number, "evResult": number }
  ],
  "addon": { "amount": number } | null
}
```

### stack_record (トーナメント)
```json
{
  "stackAmount": number,
  "remainingPlayers": number | null,
  "averageStack": number | null,
  "rebuy": { "cost": number, "chips": number } | null,
  "addon": { "cost": number, "chips": number } | null
}
```

### cash_out
```json
{ "amount": number }
```

### tournament_result
```json
{
  "placement": number,
  "totalEntries": number,
  "prizeMoney": number,
  "bountyPrizes": number | null
}
```

### player_join
```json
{ "playerId": string }
```

### player_leave
```json
{ "playerId": string }
```

### session_pause
```json
{}
```

### session_resume
```json
{}
```

## State Transitions

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
- **totalBuyIn** = Σ(cash_game_buy_in.amount) + Σ(stack_record.addon.amount)
- **cashOut** = cash_out.amount
- **P&L** = cashOut - totalBuyIn
- **evCashOut** = cashOut + Σ(allIn.evResult - allIn.actualResult) across all stack_records

### トーナメント
- **buyIn** = tournament.buyIn (設定値)
- **entryFee** = tournament.entryFee (設定値)
- **rebuyCount** = count(stack_records with rebuy)
- **rebuyCost** = Σ(stack_record.rebuy.cost)
- **addonCost** = Σ(stack_record.addon.cost)
- **prizeMoney** = tournament_result.prizeMoney
- **bountyPrizes** = tournament_result.bountyPrizes
- **P&L** = (prizeMoney + bountyPrizes) - (buyIn + entryFee + rebuyCost + addonCost)
