# tRPC Router Contract: liveCashGameSession

**Package**: `@sapphire2/api`
**Router**: `liveCashGameSessionRouter`

## Procedures

### liveCashGameSession.list

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
  status: "active" | "completed"
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
  initialBuyIn: number                          // required, min 0
}
```
**Output**: `{ id: string }`
**Validation**:
- No other active session exists for the user (checked across both `liveCashGameSession` and `liveTournamentSession` tables); throws `BAD_REQUEST` if one does
**Side effects**:
- `session_start` イベントを自動記録 (payload: `{}`)
- `chip_add` イベントを自動記録 (payload: `{ amount: initialBuyIn }`)

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

### liveCashGameSession.complete

**Type**: mutation (protected)
**Input**:
```typescript
{
  id: string
  finalStack: number
}
```
**Output**: `{ id: string, pokerSessionId: string }`
**Side effects**:
- `stack_record` イベントを自動記録 (payload: `{ stackAmount: finalStack, allIns: [] }`)
- `session_end` イベントを自動記録 (payload: `{}`)
- pokerSessionレコードを作成または更新（イベント集約からP&L計算）
  - totalBuyIn = Σ chip_add.amount
  - cashOut = last stack_record.stackAmount
- 通貨トランザクションを自動作成または更新（currencyId設定時）

### liveCashGameSession.reopen

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**:
- `status === "completed"`
- No other active session exists for the user (checked across both `liveCashGameSession` and `liveTournamentSession` tables)
**Side effects**:
- `status` を `"active"` に変更、`endedAt` をクリア
- 新しい `session_start` イベントを末尾に追加（既存イベントは保持）
- リンクされた `pokerSession` と `currencyTransaction` を削除（次回 `complete` 時に再作成）

### liveCashGameSession.discard

**Type**: mutation (protected)
**Input**: `{ id: string }`
**Output**: `{ id: string }`
**Validation**: `status === "active"`
**Side effects**: セッション + 全イベント + 全SessionTablePlayerをカスケード削除

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | セッションが存在しないまたは他ユーザーのセッション |
| BAD_REQUEST | 無効な状態遷移 |
| BAD_REQUEST | アクティブでないセッションの破棄 |
| BAD_REQUEST | create/reopen時に他のアクティブセッションが存在する（キャッシュゲーム・トーナメント両テーブルをチェック） |
