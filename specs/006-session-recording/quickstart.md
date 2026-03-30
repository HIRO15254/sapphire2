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

1. `packages/db/src/schema/live-session.ts` - LiveSession, SessionEvent, SessionTablePlayerスキーマ
2. `packages/db/src/schema.ts` - エクスポート追加
3. `packages/db/src/__tests__/live-session.test.ts` - スキーマテスト
4. `packages/api/src/routers/live-session.ts` - LiveSessionルーター
5. `packages/api/src/routers/session-event.ts` - SessionEventルーター
6. `packages/api/src/routers/session-table-player.ts` - SessionTablePlayerルーター
7. `packages/api/src/routers/index.ts` - ルーター登録
8. `packages/api/src/__tests__/live-session.test.ts` - ルーターテスト
9. `apps/web/src/routes/live-sessions/index.tsx` - セッション一覧ページ
10. `apps/web/src/routes/live-sessions/$liveSessionId.tsx` - セッション詳細ページ
11. `apps/web/src/components/live-sessions/` - UIコンポーネント群

### 既存ファイル（変更）

1. `packages/db/src/schema/session.ts` - pokerSessionにliveSessionIdカラム追加
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
    .input(z.object({ status: z.enum(["active", "paused", "completed"]).optional() }))
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
