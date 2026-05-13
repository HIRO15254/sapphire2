# Overview — 現状実装の設計原則

このドキュメントは `apps/web/` を全面リライトするにあたり、**「リライト前の現時点での設計上の決定」を後世に残す**ためのアーカイブの土台である。`.claude/rules/*` が「こうしろ」という規約集だとすれば、本アーカイブは「現状こうなっており、その理由はこうだ」という決定集として相補的に機能する。本ファイル `00-overview.md` は他 11 ファイル（`01-page-shell.md` ～ `11-…`）の前提を整理する位置付けで、全体設計原則・ディレクトリ哲学・依存関係の流れに集中する。個別トピックの深掘りは後続ファイルに譲る。

## 次のUIリライトで変更が決まっている方針

本アーカイブは「過去の決定」を残すものだが、リライトでは以下の 2 点が**意図的に変わる**ことが既に決まっている。読者は各章を読む際、これらと現状の差分を意識すること。

1. **モバイルとデスクトップで完全に別の UI を用意する。**
   現状はモバイル / デスクトップで同じ component ツリーを使い、`ResponsiveDialog`（`shared/components/responsive-dialog/`）や `use-current-device.ts` の `useMediaQuery` で 768px を境にレンダリングを分岐させる方式に統一されている（→ `06-mobile-drawer.md`）。リライトではこの「分岐統合」を捨て、モバイル UI とデスクトップ UI を別ツリー（route 単位 or レイアウト単位）で並立させる方針に変える。`ResponsiveDialog` / `useCurrentDevice` などの分岐ヘルパーは引き継がない前提で読むこと。
2. **可能な限り `shadcn/ui` のカスタマイズで UI を構成する。**
   現状は shadcn primitive の上に `shared/components/management/*`（`ManagementList` / `EntityListItem` / `TagManager` / `ExpandableItemList` ほか）など自作の複合コンポーネントを多数積み上げており、これが層の厚みと改修コストを生んでいる（→ `07-shared-composites.md`）。リライトでは「shadcn の component に props / className / 派生バリアントを足す」までで済ませることを基本姿勢とし、自作複合 component の新設は最終手段に位置付ける。既存の `shared/components/management/*` などは原則として引き継がない前提で読むこと。

これら 2 点は CLAUDE.md / `.claude/rules/*` の現行記述とは整合しない箇所がある（特に `.claude/rules/web-ui.md` の Drawer/Dialog 切替ルールと、`07-shared-composites.md` で記録した「shared に上げる基準」）。リライト着手時にルール側を新方針に合わせて書き直す必要がある。

## 何を解決しているか

sapphire2 は、ポーカーストア（店舗）の運営者が日々のオペレーションを管理するための Web アプリケーションである。扱うドメインは以下のとおりで、`packages/db/src/schema/` のテーブル群とほぼ 1 対 1 で対応する：

- **ストア管理**: 店舗ごとのリングゲーム / トーナメント設定、ブラインド表、チップ購入オプション。`features/stores/`、`schema/store.ts` / `ring-game.ts` / `tournament.ts` / `ring-game-blind-set.ts` / `tournament-blind-set.ts` / `tournament-blind-level.ts` / `session-chip-purchase-option.ts` を中心とする。
- **プレイヤー管理**: 来店者のプロフィール、タグ付け、検索。`features/players/`、`schema/player.ts`。タグは `player-tag` ルーターで別管理。
- **ライブセッション**: 「いま卓に座っている」状態を扱う最大のドメイン。卓割り、スタック記録、イベントログ（オールイン / アドオン / チップ購入）、トーナメントタイマー、リングゲームのシート管理。`features/live-sessions/`（**182 ファイル**、全 feature の 4 割超）、`schema/session.ts` / `session-event.ts` / `session-cash-detail.ts` / `session-tournament-detail.ts` ほか。
- **セッション履歴 / 集計**: 終了済みセッションの一覧 / 詳細 / フィルタ。`features/sessions/`、`schema/session.ts`。
- **通貨管理**: 店舗ごとの内部通貨（チップ以外の決済単位）と取引履歴。`features/currencies/`、`schema/`（`currency-transaction` ルーターのみで schema は `session.ts` に同居している節がある）。
- **ダッシュボード**: ユーザーが配置可能なウィジェット集。`features/dashboard/widgets/`、`schema/dashboard-widget.ts`。
- **更新情報配信**: GitHub Releases から取り込んだ更新ノートの既読管理。`features/update-notes/`、`schema/update-note-view.ts`、Vite プラグイン `apps/web/src/plugins/vite-plugin-github-releases.ts`。

