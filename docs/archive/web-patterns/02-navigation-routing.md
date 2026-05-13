# Navigation & Routing — TanStack Router の使い方

UI リライト前 (`apps/web/src/routes/` ベース) のナビゲーション・ルーティング構造を記録したもの。`apps/web` は TanStack Router v1 のファイルベースルーティング + 認証ゲート + 2 系統のナビゲーション (Sidebar / MobileNav) で構成されている。

## 何を解決しているか

このパターンが解いている問題は 4 つに分けられる。

1. **ファイルベースルーティング**: ルート定義をコードではなくファイル配置で表現する。`apps/web/src/routes/` 配下の `.tsx` ファイル名がそのまま URL パスに対応し、`routeTree.gen.ts` がビルド時に生成される。これにより「URL を新設するときは新しいファイルを置くだけ」という単純な手順に揃えられ、ルート定義の差分とコンポーネント差分が同じファイルに収まる。
2. **認証ゲートの集約**: 「`/login` 以外はすべてログイン必須」という方針を、ルートごとに散らさず `__root.tsx` の `beforeLoad` に一箇所で表現する。各ルートは認証チェックを書かない。
3. **Sidebar と MobileNav の同期**: デスクトップは左端の `SidebarNav`、モバイルはボトムナビの `MobileNav`。両者が指すリンク集合・アクティブ判定ロジックが食い違うと UX が崩れるため、`shared/components/app-navigation/` に項目定義と `isActiveItem` を集約する。
4. **`-use-<page>-page.ts` 命名規約**: ルートコンポーネントから state / mutation / 副作用を切り出すページ専用フックを置く場所を、TanStack Router の "ignored ファイル" 命名 (`-` プレフィックス) で確保する。ルートツリー生成からは除外されるが、コロケーションは守られる。

## 中心となる部品

### ルートツリー全体

```text
apps/web/src/routes/
├── __root.tsx                     ルートレイアウト + 認証ゲート
├── index.tsx                      "/"               public な入口ページ
├── login.tsx                      "/login"          未ログイン専用 (逆向き redirect)
├── dashboard.tsx                  "/dashboard"      ダッシュボード
├── search.tsx                     "/search"         検索 (将来用)
├── settings.tsx                   "/settings"       設定 / サインアウト
├── -use-home-page.ts              ページフック (route tree から除外)
├── -use-dashboard-page.ts         〃
├── -use-login-page.ts             〃
├── stores/
│   ├── index.tsx                  "/stores"
│   ├── $storeId.tsx               "/stores/$storeId"   動的セグメント
│   ├── -use-stores-page.ts
│   └── -use-store-detail-page.ts
├── players/
│   ├── index.tsx                  "/players"
│   └── -use-players-page.ts
├── currencies/
│   ├── index.tsx                  "/currencies"
│   └── -use-currencies-page.ts
├── sessions/
│   ├── index.tsx                  "/sessions"
│   ├── $id.tsx                    "/sessions/$id"      動的セグメント
│   ├── -use-sessions-page.ts
│   └── -use-session-detail-page.ts
├── active-session.tsx             "/active-session"    layout (Outlet のみ)
├── active-session/
│   ├── index.tsx                  "/active-session/"           概要シーン
│   ├── events.tsx                 "/active-session/events"     イベント一覧
│   ├── game.tsx                   "/active-session/game"       ゲーム盤面
│   └── -use-active-session-page.ts
└── live-sessions/$sessionType/$sessionId/events.tsx
                                   旧 URL — beforeLoad で /sessions/$id へ redirect
```

`routeTree.gen.ts` は `vite.config.ts` の `tanstackRouter({})` プラグインによって自動生成される (存在のみ確認、中身は読まない)。手動編集してはならず、差分は `bun run dev` / ビルド時に同期される。

### `__root.tsx` の役割

`apps/web/src/routes/__root.tsx`:

- `createRootRouteWithContext<RouterAppContext>()` で `queryClient` と `trpc` をルーターコンテキストとして全ルートに供給する。
- `beforeLoad` で `authClient.getSession()` を呼び、未ログイン時は `/login` へ `redirect()` する。`/login` 自身は早期 return で除外。
- `RootComponent` は `useLocation()` で現在のパス名を取り、`/login` だけは `<Outlet />` を裸で描画、その他はすべて `<AuthenticatedShell>` でラップする。`HeadContent` / `ThemeProvider` / `Toaster` もこの階層で挿入する。

```tsx
export const Route = createRootRouteWithContext<RouterAppContext>()({
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") {
      return;
    }
    const session = await authClient.getSession();
    if (!session.data) {
      throw redirect({ to: "/login" });
    }
  },
  component: RootComponent,
  head: () => ({ ... }),
});
```

