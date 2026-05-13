# Hooks Separation — components と useXxx の境界

> UI リライト前の現状記録。`apps/web/src/` 配下で長らく守られている
> 「component は `useXxx` hook だけを呼ぶ」規約と、その背景、実装パターン、
> テスト戦略を一度棚卸ししておくためのアーカイブ。リライト後にこの境界が
> 維持されるか／緩められるかを判断する際の起点として使われることを想定している。

## 何を解決しているか

`apps/web/src/**/components/**/*.tsx` と `apps/web/src/routes/**/*.tsx` から
**ロジックをすべて締め出す** ことで、以下のいくつもの痛点を一度に解決している。

- **テスト容易性**：JSX に絡まないため、ロジックを `renderHook` で単独に検証できる。
  jsdom を立ち上げないテスト（pure helper / Zod schema）も `web-node`
  project に分離でき、CI / ローカル両方で速い。
- **再利用性**：`useCurrencyForm` は CurrencyDialog と CurrencyForm の両方から
  消費される。ロジックが component に張り付いていると、片方を実装ごとコピー
  することになる。
- **JSX のレビュー負担削減**：レビュー対象が "form の見た目" と "form の挙動"
  に分割されるので、PR diff が読みやすい。
- **規約の機械的検証**：禁止 hook 一覧を `rg` で grep するだけで違反を発見できる
  （[`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md)
  の verification セクション）。component 内に `useState` を書いた瞬間に CI で気付ける。
- **TanStack Query / Form / Router のラップ統一**：optimistic update のような複雑な
  パターンを hook 側に集約することで、component 側に `queryClient.setQueryData`
  が散らばるのを防いでいる（[`.claude/rules/web-data-fetching.md`](../../../.claude/rules/web-data-fetching.md)
  と相互補完）。

裏返すと、component の責務は「hook の戻り値 (state, handlers, derived values) を
受け取り JSX をレンダリングする」だけになる。条件分岐すらできるだけ hook 側で
計算した bool を受けて JSX を出し分ける、というスタイルが標準。

## 中心となる部品

### 1. 命名規約とファイル配置

- **Component-specific hook**：component と同階層に `use-<component>.ts`
  を置く。例：
  - `apps/web/src/features/currencies/components/currency-form/currency-form.tsx`
  - `apps/web/src/features/currencies/components/currency-form/use-currency-form.ts`
- **Cross-component data hook**（同じ feature 内で複数の component から使う）：
  `apps/web/src/features/<feature>/hooks/use-*.ts`。
  例：`apps/web/src/features/currencies/hooks/use-currencies.ts`。
- **Cross-feature / app-wide hook**：`apps/web/src/shared/hooks/use-*.ts`。
- **Route page hook**：route file と同階層に **leading dash 付き** で置く。
  例：`apps/web/src/routes/-use-dashboard-page.ts`。
  この `-` prefix は TanStack Router のファイルベースルーティングのスキャン対象
  から外すための慣習 — 詳しくは後述の "決定と理由"。

### 2. 禁止 hook 一覧（`*.tsx` 配下）

`apps/web/src/**/components/**/*.tsx` と `apps/web/src/routes/**/*.tsx` で
**直接呼んではいけない** hook：

- React 組み込み：`useState`、`useEffect`、`useMemo`、`useRef`、`useCallback`、
  `useReducer`、`useContext`、`useDeferredValue`、`useTransition`、`useLayoutEffect`。
- `@tanstack/react-form` の `useForm`。
- `@tanstack/react-query` の `useQuery`、`useMutation`、`useQueryClient`、`useIsMutating`。

許可されている例外：

- 自前 hook（`useXxx`）の呼び出し。内部で何を使うかは自由。
- route page component 内の `Route.useParams()` / `Route.useSearch()`
  （これは "state" ではなく "param accessor" として扱う）。
- 同ファイル内で定義した純粋に表示用の子 component（hook を呼ばないもの）。

### 3. Hook の戻り値 shape

戻り値は **named object** で揃える：

```ts
return { data, isLoading, error, onCreate, onUpdate, onDelete, ... };
```

position 引数で受けず、呼び出し側で必要なものだけ destructure する。
これは後述する "決定と理由" の通り、return order に依存しない安定した API
を保つため。

### 4. テスト戦略

component と hook を分けたことで、テストは原則 **hook を直接 `renderHook`** で叩く。
`apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts` が
代表例で、以下のパターンが定着している：

- `vi.hoisted(() => ({ ... }))` で mutable な mock 群を持ち、`vi.mock` の factory
  からそれを参照する。
- `vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }))` で tRPC proxy を
  module scope で差し替え。
- 本物の `QueryClient` を組み立て `QueryClientProvider` で `renderHook` を包む
  ことで、optimistic update の cache 書き換えを実コードで検証する。
- form hook は本物の `useForm` を使い、`act()` 内で
  `result.current.form.setFieldValue(...)` → `await result.current.form.handleSubmit()`
  という流れで submit を駆動する（`use-sign-in.test.ts` 参照）。

詳しくは [11-testing-patterns.md](./11-testing-patterns.md) を参照。

## 典型フロー

1 つの form 部品をビルドする流れを、`currency-form` を例に追う。

### Step 1：`use-currency-form.ts` にロジックを集約

```ts
// apps/web/src/features/currencies/components/currency-form/use-currency-form.ts
import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface CurrencyFormValues {
  name: string;
  unit?: string;
}