技術スタックは「Bun / TanStack 一式 / tRPC v11 / Drizzle ORM / Cloudflare D1 / Better Auth」で固定されている。理由は次の 3 点に集約される：

1. **Edge ファースト**: サーバは Hono on Cloudflare Workers、DB は D1（Cloudflare の SQLite）で完結し、Cold start とレイテンシを最小化する。`apps/server` が Workers 1 ファイル相当に収まる前提でルータが組まれている。
2. **型のソースを 1 本化**: `packages/api` の tRPC ルータ定義が、クライアント側の入力 Zod スキーマ / 返り値型 / プロシージャ一覧のすべてを兼ねる。`apps/web/src/utils/trpc.ts` で `createTRPCOptionsProxy<AppRouter>` を通すことで、`trpc.foo.list.queryOptions()` のような呼び出しが TanStack Query のオプション型まで含めて型付けされる。
3. **オフラインファースト UX**: `queryClient` を `PersistQueryClientProvider`（`apps/web/src/main.tsx`）で IndexedDB（`idb-keyval`）に永続化し、`networkMode: "offlineFirst"` をデフォルトにすることで、ライブセッション中にネットが切れても画面が止まらない設計を狙っている。PWA 化（`vite-plugin-pwa`）もこれに紐付く。

## 中心となる部品

`apps/web/src/` 直下のディレクトリは以下の通り。`CLAUDE.md` の "Repository Layout" に書かれた哲学をそのままトレースしている。

```text
apps/web/src/
├── main.tsx                # エントリ。QueryClientPersist + Router
├── routes/                 # TanStack Router のファイルベース route tree
│   ├── __root.tsx          # 認証ゲート + AuthenticatedShell の差し込み
│   ├── -use-*-page.ts      # 各ページ用 page-hook（先頭ハイフンで route 除外）
│   ├── dashboard.tsx
│   ├── active-session/     # /active-session、/active-session/game、/events
│   ├── live-sessions/      # /live-sessions/$sessionType/$sessionId/events
│   ├── stores/             # /stores、/stores/$storeId
│   ├── sessions/           # /sessions、/sessions/$id
│   ├── players/、currencies/、login.tsx、settings.tsx、search.tsx
│   └── __tests__/
├── features/               # ドメインごとのコロケーション単位（7 feature、計 442 ファイル）
│   ├── stores/             # 66 ファイル
│   ├── live-sessions/      # 182 ファイル（最大）
│   ├── sessions/           # 62 ファイル
│   ├── dashboard/          # 55 ファイル（components/ + widgets/ 構成）
│   ├── players/            # 40 ファイル
│   ├── currencies/         # 30 ファイル
│   └── update-notes/       # 7 ファイル
├── shared/                 # 2 つ以上の feature が共有する部品
│   ├── components/
│   │   ├── ui/             # shadcn プリミティブ（30+: Button, Table, Drawer, Field, ...）
│   │   ├── authenticated-shell/、app-navigation/、sidebar-nav/、mobile-nav/
│   │   ├── page-header/、page-section/、auth-form-shell/、public-page-shell/
│   │   ├── sign-in-form/、sign-up-form/、user-menu/、linked-accounts/
│   │   ├── mode-toggle/、theme-provider、loader、online-status-bar/、icons/
│   │   └── preview-auto-login/、filter-dialog-shell/、management/
│   ├── hooks/              # use-elapsed-time / use-media-query / use-mobile-nav-popover /
│   │                       # use-online-status / use-set-password-form
│   └── lib/                # form-fields.ts（Zod ヘルパー: requiredNumericString ほか）
├── utils/                  # 真にグローバルなヘルパー
│   ├── trpc.ts             # queryClient / persister / trpcClient / trpc proxy
│   ├── optimistic-update.ts # snapshotQuery / cancelTargets / restoreSnapshots / invalidateTargets
│   ├── format-number.ts、format-elapsed-time.ts、format-profit-loss.ts
│   └── table-size-colors.ts
├── lib/                    # auth-client（Better Auth クライアント）
├── plugins/                # vite-plugin-github-releases（更新ノート取り込み）
├── routeTree.gen.ts        # TanStack Router 自動生成
└── index.css
```

