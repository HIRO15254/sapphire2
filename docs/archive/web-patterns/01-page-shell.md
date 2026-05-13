# Page Shell — ページ外枠の組み立て

> UI リライト前の現状記録。`apps/web/` における「ページの外枠（shell）」がどう
> 組み立てられているかを、実装ファイルを根拠にまとめる。推測ではなく、リポジトリ
> に存在するコードだけを引用する。

## 何を解決しているか

sapphire2 の web 画面は十数枚以上のページを持つ SPA で、どのページも
「タイトル」「アクション行」「（必要なら）説明文」「スクロールする本文」という
共通の骨格を持つ。これをページごとに `<h1>` や `<header>` をベタ書きする運用にし
てしまうと、

- タイトルのフォントサイズや余白がページごとにズレる
- アクション行の `gap` / 折り返し挙動が揃わない
- モバイル時のセーフエリア（下端 16px のボトムナビ分の `padding-bottom` など）を
  ページごとに思い出して書くことになる

といった「揃わなさ」が発生しやすい。これを避けるために、`apps/web/src/shared/`
側に **2 層の shell** が用意されている。

1. **外側 shell**: アプリ全体の「枠」。サイドバー / モバイルナビ / オンライン
   ステータス表示 / グローバル sheet（live session, update notes）をまとめて
   提供する。認証済みページ用の `AuthenticatedShell` と、未認証ページ用の
   `PublicPageShell` の 2 種類がある。
2. **内側のページ骨格**: ページ本文の最初に必ず置くタイトル＋アクション行を
   司る `PageHeader`、その下に並べる「セクション」のための `PageSection`、
   ログインフォーム専用に切り出されたカードレイアウト `AuthFormShell`。

ルートレベルの規約として `CLAUDE.md` および
[`.claude/rules/web-ui.md`](../../../.claude/rules/web-ui.md) に
**"Pages start with `PageHeader`"** と明記されており、これは「ページ component
の最初の子は `PageHeader`」というハードルールとして守られている。

## 中心となる部品

| 部品 | ファイル | 責務 | 主要 props | どこで使われているか |
|---|---|---|---|---|
| `PageHeader` | `apps/web/src/shared/components/page-header/page-header.tsx` | 認証済みページの先頭に置くタイトル + 説明 + アクションスロット | `heading` (必須), `description?`, `actions?`, それ以外は `<div>` の全 props | `routes/dashboard.tsx` 経由の `DashboardPage`、`routes/players/index.tsx`、`routes/currencies/index.tsx`、`routes/sessions/index.tsx`、`routes/search.tsx`、`routes/settings.tsx`、`routes/stores/index.tsx`、`routes/stores/$storeId.tsx`、`features/live-sessions/components/active-session-scene/active-session-scene.tsx`、`features/live-sessions/components/active-session-game-scene/active-session-game-scene.tsx`、`features/live-sessions/components/session-events-scene/session-events-scene.tsx` |
| `AuthenticatedShell` | `apps/web/src/shared/components/authenticated-shell/authenticated-shell.tsx` | 認証必須ページの外枠。サイドバー、モバイルナビ、オンラインステータス、グローバル sheet 群、ライブセッション関連の context provider を一括で組み立てる | `children: ReactNode` のみ | `routes/__root.tsx` の `RootComponent` から、`/login` 以外のすべてのルートに対して使われる |
| `PublicPageShell` | `apps/web/src/shared/components/public-page-shell/public-page-shell.tsx` | 未認証ページ（現状は `/login` のみ）の外枠。2 カラムのランディング風レイアウトを提供する | `title`, `description` (必須), `eyebrow?`, `actions?`, `aside?`, `children`, `className?` | `routes/login.tsx` |
| `AuthFormShell` | `apps/web/src/shared/components/auth-form-shell/auth-form-shell.tsx` | サインイン / サインアップのカード本体。OAuth プロバイダボタン列、`or` セパレータ、子フォーム、モード切替リンク、フッターを統合する | `title`, `providerActions`, `switchLabel`, `onSwitchMode` (必須), `eyebrow?`, `description?`, `footerNote?`, `children` | `shared/components/sign-in-form`, `shared/components/sign-up-form`（`PublicPageShell` の `children` として差し込まれる） |
| `PageSection` | `apps/web/src/shared/components/page-section/page-section.tsx` | `PageHeader` の下に並べる、border + card 背景の `<section>`。セクション見出しと説明・アクションをまとめる | `heading` (必須), `description?`, `actions?`, それ以外は `<section>` の全 props | `routes/settings.tsx`、`routes/login.tsx`（`PublicPageShell` の `aside` に差し込み） |

