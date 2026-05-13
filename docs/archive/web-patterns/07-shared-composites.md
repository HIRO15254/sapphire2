# Shared Composites — 横断的な複合コンポーネント

> UI リライト前の現状記録。`apps/web/src/shared/components/` に存在する、
> shadcn primitive の **上のレイヤー** に位置する複合コンポーネント群を、
> 実装ファイルを根拠にまとめる。shadcn primitive そのもの（Button / Input /
> Dialog / Drawer / Select / Table / Badge / Avatar / Card など）は本書では
> 扱わない。ページ外枠と認証 shell は
> [`01-page-shell.md`](01-page-shell.md) で扱っているので、本書は「**ページの
> 中身を組み立てる側**」の wrapper にフォーカスする。

> **⚠️ 次の UI では捨てる/縮小するパターン**: リライトでは「可能な限り `shadcn/ui` の
> カスタマイズで UI を構成する（props / className / 派生バリアントの追加で済ませ、
> 自作複合 component の新設は最終手段）」という方針が決まっている。したがって
> 本書で扱う `management/*`（`ManagementList` / `EntityListItem` / `TagManager` /
> `ExpandableItemList` / `SectionHeader` ほか）や `filter-dialog-shell` は、
> 原則として新 UI には引き継がない前提で読むこと。読者は「過去はどの抽象を作り、
> 何が辛くなって肥大化したのか」という観点で参照し、shadcn の手前で止める判断
> 材料に使うこと。詳細は `00-overview.md` の「次の UI リライトで変更が決まって
> いる方針」を参照。

## 何を解決しているか

sapphire2 web は feature ごとにほぼ同じ形のページを持っている。

- **一覧ページ**: `PageHeader` の下に「カード型の行が縦に並ぶ」リスト。各行は
  「サマリー（折りたたまれた見出し）」と「展開した本文」と「Edit / Delete の
  アクション行」を持つ。
- **タグ / 種別の管理ダイアログ**: 既存タグの一覧 + 「+ New」ボタン +
  Edit / Delete の確認ダイアログ。中身のフォームだけが feature 固有。
- **フィルタダイアログ**: 「Filter (n)」ボタンと、開くと出る `ResponsiveDialog`
  と、Apply / Reset のアクション行。中身のフィールドだけが feature 固有。
- **アコーディオン形式の一覧**: 1 行クリックで詳細が下に展開する形。
  `stores/$storeId.tsx` のトーナメント一覧・リング一覧などで使われる。

これを feature ごとに [`management-list`](../../../apps/web/src/shared/components/management/management-list/management-list.tsx)
/ アコーディオン / 確認ダイアログを手書きすると、

- 角丸・border・padding がページ間でズレる
- delete 確認 UI（インライン「Delete?」 → Confirm / Cancel）の挙動が feature
  ごとに微妙に違う
- 展開状態（accordion）の controlled / uncontrolled API が毎回再発明される
- フォーカス管理・mobile vs desktop（`Drawer` vs `Dialog`）の出し分けがバラつく

…という現象が必ず出る。そこで `apps/web/src/shared/components/management/` と
`apps/web/src/shared/components/filter-dialog-shell/` 配下に、shadcn primitive
の薄い wrapper をいくつか置いて、「list / form / detail の同じ形」を 1 箇所に
集約している。

`CLAUDE.md` の "Promote to shared/ only when a second feature imports it" に
従い、ここに上がっているものは **必ず 2 つ以上の feature から呼ばれている**
（後述「決定と理由」参照）。

## 中心となる部品

