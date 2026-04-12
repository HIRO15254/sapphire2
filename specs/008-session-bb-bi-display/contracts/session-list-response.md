# Contract: session.list レスポンス拡張

**Feature**: 008-session-bb-bi-display
**Type**: tRPC Query Response

## 変更概要

`session.list` プロシージャのレスポンスにおいて、各アイテムに `ringGameBlind2` フィールドを追加する。

## レスポンス形式

### 現在の session.list アイテム（抜粋）

```typescript
{
  id: string;
  type: string;
  profitLoss: number | null;
  evProfitLoss: number | null;
  evDiff: number | null;
  ringGameId: string | null;
  ringGameName: string | null;
  // ... other fields ...
}
```

### 変更後の session.list アイテム（差分のみ）

```typescript
{
  // ... 既存フィールドはすべて維持 ...
  ringGameBlind2: number | null;  // 追加: ringGame.blind2 from LEFT JOIN
}
```

## フィールド仕様

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `ringGameBlind2` | `integer` | Yes | セッションに紐付くリングゲームのBB（Big Blind）額。ringGameId が null、またはリングゲームの blind2 が未設定の場合は null |

## 入力パラメータ

変更なし。既存の `session.list` 入力スキーマはそのまま。

```typescript
z.object({
  cursor: z.string().optional(),
  type: z.enum(["cash_game", "tournament"]).optional(),
  storeId: z.string().optional(),
  currencyId: z.string().optional(),
  dateFrom: z.number().optional(),
  dateTo: z.number().optional(),
})
```

## Summary レスポンス

変更なし。BB/BI変換はサマリーには適用しない。
