# Data Fetching — tRPC + TanStack Query

UI リライト前の現状記録。`apps/web` におけるサーバーデータの取得・キャッシュ・楽観的更新の構成を、実装ファイルを根拠にしてまとめる。

## 何を解決しているか

`apps/web` のデータ層は、以下のような問題をひとまとめに解決するために組まれている。

- **クライアントとサーバの型共有**。バックエンドは `packages/api/src/routers/index.ts` で `appRouter` を組み立て、その `typeof` を `AppRouter` として export している。フロント側は `apps/web/src/utils/trpc.ts` でこの `AppRouter` を import して `createTRPCClient<AppRouter>` と `createTRPCOptionsProxy<AppRouter>` に渡す。これにより、`trpc.currency.list.queryOptions()` のような呼び出しが server 側の procedure と完全に型同期する。サーバ側の Zod 入力スキーマもそのまま `mutate` / `query` の引数型として現れる。

- **キャッシュ管理と再取得のタイミング**。`@tanstack/react-query` の `QueryClient` がすべての query を一元的に保持し、ミューテーション後に `invalidateQueries` を投げることで影響範囲だけを再取得する。`apps/web/src/main.tsx` で `PersistQueryClientProvider` に `idb-keyval` ベースの persister を渡しているので、キャッシュは IndexedDB に永続化され、リロード後やオフライン復帰時にも UI が即時表示される（`gcTime: 24h`、`networkMode: "offlineFirst"`）。

- **楽観的 UI（Optimistic UI）**。Currency 作成 / Player 編集 / セッションイベント追加など、ユーザー操作の即時フィードバックが重要な箇所では、サーバレスポンスを待たずに query キャッシュを書き換える。これを **共通ヘルパー** で行うのが本リポジトリのルール。

- **失敗時のロールバック**。楽観的更新の前にキャッシュをスナップショットしておき、`onError` でそれを書き戻す。これによりサーバ側で失敗したときに UI が「サーバの真の状態」へ自然に戻る。

- **エラートースト**。`QueryCache` と `MutationCache` の `onError` で `toast.error(error.message)` を共通発火させているため、各 hook 側でトーストを書く必要がない。retry リンク（query 限定）もここに同居している。

## 中心となる部品

実装ファイルとその責務を以下に列挙する。

### `apps/web/src/utils/trpc.ts`

- **`queryClient`** — アプリ全体で 1 つだけ存在する `QueryClient`。
  - `defaultOptions.queries`: `staleTime: 0`（毎回 stale 扱い）、`gcTime: 24h`、`networkMode: "offlineFirst"`。
  - `defaultOptions.mutations`: `networkMode: "offlineFirst"`。
  - `queryCache.onError` / `mutationCache.onError` で `toast.error(error.message)` を一括発火。query の方は `action: { label: "retry", onClick: query.invalidate }` を持つ。
- **`persister`** — `createAsyncStoragePersister` を `idb-keyval` の `get` / `set` / `del` に接続し、`"sapphire2-query-cache"` キーで IndexedDB に保存。
- **`trpcClient`** — `createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: \`${VITE_SERVER_URL}/trpc\`, fetch: credentials: "include" })] })`。命令的に procedure を叩く用途（`mutate` / `query`）。
- **`trpc`** — `createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient })`。React Query の hook に渡す `queryOptions()` / `mutationOptions()` を生成するためのプロキシ。

### `apps/web/src/main.tsx`

`PersistQueryClientProvider` でアプリ全体をラップ。`maxAge: 24h` を渡す。`createRouter` の `context` に `{ trpc, queryClient }` を渡しており、TanStack Router 側からも参照可能。

### `apps/web/src/utils/optimistic-update.ts`

楽観的更新の共通ヘルパー。**直接 `queryClient.setQueryData` + `invalidateQueries` を並べることは `.claude/rules/web-data-fetching.md` で禁じられており、必ずここを通す**。

