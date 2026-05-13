# Theming, Icons & Formatters

`apps/web/` の「見た目の基盤」をまとめたアーカイブ。Tailwind v4 の CSS-first トークン定義、`next-themes` を介したダーク/ライト切替、`@tabler/icons-react` 一本化、そして `utils/format-*` の表示用フォーマッタ群を「現状どう組み立てているか / なぜそうしているか」の観点で記録する。リライトでデザイントークン体系を入れ替える際にも、ここでの決定がどの層を握っていたかを参照できるようにする。

## 何を解決しているか

UI を構成する「色・タイポ・アイコン・数値の見せ方」を、コンポーネント本体から切り離してアプリ全体で一貫させること。具体的には次の 4 軸：

1. **色トークン**: 背景 / 前景 / プライマリ / ミュート / 破壊的操作 / サイドバー / チャート用など、shadcn 流の命名で `--background` / `--foreground` / `--primary` 等を `oklch()` で定義し、Tailwind v4 の `@theme inline` から `--color-*` エイリアスとして公開する。
2. **ダーク/ライト切替**: `next-themes` の `ThemeProvider` で `<html>` に `.dark` クラスを付与する戦略を採り、`@custom-variant dark (&:is(.dark *))` で Tailwind の `dark:` バリアントに紐付ける。デフォルトは `dark`、ストレージキーは `vite-ui-theme`。
3. **アイコン体系**: 機能アイコンは `@tabler/icons-react` に一本化し、`Icon*` 名で揃える。`lucide-react` は規約上の新規禁止だが、ModeToggle と Loader の 2 ファイルにだけ残存している（リライト時に撤去予定）。OAuth プロバイダロゴ（Google / Discord）だけは `shared/components/icons/` に自前 SVG として置く。
4. **数値 / 通貨 / 時間 / テーブルサイズの表示統一**: `utils/format-*` 配下のピュア関数（`formatCompactNumber` / `formatProfitLoss` / `formatElapsedTime` / `formatYmdSlash` / `getTableSizeClassName`）を経由して必ず文字列化する。コンポーネント側で `toLocaleString()` を直書きしない。

これにより、リライトで「色だけ差し替えたい」「アイコンセットを別物に置き換えたい」「数値の桁区切りや単位ルールを変えたい」をそれぞれ独立にできる構造を保っている。

## 中心となる部品

### Tailwind v4 + shadcn のテーマ定義（[`apps/web/src/index.css`](../../../apps/web/src/index.css)）

Tailwind v4 は CSS-first 設定なので、`tailwind.config.{js,ts}` は存在しない（リポジトリ全体に該当ファイル無し）。`index.css` 1 ファイルに `@import "tailwindcss"`、`@theme inline { … }`、`@custom-variant dark (&:is(.dark *))`、`:root` / `.dark` の CSS 変数群、`@layer base` まで集約する。エントリ側冒頭は次の通り：

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist-mono";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:is(.dark *));
```

色トークンはすべて `oklch()` で記述する（HSL ではない）。例：

```css
:root {
	--background: oklch(0.97 0.005 250);
	--foreground: oklch(0.15 0.008 250);
	--primary: oklch(0.45 0.16 250);
	--destructive: oklch(0.58 0.22 27);
	--radius: 0.45rem;
	--sidebar: oklch(0.95 0.005 250);
	/* … chart-1〜5、sidebar-* なども同様 */
}

