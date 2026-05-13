# Forms — react-form + Zod

> UI リライト前の現状記録。`apps/web/` における `@tanstack/react-form` + Zod のフォーム実装パターンを、実コードを引きながら整理する。新規リライトで踏襲する／差し替える前提で読むこと。
>
> 正規ルールは [`.claude/rules/web-forms.md`](../../../.claude/rules/web-forms.md) を参照。本ドキュメントは「なぜそう書くか」を含む補助資料。

## 何を解決しているか

`apps/web/` のフォームは大小合わせて十数個ある（`currency-form`, `player-form`, `ring-game-form`, `tournament-form`, `store-form`, `sign-in-form`, セッション系の `cash-game-fields` / `tournament-fields` ほか）。書き手と書く時期がバラついても以下が崩れないようにしたい、というのが現状パターンの動機。

- **書式の統一**: フィールドの並べ方、ラベル・エラー表示位置、submit ボタンの活性条件、`required` の表示（赤い `*`）が全フォームで同じになる。
- **バリデーションの単一窓口**: フィールドごとの ad-hoc な if 分岐ではなく、`zodSchema` 1 個で submit 時に総点検する。エラーメッセージのコピーも schema に集約。
- **`<input type="number">` の挙動問題を避ける**: ブラウザ実装ごとの差異（IME 中の文字落ち、スクロールホイールでの値変動、空文字と `NaN` の混在、`.value === ""` か `null` か）に振り回されないため、すべて `type="text" inputMode="numeric"` + Zod で coerce する方針。
- **placeholder の誤誘導を防ぐ**: `placeholder="例: 100"` のような「サンプル値」を入れると、ユーザがそれを実値と誤認したり、空欄の意味（必須なのか optional なのか）が読みにくくなる。例示は description にも置かず、必要なら label 側で言い切る。
- **UI と検証ロジックの分離**: フォーム component は JSX 専、`useForm` 呼び出しと schema 定義は隣接の `use-*-form.ts` に置く。コンポーネント直で React/フォームライブラリの hook を叩くと [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md) のルールに抵触する。

## 中心となる部品

### `useForm`（@tanstack/react-form）

すべての form 用 hook（`use-*-form.ts`）の中で 1 回だけ呼ばれる。形は固定で以下のとおり。

```ts
import { useForm } from "@tanstack/react-form";
import z from "zod";

const form = useForm({
  defaultValues: { /* すべて string / 配列 / オブジェクト。number は使わない */ },
  onSubmit: ({ value }) => {
    onSubmit({
      /* 必要なら parseOptInt / parseRequiredInt で number に変換してから外へ */
    });
  },
  validators: {
    onSubmit: zodSchema, // submit 時にまとめて検証
  },
});
```

- `useForm` を component（`.tsx`）から直接呼ぶことはない。必ず `use-*-form.ts` に閉じ込め、戻り値 `{ form, ...extras }` を component が受け取る。
- 検証タイミングは原則 `validators.onSubmit`。リアルタイム検証が要る箇所だけ `onChange` を追加する。
- 戻り値の `form` は component 側で `<form.Field name="...">{(field) => …}</form.Field>` と `<form.Subscribe>{(state) => …}</form.Subscribe>` だけを使う。

### `Field` ラッパ

[`apps/web/src/shared/components/ui/field/field.tsx`](../../../apps/web/src/shared/components/ui/field/field.tsx) が全フォーム共通のラベル + 子 + description + error コンテナ。

抜粋:

```tsx
function Field({
  children, className, description, error, htmlFor, label, required = false, ...props
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {label ? <FieldLabel htmlFor={htmlFor} required={required}>{label}</FieldLabel> : null}
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
```

- `required` を付けると `FieldLabel` の末尾に赤い `*` が出る。明示しない field は暗黙的に optional 扱い。
- エラーは `field.state.meta.errors[0]?.message` を `Field` の `error` prop に流し込む。複数エラーは現状先頭のみ表示。
- `description` は使ってよいが、「例示」用途では使わない（後述）。

### `form-fields.ts` の数値ヘルパ