export interface UseCurrencyFormProps {
  defaultValues?: CurrencyFormValues;
  onSubmit: (values: CurrencyFormValues) => void;
}

export const currencyFormSchema = z.object({
  name: z.string().min(1, "Currency name is required"),
  unit: z.string(),
});

export function useCurrencyForm({
  defaultValues,
  onSubmit,
}: UseCurrencyFormProps) {
  const form = useForm({
    defaultValues: {
      name: defaultValues?.name ?? "",
      unit: defaultValues?.unit ?? "",
    },
    onSubmit: ({ value }) => {
      onSubmit({
        name: value.name,
        unit: value.unit ? value.unit : undefined,
      });
    },
    validators: {
      onSubmit: currencyFormSchema,
    },
  });

  return { form };
}
```

ポイント：

- `useForm` の呼び出しはここに閉じている。component 側からは `form` だけが見える。
- Zod schema (`currencyFormSchema`) も同じ hook ファイルに置く — component から
  schema を参照する必要がないので export しないことも多い。
- `onSubmit` の中で `unit: ""` を `undefined` に正規化する、というような
  "values から outgoing payload への変換" もここで行う。

### Step 2：`currency-form.tsx` で hook を展開

```tsx
// apps/web/src/features/currencies/components/currency-form/currency-form.tsx
import { Button } from "@/shared/components/ui/button";
import { DialogActionRow } from "@/shared/components/ui/dialog-action-row";
import { Field } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import type { CurrencyFormValues } from "./use-currency-form";
import { useCurrencyForm } from "./use-currency-form";

interface CurrencyFormProps {
  defaultValues?: CurrencyFormValues;
  isLoading?: boolean;
  onSubmit: (values: CurrencyFormValues) => void;
}

export function CurrencyForm({
  onSubmit,
  defaultValues,
  isLoading = false,
}: CurrencyFormProps) {
  const { form } = useCurrencyForm({ defaultValues, onSubmit });
  // ...JSX (form.Field を並べる)
}
```

component の冒頭は **必ず custom hook 1 行** から始まる。複数の hook を呼ぶ場合も、
すべて `useXxx` 形式。React builtin hook はここには出てこない。

### Step 3：JSX は `form.Field` を並べるだけ

```tsx
<form.Field name="name">
  {(field) => (
    <Field
      error={field.state.meta.errors[0]?.message}
      htmlFor={field.name}
      label="Currency Name"
      required
    >
      <Input
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        value={field.state.value}
      />
    </Field>
  )}