| 名前 | ファイルパス | 主要 props | 想定使用箇所 | 使用例（呼んでいる feature） |
|---|---|---|---|---|
| `ManagementList` / `ManagementListItem` | [`shared/components/management/management-list/management-list.tsx`](../../../apps/web/src/shared/components/management/management-list/management-list.tsx) | `ManagementListItem`: `title` (必須), `description?`, `leading?`, `actions?`, `children?` | 軽量な縦リスト。展開状態を持たない「タイトル + 右側アクション」の繰り返し | [`TagManager`](../../../apps/web/src/shared/components/management/tag-manager/tag-manager.tsx) のタグ一覧、[`LinkedAccounts`](../../../apps/web/src/shared/components/linked-accounts/linked-accounts.tsx) の OAuth プロバイダ一覧 |
| `ExpandableItemList` / `ExpandableItem` | [`shared/components/management/expandable-item-list/expandable-item-list.tsx`](../../../apps/web/src/shared/components/management/expandable-item-list/expandable-item-list.tsx) | `ExpandableItemList`: `value`, `onValueChange` (両方 optional) / `ExpandableItem`: `value` (必須), `summary` (必須), `summaryClassName?`, `contentClassName?` | shadcn `Accordion` (`type="single"`, `collapsible`) を「常に最大 1 つ展開」の formで包んだもの。アコーディオン UI 全般 | [`tournament-tab.tsx`](../../../apps/web/src/features/stores/components/tournament-tab/tournament-tab.tsx) と [`ring-game-tab.tsx`](../../../apps/web/src/features/stores/components/ring-game-tab/ring-game-tab.tsx) のゲーム一覧、`EntityListItem` の内部実装 |
| `EntityListItem` | [`shared/components/management/entity-list-item/entity-list-item.tsx`](../../../apps/web/src/shared/components/management/entity-list-item/entity-list-item.tsx) | `summary` (必須), `children` (必須), `onEdit` (必須), `onDelete` (必須), `deleteLabel` (必須), `actions?`, `expandedValue?`, `onExpandedValueChange?` | 「クリックで展開、展開すると詳細 + Edit / Delete アクション行が出る」標準のリスト行。controlled / uncontrolled 両対応 | [`PlayerCard`](../../../apps/web/src/features/players/components/player-card/player-card.tsx)、[`SessionCard`](../../../apps/web/src/features/sessions/components/session-card/session-card.tsx)、[`CurrencyCard`](../../../apps/web/src/features/currencies/components/currency-card/currency-card.tsx) |
| `TagManager<TTag>` | [`shared/components/management/tag-manager/tag-manager.tsx`](../../../apps/web/src/shared/components/management/tag-manager/tag-manager.tsx) | `tags` (必須), `onDelete` (必須), `renderCreateForm` / `renderEditForm` / `renderDeleteDescription` (必須 render prop), `renderTagLabel?`, `noun?`, `emptyHeading?`, `emptyDescription?`, `deleteError?`, `isDeletePending?` | 「タグ / 種別の名前と色を管理する」モーダル UI 全体。Create / Edit / Delete の 3 つの `ResponsiveDialog` を内包 | [`PlayerTagManager`](../../../apps/web/src/features/players/components/player-tag-manager/player-tag-manager.tsx)、[`SessionTagManager`](../../../apps/web/src/features/sessions/components/session-tag-manager/session-tag-manager.tsx)、[`TransactionTypeManager`](../../../apps/web/src/features/currencies/components/transaction-type-manager/transaction-type-manager.tsx) |
| `TagNameForm` | [`shared/components/management/tag-name-form/tag-name-form.tsx`](../../../apps/web/src/shared/components/management/tag-name-form/tag-name-form.tsx) | `defaultName?`, `isLoading?`, `onSubmit: (name) => void`, `children?`（追加フィールドを差し込む slot） | `TagManager` の `renderCreateForm` / `renderEditForm` に差し込む「タグ名 1 個の最小フォーム」。`@tanstack/react-form` ベース | 上記 3 つの TagManager の中身 |
| `ManagementSectionHeader` | [`shared/components/management/management-section-header/management-section-header.tsx`](../../../apps/web/src/shared/components/management/management-section-header/management-section-header.tsx) | `heading` (必須), `controls?`, `action?` | サブセクションの見出し行（「Tournaments  [archive toggle]                [+]」のようなコンパクトな帯） | [`tournament-tab.tsx`](../../../apps/web/src/features/stores/components/tournament-tab/tournament-tab.tsx)、[`ring-game-tab.tsx`](../../../apps/web/src/features/stores/components/ring-game-tab/ring-game-tab.tsx)、[`CurrencyCard`](../../../apps/web/src/features/currencies/components/currency-card/currency-card.tsx) |
| `ManagementSectionState` | [`shared/components/management/management-section-state/management-section-state.tsx`](../../../apps/web/src/shared/components/management/management-section-state/management-section-state.tsx) | `<p>` の全 props（thin wrapper） | 「Loading...」「No tournaments yet.」のような、セクション内のミニ空状態テキスト | [`tournament-tab.tsx`](../../../apps/web/src/features/stores/components/tournament-tab/tournament-tab.tsx)、[`ring-game-tab.tsx`](../../../apps/web/src/features/stores/components/ring-game-tab/ring-game-tab.tsx) |
| `FilterDialogShell` | [`shared/components/filter-dialog-shell/filter-dialog-shell.tsx`](../../../apps/web/src/shared/components/filter-dialog-shell/filter-dialog-shell.tsx) | `activeCount` (必須), `open` / `onOpenChange` / `onOpen` / `onApply` / `onReset` (必須), `title` (必須), `children` (フィルタフィールド), `buttonLabel?`, `applyLabel?`, `resetLabel?`, `description?` | 「Filter (n)」ボタン + 開くと出る `ResponsiveDialog` + Apply / Reset のアクション行をまとめた wrapper | [`PlayerFilters`](../../../apps/web/src/features/players/components/player-filters/player-filters.tsx)、[`SessionFilters`](../../../apps/web/src/features/sessions/components/session-filters/session-filters.tsx) |
| `LinkedAccounts` | [`shared/components/linked-accounts/linked-accounts.tsx`](../../../apps/web/src/shared/components/linked-accounts/linked-accounts.tsx) | （props なし — 内部で `useLinkedAccounts()` 経由で Better Auth と直接通信） | 設定画面の「Email / Password」+ OAuth プロバイダ（Google / Discord）のリンク状態管理 UI。Set Password ダイアログを内包 | [`routes/settings.tsx`](../../../apps/web/src/routes/settings.tsx) からの単一呼び出し |

