# tRPC Router Contract: sessionEvent

**Package**: `@sapphire2/api`
**Router**: `sessionEventRouter`

## Event Types

### Generic Event Types (`GENERIC_EVENT_TYPES`)

These types are valid for both cash game and tournament sessions:

| Type | Payload | Description |
|------|---------|-------------|
| `chip_add` | `{ amount: number }` | バイイン・アドオン等のチップ追加 |
| `stack_record` | `{ stackAmount: number, allIns: [{ potSize, trials, equity, wins }] }` | スタック記録（アドオンは別途 chip_add で記録） |

### Lifecycle Event Types (`LIFECYCLE_EVENT_TYPES`)

Auto-managed by session lifecycle mutations; cannot be manually created:

| Type | Payload | Description |
|------|---------|-------------|
| `session_start` | `{}` | セッション開始（create/reopen 時に自動記録） |
| `session_end` | `{}` | セッション終了（complete 時に自動記録） |

### Manual Create Blocked (`MANUAL_CREATE_BLOCKED`)

The following event types are auto-created by session lifecycle only and **cannot** be created via `sessionEvent.create`:

- `session_start`
- `session_end`

## Procedures

### sessionEvent.list

**Type**: query (protected)
**Input**:
```typescript
{
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
}
```
**Validation**: いずれか一方のみ指定
**Output**:
```typescript
{
  items: {
    id: string
    eventType: string
    occurredAt: Date
    sortOrder: number
    payload: object     // Zodバリデーション済みのパース結果
    createdAt: Date
    updatedAt: Date
  }[]
}
```
**Note**: occurredAt ASC, sortOrder ASC でソート

### sessionEvent.create

**Type**: mutation (protected)
**Input**:
```typescript
{
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  eventType: string
  occurredAt?: Date          // 省略時は現在時刻
  payload: object            // イベントタイプに応じたpayload
}
```
**Validation**:
- セッションIDはいずれか一方のみ指定
- セッションが存在し、ユーザーが所有者であること
- eventTypeがセッション種別に対して有効な値であること
- payloadがeventTypeに対応するZodスキーマに適合すること
- `session_start` および `session_end` は手動作成不可（セッションライフサイクルが自動管理）

**Payload examples**:
```typescript
// chip_add
{ amount: 5000 }

// stack_record
{
  stackAmount: 12000,
  allIns: [
    { potSize: 8000, trials: 1, equity: 65.0, wins: 1 }
  ]
}
```
**Output**: `{ id: string }`
**Side effects**:
- player_join: SessionTablePlayerのisActiveをtrueに
- player_leave: SessionTablePlayerのisActiveをfalseに、leftAtを設定
- 完了済みセッションの場合: pokerSessionとcurrencyTransactionを再計算

### sessionEvent.update

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  occurredAt?: Date
  payload?: object
}
```
**Output**: `{ id: string }`
**Validation**:
- セッションの所有者であること
- payloadが変更される場合、eventTypeに対応するZodスキーマに適合すること
**Side effects**:
- 完了済みセッションの場合: pokerSessionとcurrencyTransactionを再計算

### sessionEvent.delete

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Side effects**:
- player_joinイベントの削除: 対応するSessionTablePlayerを削除
- 完了済みセッションの場合: pokerSessionとcurrencyTransactionを再計算

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | イベントまたはセッションが存在しない |
| FORBIDDEN | 他ユーザーのセッションのイベント |
| BAD_REQUEST | 無効なeventTypeまたはpayload |
| BAD_REQUEST | セッション種別に対して無効なイベントタイプ |
| BAD_REQUEST | セッションIDの指定が不正（両方指定、両方未指定） |
| BAD_REQUEST | `session_start` または `session_end` の手動作成試行 |