逆向きのガード (`/login` にいるが既にログイン済み → `/dashboard` へ) は `login.tsx` 側の `beforeLoad` に書かれている。`__root` 側に「未ログインなら login へ」が、`login.tsx` 側に「ログイン済みなら dashboard へ」がそれぞれ責務分割されている。

### `AuthenticatedShell`

`apps/web/src/shared/components/authenticated-shell/authenticated-shell.tsx` がアプリ全体のシェルを提供する:

- `SessionFormProvider` / `StackSheetProvider` / `UpdateNotesProvider` の 3 つの Context を内側にラップ。
- 左に `<SidebarNav />` (md 以上で表示)、下に `<MobileNav />` (md 未満で表示)。
- 上部に `<OnlineStatusBar />`、`children` (= `<Outlet />`) を中央のスクロール領域に流し込む。
- グローバルシート (`LiveStackFormSheet`, `UpdateNotesSheet`) もここに常駐させる。

レイアウト的には `md:ml-56` でデスクトップ時のみ Sidebar 幅 (`w-56`) ぶんメインを右にずらし、モバイルでは `pb-16` でボトムナビ高さ (`h-16`) を逃がす。SidebarNav は `fixed inset-y-0 left-0 z-40 hidden ... md:flex`、MobileNav は `fixed inset-x-0 bottom-0 z-40 ... md:hidden` で常に画面端に貼り付く。

### `SidebarNav` / `MobileNav` / `app-navigation`

ナビゲーションは項目定義と表示コンポーネントが完全に分離されている。

- `apps/web/src/shared/components/app-navigation/app-navigation.tsx` が項目集合 (`SIDEBAR_ITEMS`, `RESOURCE_ITEMS`, `NORMAL_LEFT_ITEMS`, `NORMAL_RIGHT_ITEMS`, `LIVE_LEFT_ITEMS`, `LIVE_RIGHT_ITEMS`) と判定関数 (`isActive`, `isActiveItem`, `getMobileNavigationItems`)、描画用プリミティブ (`SidebarNavItem`, `MobileNavItem`, `NavigationCenterButton`) をまとめて export する。
- `SidebarNav` (`apps/web/src/shared/components/sidebar-nav/sidebar-nav.tsx`) は `SIDEBAR_ITEMS` をそのまま列挙して `SidebarNavItem` を描画する。`useRouterState({ select: s => s.location.pathname })` で現在地を取り、`isActiveItem(pathname, item)` でハイライト判定する。
- `MobileNav` (`apps/web/src/shared/components/mobile-nav/mobile-nav.tsx`) は左 2 件 + 中央ボタン + 右 2 件のグリッドで、`useMobileNav` フックが返す `leftItems` / `rightItems` を描画する。中央は `NavigationCenterButton` で、「アクティブセッションなし → 新規セッション作成 / paused → Resume / running → Stack シート」とモードによって挙動が切り替わる。
- 右側の "Resources" 項目だけは単一リンクではなく Popover で `RESOURCE_ITEMS` (Stores / Players / Currencies) を開く `MobileNavPopoverItem` を使う。

`NavigationItem` は以下の形:

```ts
export interface NavigationItem {
  exact?: boolean;
  icon: ComponentType<{ size?: number; stroke?: number; className?: string }>;
  label: string;
  matchPaths?: string[];
  to: string;
}
```

`matchPaths` は「この項目をアクティブ扱いにする追加パスのリスト」で、`/active-session` 配下や Resources Popover のグループ判定に使う。

### Route metadata

`__root.tsx` の `head()` で `<title>sapphire2</title>` と meta description / favicon を一括で指定する。ページごとのタイトル上書きは現状なく、画面ヘッダ ([`PageHeader`](../../apps/web/src/shared/components/page-header/page-header.tsx)) で `heading` を表示するに留まる。

### Loader 使用状況

`loader` は採用しておらず、データ取得はすべてページコンポーネントが呼び出す `useXxxPage()` フック内の `useQuery` (`trpc.<router>.<proc>.queryOptions(...)`) で行う。`beforeLoad` はあくまで認証チェックと redirect 用、loader でのプリフェッチは行わない。例外は `__root.tsx` がコンテキストに `queryClient` / `trpc` を渡している点のみで、これは各フックが `import { trpc } from "@/utils/trpc"` 経由で直接掴むため、現状は使われていない。

### Vite プラグイン設定

`apps/web/vite.config.ts` で TanStack Router プラグインを `tanstackRouter({})` (引数なし) で有効にしている。`tsr` 設定はデフォルトのまま、`routes` ディレクトリは `apps/web/src/routes/`、生成先は `apps/web/src/routeTree.gen.ts`。あわせて Tailwind v4 / React / vite-plugin-pwa / 自作の GitHub releases プラグインを差し込んでいる。PWA の `start_url` は `/dashboard` で、ホーム画面追加時はログイン後の入口に直接飛ぶ。dev サーバは `:3001`。