### `PageHeader` の実装

`PageHeader` は薄い presentational component で、内部 state を持たない。
横一列に「タイトル＋説明（左、`flex-1`、`min-w-0`）」と「アクション列（右、
`shrink-0`、`flex-wrap`）」を並べ、下に `mb-6` のマージンを取るだけ。

```tsx
// apps/web/src/shared/components/page-header/page-header.tsx
export function PageHeader({
    actions,
    className,
    description,
    heading,
    ...props
}: PageHeaderProps) {
    return (
        <div
            className={cn("mb-6 flex items-center justify-between gap-3", className)}
            {...props}
        >
            <div className="min-w-0 flex-1 space-y-1">
                <h1 className="font-bold text-2xl">{heading}</h1>
                {description ? (
                    <p className="text-muted-foreground text-sm">{description}</p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}
```

ポイント:

- `heading` は `ReactNode` なので、バッジやアイコン付きタイトルもそのまま渡せる。
- `actions` は単一の React ノード。ページ側では `<>...</>` でラップして複数の
  `Button` を並べる慣習（`routes/players/index.tsx` の例）。
- `className` は `cn(...)` でマージされ、ページ固有の余白調整が可能。

### `AuthenticatedShell` の実装

`AuthenticatedShell` は単なるレイアウト wrapper ではなく、**認証済みアプリ全体で
共有される 4 つの provider と 3 つのグローバル UI を組み立てる場所** になって
いる。

```tsx
// apps/web/src/shared/components/authenticated-shell/authenticated-shell.tsx
export function AuthenticatedShell({ children }: { children: ReactNode }) {
    return (
        <SessionFormProvider>
            <StackSheetProvider>
                <UpdateNotesProvider>
                    <div className="min-h-svh bg-background">
                        <SidebarNav />
                        <div className="flex h-svh flex-col md:ml-56">
                            <OnlineStatusBar />
                            <div className="flex-1 overflow-auto pb-16 md:pb-0">
                                {children}
                            </div>
                        </div>
                        <MobileNav />
                        <LiveStackFormSheet />
                        <UpdateNotesSheet />
                    </div>
                </UpdateNotesProvider>
            </StackSheetProvider>
        </SessionFormProvider>
    );
}
```

ポイント:

- 一番外側の 3 つ（`SessionFormProvider` / `StackSheetProvider` /
  `UpdateNotesProvider`）は、`features/live-sessions` と `features/update-notes`
  が提供する context provider。グローバルに開閉される sheet の状態をここで持つ。
- `<SidebarNav />` は `md:` 以上で表示される左固定サイドバー（幅 `w-56`）。
  `md:ml-56` で本文側はサイドバー幅ぶんオフセットされる。
- `<MobileNav />` は `md:hidden` のボトムナビ。本文側の `pb-16 md:pb-0` は
  モバイル時のボトムナビぶんのセーフエリア。
- スクロールするのは中央の `<div className="flex-1 overflow-auto ...">{children}</div>`
  だけ。`h-svh` を親に取って、ヘッダーやサイドバーを固定したまま中身だけ
  縦スクロールする構成。

### `PublicPageShell` の実装

未認証ページのレイアウト。背景に radial + linear のグラデーション、本文を
`max-w-6xl` の中央寄せにし、`lg:` 以上では「左：見出し（hidden lg:block）／
右：フォーム」の 2 カラム、それ未満では右カラム（`children`）のみが見える。

```tsx
// apps/web/src/shared/components/public-page-shell/public-page-shell.tsx
<div className="min-h-screen bg-[radial-gradient(...)]">
    <div className={cn("mx-auto flex min-h-screen w-full max-w-6xl ...", className)}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,440px)] lg:items-center">
            <div className="hidden space-y-6 lg:block">
                {/* eyebrow / title / description / actions / aside */}
            </div>
            <div>{children}</div>
        </div>
    </div>
</div>
```

`eyebrow` は大文字 + `tracking-[0.28em]` の小さなラベル。`aside` には
`PageSection` を差し込むことを想定している（`routes/login.tsx` の例がそれ）。

### `AuthFormShell` の実装