[`apps/web/src/shared/lib/form-fields.ts`](../../../apps/web/src/shared/lib/form-fields.ts) は数値系 field 用のユーティリティ。string で持ったまま Zod で検証し、submit 時に `parseOptInt` 系で number に直して外へ出す。

主な export:

- `requiredNumericString({ integer?, min?, max? })` — 空文字を reject。`integer: true` なら `Number.parseInt`、それ以外 `Number(...)`。NaN / 範囲外もそれぞれメッセージ付きで reject。
- `optionalNumericString({ integer?, min?, max? })` — 空文字を許容。中身が入っていれば同じ範囲チェック。
- `parseOptionalInt(value: string): number | undefined` — 空文字 → `undefined`、parse 不能 → `undefined`、それ以外 → number。
- `parseOptionalNumber(value: string): number | undefined` — `parseFloat` 相当。
- `parseRequiredInt(value: string): number` — `parseOptionalInt(value) ?? 0`。
- `parseRequiredNumber(value: string): number` — 同上の float 版。

中身は `numericStringSchema` 1 個に集約されており、空文字判定 → 数値変換 → finite 判定 → min/max 判定の順で `superRefine` を組み立てる。

```ts
function numericStringSchema({ required, integer = false, min, max }) {
  return z.string().superRefine((rawValue, ctx) => {
    const trimmed = rawValue.trim();
    if (trimmed === "") {
      if (required) ctx.addIssue({ code: "custom", message: "Required" });
      return;
    }
    const parsed = parseNumeric(trimmed, integer);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Must be a number" });
      return;
    }
    if (min !== undefined && parsed < min) ctx.addIssue({ code: "custom", message: `Must be at least ${min}` });
    if (max !== undefined && parsed > max) ctx.addIssue({ code: "custom", message: `Must be at most ${max}` });
  });
}
```

### `SelectWithClear`

[`apps/web/src/shared/components/ui/select/select-with-clear.tsx`](../../../apps/web/src/shared/components/ui/select/select-with-clear.tsx)。shadcn `Select`（Radix ベース）に「現在値をクリアする `×` ボタン」を足したラッパ。

```tsx
export function SelectWithClear({ children, onValueChange, value, ...props }) {
  const canClear = value !== undefined && value !== "" && !props.disabled;
  // Radix Select does not reset its internal state when `value` switches from a
  // defined string to `undefined` while controlled. Remounting via `key` forces
  // it back to the empty (placeholder) state.
  const selectKey = value ?? "__unset__";
  return (
    <div className="relative">
      <Select key={selectKey} onValueChange={onValueChange} value={value} {...props}>
        {children}
      </Select>
      {canClear && onValueChange ? (
        <button type="button" onClick={() => onValueChange(undefined)} aria-label="Clear selection" /* … */>
          <IconX size={14} />
        </button>
      ) : null}
    </div>
  );
}
```

- `onValueChange` のシグネチャが `(value: string | undefined) => void` に拡張されている点に注意（shadcn `Select` は `string` のみ）。
- 「optional な参照（store, currency, player など）の選択」は基本これを使う。例: [`features/sessions/components/link-selectors/link-selectors.tsx`](../../../apps/web/src/features/sessions/components/link-selectors/link-selectors.tsx)、`tournament-fields`, `cash-game-fields`, `session-filters` ほか。
- 「enum 必須選択（variant, anteType など）」は素の `Select` のままで OK（クリア不能であるべき）。

### schema を hook から export するパターン

`use-*-form.ts` の中で定義した zod schema は、テストや外部ユーティリティから参照する用途のために export する。例: `currencyFormSchema`, `playerFormSchema`。

```ts
// use-currency-form.ts
export const currencyFormSchema = z.object({
  name: z.string().min(1, "Currency name is required"),
  unit: z.string(),
});
```

これによりテストでは「schema 単体に対する境界値検査」「component 経由の rendering 検査」を別レイヤで書ける（[`apps/web/src/features/currencies/components/currency-form/__tests__/`](../../../apps/web/src/features/currencies/components/currency-form/__tests__/) 参照）。

## 典型フロー

[`features/currencies/components/currency-form/`](../../../apps/web/src/features/currencies/components/currency-form/) を最小例として通読する。

