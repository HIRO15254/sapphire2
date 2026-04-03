# Data Model: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-31

## Design Decision

キャッシュゲームとトーナメントのセッション記録は構造が大きく異なるため、別テーブルで管理する。既存のringGame/tournamentが別テーブルであるパターンと一致する。sessionEventとsessionTablePlayerは共有テーブルとし、両セッションへのnullable FKで参照する。

## New Tables

### liveCashGameSession

キャッシュゲームのライブセッション管理エンティティ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | セッション所有者 |
| status | text | NOT NULL | "active" \| "completed" |
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

**Create時の注意**: `initialBuyIn`を作成時に指定し、`session_start`イベントと`chip_add`（initialBuyIn）イベントが自動作成される。

### liveTournamentSession

トーナメントのライブセッション管理エンティティ。

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | UUID |
| userId | text | NOT NULL, FK → user.id (cascade) | セッション所有者 |
| status | text | NOT NULL | "active" \| "completed" |
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

### 概要

全イベントは`eventType`でディスパッチし、`payload`のJSON構造をZodスキーマでバリデーションする。イベントタイプは4グループに分類される。

```
GENERIC_EVENT_TYPES:    chip_add, stack_record
LIFECYCLE_EVENT_TYPES:  session_start, session_end
TOURNAMENT_EVENT_TYPES: tournament_stack_record, tournament_result
COMMON_EVENT_TYPES:     player_join, player_leave
```

**MANUAL_CREATE_BLOCKED**: `session_start`, `session_end` はシステムが自動生成する。ユーザーがAPIから手動作成することはできない。

### 汎用イベント (GENERIC_EVENT_TYPES)

#### chip_add
```json
{ "amount": number }
```

初回バイイン（セッション開始時に自動作成）とアドオン（ユーザーが任意タイミングで追加）の両方に使用する。アドオンはスタック記録とは独立した別イベントとして記録する。

#### stack_record
```json
{
  "stackAmount": number,
  "allIns": [
    { "potSize": number, "trials": number, "equity": number, "wins": number }
  ]
}
```

**allInsフィールド説明**:
- `potSize`: ポット合計額
- `trials`: 試行回数 (Run it multi times, 通常1)
- `equity`: 勝率(%, 0-100)
- `wins`: 実際の勝利数 (小数許容, chop対応. 例: 2回中1勝1chop → 1.5)
- EV計算: `evAmount = potSize × (equity / 100) × trials`
- 実際の獲得額: `actualAmount = potSize × wins`

> **Note**: `addon`フィールドは存在しない。アドオンは独立した `chip_add` イベントとして記録する。

### ライフサイクルイベント (LIFECYCLE_EVENT_TYPES)

#### session_start
```json
{}
```

セッション開始時（初回・再始動）にシステムが自動生成する。ユーザーによる手動作成は不可。再始動（reopen）時は既存のイベント列末尾に新しい `session_start` を追記する（以前の `session_end` を含む全イベントを保持）。

#### session_end
```json
{}
```

セッション完了時にシステムが自動生成する。ユーザーによる手動作成は不可。

### トーナメント専用イベント (TOURNAMENT_EVENT_TYPES)

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

### 共通イベント (COMMON_EVENT_TYPES)

#### player_join
```json
{ "playerId": string }
```

#### player_leave
```json
{ "playerId": string }
```

## State Transitions

キャッシュゲーム・トーナメント共通:

```
[新規作成] → active
active → completed (完了)
completed → active (再始動/reopen)
active → [破棄] (削除)
```

## P&L Calculation (イベント集約)

### キャッシュゲーム
- **totalBuyIn** = Σ(chip_add.amount) — 全 `chip_add` イベントの合計（初回バイイン＋全アドオン）
- **cashOut** = 最後の `stack_record.stackAmount`
- **addonTotal** = Σ(chip_add.amount) - 最初の chip_add.amount — 初回バイインを除いたアドオン合計
- **P&L** = cashOut - totalBuyIn
- **evDiff** = Σ(potSize × equity/100 × trials - potSize × wins) — 全 `stack_record` の allIns にわたる EV 差分合計
- **evCashOut** = cashOut + evDiff

### トーナメント
- **buyIn** = tournament.buyIn (設定値)
- **entryFee** = tournament.entryFee (設定値)
- **rebuyCount** = count(tournament_stack_records with rebuy)
- **rebuyCost** = Σ(tournament_stack_record.rebuy.cost)
- **addonCost** = Σ(tournament_stack_record.addon.cost)
- **prizeMoney** = tournament_result.prizeMoney
- **bountyPrizes** = tournament_result.bountyPrizes
- **P&L** = (prizeMoney + bountyPrizes) - (buyIn + entryFee + rebuyCost + addonCost)