## 典型フロー

ユーザーが `/stores/abc123` にアクセスした場合の解決順:

1. **URL マッチング**: TanStack Router がパスを `routeTree.gen.ts` と突き合わせ、`/stores/$storeId` ルート (`apps/web/src/routes/stores/$storeId.tsx`) を選ぶ。`$storeId` は動的パラメータとして `abc123` がキャプチャされる。
2. **`__root` の `beforeLoad` 実行**: `location.pathname` が `/login` でないので `authClient.getSession()` を呼ぶ。セッションが無ければ `/login` に redirect。
3. **`RootComponent` レンダリング**: パスが `/login` でないので `<AuthenticatedShell>` でラップして `<Outlet />` を描画する。`AuthenticatedShell` は `SidebarNav` (md 以上) / `MobileNav` (md 未満) を併置し、中央エリアに `<Outlet />` を流す。
4. **`/stores/$storeId` コンポーネント描画**: `StoreDetailPage` が呼ばれ、`Route.useParams()` で `{ storeId: "abc123" }` を取り出す。

   ```tsx
   function StoreDetailPage() {
     const { storeId } = Route.useParams();
     const { store, isLoading, expandedGameId, handleToggleGame } =
       useStoreDetailPage(storeId);
     // ...
   }
   ```

5. **ページフックでデータ取得**: `useStoreDetailPage(storeId)` (`apps/web/src/routes/stores/-use-store-detail-page.ts`) が `useQuery(trpc.store.getById.queryOptions({ id: storeId }))` を呼び、ローディング中は "Loading store..." を、データ取得後は `<PageHeader>` + `<Tabs>` (Cash Games / Tournaments) を描画する。

   ```ts
   export function useStoreDetailPage(storeId: string) {
     const storeQuery = useQuery(trpc.store.getById.queryOptions({ id: storeId }));
     const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
     const handleToggleGame = (id: string | null) => setExpandedGameId(id);
     return {
       store: storeQuery.data,
       isLoading: storeQuery.isLoading,
       expandedGameId,
       handleToggleGame,
     };
   }
   ```

6. **ナビゲーションのハイライト**: `SidebarNav` は `useRouterState` で `pathname = "/stores/abc123"` を取り、`isActiveItem(pathname, { to: "/stores", ... })` が `currentPath.startsWith("/stores/")` で `true` を返すので Stores 項目がハイライトされる。MobileNav 側は Resources Popover (`matchPaths: ["/stores", "/players", "/currencies"]`) がアクティブ判定される。

## 決定と理由

### ファイルベースルーティングを採用した理由

TanStack Router 公式の推奨パターン。`createFileRoute("/stores/$storeId")(...)` を `apps/web/src/routes/stores/$storeId.tsx` に書けば自動で `routeTree.gen.ts` に登録される。型推論 (パラメータ / search params の型) もファイルパスを起点に生成されるため、コードベースルーティングを使うと得られる「型の鋭さ」が損なわれる。`vite.config.ts` の `tanstackRouter({})` プラグインがファイル監視と型生成を担当する。

### page-hook を `-use-<page>-page.ts` に切り出している理由

理由は 2 つ。

1. **コンポーネント / 副作用の分離 (`.claude/rules/web-hooks-separation.md`)**: ルートコンポーネントは `useState` / `useEffect` / `useQuery` / `useMutation` を直接呼ばない。すべてページ専用のカスタムフックに閉じ込め、ルートコンポーネントは destructured な戻り値を JSX に貼るだけにする。
2. **TanStack Router の "ignored" 命名規約**: ファイル名が `-` で始まるファイルはルートツリー生成から除外される。`apps/web/src/routes/stores/-use-store-detail-page.ts` をルートディレクトリ配下に置いてもルートになることがなく、ルートファイルとフックがコロケーションされる。

リファレンス: [`apps/web/src/routes/players/-use-players-page.ts`](../../apps/web/src/routes/players/-use-players-page.ts) + [`apps/web/src/routes/players/index.tsx`](../../apps/web/src/routes/players/index.tsx) が標準形。

### 認証ゲートを `__root.tsx` の `beforeLoad` に集約している理由

各ルートに個別の `beforeLoad` を書くと「ガード忘れによる情報漏洩」が起きうる。`__root` で「`/login` 以外はログイン必須」と書き、`/login` 自身は逆方向 (`session.data` あり → `/dashboard` redirect) を `login.tsx` 側で書く。これにより認証ロジックの責務が 2 ファイルに集約される。public ページとして `/` (`index.tsx`) があるが、現状の `__root` 実装ではこれもログインゲートにかかる (`/` にアクセスしても未ログインなら `/login` に飛ばされる) — public 入口の役割は限定的。