`PublicPageShell` の `children` 側に差し込まれる、カードのフォーム本体。OAuth
ボタン → `or` セパレータ → 子フォーム → モード切替リンク → フッターノート、
という縦並びを固定で提供する。実体は `rounded-2xl border bg-card/95 p-6
shadow-sm backdrop-blur sm:p-8` のカード 1 枚で、`providerActions: Array<{
icon, label, onClick }>` を全幅 `Button` 列として並べ、その下に `or` セパレータ、
`children`（実フォーム）、`onSwitchMode` を呼ぶ `variant="link"` ボタン、
`footerNote` を順に描く。

ファイル末尾には `authSubmitLabels` という送信ボタン文言の定数も export して
いる（`signIn`/`signUp` 各々 `{ idle, submitting }`）。`SignInForm` / `SignUpForm`
の両方で同じ文言を使うための共有ポイント。

### `PageSection` の実装

`PageHeader` の下に並べる、カード状の `<section>`。

```tsx
// apps/web/src/shared/components/page-section/page-section.tsx
<section className={cn("rounded-lg border bg-card p-4", className)} {...props}>
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
            <h2 className="font-semibold text-lg">{heading}</h2>
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
    </div>
    {children}
</section>
```

`PageHeader` がページ全体のタイトル（`<h1>` + `text-2xl`）なのに対し、
`PageSection` はセクション見出し（`<h2>` + `text-lg`）。視覚階層は
**PageHeader > PageSection**。

## 典型フロー

ユーザーが `/dashboard` を開くケースを、ルート → shell → ページの順に追う。

### 1. `routes/__root.tsx` で認証チェック

ルートルートの `beforeLoad` で `authClient.getSession()` を呼び、未認証なら
`/login` にリダイレクトする。`/login` ページだけはチェックをスキップする。

```tsx
// apps/web/src/routes/__root.tsx
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
    // ...
});
```

`_authenticated.tsx` のような専用の認証 layout route は **存在しない**。認証
チェックは `__root.tsx` の `beforeLoad` 一箇所、外側 shell の出し分けは同じ
ファイル内の `RootComponent` で行う、という設計になっている。

### 2. `RootComponent` で shell を出し分ける

`useLocation().pathname` を見て、`/login` のときだけ `<Outlet />` を裸で出し、
それ以外では `AuthenticatedShell` で包む。Theme provider と Sonner Toaster は
両方共通。

```tsx
// apps/web/src/routes/__root.tsx
export function RootComponent() {
    const { pathname } = useLocation();
    const isLoginPage = pathname === "/login";

    return (
        <>
            <HeadContent />
            <ThemeProvider attribute="class" defaultTheme="dark" ...>
                {isLoginPage ? (
                    <Outlet />
                ) : (
                    <AuthenticatedShell>
                        <Outlet />
                    </AuthenticatedShell>
                )}
                <Toaster position="top-right" richColors />
            </ThemeProvider>
        </>
    );
}
```

### 3. `AuthenticatedShell` が `children` を中央に流す

上述のとおり、`AuthenticatedShell` は context provider 群 → サイドバー →
オンラインステータスバー → スクロール領域（ここに `children` が入る）→ モバイル
ナビ → グローバル sheet、という構成。`/dashboard` の場合、`children` には
TanStack Router が解決した `routes/dashboard.tsx` の `Route.component` が入る。

### 4. ルートファイルがページ component を読み込む

`routes/dashboard.tsx` は薄く、`createFileRoute` で `DashboardPage` を component
として登録するだけ。

```tsx
// apps/web/src/routes/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/dashboard/components/dashboard-page";

export const Route = createFileRoute("/dashboard")({
    component: DashboardPage,
});
```

### 5. ページ component の最初の子が `PageHeader`

`DashboardPage` は `useDashboardPage()` から state と handler を取り、外側を
`<div className="p-4 md:p-6">` で囲み、**その最初の子として `PageHeader` を
レンダーする**。`actions` には編集モードのトグルと「追加」メニューを並べる。

```tsx
// apps/web/src/features/dashboard/components/dashboard-page/dashboard-page.tsx
return (
    <div className="p-4 md:p-6">
        <PageHeader
            actions={
                <>
                    {isEditing ? <AddWidgetMenu onSelect={handleAdd} /> : null}
                    <EditModeToggle isEditing={isEditing} onToggle={handleDoneClick} />
                </>
            }
            heading="Dashboard"
        />
        {/* ... 本文 ... */}
    </div>
);
```

同じ形は `routes/players/index.tsx` でも踏襲されている。

