# tRPC Router Contract: sessionEvent

**Package**: `@sapphire2/api`
**Router**: `sessionEventRouter`

## Procedures

### sessionEvent.list

**Type**: query (protected)
**Input**:
```typescript
{
  liveSessionId: string
}
```
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
  liveSessionId: string
  eventType: string
  occurredAt?: Date          // 省略時は現在時刻
  payload: object            // イベントタイプに応じたpayload
}
```
**Output**: `{ id: string }`
**Validation**:
- liveSessionが存在し、ユーザーが所有者であること
- eventTypeが有効な値であること
- payloadがeventTypeに対応するZodスキーマに適合すること
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