エクスポートされる API：

- **型**
  - `OptimisticTarget` — `{ queryKey: QueryKey } | { filters: Pick<QueryFilters, "queryKey"> }`。単一キー指定とフィルタ指定の両方を受け付ける discriminated union。
  - `QuerySnapshot<TData>` — `{ data, kind: "query", queryKey }`。単一 query の rollback 用スナップショット。
  - `QueriesSnapshot<TData>` — `{ entries: [QueryKey, TData | undefined][], kind: "queries" }`。フィルタにマッチする複数 query の rollback 用。
  - `OptimisticSnapshot` — 上記 2 つの union。
- **関数**
  - `cancelTargets(queryClient, targets)` — `Promise.all` で各 target に対し `queryClient.cancelQueries` を実行。`onMutate` の冒頭で呼び、in-flight な refetch が楽観値を上書きしてしまうのを防ぐ。
  - `snapshotQuery(queryClient, queryKey)` — `getQueryData<TData>(queryKey)` を `{ data, kind: "query", queryKey }` に包んで返す。**rollback の起点**。
  - `snapshotQueries(queryClient, filters)` — `getQueriesData<TData>(filters)` を `{ entries, kind: "queries" }` に包んで返す。`["session", "list", *]` のようにキー前方一致で複数 query をまとめてスナップショットしたいときに使う。
  - `restoreSnapshots(queryClient, snapshots)` — `null` / `undefined` を含む配列を受け取り、`kind` に応じて `setQueryData` を呼ぶ。`onError` で `context?.previous` をそのまま投げ込める設計。
  - `invalidateTargets(queryClient, targets)` — `Promise.all` で `invalidateQueries` を実行。`onSettled` から呼んで、楽観値とサーバ正本を最終的に整合させる。

`getFilters` は private な変換器で、`OptimisticTarget` を `{ queryKey }` 形に正規化している。

### feature 別の `hooks/use-*.ts`

各 feature の `apps/web/src/features/<feature>/hooks/use-*.ts` が、tRPC を直接触る唯一のレイヤー。コンポーネント側（`*.tsx`）は **React / React Query / TanStack Form の hook を直接呼んではいけない**（`.claude/rules/web-hooks-separation.md`）。例：

- `apps/web/src/features/currencies/hooks/use-currencies.ts` — list / create / update / delete + transactions の load-more。
- `apps/web/src/features/players/hooks/use-players.ts` — tag filter 付き list と CRUD。
- `apps/web/src/features/players/hooks/use-player-detail.ts`, `use-player-tags.ts`, `use-table-players.ts` ほか。
- `apps/web/src/features/live-sessions/utils/optimistic-session-event.ts` — セッションイベント追加系ミューテーションの共通ファクトリ（後述）。

返り値の慣行は `{ data…, is*Pending, on*Handler, … }`。`mutate` 系は `mutateAsync` を `create` / `update` / `delete` のようなドメイン動詞でラップして公開する。コンポーネント側は `await create(values)` / `update(values)` のような呼び方で済み、`trpcClient` も `queryClient` も触らない。

### `packages/api` 側の procedure ファクトリ

データ層の入口は `packages/api/src/index.ts` の `protectedProcedure`。`ctx.session` が無ければ `TRPCError({ code: "UNAUTHORIZED" })` を投げる薄いミドルウェアで、すべての private procedure はこれを起点に生やす。`apps/web` のフェッチが 401 風エラーを受けるとき、その源はだいたいここ。

`packages/api/src/routers/index.ts` の `appRouter` 配下に 20 弱のサブルーター（`currency`, `player`, `liveSession`, `sessionEvent`, `tournament`, ...）がぶら下がっており、フロントの `trpc.<namespace>.<procedure>.queryOptions()` / `.mutate()` のキー第 1 段はこの `namespace` と一致する。query key 設計を覚えるときは「namespace は router のキー、procedure はそのルーター内のキー」と読み替えればよい。