各 composite が何を抽象化しているか（簡単に）:

- **`ManagementList` / `Item`**: 「border + rounded-md + padding」の縦リストで、
  `leading` / `title` / `description` / `actions` のレイアウトを固定する。
  内部 state は持たない、純粋なプレゼンテーション wrapper。
- **`ExpandableItemList` / `Item`**: shadcn `Accordion` を `type="single"` /
  `collapsible` に固定。`value` を `string | null` に正規化して
  「未展開 = `null`」を扱えるようにする。
- **`EntityListItem`**: `ExpandableItemList` を 1 アイテムだけで使い、その中に
  「展開済み詳細 + Edit / Delete のアクション行」を組み込んだもの。
  Delete を押すと **インライン確認 UI**（"Delete this {label}?" + Confirm /
  Cancel）に切り替わる。この確認状態は `useEntityListItem` で局所管理される。
- **`TagManager`**: 「タグ / 種別」CRUD を render prop で受け取る generic な
  composite。フォームの中身は feature が `renderCreateForm` / `renderEditForm`
  で差し込む。
- **`TagNameForm`**: タグ名 1 個の最小 `@tanstack/react-form`。color picker など
  追加フィールドは `children` slot で差し込む（player-tag-manager で実例あり）。
- **`FilterDialogShell`**: 「フィルタを下書き → Apply で確定 / Reset で初期化」
  の UX 骨格だけを提供。フィールド自体は `children` として feature が組む。
- **`LinkedAccounts`**: `ManagementList` の上に Better Auth (`authClient`) を
  直接乗せた、設定画面専用の self-contained widget。

## 典型フロー