.dark {
	--background: oklch(0.14 0.008 250);
	--foreground: oklch(0.85 0 0);
	--primary: oklch(0.72 0.16 250);
	/* … */
}
```

これらの CSS 変数を Tailwind のユーティリティから `bg-background` / `text-foreground` / `border-border` のように使えるよう、`@theme inline` で `--color-*` エイリアスを張る：

```css
@theme inline {
	--font-sans: "Inter Variable", sans-serif;
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-primary: var(--primary);
	--color-destructive: var(--destructive);
	--color-sidebar: var(--sidebar);
	--radius-sm: calc(var(--radius) - 4px);
	--radius-md: calc(var(--radius) - 2px);
	--radius-lg: var(--radius);
	--font-mono: "Geist Mono Variable", monospace;
}
```

`@layer base` で全要素の `border` / `outline` 既定値と `body` のフォント / 背景を当てる：

```css
@layer base {
	* {
		@apply border-border outline-ring/50;
	}
	body {
		@apply font-mono bg-background text-foreground;
	}
	html {
		@apply font-mono;
	}
}
```

`body` / `html` がデフォルトで `font-mono`（Geist Mono Variable）になっている点は意図的で、sapphire2 は「数値が読みやすい等幅」を全体ベースラインにしている。

### shadcn 設定（[`apps/web/components.json`](../../../apps/web/components.json)）

```json
{
	"style": "radix-nova",
	"tailwind": { "config": "", "css": "src/index.css", "baseColor": "neutral", "cssVariables": true },
	"iconLibrary": "tabler",
	"aliases": { "components": "@/components", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```

ポイントは 3 つ：

- `tailwind.config: ""`：v4 の CSS-first を明示。
- `baseColor: "neutral"` + `cssVariables: true`：色は CSS 変数経由で差し替え可能に。
- `iconLibrary: "tabler"`：`bunx shadcn add` 系で追加されるコンポーネントが Tabler を使うよう固定。

### ThemeProvider と ModeToggle

[`apps/web/src/shared/components/theme-provider/theme-provider.tsx`](../../../apps/web/src/shared/components/theme-provider/theme-provider.tsx) は `next-themes` の `ThemeProvider` を再エクスポートしているだけの薄いラッパ：

```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

export function ThemeProvider({
	children,
	...props
}: React.ComponentProps<typeof NextThemesProvider>) {
	return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

実際の差し込みは [`apps/web/src/routes/__root.tsx`](../../../apps/web/src/routes/__root.tsx) の `RootComponent` で行う：

```tsx
<ThemeProvider
	attribute="class"
	defaultTheme="dark"
	disableTransitionOnChange
	storageKey="vite-ui-theme"
>
	{isLoginPage ? <Outlet /> : <AuthenticatedShell><Outlet /></AuthenticatedShell>}
	<Toaster position="top-right" richColors />
</ThemeProvider>
```

`attribute="class"` で `<html class="dark">` に切替、`disableTransitionOnChange` で切替時のフラッシュを抑制、`storageKey="vite-ui-theme"` で `localStorage` に保存する。

切替 UI は [`apps/web/src/shared/components/mode-toggle/mode-toggle.tsx`](../../../apps/web/src/shared/components/mode-toggle/mode-toggle.tsx)。`next-themes` の `useTheme()` を直接呼ぶ「shared 内 composite」で、3 択（Light / Dark / System）のドロップダウン。`useTheme` は third-party hook なので、本来 `.claude/rules/web-hooks-separation.md` の禁止対象だが、ここは shared composite なので例外として直書きが残っている（リライトで `use-mode-toggle.ts` に切り出す候補）。

### アイコン: `@tabler/icons-react` 一本

`@tabler/icons-react` のインポートは 53 箇所 / 52 ファイルに分散している。代表例（[`apps/web/src/shared/components/app-navigation/app-navigation.tsx`](../../../apps/web/src/shared/components/app-navigation/app-navigation.tsx)）：

```tsx
import {
	IconBolt,
	IconBuildingStore,
	IconCards,
	IconCategory,
	IconCoins,
	IconLayoutDashboard,
	IconList,
	IconSettings,
	IconUsers,
} from "@tabler/icons-react";

export const SIDEBAR_ITEMS: readonly NavigationItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
	{ to: "/sessions", label: "Sessions", icon: IconCards },
	{ to: "/active-session", label: "Active session", icon: IconBolt, matchPaths: ["/active-session"] },
	{ to: "/stores", label: "Stores", icon: IconBuildingStore },
	{ to: "/players", label: "Players", icon: IconUsers },
	{ to: "/currencies", label: "Currencies", icon: IconCoins },
	{ to: "/settings", label: "Settings", icon: IconSettings },
] as const;
```

`NavigationItem.icon` の型は `ComponentType<{ size?: number; stroke?: number; className?: string }>` で、Tabler のプロパティ（`size` / `stroke`）をそのまま受けられる。

OAuth プロバイダロゴだけは Tabler に無いため、`shared/components/icons/google.tsx` / `discord.tsx` に自前 SVG として持つ：

```tsx
export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
	return <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>{/* paths */}</svg>;
}
```

### フォーマッタ（`apps/web/src/utils/`）

すべて hook 外のピュア関数。React の依存を持たないので、テストは `web-node` プロジェクトで動く。

| ファイル | 公開シグネチャ | 用途 |
|---|---|---|
| [`format-number.ts`](../../../apps/web/src/utils/format-number.ts) | `formatCompactNumber(value: number): string` | 10,000 以上で `k` / `M` / `B` の単位を付ける compact 表記。それ未満は `toLocaleString()` |
| 〃 | `createGroupFormatter(values: (number \| null \| undefined)[]): (value: number) => string` | グループ内の最大絶対値で tier を固定し、全要素を同じ単位で揃える |
| 〃 | `formatYmdSlash(input: string \| Date): string` | `YYYY/MM/DD` |
| [`format-profit-loss.ts`](../../../apps/web/src/utils/format-profit-loss.ts) | `formatProfitLoss(value, { currencyUnit?, nullDisplay? }): string` | 損益表示。プラスに `+` を付け、null は `—`（または `nullDisplay`） |
| 〃 | `profitLossColorClass(value): string` | `text-green-600 dark:text-green-400` / `text-red-600 dark:text-red-400` / 空文字 |
| [`format-elapsed-time.ts`](../../../apps/web/src/utils/format-elapsed-time.ts) | `formatElapsedTime(startedAt: Date \| string \| number \| null \| undefined): string` | `"3h 12m"` / `"42m"` / `"—"` |
| [`table-size-colors.ts`](../../../apps/web/src/utils/table-size-colors.ts) | `getTableSizeClassName(size: number): string` | 卓のサイズ 2〜10 に Tailwind の bg/text クラスを割り当てるマップ |

`formatCompactNumber` の内部はシンプルなしきい値分岐で、`Intl.NumberFormat` の compact notation には依存していない（後述 "落とし穴"）：

```ts
const TRAILING_ZERO = /\.0$/;

export function formatCompactNumber(value: number): string {
	if (Math.abs(value) >= 10_000_000_000) {
		return `${(value / 1_000_000_000).toFixed(1).replace(TRAILING_ZERO, "")}B`;
	}
	if (Math.abs(value) >= 10_000_000) {
		return `${(value / 1_000_000).toFixed(1).replace(TRAILING_ZERO, "")}M`;
	}
	if (Math.abs(value) >= 10_000) {
		return `${(value / 1000).toFixed(1).replace(TRAILING_ZERO, "")}k`;
	}
	return value.toLocaleString();
}
```

「経過時間をリアルタイム更新したい」ケースだけは別途 hook 化されている：[`apps/web/src/shared/hooks/use-elapsed-time.ts`](../../../apps/web/src/shared/hooks/use-elapsed-time.ts)。1 分（`60_000ms`）ごとに `formatElapsedTime` を再計算し、`setInterval` を `useEffect` のクリーンアップで `clearInterval` する。`use-cash-game-compact-summary.ts` / `use-tournament-compact-summary.ts` / `active-session-widget.tsx` から使用。

## 典型フロー

### テーマ切替

1. ユーザーが `ModeToggle`（サイドナビ下部 / モバイルでのユーザーメニュー脇）の `Sun` / `Moon` ボタンを押し、ドロップダウンから "Dark" を選択。
2. `mode-toggle.tsx` 内の `useTheme()` から取った `setTheme("dark")` が呼ばれる。
3. `next-themes` が `localStorage["vite-ui-theme"] = "dark"` を書き、`document.documentElement.classList` に `dark` を付与（`attribute="class"` のため）。
4. `index.css` の `@custom-variant dark (&:is(.dark *))` が `.dark` 子孫を捕まえ、`.dark { … }` ブロックの CSS 変数が有効化。
5. Tailwind ユーティリティ（`bg-background` / `text-foreground` / `dark:text-green-400` 等）が新しい変数値を参照し、全画面が再描画される。`disableTransitionOnChange` のためフラッシュは出ない。

`defaultTheme="dark"` なので、初回アクセスは `localStorage` 未設定 → `dark` で起動する。

### 数値表示

1. tRPC procedure から `{ amount: 12345, currency: { unit: "JPY" } }` が返る。
2. コンポーネント本体は描画だけなので、`use-<component>.ts` 側で次のように整形：

```ts
const display = formatProfitLoss(amount, { currencyUnit: currency?.unit });
const colorClass = profitLossColorClass(amount);
```

3. JSX で `<span className={colorClass}>{display}</span>` のように消費する。
4. 同じ画面に複数の数値が並ぶ場合（例: ダッシュボードの通貨残高ウィジェット）、`createGroupFormatter` で tier を揃える：

```ts
const fmt = createGroupFormatter(currencies.map((c) => c.balance));
const rows = currencies.map((c) => ({ label: c.unit, value: fmt(c.balance) }));
```

### 経過時間表示

ライブセッション中の「卓に座って何時間経ったか」など：

```ts
const elapsed = useElapsedTime(session.startedAt); // "2h 47m" を 1 分ごとに更新
```

`startedAt` を変えると即時再計算し、`setInterval` も差し替わる。

## 決定と理由

| # | 決定 | 理由 |
|---|---|---|
| 1 | **Tailwind v4 を採用、CSS-first（`@theme inline`）でトークン管理** | v3 系の JS 設定ファイル分離より、`index.css` 1 ファイルに `--background` 等の CSS 変数と Tailwind ユーティリティのマッピングを集約できる方が、テーマ差し替えやリライトの diff が読みやすい。`tailwind.config.{js,ts}` を持たないことでビルド設定の表面積も減る。 |
| 2 | **色は `oklch()` で記述する** | sRGB / HSL より知覚的な明度・色相のステップが揃いやすく、ダーク/ライトの対比を作る際にチャネル分離（L / C / H）で調整できる。chart-1〜5 のような系列色も hue を 10〜20 ずつずらす運用で揃えやすい。 |
| 3 | **`next-themes` で `attribute="class"` 戦略**、`storageKey="vite-ui-theme"` | data 属性より CSS のクラス変種（`.dark`）と Tailwind の `dark:` バリアントの相性が良い。`@custom-variant dark (&:is(.dark *))` でセレクタ精度を保ちつつ、`disableTransitionOnChange` で切替時のチラつきを潰す。 |
| 4 | **デフォルトは `dark`** | ライブセッション中は店舗内の薄暗い環境で見ることが多く、白背景はまぶしい。`defaultTheme="dark"` でログイン直後から暗いまま起動する。 |
| 5 | **shadcn/ui の `components.json` を保持し、`iconLibrary: "tabler"`** | `bunx shadcn add` で新規プリミティブを追加する際にも Tabler に揃うよう固定。`cssVariables: true` で色は変数経由、ベース色は `neutral`。 |
| 6 | **アイコンは `@tabler/icons-react` 一本に統一** | スタイル一貫性（線の太さ・コーナー処理）の確保と、複数 icon ライブラリを抱え込んで bundle が重複するのを避ける目的。`.claude/rules/web-ui.md` および MEMORY の `feedback_icons.md` で「lucide-react は新規禁止」が明文化されている。OAuth ロゴだけはブランドガイドラインで自前 SVG。 |
| 7 | **フォーマッタは `utils/` のピュア関数として React 外で完結** | 経過時間の `useElapsedTime` のような「時間を進める」ケースだけが hook で、純粋な変換は hook にしない。`renderHook` を必要としない軽い node 環境テスト（`web-node` プロジェクト）で網羅できるため、`format-number.test.ts` / `format-profit-loss.test.ts` / `format-elapsed-time.test.ts` / `table-size-colors.test.ts` が境界値テストの教科書として機能する。 |
| 8 | **`formatCompactNumber` は `Intl.NumberFormat` を使わず手書き** | locale 依存を排除し、サーバ（Cloudflare Workers）でも同じ文字列を返せるよう書式を完全固定する。"k" / "M" / "B" の英語表記は UI 規約（English-only）と整合。 |
| 9 | **損益表示色は dark variant 込みでクラスを返す** | `profitLossColorClass` が `"text-green-600 dark:text-green-400"` を文字列として返すので、`profitLossColorClass(amount)` をそのまま `className` に渡せる。コンポーネント側で if 分岐しない。 |
| 10 | **`body` / `html` のデフォルトを `font-mono` (Geist Mono Variable)** | sapphire2 は数値の縦並びを多用する（卓のスタック表、損益、ブラインド表）。等幅をベースにすることで数字の桁ずれを抑える。見出しに sans を当てたい場合は局所的に `font-sans` を上書きする方針。 |

## 落とし穴

リライト時に再確認すべき点：

- **`lucide-react` 残骸**: 規約上「新規禁止」だが、現状 [`apps/web/src/shared/components/mode-toggle/mode-toggle.tsx`](../../../apps/web/src/shared/components/mode-toggle/mode-toggle.tsx)（`Moon`、`Sun`）と [`apps/web/src/shared/components/loader/loader.tsx`](../../../apps/web/src/shared/components/loader/loader.tsx)（`Loader2`）の 2 ファイルにインポートが残っている。`package.json` からも依存が抜けていない。リライトの一括差し替えタスクで Tabler の `IconSun` / `IconMoon` / `IconLoader2` 等に置き換え、依存を撤去すれば bundle が縮む。検証コマンド：

	```sh
	rg "from ['\"]lucide-react['\"]" apps/web/src
	```

	が 0 件になれば完了。

- **ダークモード時のコントラスト**: `.dark` 側で `--border: oklch(1 0 0 / 8%)`、`--input: oklch(1 0 0 / 12%)` のように半透明白を border に使っている。背景色の上に何度もレイヤする UI（モーダル on モーダル、サイドバー内カード）でコントラストが落ちる可能性がある。リライト時はレイヤごとの実効輝度を Storybook 等で確認すること。

- **`Intl.NumberFormat` を使わないことの逆説的な罠**: 「locale を増やすときに `formatCompactNumber` をどう国際化するか」の道筋が現状無い。English-only ルールの間は問題ないが、将来 i18n が入る場合は `format-*` を locale 渡しに作り替える必要がある。

- **Cloudflare Workers 上のフォーマッタ**: 現状フォーマッタはクライアント側からしか呼ばれない（サーバ tRPC は数値そのままを返す）。仮にサーバ側で同じフォーマットを再現したくなった場合、`utils/format-*` は `apps/web/src/utils` 配下にあるため `packages/` に共有する設計になっていない。プロモーション先（`packages/utils` 新設 など）はリライト判断対象。

- **`formatElapsedTime` の更新間隔と `setInterval` リーク**: `useElapsedTime(startedAt, intervalMs = 60_000)` は `useEffect` のクリーンアップで `clearInterval` するが、`intervalMs` を毎レンダー新規オブジェクトで渡すと interval が毎回張り直される。プリミティブ値（数値リテラル）で渡す前提。テストは [`apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts`](../../../apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts) が `vi.useFakeTimers()` でカバー済み（CLAUDE.md "Simple hook" のリファレンス実装）。

- **`@theme inline` のキャッシュ**: Tailwind v4 のビルドキャッシュは CSS 側の変更検知が弱いケースがある。`index.css` を編集しても dev サーバで反映されない場合は `.vite/` キャッシュを消すこと。

- **`storageKey="vite-ui-theme"` のテスト隔離**: テストでは `next-themes` 全体をモックする（[`apps/web/src/__tests__/authenticated-shell.test.tsx`](../../../apps/web/src/__tests__/authenticated-shell.test.tsx) の `ThemeProvider: ({ children }) => <>{children}</>` パターン）。テスト間で `localStorage` を汚さないために、`ThemeProvider` 自体をパススルーモックする方が安全。

- **`getTableSizeClassName` のフォールバック**: `TABLE_SIZE_COLORS[size] ?? "bg-muted text-muted-foreground"` で未定義サイズ（11 人卓など）はミュート色に落ちる。エラーにせず黙って色を失う設計なので、卓サイズの上限を増やす際は色も増やす必要がある。

- **mode-toggle が `useTheme` を直接呼ぶ**: `.claude/rules/web-hooks-separation.md` の STRICT 規約からすると逸脱（third-party hook を component から呼んでいる）。検証スクリプトには `useTheme` が列挙されていないので grep は通るが、リライトで一貫性を取るなら `use-mode-toggle.ts` を作って `setTheme` を返すべき。

## 関連

- [`./00-overview.md`](./00-overview.md) — 全体設計原則、本ファイルの位置付け
- [`./01-page-shell.md`](./01-page-shell.md) — `__root.tsx` での `ThemeProvider` 差し込み位置、`AuthenticatedShell` 内のサイドナビ
- [`./04-shared-and-ui-primitives.md`](./04-shared-and-ui-primitives.md) — shadcn プリミティブの採用範囲
- [`.claude/rules/web-ui.md`](../../../.claude/rules/web-ui.md) — アイコン規約、PageHeader、English-only
- MEMORY: [`feedback_icons.md`](../../../.claude/projects/) — `@tabler/icons-react` 一本化の incident
- 実装ファイル：
	- [`apps/web/src/index.css`](../../../apps/web/src/index.css) — Tailwind v4 トークン定義
	- [`apps/web/components.json`](../../../apps/web/components.json) — shadcn 設定
	- [`apps/web/src/shared/components/theme-provider/theme-provider.tsx`](../../../apps/web/src/shared/components/theme-provider/theme-provider.tsx)
	- [`apps/web/src/shared/components/mode-toggle/mode-toggle.tsx`](../../../apps/web/src/shared/components/mode-toggle/mode-toggle.tsx)
	- [`apps/web/src/shared/components/app-navigation/app-navigation.tsx`](../../../apps/web/src/shared/components/app-navigation/app-navigation.tsx) — Tabler アイコン使用例
	- [`apps/web/src/utils/format-number.ts`](../../../apps/web/src/utils/format-number.ts) / [`format-profit-loss.ts`](../../../apps/web/src/utils/format-profit-loss.ts) / [`format-elapsed-time.ts`](../../../apps/web/src/utils/format-elapsed-time.ts) / [`table-size-colors.ts`](../../../apps/web/src/utils/table-size-colors.ts)
	- [`apps/web/src/shared/hooks/use-elapsed-time.ts`](../../../apps/web/src/shared/hooks/use-elapsed-time.ts)