## 典型フロー

「Currency を新規作成 → 一覧に即座に表示 → サーバが失敗したらロールバック」を `use-currencies.ts` から抜粋する。

```ts
const createMutation = useMutation({
  mutationFn: (values: CurrencyValues) =>
    trpcClient.currency.create.mutate(values),
  onMutate: async (newCurrency) => {
    await cancelTargets(queryClient, [{ queryKey: currencyListKey }]);
    const previous = snapshotQuery(queryClient, currencyListKey);
    queryClient.setQueryData(currencyListKey, (old) => {
      if (!old) {
        return old;
      }
      const base = old[0];
      return [
        ...old,
        {
          ...base,
          id: `temp-${Date.now()}`,
          name: newCurrency.name,
          unit: newCurrency.unit ?? null,
          balance: 0,
        },
      ];
    });
    return { previous };
  },
  onError: (_err, _vars, context) => {
    restoreSnapshots(queryClient, [context?.previous]);
  },
  onSettled: () => {
    invalidateTargets(queryClient, [{ queryKey: currencyListKey }]);
  },
});
```

それぞれの callback の役割：

- **`onMutate(newCurrency)`** — ユーザー操作直後、ネットワーク発火と並行して呼ばれる。
  - `cancelTargets` で当該 query の in-flight refetch を停止する（停止しないと、refetch のレスポンスが楽観書き込みを上書きする恐れがある）。
  - `snapshotQuery` で現在のキャッシュを **rollback 用に保存**し、`context` として返す。React Query はこの戻り値を以後の callback に第 3 引数で渡す。
  - `setQueryData` で「サーバが受理したらこうなるはず」というレコードを追加する。ID は `temp-<timestamp>` で衝突回避。`balance: 0` のように欠落フィールドは妥当な既定値で埋める。
- **`onError(err, vars, context)`** — `mutationFn` が reject されたときに呼ばれる。`restoreSnapshots(queryClient, [context?.previous])` を呼ぶだけで、`snapshotQuery` が記録した `kind: "query"` を見て `setQueryData` で書き戻してくれる。`null` 安全に書けるのがヘルパーの利点。トースト発火は `mutationCache.onError` に集約されているため、ここでは扱わない。
- **`onSettled()`** — 成功・失敗どちらでも最後に呼ばれる。`invalidateTargets` で当該 query を invalidate し、サーバの真値で再取得する。これにより、`temp-<timestamp>` の楽観行が server から返ってきた本物の row で置き換わる。

`use-players.ts` の `createMutation` も完全に同じ 4 段（`cancelTargets` → `snapshotQuery` → `setQueryData` → `return { previous }`）を踏み、`onError` / `onSettled` も同型。**この 4 段はリポジトリ内のテンプレート**として徹底されている。

より複雑なケース、たとえば session イベント追加のように **「session 詳細 / イベント一覧 / 入力違いで分散している複数のリスト」を同時に楽観更新する** ケースは `optimistic-session-event.ts` の `createSessionEventMutationOptions` がまとめている。`onMutate` 内で `cancelTargets` に 4 つのキー（`sessionKey` / `eventsKey` / `activeListKey` / `pausedListKey`）を一度に渡し、`snapshotQuery` を 2 件と `snapshotQueries` を 1 件取り、`buildOptimisticSessionSummary` でサマリを再計算しつつ `optimisticListStatusUpdate` でリスト間のセッション移動も予測反映する。返す context は `{ previousSession, previousEvents, previousLists }` の 3 件構造で、`onError` ではこれを配列にして `restoreSnapshots` に渡すだけで一括 rollback できる。**ヘルパーが `OptimisticSnapshot` union を提供しているおかげで、context の中身を `kind` で識別する必要がない** のがポイント。