```tsx
// apps/web/src/routes/players/index.tsx（抜粋）
return (
    <div className="p-4 md:p-6">
        <PageHeader
            actions={
                <>
                    <Button onClick={() => setIsTagManagerOpen(true)} size="sm" variant="outline">
                        <IconTags size={16} />
                        Manage Tags
                    </Button>
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <IconPlus size={16} />
                        New Player
                    </Button>
                </>
            }
            heading="Players"
        />
        {/* ... 本文 ... */}
    </div>
);
```

### 6. ログインだけは別系統

`/login` の場合、`__root.tsx` は `AuthenticatedShell` を通さず `<Outlet />`
を裸で出すので、ルート側で `PublicPageShell` を直接使う。`children` には
`SignInForm` / `SignUpForm` が入り、それらの内部で `AuthFormShell` を呼ぶ。

```tsx
// apps/web/src/routes/login.tsx
return (
    <PublicPageShell
        aside={
            <PageSection
                description="Choose the auth method that fits your setup ..."
                heading="Why sign in here"
            >
                <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>Resume your dashboard and current live-session flow.</li>
                    {/* ... */}
                </ul>
            </PageSection>
        }
        description="Use the same shared auth flow ..."
        eyebrow="Authentication"
        title={showSignIn ? "Welcome back." : "Create your account."}
    >
        <PreviewAutoLogin />
        {showSignIn ? (
            <SignInForm onSwitchToSignUp={onSwitchToSignUp} />
        ) : (
            <SignUpForm onSwitchToSignIn={onSwitchToSignIn} />
        )}
    </PublicPageShell>
);
```

## 決定と理由

### `PageHeader` をプロジェクト全体で必須にした理由

`.claude/rules/web-ui.md` に **"Every top-level page composes its header with
`PageHeader`. ... Do not hand-roll page titles or action rows."** と明文化さ
れている。理由はシンプルで、

- タイトルのフォントサイズ（`text-2xl font-bold`）と下マージン（`mb-6`）、
  説明文の色（`text-muted-foreground text-sm`）、アクション列の `gap-2` と
  `flex-wrap` が、自動的に全ページで揃う。
- アクション列が `shrink-0` + `flex-wrap`、タイトル側が `min-w-0 flex-1` という
  「タイトル省略・アクションは折り返し」の組み合わせも、ページごとに思い出さず
  に済む。

実際に `<h1>` を直書きしているのは shell 部品自身（`PageHeader`,
`PublicPageShell`, `AuthFormShell`）の **3 ファイルだけ**。ページ component
には `<h1>` の直書きが 0 件（`rg '<h1' apps/web/src` で確認済み）。

### 認証 shell と public shell を分離した理由

`AuthenticatedShell` はサイドバー / モバイルナビ / オンラインステータス /
グローバル sheet とそれらが要求する context provider 群を抱えている。これらは
未認証ページでは

- 表示する意味がない（ナビ先のページが全部 redirect で `/login` に戻る）
- そもそも provider 内部で認証済みの tRPC コンテキストを前提にしている可能性
  がある

ため、ログイン画面でこの shell を通すと無駄なリクエストと redirect ループの
リスクが出る。これを避けるため、`/login` だけは `__root.tsx` の `RootComponent`
で分岐させ、`PublicPageShell`（純粋なレイアウトのみ、認証依存なし）を経由する
ようにしている。

### サイドバー / モバイルナビを `AuthenticatedShell` が直接持つ理由

ナビゲーション部品（`SidebarNav`, `MobileNav`）は、

- 認証済みであることが前提（`UserMenu` を含む）
- アプリ全体で 1 つだけ存在する
- 表示位置が固定（左固定 / 下固定）でルートに依存しない

という性質を持つ。これらは `AuthenticatedShell` の中で「サイドバー →
本文 → モバイルナビ」の順に並べ、本文だけを `overflow-auto` のコンテナで
括ることで、

- サイドバー / モバイルナビは固定位置にとどまる（`fixed inset-y-0 left-0`,
  `fixed inset-x-0 bottom-0`）
- 本文の縦スクロールがナビと干渉しない
- モバイル時に下部 `pb-16` のセーフエリアを取る箇所が 1 箇所に集約される

という形になっている。ページ側はナビの存在を一切意識せず、`<div className="p-4
md:p-6">` で本文を始められる。

### shell が `<Outlet />` を出す境界の位置

TanStack Router の `<Outlet />` が呼ばれるのは `__root.tsx` の `RootComponent`
のみ。`AuthenticatedShell` 自身は `children: ReactNode` を受け取るだけで
`Outlet` を内蔵しない。つまり境界は、

