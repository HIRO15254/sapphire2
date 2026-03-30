# tRPC Router Contract: liveCashGameSession

**Package**: `@sapphire2/api`
**Router**: `liveCashGameSessionRouter`

## Procedures

### liveCashGameSession.list

**Type**: query (protected)
**Input**:
```typescript
{
  status?: "active" | "paused" | "completed"
  cursor?: string
  limit?: number                               // デフォルト20
}
```
**Output**:
```typescript
{
  items: {
    id: string
    status: "active" | "paused" | "completed"
    store: { id: string, name: string } | null
    ringGame: { id: string, name: string } | null
    currency: { id: string, name: string, unit: string } | null
    startedAt: Date
    endedAt: Date | null
    memo: string | null
    latestStackAmount: number | null
    eventCount: number
  }[]
  nextCursor: string | null
}
```

### liveCashGameSession.getById

**Type**: query (protected)
**Input**: `{ id: string }`
**Output**:
```typescript
{
  id: string
  status: "active" | "paused" | "completed"
  store: { id: string, name: string } | null
  ringGame: { ... } | null
  currency: { ... } | null
  startedAt: Date
  endedAt: Date | null
  memo: string | null
  pokerSessionId: string | null
  events: SessionEvent[]
  tablePlayers: SessionTablePlayer[]
  summary: {
    totalBuyIn: number
    cashOut: number | null
    profitLoss: number | null
    evCashOut: number | null
    addonCount: number
    maxStack: number | null
    minStack: number | null
    currentStack: number | null
  }
}
```

### liveCashGameSession.create

**Type**: mutation (protected)
**Input**:
```typescript
{
  storeId?: string
  ringGameId?: string
  currencyId?: string
  memo?: string
}
```
**Output**: `{ id: string }`

### liveCashGameSession.update

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  memo?: string
  storeId?: string | null
  currencyId?: string | null
}
```
**Output**: `{ id: string }`

### liveCashGameSession.pause

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Side effects**: session_pauseイベントを自動記録

### liveCashGameSession.resume

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Side effects**: session_resumeイベントを自動記録

### liveCashGameSession.complete

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  cashOut: number
}
```
**Output**: `{ id: string, pokerSessionId: string }`
**Side effects**:
- cash_outイベントを自動記録
- pokerSessionレコードを作成（イベント集約からP&L計算）
- 通貨トランザクションを自動作成（currencyId設定時）

### liveCashGameSession.discard

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**: status !== "completed"
**Side effects**: セッション + 全イベント + 全SessionTablePlayerをカスケード削除

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | セッションが存在しないまたは他ユーザーのセッション |
| BAD_REQUEST | 無効な状態遷移（例: completed → pause） |
| BAD_REQUEST | 完了済みセッションの破棄 |
