# tRPC Router Contract: liveSession

**Package**: `@sapphire2/api`
**Router**: `liveSessionRouter`

## Procedures

### liveSession.list

**Type**: query (protected)
**Input**:
```typescript
{
  status?: "active" | "paused" | "completed"  // フィルタ（省略時は全件）
  type?: "cash_game" | "tournament"           // フィルタ
  cursor?: string                              // ページネーションカーソル
  limit?: number                               // デフォルト20
}
```
**Output**:
```typescript
{
  items: {
    id: string
    type: "cash_game" | "tournament"
    status: "active" | "paused" | "completed"
    store: { id: string, name: string } | null
    ringGame: { id: string, name: string } | null
    tournament: { id: string, name: string } | null
    currency: { id: string, name: string, unit: string } | null
    startedAt: Date
    endedAt: Date | null
    memo: string | null
    latestStackAmount: number | null    // 最新スタック（イベント集約）
    eventCount: number                   // イベント数
  }[]
  nextCursor: string | null
}
```

### liveSession.getById

**Type**: query (protected)
**Input**: `{ id: string }`
**Output**:
```typescript
{
  id: string
  type: "cash_game" | "tournament"
  status: "active" | "paused" | "completed"
  store: { id: string, name: string } | null
  ringGame: { ... } | null
  tournament: { ... } | null
  currency: { ... } | null
  startedAt: Date
  endedAt: Date | null
  memo: string | null
  pokerSessionId: string | null         // 完了済みの場合
  events: SessionEvent[]                 // 全イベント（時系列順）
  tablePlayers: SessionTablePlayer[]     // 同卓プレイヤー
  summary: {                             // イベント集約サマリー
    totalBuyIn: number
    cashOut: number | null
    profitLoss: number | null
    evCashOut: number | null
    rebuyCount: number
    addonCount: number
    maxStack: number | null
    minStack: number | null
    currentStack: number | null
  }
}
```

### liveSession.create

**Type**: mutation (protected)
**Input**:
```typescript
{
  type: "cash_game" | "tournament"
  storeId?: string
  ringGameId?: string          // type=cash_gameの場合
  tournamentId?: string        // type=tournamentの場合
  currencyId?: string
  memo?: string
}
```
**Output**: `{ id: string }`

### liveSession.update

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

### liveSession.pause

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Side effects**: session_pauseイベントを自動記録

### liveSession.resume

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Side effects**: session_resumeイベントを自動記録

### liveSession.complete

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  // キャッシュゲーム
  cashOut?: number
  // トーナメント
  placement?: number
  totalEntries?: number
  prizeMoney?: number
  bountyPrizes?: number
}
```
**Output**: `{ id: string, pokerSessionId: string }`
**Side effects**:
- cash_outまたはtournament_resultイベントを自動記録
- pokerSessionレコードを作成（イベント集約からP&L計算）
- 通貨トランザクションを自動作成（currencyId設定時）

### liveSession.discard

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**: status !== "completed"
**Side effects**: LiveSession + 全イベント + 全SessionTablePlayerを削除

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | セッションが存在しないまたは他ユーザーのセッション |
| BAD_REQUEST | 無効な状態遷移（例: completed → pause） |
| BAD_REQUEST | キャッシュゲームなのにtournamentIdを指定 |
| BAD_REQUEST | 完了済みセッションの破棄 |
