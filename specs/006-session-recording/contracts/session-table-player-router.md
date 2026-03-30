# tRPC Router Contract: sessionTablePlayer

**Package**: `@sapphire2/api`
**Router**: `sessionTablePlayerRouter`

## Procedures

### sessionTablePlayer.list

**Type**: query (protected)
**Input**:
```typescript
{
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  activeOnly?: boolean     // デフォルトfalse
}
```
**Validation**: セッションIDはいずれか一方のみ指定
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
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  playerId: string
}
```
**Validation**: セッションIDはいずれか一方のみ指定
**Output**: `{ id: string }`
**Side effects**:
- SessionTablePlayerレコードを作成（isActive=true）
- player_joinイベントを自動記録

### sessionTablePlayer.addNew

**Type**: mutation (protected)
**Input**:
```typescript
{
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  playerName: string
  playerMemo?: string
}
```
**Validation**: セッションIDはいずれか一方のみ指定
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
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  playerId: string
}
```
**Validation**: セッションIDはいずれか一方のみ指定
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
| BAD_REQUEST | セッションIDの指定が不正 |