各層の責務：

| 層 | 責務 | 「ここに入る基準」 |
|---|---|---|
| `routes/` | URL → ページ束ね。認証ゲート (`__root.tsx`)、loader / preload、page-hook を呼び出して JSX を返すだけ | URL に対応するページ単位 |
| `routes/-use-*-page.ts` | ページ全体の状態オーケストレーション。複数の feature hook を束ね、loading / error をまとめる | ページ単位のロジック |
| `features/<x>/components/<c>/` | コンポーネント + その専属 hook + `index.ts`。`<c>.tsx` / `use-<c>.ts` をセットで配置 | コンポーネント固有のロジックがある |
| `features/<x>/hooks/` | feature 内の複数コンポーネントから呼ばれるデータ hook（`use-currencies.ts` 形式） | feature 内 cross-component |
| `features/<x>/utils/` | feature 内のピュア関数 / 定数 / Zod スキーマ | feature 内 cross-file の純粋ロジック |
| `features/<x>/constants/`、`features/<x>/widgets/` | players は constants、dashboard は widgets を持つ（feature 固有の細分化） | feature 自身が必要と判断したサブ構造 |
| `shared/components/ui/` | shadcn プリミティブ（差し替えるなら一括）。`select-with-clear` のような薄いラッパもここ | feature 横断 / アプリの言語 |
| `shared/components/<x>/` | 2 つ以上の feature から使う composite（PageHeader、AuthenticatedShell、sign-in-form 等） | feature 横断の構成要素 |
| `shared/hooks/` | feature 横断 hook（メディアクエリ、オンライン検知、経過時間） | feature 横断 |
| `shared/lib/` | feature 横断 helper（form の Zod ヘルパー） | feature 横断の純粋ロジック |
| `utils/` | アプリの基盤。tRPC クライアント / Query 設定 / 楽観更新 / フォーマッタ | shared/lib より下、もはやドメインを持たない |

### ルータの形

サーバ側 `packages/api/src/routers/` には **20 個のルータファイル** が存在する：

```text
ai-extract / ai-extract-sources / currency / currency-transaction / dashboard-widget /
limit-format / live-session / player / player-tag / ring-game / session / session-event /
session-tag / store / tournament / tournament-chip-purchase / transaction-type /
update-note-view / variant / index
```

`publicProcedure` / `protectedProcedure` の出現は合計 **136 箇所**（簡易 grep）。procedure 数で見ると `live-session` と `tournament` が 18、`ring-game` が 13、`session-event` が 9、`tournament-chip-purchase` が 8 と、ライブ系が突出している。

### UI プリミティブ

`shared/components/ui/` には 30+ の shadcn プリミティブが揃う：accordion / alert / avatar / badge / button / card / checkbox / command / dialog / dialog-action-row / drawer / dropdown-menu / empty-state / field / input / label / popover / radio-group / responsive-dialog / rich-text-editor / select / separator / skeleton / sonner / switch / table / tabs / tag-input / tag-picker-base / textarea / toggle-group。`responsive-dialog` と `dialog-action-row` は shadcn 既製ではない自家製ラッパで、モバイル = Drawer / デスクトップ = Dialog の分岐を抽象化している。

## 典型フロー

ユーザーが `/stores/abc123` を開いたときの上から下までの流れを 1 例として：

