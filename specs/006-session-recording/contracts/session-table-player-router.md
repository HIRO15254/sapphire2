# tRPC Router Contract: sessionTablePlayer

**Package**: `@sapphire2/api`
**Router**: `sessionTablePlayerRouter`

## Procedures

### sessionTablePlayer.list

**Type**: query (protected)
**Input**:
```typescript
{
  liveSessionId: string
  activeOnly?: boolean     // デフォルトfalse
}
```
**Output**:
```typescript
{
  items: {
    id: string
    player: { id: string, name: string, memo: string | null }
    isActive: boolean
    joinedAt: Date
    leftAt: Date | null
  }[]
}
```

### sessionTablePlayer.add

**Type**: mutation (protected)
**Input**:
```typescript
{
  liveSessionId: string
  playerId: string
}
```
**Output**: `{ id: string }`
**Side effects**:
- SessionTablePlayerレコードを作成（isActive=true）
- player_joinイベントを自動記録

### sessionTablePlayer.addNew

**Type**: mutation (protected)
**Input**:
```typescript
{
  liveSessionId: string
  playerName: string
  playerMemo?: string
}
```
**Output**: `{ id: string, playerId: string }`
**Side effects**:
- 新規playerレコードを作成
- SessionTablePlayerレコードを作成（isActive=true）
- player_joinイベントを自動記録

### sessionTablePlayer.remove

**Type**: mutation (protected)
**Input**:
```typescript
{
  liveSessionId: string
  playerId: string
}
```
**Output**: `{ id: string }`
**Side effects**:
- SessionTablePlayerのisActive=false, leftAt=now
- player_leaveイベントを自動記録

## Error Codes

| Code | Condition |
|------|-----------|
| NOT_FOUND | セッションまたはプレイヤーが存在しない |
| BAD_REQUEST | 既にアクティブなプレイヤーを再追加 |
| BAD_REQUEST | アクティブでないプレイヤーを退席させる |