</form.Field>
```

state を保持しているのはあくまで hook 内部の `form` インスタンス。
component は値を読み書きするための JSX を組み立てるだけ。

### Step 4：テストは `renderHook` で hook を単独に叩く

```ts
const { result } = renderHook(() => useCurrencyForm({ onSubmit }));
act(() => {
  result.current.form.setFieldValue("name", "Gold");
});
await act(async () => {
  await result.current.form.handleSubmit();
});
expect(onSubmit).toHaveBeenCalledWith({ name: "Gold", unit: undefined });
```

JSX を render する必要がない。validation・正規化・submit を直接観測できる。

### より複雑な例：`useDashboardPage`

route page では複数の hook を組み合わせ、`useBlocker` のような router 由来の
hook も hook 側に閉じ込める。`apps/web/src/routes/-use-dashboard-page.ts` は
180 行近い hook で、内部で：

- `useCurrentDevice()`、`useDashboardWidgets(device)`、`useEditMode()`、
  `useLayoutSync(device)` を順に呼ぶ。
- `useContainerWidth()` という file-local hook（`ResizeObserver` を `useEffect`
  でセットアップ）を持つ。
- `useBlocker({...})` を hook 内で呼び、結果を component に渡すだけにする。
- `useCallback` を使った handler 群を内部で組み立て、まとめて 1 つの巨大な
  named object として return する。

これに対して `dashboard.tsx` は本当に

```tsx
export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});
```

だけ（実体は `DashboardPage` component に委譲されており、その component も
`const { ... } = useDashboardPage()` で全展開される）。

## 決定と理由

### 1. component から builtin / 3rd-party hook を直接呼ぶことを禁止した理由

過去、`useState`・`useEffect`・`useQuery` などが component に散らばっていた
時期があり、

- form ロジックを再利用したいときに JSX ごとコピーペーストする羽目になった、
- snapshot test や DOM 経由のテストでしか検証できず、ロジックのバグ発見が
  遅れた、
- optimistic update を `useMutation` の `onMutate` に書く想定だったのに、
  `queryClient.setQueryData` が component 側に漏れ出てしまうケースが出た、

という痛みがあった。境界を厳格化し、`.claude/rules/web-hooks-separation.md` の
**verification script**（`rg` で禁止 hook 名を `components/**/*.tsx` と
`routes/**/*.tsx` に対して検索）を CI に入れることで、違反を機械的に検出可能に
した。verification は「**1 件もヒットしてはいけない**」が合格基準。

### 2. Route page hook を `-` prefix にした理由

TanStack Router はファイルベースルーティングを採用しており、
`apps/web/src/routes/**/*.{ts,tsx}` をスキャンしてルートツリーを生成する。
このスキャンは **leading dash の付いたファイル名を無視する** という規約があり、
そこに乗ることで `routes/-use-dashboard-page.ts` をルート生成対象から外しつつ、
"page hook" として route と隣接配置できる。`features/` 配下に置くと
"そのページ専用" という意図が薄れるため、あえて routes と同階層に置く。

### 3. Hook の return を named object にする慣習

position tuple（`[state, setState]` 形式）は呼び出し側で順序を覚える必要があり、
hook の signature を変えたときに silent breakage を起こしやすい。`useState` は
React 由来なので例外として位置引数を許すが、自前 hook の return は必ず
named object にする。これにより：

- destructure の名前で意図が伝わる（`const { onCreate, isCreatePending } = ...`）。
- 戻り値を増やしても呼び出し側を壊さない。
- テストでも `result.current.onCreate` のようにフィールド名で参照でき、
  実装の並べ替えに耐える。

### 4. Black-box test 方針

hook のテストでは **戻り値の state と、外部への副作用（toast、navigate、
queryClient の write）** のみを assert する。内部で `useReducer` を使うか
`useState` を 3 つ並べるかといった実装詳細はテストしない。これにより、hook を
リファクタしてもテストを書き直さずに済む。詳細は
[11-testing-patterns.md](./11-testing-patterns.md)。

## 落とし穴

### 1. Hook を条件分岐の中で呼ばない

複数の自前 hook を組み合わせるとき、

```ts
// BAD
if (mode === "edit") {
  const { data } = useEditData(id);
  // ...
}
```

これは React の Rules of Hooks 違反。hook 側で

```ts
function useEditDataOrEmpty(id: string | null) {
  const enabled = id !== null;
  return useQuery({ ...options, enabled });
}
```

のように **always-called だが内部で disabled** にする形に逃がす。

### 2. `useEffect` を component に書きたくなる衝動

リライト中によく出てくる「focus を当てる」「resize を観測する」といったケースで、
つい component に直接 `useEffect` を書きたくなる。これは禁止対象なので、
小さくても hook に切り出す。`useContainerWidth` のように file-local な hook を
**page hook ファイル内で定義する** のは許容されている（同ファイル内で
verification を通すため）。

### 3. Hook の戻り値に内部状態を漏らさない

`{ form, internalDraft, _cache }` のように内部実装を return すると、テストが
内部に依存して脆くなる。**呼び出し側 component が JSX に直接使う値** と
**handler** だけを返す。`useCurrencies` は `currencies` / `allTransactions` /
`isCreatePending` / `create` / `update` などのフラットな顔だけを公開し、
中で抱えている `queryClient` インスタンスや `useMutation` の戻り値そのものは
露出しない。

### 4. `form` プロパティの再露出はバランス

form hook は `{ form }` を返すのが基本で、`form.handleSubmit` や
`form.Field` を component が直接触る — これは "TanStack Form の API を
そのまま使う" という意図的な設計。一方、`form.state.values.foo` を
hook 外で参照したい衝動は再考の合図：たいてい hook 内で derive して
別のキーで return すべき。

### 5. ResponsiveDialog / Drawer などの `open` state

bottom sheet / dialog の `open` boolean は **その dialog を呼び出すページ側 hook**
で持つ。dialog component 自身が `useState` を持つと、外部から制御できなくなる。
`useAddWidgetMenu` が `open` / `setOpen` / `handleOpen` / `handleSelect` を
ひとまとめにして component に渡しているのが典型例。

## 関連

- [`03-data-fetching.md`](./03-data-fetching.md) — optimistic update の共通
  ヘルパー (`utils/optimistic-update.ts`) と mutation hook の戻り値形状。
- [`05-forms.md`](./05-forms.md) — `@tanstack/react-form` を hook 側で組み立てる
  パターン、`SelectWithClear`、`requiredNumericString` などの helpers。
- [`11-testing-patterns.md`](./11-testing-patterns.md) — `renderHook` + 本物の
  `QueryClient` + `vi.hoisted` mock パターン、`createTrpcMock` / `withQueryClient`
  共通 helper の使い方。
- [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md)
  — 強制版。禁止 hook 一覧と verification script。リライト後も同じ強度で残すか
  どうかはここで議論する。