例として **currencies の一覧ページ**を取り上げる。`routes/currencies/index.tsx`
は `PageHeader` の下に `CurrencyCard` を縦に並べる。`CurrencyCard` は
`EntityListItem` を使って 1 通貨 1 行を描画し、展開すると `ManagementSectionHeader`
+ トランザクション一覧（`TransactionList`）を表示する。

```tsx
// routes/currencies/index.tsx（抜粋）
{currencies.map((c) => (
  <CurrencyCard
    currency={c}
    isExpanded={expandedCurrencyId === c.id}
    key={c.id}
    onAddTransaction={() => setAddTransactionCurrencyId(c.id)}
    onDelete={handleDelete}
    onEdit={setEditingCurrency}
    onExpandChange={(expanded) =>
      handleExpandedCurrencyChange(expanded ? c.id : null)
    }
    transactions={…}
  />
))}
```

`CurrencyCard` 側は `EntityListItem` に **controlled な展開状態** を渡し、
中身は `ManagementSectionHeader` を使う：

```tsx
// features/currencies/components/currency-card/currency-card.tsx（抜粋）
return (
  <EntityListItem
    deleteLabel="currency"
    expandedValue={isExpanded ? "details" : null}
    onDelete={() => onDelete(c.id)}
    onEdit={() => onEdit(c)}
    onExpandedValueChange={(value) => onExpandChange?.(value !== null)}
    summary={
      <div className="flex w-full items-center justify-between gap-2 text-left">
        <span className="truncate font-medium text-sm">{c.name}</span>
        <span className="shrink-0 font-semibold text-foreground text-sm">
          {formatCompactNumber(c.balance)}{c.unit ? ` ${c.unit}` : ""}
        </span>
      </div>
    }
  >
    <ManagementSectionHeader
      action={
        <Button onClick={onAddTransaction} size="sm" variant="outline">
          <IconPlus size={14} />Add
        </Button>
      }
      heading="Transaction History"
    />
    <TransactionList ... />
  </EntityListItem>
);
```

ここで `EntityListItem` が肩代わりしているのは、

- アコーディオンの開閉トリガー（クリック領域 + 矢印 chevron）
- 展開した本文の padding と border-top の区切り線
- 右下に並べる Edit / Delete ボタン
- Delete 押下時のインライン確認 UI（"Delete this currency?" → Confirm / Cancel）
- ↑のクリックの `stopPropagation`（親アコーディオンを閉じないため）

の 5 点。feature 側はカードの **summary（折りたたみ時）と children（展開時）の
中身に集中できる**。`PlayerCard` / `SessionCard` も同じパターンで、`summary` /
`children` の中身だけが違う。

## 決定と理由

### 「2 feature 以上で必要になってから shared に上げる」ルールの実例

`CLAUDE.md` には「Promote to `shared/` only when a second feature imports it.」
という運用ルールがある。本書で扱った composite は、すべて少なくとも 2 つの
feature から import されていることを確認した：

- `EntityListItem` → `features/players` / `features/sessions` /
  `features/currencies` の 3 feature
- `TagManager` + `TagNameForm` → `features/players` / `features/sessions` /
  `features/currencies` の 3 feature
- `ExpandableItemList` → `features/stores`（tournament-tab / ring-game-tab）
  + `EntityListItem` 内部（= 上記 3 feature 経由）
- `ManagementSectionHeader` → `features/stores` + `features/currencies`
- `ManagementSectionState` → `features/stores`（tournament-tab / ring-game-tab）
- `FilterDialogShell` → `features/players` / `features/sessions`
- `ManagementList` / `ManagementListItem` → `shared/components/linked-accounts` +
  `shared/components/management/tag-manager`（後者が前述の通り 3 feature から
  使われる）

唯一の例外的存在は `LinkedAccounts` で、これは現状 `routes/settings.tsx` から
しか呼ばれていない。ただしこれは feature ではなく「Better Auth との接続を
SettingsPage から切り離して単独テスト可能にする」目的の widget であって、
責務分離のための切り出しなので shared に置く判断自体は妥当。後述「落とし穴」
で再度触れる。

