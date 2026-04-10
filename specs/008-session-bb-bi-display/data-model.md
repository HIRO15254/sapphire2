# Data Model: セッション一覧のBB/BI単位表示

**Feature**: 008-session-bb-bi-display
**Date**: 2026-04-10

## Schema Changes

### なし（DBスキーマ変更不要）

本機能はDBスキーマの変更を必要としない。すべてのデータは既存のテーブル・カラムから取得可能。

## API Response Changes

### session.list レスポンス拡張

既存の `session.list` レスポンスの各アイテムに以下のフィールドを追加する:

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `ringGameBlind2` | `number \| null` | `ringGame.blind2` | リングゲームのBB値。Cash Gameでring_gameが紐付いている場合のみ値あり |

**変更箇所**: `packages/api/src/routers/session.ts` の `list` プロシージャ内SELECTクエリ

```typescript
// 追加するフィールド（既存のringGameName: ringGame.nameの直後）
ringGameBlind2: ringGame.blind2,
```

## Frontend Type Changes

### SessionItem インターフェース拡張

`apps/web/src/sessions/hooks/use-sessions.ts`:

```typescript
export interface SessionItem {
  // ... 既存フィールド ...
  ringGameBlind2: number | null;  // 追加
}
```

### SessionCardProps.session 型拡張

`apps/web/src/sessions/components/session-card.tsx`:

```typescript
session: {
  // ... 既存フィールド ...
  ringGameBlind2: number | null;  // 追加
}
```

## Computed Values（フロントエンド計算）

以下の値はフロントエンドでリアルタイムに計算される（DBやAPI側の変更不要）:

### Cash Game BB変換

```
bbProfitLoss = profitLoss / ringGameBlind2
bbEvProfitLoss = evProfitLoss / ringGameBlind2
bbBuyIn = buyIn / ringGameBlind2
bbCashOut = cashOut / ringGameBlind2
bbEvCashOut = evCashOut / ringGameBlind2
```

**条件**: `ringGameBlind2` が non-null かつ > 0

### Tournament BI変換

```
totalCost = (tournamentBuyIn ?? 0) + (entryFee ?? 0) + ((rebuyCount ?? 0) * (rebuyCost ?? 0)) + (addonCost ?? 0)
biProfitLoss = profitLoss / totalCost
```

**条件**: `totalCost` が > 0

## Entity Relationships（変更なし）

```
pokerSession ──> ringGame (既存: many-to-one, optional)
                    └── blind2 (integer, nullable) ← BBとして使用
pokerSession ──> tournament (既存: many-to-one, optional)
                    ※ tournament自体のbuyIn/entryFeeではなく、session固有のtournamentBuyIn等を使用
```