### 1. schema 定義 + `useForm`（`use-currency-form.ts`）

```ts
import { useForm } from "@tanstack/react-form";
import z from "zod";

export interface CurrencyFormValues {
  name: string;
  unit?: string;
}

export const currencyFormSchema = z.object({
  name: z.string().min(1, "Currency name is required"),
  unit: z.string(),
});

export function useCurrencyForm({ defaultValues, onSubmit }) {
  const form = useForm({
    defaultValues: {
      name: defaultValues?.name ?? "",
      unit: defaultValues?.unit ?? "",
    },
    onSubmit: ({ value }) => {
      onSubmit({
        name: value.name,
        unit: value.unit ? value.unit : undefined, // 空文字 → undefined
      });
    },
    validators: { onSubmit: currencyFormSchema },
  });
  return { form };
}
```

注目点:

- defaultValues は **必ず string 化**。`undefined` は使わず `""` で初期化する。
- submit 時、空文字を `undefined` に変換してから親に渡す（API は optional を `undefined` で受ける契約）。

### 2. component（`currency-form.tsx`）

```tsx
export function CurrencyForm({ onSubmit, defaultValues, isLoading = false }: CurrencyFormProps) {
  const { form } = useCurrencyForm({ defaultValues, onSubmit });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
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

      {/* ... unit field ... */}

      <DialogActionRow>
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button disabled={isLoading || !canSubmit || isSubmitting} type="submit">
              {isLoading ? "Saving..." : "Save"}
            </Button>
          )}
        </form.Subscribe>
      </DialogActionRow>
    </form>
  );
}
```

決まり事:

- `onSubmit` ハンドラは必ず `e.preventDefault()` + `e.stopPropagation()` を呼んでから `form.handleSubmit()`。Dialog/Drawer 内ネスト時に外側 form へ submit を漏らさないため。
- `<form.Field>` の中身は arrow function。`field.state.value` を `value` に、`field.handleChange(e.target.value)` を `onChange` に、`field.handleBlur` を `onBlur` に渡す。3 つそろえないとバリデーション発火タイミングがズレる（後述）。
- submit ボタンは `<form.Subscribe>` で `canSubmit` と `isSubmitting` を購読する。`isLoading`（= 親の mutation pending）も `disabled` に合算する。

### 3. 数値混じり版（`ring-game-form`）

`type="text" inputMode="numeric"` + `optionalNumericString` の組み合わせ。

```ts
const ringGameFormSchema = z.object({
  name: z.string().min(1, "Game name is required"),
  variant: z.string().min(1),
  blind1: optionalNumericString({ integer: true, min: 0 }),
  blind2: optionalNumericString({ integer: true, min: 0 }),
  ante:   optionalNumericString({ integer: true, min: 0 }),
  anteType: z.enum(["all", "bb", "none"]),
  minBuyIn: optionalNumericString({ integer: true, min: 0 }),
  maxBuyIn: optionalNumericString({ integer: true, min: 0 }),
  // ...
});
```

submit 側で string → number に変換:

```ts
onSubmit: ({ value }) => {
  const isAnteDisabled = value.anteType === "none";
  onSubmit({
    name: value.name,
    blind1: parseOptInt(value.blind1),
    ante: isAnteDisabled ? undefined : parseOptInt(value.ante),
    // ...
  });
},
```

`parseOptInt` は `form-fields.ts` の `parseOptionalInt` 同等。tournament-form / ring-game-form では現状ローカル定義が残っており、整理対象。

input 側はこう書く（数値だが `type="text"`）:

```tsx
<Input
  id={field.name}
  inputMode="numeric"
  onBlur={field.handleBlur}
  onChange={(e) => field.handleChange(e.target.value)}
  value={field.state.value}
/>
```

### 4. 副作用 + provider 連携版（`sign-in-form`）

`onSubmit` が async で、`authClient.signIn.email` を呼び、`toast.success` / `toast.error` / `navigate` を内側で叩く例。