```
__root.tsx                  ← Outlet を呼ぶ唯一の場所
  └─ AuthenticatedShell     ← 受け取った Outlet を children として描画するだけ
       └─ <Outlet />        ← ここで実際のページが流れる
            └─ ページ component (最初の子は PageHeader)
```

`_authenticated.tsx` のような中間 layout route を **置かない** という決定が
あり、認証チェック + shell 切替を 1 ファイルにまとめてある。layout route を
切らない代わりに、shell が認証ごとに切り替わる単純な if 分岐で済ませている。

## 落とし穴

- **`PageHeader` を経由せず `<h1>` を直書きしているページは現状なし。**
  ただし shell コンポーネントの内部（`page-header.tsx`, `public-page-shell.tsx`,
  `auth-form-shell.tsx`）には `<h1>` がある。ページ component に `<h1>` を直書き
  しようとした場合は、`PageHeader.heading` に `ReactNode` を渡せば十分なケースが
  ほとんどなので、まずそちらを検討すること。
- **ページ component の最初の子が `PageHeader` でないと余白が狂う。** `PageHeader`
  は自分で `mb-6` を持つので、その上に別の要素（フィルタ行など）を挟むと縦の
  リズムが崩れる。`PageHeader` の上には何も置かない、を慣習として守ること。
- **`AuthenticatedShell` は context provider を抱えている。** `SessionFormProvider`
  / `StackSheetProvider` / `UpdateNotesProvider` は shell の中でしか提供されない
  ので、Storybook 等で shell の外でページ component を直接マウントすると、
  これらの context を消費する子 component が落ちる。プレビュー時はテスト用の
  wrapper が必要になる。
- **`AuthenticatedShell` は `LiveStackFormSheet` と `UpdateNotesSheet` を常に
  マウントしている。** これらは内部の context state で開閉が制御されているが、
  「閉じている時もマウントはされている」ことを忘れて、`useEffect` 系を増やすと
  全ページに副作用が乗る。新しいグローバル sheet を追加するときは、開閉以外の
  処理を必ず `provider` 側の state にガードさせる。
- **shell とページの責務境界がやや曖昧な点。** 現状、`<div className="p-4 md:p-6">`
  という「本文側のパディング」をページ component ごとに繰り返し書いている
  （`DashboardPage`, `PlayersPage`, `SettingsPage`, ...）。これは shell 側に
  寄せられる候補だが、リライト前の現状では各ページが自前で書いている。
- **`PageHeader` の `actions` API の揺れ。** `actions` は `ReactNode` を 1 つ
  受け取る API なので、複数 `Button` を並べたいときはページ側で `<>...</>` を
  書く。各ページが
  - `actions={<> <Button>A</Button> <Button>B</Button> </>}` の形（players,
    dashboard など）
  - `actions={<Button>X</Button>}` の単体形（stores/$storeId, settings,
    active-session-scene など）

  を使い分けており、`actions` 側の `size` や `variant` も全ページで揃って
  いない（`size="sm" variant="outline"` を付けるページと、デフォルトのままの
  ページが混在）。プロダクトレベルで「アクションボタンの密度」を整えるなら、
  この層の規約をリライト時に検討する余地がある。
- **`PublicPageShell` の左カラムは `hidden lg:block`。** `lg` 未満のビューポート
  では `title` / `description` / `eyebrow` / `actions` / `aside` がすべて
  描画されない（DOM には存在するが `display: none`）。SEO 的なタイトルは
  `HeadContent` 側（`__root.tsx` の `head()`）で別途付ける必要がある。
  ログインページ本体に左カラムのテキストが見えないからといって、
  `title` を空にしてはいけない。

## 関連

- ナビゲーション側の作り（サイドバー / モバイルナビ / `app-navigation`）:
  [`02-navigation-routing.md`](./02-navigation-routing.md)
- モバイル時の Drawer / bottom sheet の規約（`AuthenticatedShell` の
  `pb-16 md:pb-0` と一緒に効いてくる）:
  [`06-mobile-drawer.md`](./06-mobile-drawer.md)
- 認証フロー全体（`authClient.getSession()` → redirect → `PublicPageShell`）:
  [`09-auth-flow.md`](./09-auth-flow.md)
- UI 全般の規約: [`../../../.claude/rules/web-ui.md`](../../../.claude/rules/web-ui.md)