1. **ブラウザ** が `index.html` を取得し、`main.tsx` が起動する。`PersistQueryClientProvider`（`apps/web/src/main.tsx`）が IndexedDB（`idb-keyval`）から `sapphire2-query-cache` を復元する。Provider の `maxAge` は 24h（`1000 * 60 * 60 * 24`）。
2. **TanStack Router** が `RouterProvider` から `defaultPreload: "intent"` でルーティング。`routes/__root.tsx` の `beforeLoad` が `authClient.getSession()` を呼ぶ。未ログインなら `/login` に `throw redirect`。
3. **AuthenticatedShell**（`shared/components/authenticated-shell/`）がレイアウト枠（サイドナビ / モバイルナビ / トースト）を当て、`<Outlet />` で子ルートを描画する。`ThemeProvider` でダークテーマがデフォルト。
4. **`routes/stores/$storeId.tsx`** が描画される。コンポーネント本体は **hook を 1 つ呼ぶだけ**で（`.claude/rules/web-hooks-separation.md` の STRICT ルール）、`Route.useParams()` で `storeId` を取り、`-use-store-detail-page.ts` に渡す。
5. **`-use-store-detail-page.ts`**（page-hook）が複数の feature hook（例: `features/stores/hooks/use-store.ts`、`features/stores/hooks/use-tournaments.ts`、`features/stores/hooks/use-ring-games.ts`）をオーケストレートする。各 hook 内で `trpc.store.byId.queryOptions({ id: storeId })` のような呼び出しが `useQuery` で実行される。
6. **tRPC バッチリンク** が `httpBatchLink({ url: \`${VITE_SERVER_URL}/trpc\` })`（`utils/trpc.ts`）経由で `apps/server` の Hono ハンドラへ。`credentials: "include"` で Better Auth セッションクッキーが乗る。
7. **サーバ側 tRPC** が `packages/api/src/routers/store.ts` の `byId` procedure に到達。`protectedProcedure` であれば `context.ts` で `session` を確認する。
8. **Drizzle ORM** が `packages/db/src/schema/store.ts` を経由して D1 を SELECT。結果は型付き JSON で返る。
9. **クライアントの `queryCache.onError`**（`utils/trpc.ts`）が `toast.error` を発火する設定で、レスポンス成功時は React コンポーネントが再レンダー。失敗時は再試行ボタン付きトーストが出る。
10. **ユーザーがフォームを送信** → コンポーネントは `use-store-form.ts` の `onSubmit` を呼ぶだけ。hook 内で `@tanstack/react-form` の `form.handleSubmit()` が走り、`mutation.mutateAsync` → サーバへ。楽観更新が必要なケースでは `onMutate` で `snapshotQuery` → `setQueryData`、`onError` で `restoreSnapshots`、`onSettled` で `invalidateTargets`（すべて `utils/optimistic-update.ts` のヘルパー経由、`.claude/rules/web-data-fetching.md`）。

## 決定と理由

