# Quickstart: セッション一覧のBB/BI単位表示

**Feature**: 008-session-bb-bi-display
**Date**: 2026-04-10

## 概要

セッション一覧画面にBB/BI表示トグルを追加し、Cash GameはP&LをBB単位（profitLoss / blind2）、TourneyはP&LをBI単位（profitLoss / totalCost）で表示する機能。

## 前提条件

- Bun がインストール済み
- `bun install` で依存関係がインストール済み
- dev サーバーが起動可能（`bun run dev`）

## 開発の進め方

### 1. API変更（Backend）

**ファイル**: `packages/api/src/routers/session.ts`

session.list の SELECT に `ringGameBlind2: ringGame.blind2` を追加するのみ。

```bash
# テスト実行
bun run test -- packages/api
```

### 2. フロントエンド型更新

**ファイル**: 
- `apps/web/src/sessions/hooks/use-sessions.ts` — `SessionItem` に `ringGameBlind2` 追加
- `apps/web/src/sessions/components/session-card.tsx` — `SessionCardProps` に `ringGameBlind2` 追加

### 3. BB/BI変換ユーティリティ

**ファイル**: `apps/web/src/sessions/components/session-card.tsx` 内、または新規ユーティリティ

BB/BI変換のヘルパー関数を実装：
- `toBB(value, blind2)` — value / blind2、blind2がnullや0の場合はnull返却
- `toBI(profitLoss, session)` — profitLoss / totalCost、totalCostが0の場合はnull返却
- `formatBBBI(value, unit)` — `+25.3 BB` 形式のフォーマット

### 4. トグルUI

**ファイル**: `apps/web/src/routes/sessions/index.tsx`

- `useState<boolean>(false)` で `bbBiMode` を管理
- `PageHeader` の `actions` にshadcn/ui `Switch` を追加
- `SessionCard` に `bbBiMode` prop を渡す

### 5. SessionCard の表示切替

**ファイル**: `apps/web/src/sessions/components/session-card.tsx`

- `SessionHeader`: bbBiMode時にP&LをBB/BI単位で表示
- `CashGameDetails`: bbBiMode時にBuy-in, Cash-out, EV Cash-outをBB単位で表示
- `TournamentDetails`: 変更なし（詳細部はチップ値のまま）

### 6. テスト

```bash
# 全テスト実行
bun run test

# Session関連テストのみ
bun run test -- session

# 型チェック
bun run check-types

# リント
bun run check
```

## 変更範囲

| レイヤー | ファイル | 変更内容 |
|---------|---------|---------|
| API | `packages/api/src/routers/session.ts` | SELECT に blind2 追加 |
| API Test | `packages/api/src/__tests__/session.test.ts` | blind2 が返却されることを検証 |
| Hook | `apps/web/src/sessions/hooks/use-sessions.ts` | SessionItem型に ringGameBlind2 追加 |
| Component | `apps/web/src/sessions/components/session-card.tsx` | BB/BI表示ロジック追加 |
| Route | `apps/web/src/routes/sessions/index.tsx` | トグルUI追加、bbBiMode state管理 |
| Test | `apps/web/src/sessions/components/__tests__/session-card.test.tsx` | BB/BI表示テスト追加 |

## 注意事項

- DBマイグレーション不要
- 新規パッケージ依存なし（shadcn/ui の Switch が既存かどうか要確認、なければ追加）
- サマリー統計のBB/BI変換は本スコープ外