呼び出し側（`use-cash-game-session.ts` などの hook）はこの factory を `useMutation(createSessionEventMutationOptions({ ... }))` のように呼ぶだけで、4 段の流れを意識せずに楽観更新付き mutation を組み立てられる。**「ヘルパーで足りないケースは factory を作る、factory でも足りなければヘルパーを足す」** の連鎖でロジックの再発明を抑える設計。

## 決定と理由

### なぜ tRPC を採用したか

`packages/api` 側で構築した `AppRouter` を `apps/web/src/utils/trpc.ts` がそのまま `import type` する構成にすることで、サーバ procedure と client 呼び出しの型ずれが起こり得ない構造を作っている。`packages/api/src/index.ts` で `protectedProcedure` を中央定義し、`packages/api/src/routers/*.ts` の各ルーターがそこから派生する。フロントが知るべきはこの `AppRouter` の型ひとつだけで、route の追加・procedure の改名は `bun run check-types` で機械的に検知される。

### なぜ optimistic update を共通ヘルパーに切り出したか

各 feature が個別に `queryClient.cancelQueries` → `queryClient.getQueryData` → `queryClient.setQueryData` → `queryClient.invalidateQueries` を手書きすると、

- snapshot 取り忘れ（rollback できない）
- cancel 忘れ（refetch が楽観値を上書きする）
- 単一 query と複数 query で書き方が分岐する

の典型ミスが個別に発生する。Coverage sweep の整備とともに `optimistic-update.ts` を導入し、`.claude/rules/web-data-fetching.md` で「**直接 `queryClient.setQueryData` + `invalidateQueries` 連鎖を書かない。ヘルパーで足りないケースはヘルパーを拡張する**」をルール化している。

`snapshotQuery` と `snapshotQueries` を分けてあるのは、`["session", "list", *]` のように **入力違いで分散した複数キャッシュをまとめて rollback したい** ケースを安全に扱うため。`optimistic-session-event.ts` の `previousLists: snapshotQueries(queryClient, { queryKey: allListsKey })` がその実例。

### cache invalidation の粒度

`invalidateTargets` に渡すターゲットは、**そのミューテーションが影響する query だけ** をピンポイントで指定する。粒度の選択基準：

- 単一 procedure・単一入力 → `{ queryKey: trpc.currency.list.queryOptions().queryKey }` のように完全一致のキー。`use-currencies.ts` の各 mutation がこのパターン。
- 入力違いで分散している同一 procedure → `{ filters: { queryKey: allListsKey } }`（フィルタ指定）で前方一致にマッチさせる。`optimistic-session-event.ts` の `onSettled` がこのパターン。
- 複数 procedure を巻き込む（transaction を追加すると残高 list も動く） → ターゲットを配列で複数渡す。`use-currencies.ts` の `addTransactionMutation.onSettled` は `currencyListKey` と `transactionsQueryOptions.queryKey` の 2 件を invalidate。

### `invalidateQueries` と `setQueryData` の使い分け

- **`setQueryData`** — 「次にサーバから返ってくるはずの値」を確実に予測できるケースで、`onMutate` 内の楽観書き込みに使う。サーバを叩かずローカルキャッシュを書き換えるだけなので即時反映。一方、サーバ生成 ID やサーバ算出フィールド（残高合計、`updatedAt` など）は推測値しか入らないので必ず `onSettled` で `invalidate` してサーバ正本に置き換える。
- **`invalidateQueries`**（＝ `invalidateTargets`） — 「結局サーバに聞き直す」操作。`onSettled` のデフォルト戦略であり、`setQueryData` を行ったかどうかに関わらず最後に必ず呼んで整合性を取る。楽観更新を行わないシンプルな mutation（例：`addTransactionMutation` は `onMutate` を持たず `onSettled` の invalidate のみ）でも同様に動作する。

### 楽観更新は「リスト操作のみ」「フォーム由来」に限る