```ts
const form = useForm({
  defaultValues: { email: "", password: "" },
  onSubmit: async ({ value }) => {
    await authClient.signIn.email(
      { email: value.email, password: value.password },
      {
        onSuccess: () => { navigate({ to: "/dashboard" }); toast.success("Sign in successful"); },
        onError: (error) => { toast.error(error.error.message || error.error.statusText); },
      }
    );
  },
  validators: {
    onSubmit: z.object({
      email: z.email("Invalid email address"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }),
  },
});
```

component 側は他の form と同じ作法（`form.handleSubmit()` を `onSubmit` で呼び、`<form.Field>` で値を流す）。`form.Subscribe` で `isSubmitting` を見て submit ボタンのラベルを切り替えるところまで共通。

## 決定と理由

- **`@tanstack/react-form` を採用した理由**
  - 既存スタックが TanStack 系（router, query）に揃っており、API 流儀（field-level subscribe, schema-first validator）と相性がいい。
  - React Hook Form は controlled/uncontrolled が混在しやすく、Radix `Select` などの 3rd-party controlled component と組むとき `Controller` を毎回噛ます必要があり、定型が増える。`@tanstack/react-form` の `<form.Field>` render-prop は controlled 前提なので、shadcn 系と無理なく結線できる。
  - schema を `validators.onSubmit` に渡すだけで全フィールド検査が回るので、`resolver` 抽象を介さずに済む（React Hook Form の `@hookform/resolvers/zod` 不要）。

- **`type="number"` を使わない理由**
  - 空文字と `null` と `NaN` が混在し、`e.target.value` の型が場合により切り替わる（ブラウザ差）。
  - スクロールホイールやキーボード `↑↓` で意図しない値変動が起きる。
  - 桁区切り、小数点、マイナス記号の入力途中で reject されることがある。
  - 代わりに `type="text" inputMode="numeric"` で string として持ち、Zod で `superRefine` する。これで型は終始 `string`、検証ロジックは 1 か所 (`form-fields.ts`)。

- **placeholder にサンプル値を入れない方針**
  - `placeholder="例: 1000"` は誤入力誘導になりやすい。「placeholder の文字が薄く見えているからもう値が入っている」と思われる、空欄が optional か required か区別しづらくなる、`aria-` まわりで実値とコンフリクトする、など。
  - 「例示」用途は description に移したくなるが、それも **今は禁じている**。理由は「実装側が `e.g.` テキストを入れたくなる衝動を抑え、ラベルとエラーメッセージで自明にする」ための整理。`Field` の `description` 自体は使ってよいが、サンプル値の置き場としては使わない。
  - これにより、例えば currency 入力で `placeholder="100"` のようなコピーは現状全フォームから排除されている。

- **clearable な Select に `SelectWithClear` を使う理由**
  - shadcn `Select` は Radix `Select` をラップしているが、Radix `Select.Root` の `value` を controlled で `undefined` に戻しても内部 state がリセットされず placeholder が再表示されない。
  - そのため `SelectWithClear` は `value ?? "__unset__"` を `key` に渡して強制 remount する。
  - 加えて `×` ボタン UI を絶対配置で SelectTrigger の右側に重ねる。`onValueChange` のシグネチャを `(string | undefined)` に拡張し、`undefined` を投げてリセットを伝える。
  - 「選択肢が optional な参照（店舗・通貨・プレイヤーなど）」は全部これ。「enum で必ず 1 つに定まるもの（variant・anteType・tableSize など）」は素の `Select`。

- **schema を hook ファイルから export する理由**
  - schema 単体テスト（境界値、空文字、最大長、`Number.NaN`）を component を立ち上げずに高速に書ける（`web-node` プロジェクト）。
  - schema の input/output 型を `z.infer<typeof xxxFormSchema>` で取り出して、props 型 (`XxxFormValues`) を派生させられる。
  - schema を確認すれば「このフォームが何を要求するか」が 1 ファイル内で読める。

## 落とし穴

- **controlled input の `onChange` と `form.handleSubmit` を混同する**
  - `<Input onChange={form.handleSubmit}>` のような誤りで「タイプするたび submit が走る」事故が起こりやすい。`onChange` には `field.handleChange(e.target.value)` を、`onSubmit`（form タグ側）には `form.handleSubmit()` を、と機能ごとに別経路で結線する。