| # | 決定 | 理由 |
|---|---|---|
| 1 | **`<component>.tsx` / `use-<component>.ts` / `index.ts` を同一ディレクトリにコロケート**する | feature 内移動時に「実装」「ロジック」「公開境界」がセットで動く。`features/players/components/player-form/` がリファレンス（`player-form.tsx` + `use-player-form.ts` + `index.ts` + テスト）。 |
| 2 | **コンポーネント / ルートは custom hook 以外の hook を直接呼ばない**（`.claude/rules/web-hooks-separation.md`） | `useState` / `useQuery` / `useForm` などの実装詳細がコンポーネントに漏れると、テストの単位が「JSX とロジックの絡まり」になりやすい。hook 単位の `renderHook` テストで黒箱化したい。 |
| 3 | **features → shared への一方向依存**、shared から features を参照しない | プロモーションの一方向性を保つ。「2 つ目の feature が import したら shared に上げる」運用で、shared の肥大を後付け正当化する。 |
| 4 | **`.claude/rules/` を `paths:` frontmatter で path-scoped に分割**する | 規約が増えても触っているパスに紐づくものだけが Claude セッションに自動ロードされ、トップレベル `CLAUDE.md` を 200 行以下に抑えられる。現在 4 ファイル（hooks-separation / forms / ui / data-fetching）。 |
| 5 | **UI コピーは English-only**（`.claude/rules/web-ui.md`） | 将来の i18n を見据え、文字列を English を base locale として固定。コード内コメントや commit / PR は日本語可。 |
| 6 | **モバイル = Drawer、デスクトップ = Dialog** に分岐 | スマホでフォームを Dialog で出すと iOS Safari のソフトキーボードが入力欄を隠す。`shared/components/ui/responsive-dialog/` で抽象化済み。ライブセッション中はモバイル利用率が極めて高い前提。 |
| 7 | **Vitest project を 4 分割**（`web-dom` / `web-node` / `api` / `db` / `env`） | jsdom を必要としないピュア関数 / Zod / DB スキーマは node 環境で走らせ、起動コストを下げる。Windows 環境で `bun run test` が数分かかる事情への対処（`CLAUDE.md` の "Do NOT run the full test suite during a task" を参照）。 |
| 8 | **tRPC を「クライアント型のソース」とする**（`packages/api`） | サーバとクライアントの型を OpenAPI / 手書き型で二重管理しない。`apps/web/src/utils/trpc.ts` の `createTRPCOptionsProxy<AppRouter>` 経由で query-key も型付け。 |
| 9 | **DB は Cloudflare D1（SQLite）+ Drizzle**、Workers から直結 | Edge での低レイテンシ、`apps/server` を Workers バンドルに収める制約。Postgres 固有機能を使わない設計を最初から強制する効果もある。 |
| 10 | **`queryClient` を IndexedDB に永続化、`networkMode: "offlineFirst"`** | ライブセッション中にネットが切れても画面が機能する UX。`@tanstack/query-async-storage-persister` + `idb-keyval`、`gcTime: 24h`。 |
| 11 | **shadcn プリミティブを薄くラップする方針**（`select-with-clear` / `responsive-dialog` / `dialog-action-row` / `page-header` / `empty-state`） | 「shadcn 直」では繰り返しが出る部分だけをラップし、デザインの一貫性を hook 化する。`.claude/rules/web-ui.md` で `<table>` / `ColorBadge` / `PlayerAvatar` などの hand-roll を明示禁止。 |
| 12 | **アイコンは `@tabler/icons-react` 一本**（lucide は新規禁止） | スタイル統一とバンドル重複の回避。`package.json` には `lucide-react` も残るが、新規追加は禁止のフェーズ。 |
| 13 | **Zod は default import (`import z from "zod"`)** | Vite のバンドラ問題で namespace import が壊れる前例があり、ルールに明文化（`.claude/rules/web-forms.md` #8）。 |
| 14 | **楽観更新は `utils/optimistic-update.ts` ヘルパー経由のみ**（`.claude/rules/web-data-fetching.md`） | `setQueryData` + `invalidateQueries` の自前チェーンが各所に散ると、rollback / cancel の網目が抜ける。`snapshotQuery` / `cancelTargets` / `restoreSnapshots` / `invalidateTargets` の 4 つ組で固定。 |
| 15 | **page-hook を `routes/-use-<page>-page.ts` に置く**（先頭ハイフン） | TanStack Router のファイルベースルーティングから自動除外される命名規約。route の隣に置きつつ route として認識させない。 |

## 落とし穴

リライト時に「ここは意図か / 負債か」の判断を要する論点：