`use-currencies.ts` の `addTransactionMutation` / `editTransactionMutation` が `onMutate` を持たないように、**集計値（残高、`evDiff` など）が絡む変更は楽観しない**設計になっている箇所がある。一方、`optimistic-session-event.ts` の `buildOptimisticSessionSummary` は session summary を頑張って楽観計算する。これは「即時 UI 反映が UX 上クリティカルなライブセッション系」と「そうでない通常 CRUD」を区別した判断。

## 落とし穴

実コードを読みながら把握された注意点：

- **`previousData` の snapshot を取り忘れるとロールバックできない**。`onMutate` の頭で必ず `snapshotQuery` / `snapshotQueries` を呼んで `context` で返す。`onError` 側は `restoreSnapshots(queryClient, [context?.previous])` を呼ぶだけだが、`context` が空だと何も戻らない。`use-currencies.ts` の `deleteTransactionMutation` のように React state 側で `previous = allTransactions` をそのまま保持して rollback するケースもあるが、その場合も「rollback 源を必ず保存する」原則は変わらない。

- **`cancelTargets` を `onMutate` の頭で呼び忘れると、in-flight な refetch が楽観値を上書きする**。React Query は `queryClient.cancelQueries` で進行中の query を `cancelled` 状態にし、その結果の `setQueryData` を抑止する。これを飛ばすと「楽観反映 → refetch が古い値で勝つ → UI がチラつく」現象になる。

- **`invalidateQueries` のフィルタが緩いと他画面まで refetch が走る**。例えば `{ filters: { queryKey: ["session"] } }` を渡すと `session.*` 配下のすべてが invalidate される。`optimistic-session-event.ts` が `allListsKey` を `trpc.session.list.queryOptions({}).queryKey` から取って渡しているのは、意図して `session.list` 配下全ての input variant を巻き込みたいから。CRUD レベルでは `trpc.currency.list.queryOptions().queryKey` のように完全一致キーを使う方が安全。

- **tRPC proxy の型推論を壊さないため Vite 設定に注意**。`zod` は `import z from "zod"`（default import）で揃える必要がある（namespace import が Vite バンドラの問題で壊れる）。これは `.claude/rules/web-forms.md` および CLAUDE.md にも明記されている。tRPC 経由で procedure の入力 Zod スキーマがフロントの型として現れるため、ここが崩れると `trpc.currency.create.mutate(values)` の引数型が `unknown` に退化する。

- **`setQueryData` の updater で `old` が `undefined` のケースを忘れない**。`use-currencies.ts` の `onMutate` は `if (!old) return old;` で早期 return している。初回マウント前など、まだ list が fetch されていない状況で楽観挿入だけ走ると、`undefined` に対する `[...undefined, …]` で実行時例外になる。`old?.filter(...)` / `old?.map(...)` のように optional chaining を必ず付ける。

- **`temp-<timestamp>` 行を使う場合、`onSettled` の invalidate で必ず正規の row に置き換える**。invalidate を忘れると、楽観挿入された `temp-...` 行が永遠に残る。逆に `temp-` をキーに参照する別 UI（例：ID を URL に積む）がそのタイミングで動くと、サーバ ID と不整合になる。挿入直後に navigate する設計には不向き。

- **`PersistQueryClientProvider` のキャッシュは IndexedDB に長期保存される**。`maxAge: 24h` を `main.tsx` で渡しているが、不整合キャッシュをユーザーが踏むと「一見動いて見えるのに古いデータ」状態になり得る。スキーマ変更時の対応は `idb-keyval` 側で個別にクリアする方針。

- **コンポーネントから直接 `useMutation` / `useQuery` / `useQueryClient` を呼ばない**。これらは `.claude/rules/web-hooks-separation.md` で `*.tsx` 直接呼び出しが禁止されている。データ層のロジックは必ず `features/<f>/hooks/use-*.ts` または `routes/.../-use-*-page.ts` に閉じ込めて、コンポーネントは戻り値の `{ data, is*Pending, on*Handler }` を受け取って描画するだけにする。