- **Zod 4.x の `import z from "zod"` 必須**
  - 名前空間 import (`import * as z from "zod"`) は Vite のバンドラ問題で実行時に `z.object is not a function` 系で落ちる。default import を厳守。
  - CLAUDE.md にも明記されている既出の罠。新規ファイルを足すときは既存パターンをコピーする。

- **数値フィールドで空文字 → `NaN` → Zod reject の連鎖**
  - `type="number"` の `e.target.valueAsNumber` をそのまま `field.handleChange` に流すと、空欄時に `NaN` が入って `z.number()` で reject される。エラーメッセージも `"Expected number, received nan"` のような意味不明なものになる。
  - 解決策が `optionalNumericString` / `requiredNumericString`: 値を string で持ち、`""` を「空欄」として明示的に扱う。検証は `superRefine` で行い、submit 時のみ `parseOptInt` で number に変換する。

- **`field.handleBlur` を呼ばないとバリデーションが発火しないケース**
  - `validators.onBlur` を使っている field では `onBlur={field.handleBlur}` を渡し忘れると blur 時の検証が動かない。
  - 現状は `validators.onSubmit` 一本のフォームが多いので影響は限定的だが、`<Input>` 側で `onBlur` を渡す習慣をつけておく（既存コード全部が `onBlur={field.handleBlur}` をセットしている）。

- **submit 時に `e.preventDefault()` / `e.stopPropagation()` を忘れる**
  - Dialog / Drawer の中に form を置くと、外側に submit event が伝搬してページ遷移するブラウザがある（Safari）。`onSubmit` ハンドラの最初の 2 行は固定で `e.preventDefault(); e.stopPropagation();`。

- **`form.Subscribe` の selector を関数比較で渡してしまう**
  - `selector={(state) => [state.canSubmit, state.isSubmitting]}` のように配列を返すと shallow 比較で毎回 re-render する。気になる場合は `selector={(state) => state.canSubmit && !state.isSubmitting}` のように bool に潰す。現状コードでは両形式が混在。

- **`SelectWithClear` の `key` 戦略の副作用**
  - `value` が変わるたびに Radix Select が remount するため、開いている popover が閉じる。連続選択 UI を作るときは `SelectWithClear` ではなく素の `Select` で書くか、別 component を起こす。

## 関連

- 正規ルール: [`.claude/rules/web-forms.md`](../../../.claude/rules/web-forms.md)
- UI / Logic 分離: [`04-hooks-separation.md`](./04-hooks-separation.md) / [`.claude/rules/web-hooks-separation.md`](../../../.claude/rules/web-hooks-separation.md)
- モバイル時のフォーム表示 (Drawer): [`06-mobile-drawer.md`](./06-mobile-drawer.md)
- 共通プリミティブ: [`shared/components/ui/field/field.tsx`](../../../apps/web/src/shared/components/ui/field/field.tsx), [`shared/components/ui/select/select-with-clear.tsx`](../../../apps/web/src/shared/components/ui/select/select-with-clear.tsx)
- 数値ヘルパ: [`shared/lib/form-fields.ts`](../../../apps/web/src/shared/lib/form-fields.ts)
- 参考実装:
  - [`features/currencies/components/currency-form/`](../../../apps/web/src/features/currencies/components/currency-form/) — 最小例
  - [`features/players/components/player-form/`](../../../apps/web/src/features/players/components/player-form/) — Tag input + RichTextEditor 連携 + `leadingActions` 拡張
  - [`features/stores/components/ring-game-form/`](../../../apps/web/src/features/stores/components/ring-game-form/) — 数値多めの代表例 (`optionalNumericString`, `parseOptInt`, anteType に応じた enable 切替)
  - [`features/stores/components/tournament-form/`](../../../apps/web/src/features/stores/components/tournament-form/) — chip purchases の配列 field を含む大型例
  - [`shared/components/sign-in-form/`](../../../apps/web/src/shared/components/sign-in-form/) — 認証 + provider OAuth + toast/navigate 副作用
