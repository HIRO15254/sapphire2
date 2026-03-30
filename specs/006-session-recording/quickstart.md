# Quickstart: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30

## 実装の前提知識

### プロジェクト構造

```
packages/db/src/schema/     # Drizzleスキーマ定義
packages/api/src/routers/   # tRPCルーター
apps/web/src/routes/        # TanStack Routerファイルベースルーティング
apps/web/src/components/    # Reactコンポーネント
```

### 新規ファイル（作成順序）

1. `packages/db/src/schema/live-cash-game-session.ts` - liveCashGameSessionスキーマ
2. `packages/db/src/schema/live-tournament-session.ts` - liveTournamentSessionスキーマ
3. `packages/db/src/schema/session-event.ts` - sessionEventスキーマ（共有）
4. `packages/db/src/schema/session-table-player.ts` - sessionTablePlayerスキーマ（共有）
5. `packages/db/src/schema.ts` - エクスポート追加
6. `packages/db/src/__tests__/live-cash-game-session.test.ts` - スキーマテスト
7. `packages/db/src/__tests__/live-tournament-session.test.ts` - スキーマテスト
8. `packages/api/src/routers/live-cash-game-session.ts` - キャッシュゲームルーター
9. `packages/api/src/routers/live-tournament-session.ts` - トーナメントルーター
10. `packages/api/src/routers/session-event.ts` - SessionEventルーター
11. `packages/api/src/routers/session-table-player.ts` - SessionTablePlayerルーター
12. `packages/api/src/routers/index.ts` - ルーター登録
13. `apps/web/src/routes/live-sessions/index.tsx` - セッション一覧ページ
14. `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx` - キャッシュゲーム詳細
15. `apps/web/src/routes/live-sessions/tournament/$sessionId.tsx` - トーナメント詳細
16. `apps/web/src/components/live-sessions/` - 共通UIコンポーネント
17. `apps/web/src/components/live-cash-game/` - キャッシュゲーム専用コンポーネント
18. `apps/web/src/components/live-tournament/` - トーナメント専用コンポーネント

### 既存ファイル（変更）

1. `packages/db/src/schema/session.ts` - pokerSessionにliveCashGameSessionId, liveTournamentSessionIdカラム追加
2. `packages/api/src/routers/session.ts` - pokerSession作成ロジックにliveSessionId対応追加
3. `apps/web/src/routes/sessions/index.tsx` - セッション一覧にイベント履歴リンク追加
4. `apps/web/src/components/sessions/session-card.tsx` - イベント履歴リンク表示

## キーパターン

### スキーマ定義パターン

```typescript
// packages/db/src/schema/live-session.ts
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const liveSession = sqliteTable("live_session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  // ...
}, (table) => [
  index("liveSession_userId_idx").on(table.userId),
]);
```

### ルーター定義パターン

```typescript
// packages/api/src/routers/live-session.ts
import { protectedProcedure, router } from "../index";
import { z } from "zod";

export const liveSessionRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.enum(["active", "completed"]).optional() }))
    .query(async ({ ctx, input }) => {
      // ctx.session.user.id でユーザースコープ
      // ctx.db で Drizzle DB アクセス
    }),
});
```

### フロントエンドページパターン

```typescript
// apps/web/src/routes/live-sessions/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/live-sessions/")({
  component: LiveSessionsPage,
});

function LiveSessionsPage() {
  const { data } = useQuery(trpc.liveSession.list.queryOptions({}));
  const createMutation = useMutation(trpcClient.liveSession.create.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.liveSession.list.queryKey() }),
  }));
}
```

## UXデザイン制約

### セッション状態
- `active` / `completed` の2状態のみ（`paused` は廃止）
- 同時にactiveにできるセッションは1つのみ
- 完了済みセッションは `reopen` で再始動可能

### セッション開始時
- 初回バイイン額は必須入力（`initialBuyIn`）
- ゲーム選択時に `maxBuyIn` を自動入力、`currencyId` を自動紐づけ
- 2回目以降のチップ追加はスタック記録の `addon` として記録

### オールイン記録形式
```typescript
{ potSize: number, trials: number, equity: number, wins: number }
// potSize: ポット合計額
// trials: 試行回数（Run it multi times、通常1）
// equity: 勝率（%、0-100）
// wins: 実際の勝利数（小数許容、chop対応）
// EV計算: evAmount = potSize × (equity / 100) × trials
// 実際: actualAmount = potSize × wins
```

### UIパターン
- オールイン・アドオン入力: ボトムシート（Drawer）で入力、追加済みはバッジ表示、タップで編集・削除
- ライブセッション中の全画面は1画面完結（スクロールなし）
- ボトムナビ: セッション進行中は中央強調ボタン→セッション画面、それ以外は新規開始/再始動

## マイグレーション

```bash
# スキーマ変更後
bun run --cwd packages/db generate   # SQLマイグレーション生成
bun run --cwd packages/db migrate    # マイグレーション実行
```

## テスト実行

```bash
bun test                              # 全テスト
bun test --filter db                  # DBパッケージのみ
bun test --filter api                 # APIパッケージのみ
```

## 型チェック・lint

```bash
bun run check-types                   # TypeScript型チェック
bun x ultracite check                 # lint/format チェック
bun x ultracite fix                   # 自動修正
```