- **mutation の `onSettled` で `invalidateTargets` を `await` するかどうかは慎重に**。`use-currencies.ts` の `createMutation.onSettled` は `await` せず fire-and-forget で `invalidateTargets` を呼んでいるが、`optimistic-session-event.ts` の `onSettled` は `await invalidateTargets(...)` を返して mutation の `isPending` を refetch 完了まで延ばしている。後者は「mutation 完了直後に画面遷移したい」フローで、画面遷移先で古いキャッシュを踏まないようにするための意図的な選択。どちらが正解というよりは、後続フローが refetch に依存するかで決める。

- **`listByCurrency` のような cursor 付きクエリは load-more と invalidate が干渉する**。`use-currencies.ts` の `handleLoadMore` は `trpcClient.currencyTransaction.listByCurrency.query({ cursor })` を命令的に叩いて React state の `allTransactions` にマージしている。これは React Query の cache を介さない手書きページネーション。`invalidateTargets` を呼ぶと React state 側のページネーション位置はリセットされるため、`resetTransactionState()` を `onSuccess` で必ず呼ぶ。同じパターンを増やすときは「query cache 経由のページネーション（`useInfiniteQuery`）に揃えるか、手書きするなら必ず state リセットを伴うか」を決めておく必要がある。

- **`temp-<timestamp>` 行を使った楽観挿入は、リスト並び順がサーバ確定値に依存するケースで破綻する**。例えばサーバが `createdAt DESC` で返す場合、`[...old, temp]` の append は一瞬末尾に挿入してから invalidate で先頭に移動する、というチラつきになる。並びの正確性が重要な画面では「楽観挿入を諦めて invalidate のみ」か、「prepend」か、明示的なソート関数を通す必要がある。`use-currencies.ts` は append しているが、currencies はユーザーごとに少数で並び順がそこまで強くないという前提に立っている。

- **エラー時のトーストはグローバル設定に集約されている**。各 mutation で `toast.error` を書くと二重表示になる。`apps/web/src/utils/trpc.ts` の `mutationCache.onError` / `queryCache.onError` がアプリ全体で一度だけ発火する設計なので、個別 hook では `onError` でロールバックのみを行い、UI 通知は触らない。retry リンク付きトーストは query 側のみで、`query.invalidate` を `onClick` に紐付けてある。

## 関連

- [`04-hooks-separation.md`](./04-hooks-separation.md) — コンポーネントが React / TanStack 系 hook を直接呼ばないルールの詳細。tRPC hook も対象。
- [`08-feature-domain-map.md`](./08-feature-domain-map.md) — どの feature がどの router を消費しているかの対応表。
- [`.claude/rules/web-data-fetching.md`](../../../.claude/rules/web-data-fetching.md) — 「optimistic update は必ず共通ヘルパー経由」の運用ルール。
- 参考実装：
  - [`apps/web/src/utils/trpc.ts`](../../../apps/web/src/utils/trpc.ts)
  - [`apps/web/src/utils/optimistic-update.ts`](../../../apps/web/src/utils/optimistic-update.ts) と [`__tests__/optimistic-update.test.ts`](../../../apps/web/src/utils/__tests__/optimistic-update.test.ts)
  - [`apps/web/src/features/currencies/hooks/use-currencies.ts`](../../../apps/web/src/features/currencies/hooks/use-currencies.ts)
  - [`apps/web/src/features/players/hooks/use-players.ts`](../../../apps/web/src/features/players/hooks/use-players.ts)
  - [`apps/web/src/features/live-sessions/utils/optimistic-session-event.ts`](../../../apps/web/src/features/live-sessions/utils/optimistic-session-event.ts)
  - [`apps/web/src/main.tsx`](../../../apps/web/src/main.tsx)
  - [`packages/api/src/routers/index.ts`](../../../packages/api/src/routers/index.ts)