- **`features/live-sessions/` の肥大**: 全 442 ファイルのうち 182（41%）が live-sessions に集中している。`components/` は 25 ディレクトリ、`hooks/` は 17 ファイル。卓割り（`poker-table`、`add-player-sheet`、`seat-from-screenshot-sheet`）、スタック記録（`stack-form`、`stack-record-editor`、`tournament-stack-record-editor`）、イベント編集（`event-editors`、`event-fields`、`event-badge`）が並走しており、内部で更にサブ feature 化する余地がある。リライトでは「`live-sessions` を `live-cash` / `live-tournament` / `live-shared` などに分解する」案を最低限テーブルに乗せること。
- **`schema/` のテーブル数**: `packages/db/src/schema/` に 21 ファイル。`session-cash-detail` / `session-tournament-detail` / `session-cash-blind-set` / `session-tournament-blind-set` のように「セッション × バリアント」で重複構造が増えている。スキーマ層のリライトと UI のリライトを連動させる場合、対応マップが必要。
- **`packages/api` の procedure 数**: 簡易 grep で 136。`live-session` 18 / `tournament` 18 / `ring-game` 13 が突出する。tRPC v11 → v12 の動向や、router の機能別分割（例: tournament-mutation / tournament-query）を検討する余地。
- **`dashboard/widgets/` の registry パターン**: 他 feature にはないサブ構造（`registry` ディレクトリ）。リライト後にウィジェット拡張ポイントとして残すか、ダッシュボードを別 app に切るかは要決定。
- **`lucide-react` が `package.json` に残っている**: 規約上は禁止だが依存自体は撤去されていない。完全撤去すれば bundle が縮む。
- **`refactor/collocate-batch` 系の過去ブランチ**: 既に直近で大規模なコロケーション再編（`fix(seed):`、`refactor(web): align stores/* and live-sessions/* with new tournament/ring-game API` 等のコミット）が走った直後である。「最新の構造はこの 1〜2 週間で確定したもの」という前提を持つこと。
- **`apps/web/src/utils/trpc.ts` がトップレベルでトーストを発火**: `QueryCache.onError` / `MutationCache.onError` がアプリ全体の失敗 UX を握っている。テスト環境ではここを差し替えにくいので、`createTestQueryClient`（`apps/web/src/__tests__/test-utils.tsx`）を必ず使う前提が暗黙化している。
- **route file と page-hook の同期**: 先頭ハイフン規約（`-use-<page>-page.ts`）はファイル名でしか担保されない。リライトでフォルダ構造を変える場合、`routeTree.gen.ts` の再生成と合わせて検証する必要がある。
- **PWA + 永続化キャッシュの整合性**: `queryClient` の cache key は tRPC 経由で自動付与されるため、サーバ側 procedure 名 / 入力スキーマを変更すると古いキャッシュが残る。`sapphire2-query-cache` のバージョニング戦略は未整備で、リライトでサーバ API を変える場合は `key` を bump する運用を明文化したい。
- **Vite plugin `vite-plugin-github-releases`**: ビルド時に GitHub Releases を取り込んで `virtual-update-notes.d.ts` 経由で feature `update-notes` が参照している。リライト後も同じ取り込み方式を維持するなら、build 環境の GH トークン要件を引き継ぐ必要がある。

## 関連

本 overview の各論を担う後続ファイル（同一フォルダの相対パス）：

- [`./01-page-shell.md`](./01-page-shell.md) — `__root.tsx` / `AuthenticatedShell` / `PageHeader` / ナビゲーションのページ枠
- [`./02-routing-and-page-hooks.md`](./02-routing-and-page-hooks.md) — TanStack Router 構成、`-use-<page>-page.ts` 規約、loader / preload
- [`./03-feature-colocation.md`](./03-feature-colocation.md) — `features/<x>/{components,hooks,utils}/` の使い分けと promotion ルール
- [`./04-shared-and-ui-primitives.md`](./04-shared-and-ui-primitives.md) — `shared/components/ui/` の shadcn 採用範囲、自家製ラッパ
- [`./05-forms.md`](./05-forms.md) — `@tanstack/react-form` + Zod、`SelectWithClear`、`type="text" inputMode="numeric"`、Drawer 分岐
- [`./06-data-fetching-and-trpc.md`](./06-data-fetching-and-trpc.md) — `utils/trpc.ts` 設定、queryOptions パターン、persister
- [`./07-optimistic-updates.md`](./07-optimistic-updates.md) — `utils/optimistic-update.ts` の 4 ヘルパーと使用パターン
- [`./08-auth.md`](./08-auth.md) — Better Auth、`__root.beforeLoad` の認証ゲート、`lib/auth-client.ts`
- [`./09-testing.md`](./09-testing.md) — Vitest project 分割、`renderHook` 中心、`test-utils.tsx` のヘルパー群
- [`./10-domain-live-sessions.md`](./10-domain-live-sessions.md) — `features/live-sessions/` の内部構造、卓 / スタック / イベント / タイマー
- [`./11-build-and-deploy.md`](./11-build-and-deploy.md) — Vite + PWA、Cloudflare Workers バンドル、D1 マイグレーション

参照する規約ファイル（`.claude/rules/`）：

- [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md)
- [`.claude/rules/web-forms.md`](../../../.claude/rules/web-forms.md)
- [`.claude/rules/web-ui.md`](../../../.claude/rules/web-ui.md)
- [`.claude/rules/web-data-fetching.md`](../../../.claude/rules/web-data-fetching.md)
- [`CLAUDE.md`](../../../CLAUDE.md)
