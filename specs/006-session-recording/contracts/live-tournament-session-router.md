# tRPC Router Contract: liveTournamentSession

**Package**: `@sapphire2/api`
**Router**: `liveTournamentSessionRouter`

## Procedures

### liveTournamentSession.list

**Type**: query (protected)
**Input**:
```typescript
{
  status?: "active" | "completed"
  cursor?: string
  limit?: number                               // デフォルト20
}
```
**Output**:
```typescript
{
  items: {
    id: string
    status: "active" | "completed"
    store: { id: string, name: string } | null
    tournament: { id: string, name: string } | null
    currency: { id: string, name: string, unit: string } | null
    startedAt: Date
    endedAt: Date | null
    memo: string | null
    latestStackAmount: number | null
    remainingPlayers: number | null
    averageStack: number | null
    eventCount: number
  }[]
  nextCursor: string | null
}
```

### liveTournamentSession.getById

**Type**: query (protected)
**Input**: `{ id: string }`
**Output**:
```typescript
{
  id: string
  status: "active" | "completed"
  store: { id: string, name: string } | null
  tournament: { ... } | null
  currency: { ... } | null
  startedAt: Date
  endedAt: Date | null
  memo: string | null
  pokerSessionId: string | null
  events: SessionEvent[]
  tablePlayers: SessionTablePlayer[]
  summary: {
    rebuyCount: number
    rebuyCost: number
    addonCount: number
    addonCost: number
    placement: number | null
    totalEntries: number | null
    prizeMoney: number | null
    bountyPrizes: number | null
    profitLoss: number | null
    maxStack: number | null
    minStack: number | null
    currentStack: number | null
    remainingPlayers: number | null
    averageStack: number | null
  }
}
```

### liveTournamentSession.create

**Type**: mutation (protected)
**Input**:
```typescript
{
  storeId?: string
  tournamentId?: string
  currencyId?: string
  memo?: string
}
```
**Output**: `{ id: string }`

### liveTournamentSession.update

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

### liveTournamentSession.complete

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  placement: number
  totalEntries: number
  prizeMoney: number
  bountyPrizes?: number
}
```
**Output**: `{ id: string, pokerSessionId: string }`
**Side effects**:
- tournament_resultイベントを自動記録
- pokerSessionレコードを作成（イベント集約からP&L計算）
- 通貨トランザクションを自動作成（currencyId設定時）

### liveTournamentSession.reopen

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**: status === "completed", no other active session exists
**Side effects**: status を "active" に変更

### liveTournamentSession.discard

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**: status === "active"
**Side effects**: セッション + 全イベント + 全SessionTablePlayerをカスケード削除

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | セッションが存在しないまたは他ユーザーのセッション |
| BAD_REQUEST | 無効な状態遷移 |
| BAD_REQUEST | アクティブでないセッションの破棄 |
| BAD_REQUEST | reopen時に他のアクティブセッションが存在する |