### SidebarNav / MobileNav の項目定義を `shared/components/app-navigation/` に置いた理由

Sidebar と MobileNav は別コンポーネントだが同じナビゲーション空間を表す。アイテム配列・アクティブ判定 (`isActiveItem`) を 2 箇所にコピペすると、新しいリンク追加時の片忘れが必ず起きる。`app-navigation/app-navigation.tsx` に `SIDEBAR_ITEMS` / `NORMAL_LEFT_ITEMS` / `NORMAL_RIGHT_ITEMS` / `LIVE_LEFT_ITEMS` / `LIVE_RIGHT_ITEMS` / `RESOURCE_ITEMS` をまとめ、両者がそこから引く構成にしてある。

## 落とし穴

- **動的セグメント (`$storeId`, `$id`) のロード待ち UX**: `loader` を使っていないため、ルート遷移直後はコンポーネントが空 → `useQuery` 発火 → ローディング表示 → データ表示、という 2 段階遷移になる。`StoreDetailPage` も `SessionDetailPage` も自前で `isLoading` チェックを書き「Loading..." / "Store not found" / "Session not found" を出し分ける必要がある。loader 導入時はこれらの分岐を route 側 (`pendingComponent` / `errorComponent`) に寄せられる。
- **`routeTree.gen.ts` を手で触らない**: `vite.config.ts` の `tanstackRouter({})` が `apps/web/src/routes/` を監視して自動再生成する。手編集すると次の dev サーバ起動で上書きされ、差分が消える。Git に commit はされている (生成物だが他環境のビルドで必要) が、変更を入れる手段は「ルートファイルを足す/消す」だけ。
- **MobileNav と SidebarNav の項目が二重定義になっている箇所**: `RESOURCE_ITEMS` (`/stores`, `/players`, `/currencies`) は `SIDEBAR_ITEMS` にも個別に展開されている。Sidebar はフラットに全項目を並べ、MobileNav は Popover で 3 つをまとめて出すという表示要件の違いで、配列が 2 つに分かれている。新規リソースを追加するときは両方を編集する必要がある (リンター / 型による検知はない)。同様に Settings は `SIDEBAR_ITEMS` と `NORMAL_RIGHT_ITEMS` / `LIVE_RIGHT_ITEMS` の 3 箇所に存在する。
- **ネストが深いルートの取り扱い**: `/live-sessions/$sessionType/$sessionId/events` という旧 URL は、現在は `apps/web/src/routes/live-sessions/$sessionType/$sessionId/events.tsx` の `beforeLoad` が `/sessions/$id` に 301 (replace: true) redirect するだけのスタブになっている。新しい live セッション系の画面はすべて `/active-session` (`/active-session/`, `/active-session/events`, `/active-session/game`) という浅いツリーに統合され、ルートパラメータでセッション ID を取らず `useActiveSession()` フックで取得する設計に変わった。歴史的経緯による空ファイルをいきなり削除すると外部から来たリンクが 404 になる点に注意。
- **`/active-session` の layout route**: `apps/web/src/routes/active-session.tsx` は `() => <Outlet />` だけの薄い layout route で、配下の `index.tsx` / `events.tsx` / `game.tsx` の親になる。MobileNav はアクティブセッションがあるときだけ `LIVE_LEFT_ITEMS` / `LIVE_RIGHT_ITEMS` に切り替わり、`/active-session/events` と `/active-session/game` を露出する。セッションが終了するとこれらのリンクは MobileNav から消えるが、URL を直打ちすれば到達できる (`useActiveSession()` の結果次第で空表示)。
- **`__root` の `beforeLoad` は毎ナビゲーション走る**: `authClient.getSession()` がキャッシュ無しで毎回呼ばれる構造。better-auth 側の挙動次第ではあるが、画面遷移が増えるとセッション確認の HTTP コストが積み上がる。
- **`Route.useParams()` の戻り値は string**: パラメータは TanStack Router 側で型生成されるが、`storeId` / `id` はあくまで文字列。数値化や UUID 検証は呼び出し側 (フック内) で行う必要がある。

## 関連

- [`01-page-shell.md`](./01-page-shell.md) — `AuthenticatedShell` / `PageHeader` / `PageSection` などのページ骨格
- [`04-hooks-separation.md`](./04-hooks-separation.md) — `-use-<page>-page.ts` および `useXxx` フックへの集約ルール
- [`09-auth-flow.md`](./09-auth-flow.md) — `authClient` / Better Auth と `__root.tsx` / `login.tsx` の連携