### `EntityListItem` を抽象化したことで何が楽になったか

`EntityListItem` 導入前、Player / Session / Currency それぞれの一覧行は

- shadcn `Accordion` を直接組み立て、
- 展開済み内部に `Edit` / `Delete` ボタンを置き、
- Delete のインライン確認 UI を独自に hand-roll する

という構造を **3 feature ぶん別々に持っていた**。これを `EntityListItem` に
寄せたことで、

1. **インライン Delete 確認 UI が 1 箇所に集約された**。confirm → onDelete →
   accordion を閉じる、というフローが [`use-entity-list-item.ts`](../../../apps/web/src/shared/components/management/entity-list-item/use-entity-list-item.ts)
   に局所化されている。
2. **展開状態の controlled / uncontrolled 両対応**: 現状 controlled で使って
   いるのは `CurrencyCard`（外側でアコーディオン排他制御をしたい）、
   uncontrolled は `PlayerCard` / `SessionCard`（行同士が独立）。同じ
   コンポーネントで両方扱える。
3. **アクションボタンのスタイル統一**: Edit / Delete はすべて `size="xs"` の
   ghost ボタン、Delete は `text-destructive`、というルックが固定。

### props 設計の選択

各 composite で採用している API スタイルが揃っていないので、列挙する：

- **`ManagementListItem` / `PageSection` / `ManagementSectionHeader`**:
  **slot prop** スタイル（`title`, `actions`, `description`, `leading`,
  `controls`, `action` などを `ReactNode` で受ける）。シンプルなレイアウト
  wrapper はだいたいこれ。
- **`EntityListItem`**: **slot prop + 状態 prop の組み合わせ**。`summary` /
  `children` / `actions` は slot、`expandedValue` / `onExpandedValueChange`
  は controlled API、`onEdit` / `onDelete` / `deleteLabel` は固定 action。
- **`TagManager<TTag>`**: **render prop + generic** スタイル。`renderCreateForm`
  / `renderEditForm` / `renderDeleteDescription` / `renderTagLabel` が
  `(tag: TTag, onClose) => ReactNode`。`TTag extends { id: string; name: string }`
  に制約を付けることで `TagItem`（player tag、color あり）と
  `TransactionType`（color なし）の両方を 1 つの composite で扱える。
- **`FilterDialogShell`**: **state は外部・骨組みだけを提供**するスタイル。
  `open` / `onApply` / `onReset` / `onOpenChange` をすべて外から渡し、
  draft state は feature 側の `useFilters` 系 hook が持つ
  （[`use-session-filters`](../../../apps/web/src/features/sessions/components/session-filters/use-session-filters.ts) など）。
- **`ExpandableItemList`**: **shadcn `Accordion` の薄い fallback** スタイル。
  `value === null` を「未展開」として正規化（shadcn は `""` を未展開とする）。
- **`TagNameForm`**: **children slot で追加フィールドを差し込む**スタイル。
  名前 1 個の最小フォームを基底とし、player の color picker などは
  `children` 経由で重ねる。

## 落とし穴

### 1 feature でしか使われていない composite が混じる

前述の通り、現状 `LinkedAccounts` は `routes/settings.tsx` 1 箇所からしか
呼ばれていない。**shared に置く正当性は「Better Auth 連携を SettingsPage から
切り離して単独テスト可能にする」点**であって、再利用ではない。再利用基準で
shared/ への昇格を見るルールに照らすと例外で、次に「他の場所からも認証連携を
出したい」という要求が来るまでは feature 化を見送るのが妥当。

`SetPasswordDialog` も `linked-accounts.tsx` の中で内部 component として
hoist されているだけで、別の場所からの再利用は無い。

### `EntityListItem` の展開状態管理が外部 hook ではなく内部 state

`useEntityListItem` は `useState` を直接持ち、`isControlled`（= `expandedValue`
prop が undefined でない）かどうかを引数で受け取って分岐する古典的な
controlled/uncontrolled 同居パターン。これは
[`web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md)
の「component が `useState` を直接呼ばない」ルールには **準拠している**
（hook 側に閉じている）が、注意点として：

- `expandedValue` を `undefined` から `string | null` に途中で切り替えると、
  `isControlled` の判定が反転して `internalExpandedValue` に書き戻されなく
  なる。逆も同様。**props の controlled 性は親コンポーネントの寿命の中で
  固定する**こと。`CurrencyCard` は常に `expandedValue` を渡している、
  `PlayerCard` / `SessionCard` は常に渡していない、という運用で整合している。
- delete 確認 state (`confirmingDelete`) は accordion を閉じると強制リセット
  されるが、controlled の場合に呼び出し側が `onExpandedValueChange` を無視
  すると確認 state が「展開済みのまま」残る。

### `ExpandableItemList` の `value` 正規化

shadcn `Accordion` (`type="single"`, `collapsible`) は「未展開」を `""` で
表現するが、`ExpandableItemList` は呼び出し側に **`string | null`** で公開
している。具体的には：

```ts
onValueChange={(nextValue) => onValueChange?.(nextValue || null)}
value={value ?? ""}
```

呼び出し側が `value=""` を「未展開」のつもりで渡しても、`ExpandableItem` の
`value` prop は **必ず非空文字列** にする必要がある（`""` を `value` にした
`ExpandableItem` を作ると、`Accordion` 側で「未展開状態」と区別できなくなる）。

### `TagManager` の generic 推論

`<TagManager<TTag extends { id: string; name: string }>>` は呼び出し側が
**明示的に `<TagItem>` を書いている** ケース（player-tag-manager）と、
**型推論に任せている** ケース（transaction-type-manager / session-tag-manager）
が混在している。`renderEditForm` の中で `tag` の型を `TTag` として参照したい
場合、推論が `{ id: string; name: string }` に潰れて color など独自フィールド
が見えなくなることがあるので、**player のように color 付きのタグを扱うときは
`<TagManager<TagItem>>` と明示する**こと。

### `TagNameForm` の children slot

`children` を `form` の中の `<form.Field name="name">` の **下**、submit
ボタンの **上**に挿入する設計。`children` 内で `form` API を直接触ることは
できない（hook が `tag-name-form.tsx` 内で `useTagNameForm({ name })` を作って
いるため、別フィールドの validation は外側の wrapper hook と通信する必要が
ある）。player tag の color picker が `useTagForm` という別 hook で
`selectedColor` を独立管理して、submit 時に `onSubmit({ name, color })` に
合流させているのはこのため。

### `FilterDialogShell` の Apply / Reset と draft state

`FilterDialogShell` 自体は draft state を持たない。`open` した時点の
フィルタを feature 側 hook が draft にコピーし、`onApply` で本物に commit、
`onReset` で空に戻す、という動きを **外側 hook が担う**前提。これを忘れて
`children` の入力フィールドを直接「本物の filters」に bind すると、ダイアログ
を閉じるだけでフィルタが変わってしまう。reference:
[`use-session-filters`](../../../apps/web/src/features/sessions/components/session-filters/use-session-filters.ts)。

## 関連

- [`01-page-shell.md`](01-page-shell.md) — ページの外枠（`PageHeader` /
  `AuthenticatedShell` / `PublicPageShell` / `PageSection` / `AuthFormShell`）。
  本書の composite はすべて `PageHeader` の **下** に置かれる中身側。
- [`04-hooks-separation.md`](04-hooks-separation.md) — 本書で扱った composite
  はどれも colocated な `use-<component>.ts` を持ち（`use-entity-list-item.ts`
  / `use-tag-manager.ts` / `use-tag-name-form.ts` / `use-linked-accounts.ts`）、
  component 側は state を直接持たない原則を守っている。
- [`08-feature-domain-map.md`](08-feature-domain-map.md) — どの feature が
  どの composite を使っているかの俯瞰。本書の「使用例」列の参照先。
