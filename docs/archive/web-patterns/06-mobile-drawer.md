# Mobile Drawer / Desktop Dialog

> UI リライト前の現状記録。`apps/web` で「モバイルでは下からせり上がる bottom sheet、デスクトップでは中央にフロートする modal dialog」を出し分けるレスポンシブパターンを記述する。

> **⚠️ 次の UI では捨てるパターン**: リライトではモバイル UI とデスクトップ UI を**完全に別ツリーで並立**させる方針が決まっており、本ファイルで扱う `ResponsiveDialog` / `useCurrentDevice` のような「1 つの component で両デバイスを面倒見る分岐」は引き継がない。読者は「過去はこう統合していた、なぜ統合したのか、何が辛かったのか」という視点で読み、新 UI 側の "分けて作る" 設計判断の比較材料として参照すること。詳細は `00-overview.md` の「次の UI リライトで変更が決まっている方針」を参照。

## 何を解決しているか

`apps/web` のフォームや確認ダイアログは、同じ「フォーカスを奪うモーダル」だが、デバイスごとに最適な提示形態が違う。

- **モバイル**: 画面が縦長で、片手親指の到達範囲は画面下半分。フォーム入力中はソフトウェアキーボードが下から押し上げてくる。`Dialog` を画面中央に出すと、キーボードに隠れる／指が届かないという二重のつらさが発生する。iOS / Android のネイティブパターンでは bottom sheet が標準。
- **デスクトップ**: マウス前提で画面が広い。bottom sheet にすると視線移動が大きく、横並びの action row も窮屈になる。中央配置の modal dialog の方が見やすい。

両方を扱うため、`apps/web` では:

1. shadcn の `Drawer`（vaul ベースの bottom sheet）と shadcn の `Dialog`（Radix ベースの modal）を別の primitive として保持する。
2. JS の `window.matchMedia` で breakpoint を判定し、レンダリング段階でどちらかだけをマウントする。
3. 出し分けを毎回手で書かないよう、`ResponsiveDialog` という単一の wrapper でカプセル化する。呼び出し側は title / description / children を渡すだけで、breakpoint を意識しない。

CLAUDE.md および `.claude/rules/web-ui.md` / `.claude/rules/web-forms.md` にも「モバイルのフォームダイアログは `Dialog` ではなく `Drawer`（bottom sheet）」と明記されている。

## 中心となる部品

### `Drawer` primitive — `apps/web/src/shared/components/ui/drawer/drawer.tsx`

shadcn が配布している vaul ラッパー。`Drawer.Root` を `shouldScaleBackground=true` で開き、`DrawerContent` は画面下端に固定 (`fixed inset-x-0 bottom-0`) し、最大高さ `max-h-[calc(100svh-2rem)]` で flex column を構成する:

```tsx
const DrawerContent = forwardRef<...>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100svh-2rem)] flex-col rounded-t-[10px] border bg-background",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
```

- `100svh` (small viewport height) を使う点に注意。iOS Safari でアドレスバーが出たり消えたりしてもジャンプしないようにするための仕様。`100vh` ではない。
- `vaul` から再エクスポートしているのは `Drawer / DrawerTrigger / DrawerPortal / DrawerOverlay / DrawerContent / DrawerHeader / DrawerFooter / DrawerTitle / DrawerDescription / DrawerClose` のみ。`vaul` を直接 import している箇所はこの一ファイルだけで、`apps/web` の他のコードはすべて shadcn の `Drawer` 経由で触る。

### `Dialog` primitive — `apps/web/src/shared/components/ui/dialog/dialog.tsx`

Radix `Dialog` のラッパー。`DialogContent` は中央に絶対配置し、`sm:max-w-sm` で幅を絞る:

```tsx
<DialogPrimitive.Content
  className={cn(
    "data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-background p-4 text-sm outline-none ring-1 ring-foreground/10 duration-100 data-closed:animate-out data-open:animate-in sm:max-w-sm",
    className
  )}
  data-slot="dialog-content"
  {...props}
>
```

- `DialogContent` には `showCloseButton` プロップが標準で生えていて、右上に `IconX` の close ボタンを描画する。
- `DialogFooter` は `showCloseButton` で「Close」テキストボタンも出せる、いわゆる footer 標準コンポーネント。

### `useMediaQuery` — `apps/web/src/shared/hooks/use-media-query.ts`

`window.matchMedia` を React state に橋渡しする 14 行のミニマルなフック:

```ts
import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
```

- 初期値は `false`。SSR / 初回レンダリングでは「モバイル扱い」になることが構造的に決まっている。`useEffect` 後に正しい値に同期するので、デスクトップでは 1 フレームの flicker が起こり得る。
- `removeEventListener` のクリーンアップあり。`query` 文字列を依存配列に入れているので、breakpoint 文字列を切り替えるユースケースにも対応する。

### `useCurrentDevice` — `apps/web/src/features/dashboard/hooks/use-current-device.ts`

dashboard 由来の thin wrapper。breakpoint 値の出所が散らからないように、定数として export している:

```ts
import { useMediaQuery } from "@/shared/hooks/use-media-query";

export type Device = "mobile" | "desktop";

export const DESKTOP_BREAKPOINT = "(min-width: 768px)";

export function useCurrentDevice(): Device {
  const isDesktop = useMediaQuery(DESKTOP_BREAKPOINT);
  return isDesktop ? "desktop" : "mobile";
}
```

`(min-width: 768px)` が `apps/web` 全体の「デスクトップ閾値」。これは Tailwind の `md:` ブレークポイントと一致する。

### `ResponsiveDialog` — `apps/web/src/shared/components/ui/responsive-dialog/responsive-dialog.tsx`

`apps/web` で **直接 `Drawer` を import しているのは `responsive-dialog.tsx` 1 ファイルだけ** で、他はすべてこの wrapper を経由する（Grep `from "@/shared/components/ui/drawer"` で確認済み: 該当 1 ファイル）。プロップは title / description / children / open / onOpenChange / headerAction / fullHeight の 7 つ:

```tsx
interface ResponsiveDialogProps {
  children: ReactNode;
  description?: ReactNode;
  /**
   * When true, the mobile Drawer always uses maximum height.
   * Use for content with dynamic height (e.g., editable tables).
   */
  fullHeight?: boolean;
  headerAction?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: ReactNode;
}

export function ResponsiveDialog({ children, description, fullHeight = false, headerAction, onOpenChange, open, title }: ResponsiveDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const descriptionContent = description ?? "Dialog details";
  const descriptionClassName = description ? undefined : "sr-only";

  if (isDesktop) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{title}</DialogTitle>
              {headerAction}
            </div>
            <DialogDescription className={descriptionClassName}>
              {descriptionContent}
            </DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer dismissible={false} onOpenChange={onOpenChange} open={open}>
      <DrawerContent className={fullHeight ? "h-[calc(100svh-2rem)]" : undefined}>
        <DrawerHeader className="relative shrink-0">
          <div className="flex items-center gap-2">
            <DrawerTitle>{title}</DrawerTitle>
            {headerAction}
          </div>
          <DrawerDescription className={descriptionClassName}>
            {descriptionContent}
          </DrawerDescription>
          <Button className="absolute top-2 right-2" onClick={() => onOpenChange(false)} size="sm" variant="ghost">
            <IconX size={16} />
            <span className="sr-only">Close</span>
          </Button>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

注目ポイント:

- `if (isDesktop) { return <Dialog/> } return <Drawer/>` の 2 分岐で、**片方しかマウントしない**。
- description は a11y 用 (`DialogDescription` / `DrawerDescription` は Radix / vaul とも必須に近い)。呼び出し側が省略した場合は `"Dialog details"` を `sr-only` で埋めて、警告と読み上げ崩壊の両方を防ぐ。
- mobile では `dismissible={false}` で vaul のドラッグ閉じを禁止し、明示的な close ボタンとフォームの cancel ボタンに閉動作を集約している。フォーム途中で誤って下スワイプして消える事故を防ぐため。
- mobile の `DrawerContent` は flex column で、header は `shrink-0`、body は `flex-1 overflow-y-auto overscroll-contain`。`overscroll-contain` を入れてあるので、body をスクロールし切っても背後のページがバウンスしない。
- `fullHeight` プロップは「コンテンツの高さが動的に変わるケース」（例: 編集可能なテーブル）のための逃げ。`max-h-[calc(100svh-2rem)]` (デフォルト) を `h-[calc(100svh-2rem)]` に上書きして高さを固定化する。

## 典型フロー

「プレイヤー編集ダイアログ」が一番素直な例。

### Route 側 — `apps/web/src/routes/players/index.tsx`

```tsx
<ResponsiveDialog
  onOpenChange={setIsCreateOpen}
  open={isCreateOpen}
  title="New Player"
>
  <PlayerForm
    availableTags={availableTags}
    isLoading={isCreatePending}
    onCreateTag={createTag}
    onSubmit={handleCreate}
  />
</ResponsiveDialog>

<ResponsiveDialog
  onOpenChange={(open) => {
    if (!open) {
      handleCloseEdit();
    }
  }}
  open={editingPlayer !== null}
  title="Edit Player"
>
  {editingPlayer && (
    <PlayerForm
      availableTags={availableTags}
      defaultMemo={editingPlayer.memo}
      defaultTags={editingPlayer.tags}
      defaultValues={{ name: editingPlayer.name }}
      isLoading={isUpdatePending}
      onCreateTag={createTag}
      onSubmit={handleUpdate}
    />
  )}
</ResponsiveDialog>
```

ページ側は `Drawer` / `Dialog` の存在を知らない。`open` を bool で渡し、close ボタンと cancel ボタンと escape キーが同じ `onOpenChange(false)` に集約される。

### Form 側 — `apps/web/src/features/players/components/player-form/player-form.tsx`

`PlayerForm` は **Drawer / Dialog どちらに入るかを知らない**:

```tsx
export function PlayerForm({ availableTags, defaultMemo, defaultTags, defaultValues, isLoading = false, leadingActions, onCreateTag, onSubmit }: PlayerFormProps) {
  const { form } = usePlayerForm({ defaultMemo, defaultTags, defaultValues, onSubmit });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="name">{(field) => (...)}</form.Field>
      {availableTags && <form.Field name="tags">{(field) => (...)}</form.Field>}
      <form.Field name="memo">{(field) => (...)}</form.Field>

      <form.Subscribe>
        {(state) => {
          const saveButton = (
            <Button disabled={isLoading || !state.canSubmit || state.isSubmitting} type="submit">
              {isLoading || state.isSubmitting ? "Saving..." : "Save"}
            </Button>
          );
          return leadingActions ? (
            <DialogActionRow>{leadingActions}{saveButton}</DialogActionRow>
          ) : saveButton;
        }}
      </form.Subscribe>
    </form>
  );
}
```

`form` は `usePlayerForm` というカスタムフックの中に閉じている (`.claude/rules/web-hooks-separation.md`)。フォームステートが `ResponsiveDialog` の外側のフックに住んでいるおかげで、`Drawer` と `Dialog` を切り替えてもフォーム値は影響を受けない（中身の JSX を別ツリーにマウントし直すだけ）。

### Breakpoint

`apps/web` の出し分け閾値は `(min-width: 768px)`。Tailwind v4 の `md:` プレフィクスと一致。

| 環境 | window 幅 | 表示 |
|---|---|---|
| iPhone Pro Max 縦 | 430px | Drawer |
| iPad mini 縦 | 768px | Dialog (>= 768 で desktop 扱い) |
| 1080p ノート PC | 1920px | Dialog |

`useMediaQuery` 内の `useState(false)` 初期値の影響で、SSR / hydration / 初回レンダー時点では「mobile 扱い」から始まる。デスクトップでは `useEffect` 同期後に Dialog に切り替わる。

## 決定と理由

- **shadcn `Drawer` (vaul ベース) を選んだ理由**:
  - iOS / Android のネイティブ bottom sheet とジェスチャ感が一致する（ドラッグハンドル、慣性スクロール、velocity による snap）。
  - 自前で「下端固定 + 高さアニメ + drag-to-dismiss + キーボード回避」を組むのは現実的でない。vaul は Material Design / iOS の sheet をかなり忠実に模倣している。
  - shadcn が配布する形 (Radix と同じ pattern の Root / Trigger / Portal / Overlay / Content / Header / Footer / Title / Description / Close 構造) なので、`Dialog` と入れ替え可能な形になっている。`ResponsiveDialog` の分岐ロジックが対称形で書けるのはこのおかげ。

- **JS で `matchMedia` 判定する理由（CSS の `@media` ではなく）**:
  - CSS だけで分岐すると `Drawer` と `Dialog` の **両方を DOM にマウントする** ことになる。Radix Dialog と vaul の両方が portal を作り、focus trap を競合させ、a11y アナウンスが二重発火する。
  - フォームを内側に置くと React のステート tree が 2 セット作られる。`useForm` を 2 回呼ぶことになるので、フォーム値の同期がほぼ不可能。
  - JS 判定なら片側だけマウントすれば良く、focus trap も portal も衝突しない。

- **フォームを別 hook に切り出す慣習**:
  - `.claude/rules/web-hooks-separation.md` で「コンポーネントは React の primitive フックを直接呼べない」という制約があるため、`useForm` は `use-*-form.ts` に閉じる。
  - 結果として `PlayerForm` のような子コンポーネントは Drawer / Dialog どちらに入っても同じ。ステート保持と breakpoint の分岐責任が分離されている。
  - `useAllInForm` のように、`open` プロップを依存に取って `form.reset()` する pattern も使われる:

    ```ts
    useEffect(() => {
      if (open) {
        form.reset(toFormDefaults(initialValues));
      }
    }, [open, initialValues, form]);
    ```

    開閉のたびにフォームをリセットする責任は「フォームのフック」側にある。`ResponsiveDialog` はリセットの存在を知らない。

- **`dismissible={false}` を `Drawer` 側だけに付ける**:
  - フォーム入力中の誤スワイプによる破棄を防ぐ。
  - 閉じる手段は (1) ヘッダー右上の `IconX`、(2) フォーム内の `Cancel` ボタン、(3) ESC キー (vaul のデフォルトで効く)、の 3 つに集約。
  - 一方 desktop の `Dialog` は overlay クリックで閉じられる（Radix のデフォルト）。これは modal の慣例なので維持。

- **`max-h-[85vh]` (desktop) vs `max-h-[calc(100svh-2rem)]` (mobile)**:
  - desktop は画面に対する比率制限で済む。
  - mobile はアドレスバーが伸び縮みする iOS Safari を考慮して `100svh` を使い、`-2rem` で「上部に少し空ける」ことで bottom sheet 感を出す。

## 落とし穴

- **両方マウントすると form state が二重になる**: `@media` ベースで分岐したくなるが、`useForm` が 2 回呼ばれる時点でアウト。`ResponsiveDialog` の `if (isDesktop)` 分岐をやめてはいけない。
- **`useMediaQuery` の初回 false flicker**: `useState(false)` で始まり `useEffect` 後に同期するので、デスクトップでは「Drawer が一瞬出てから Dialog に置き換わる」可能性がある。`isCreateOpen` が初期 false ならユーザーには見えないが、router state からモーダルを直接 open で開く route には注意。
- **`vaul` の iOS overscroll 独自処理**: vaul は iOS Safari の overscroll bounce を独自に上書きしている。`DrawerContent` 内のスクロールコンテナに `overscroll-contain` を **重ねて** かけると、vaul 側の touch handling と干渉してスクロールが固まるケースがある。現状の `ResponsiveDialog` は body の wrapper に `overscroll-contain` だけ付け、vaul の root 設定はデフォルトのまま。`shouldScaleBackground` も shadcn デフォルトの `true` を維持している (背後ページが微妙に縮んで bottom sheet 感を出す)。
- **mobile → desktop に画面が変わったときのフォーム状態保持**: ウィンドウを 768px 跨いでリサイズすると `isDesktop` が切り替わり、`Drawer` と `Dialog` が DOM 上で入れ替わる。中の `PlayerForm` も unmount / remount するので、入力中のフォーム値は **失われる**。実用上はモバイル端末でリサイズはほぼ起きないので問題視されていないが、ブラウザ devtools のレスポンシブモードでデバッグするときには罠になる。回避するには `useForm` を `ResponsiveDialog` の外側のフックに置く（route page hook など、`ResponsiveDialog` の親で）か、フォーム値を route state に持ち上げる。
- **description の必須性**: Radix `Dialog` / vaul `Drawer` は `aria-describedby` 用の description を期待する。省略すると warning。`ResponsiveDialog` は `description` が undefined なら `"Dialog details"` を `sr-only` でフォールバックさせるので、呼び出し側で省略しても警告は出ない仕様。が、できれば渡す方が読み上げに親切。
- **headerAction の置き場所**: `headerAction` は title と横並びで描画される (`flex items-center gap-2`)。フッターの action row には `DialogActionRow` という別 component (`apps/web/src/shared/components/ui/dialog-action-row`) があり、これは Drawer / Dialog どちらにも入る前提で書かれている。ヘッダー右上の close は `ResponsiveDialog` が自分で描画する (`IconX`)。
- **`100svh` vs `100vh`**: 過去 `100vh` を使っていた箇所を `100svh` に置き換えた経緯がある（iOS Safari のアドレスバー伸縮対応）。drawer 関連で高さ指定するときは `svh` を使うのが慣例。

## 関連

- `05-forms.md`: フォームを `use-*-form.ts` に切り出す方針。`ResponsiveDialog` がフォームを「中身は知らない」状態で入れ替えられるのは、この分離が大前提。
- `07-shared-composites.md`: `PageHeader` / `DialogActionRow` / `EmptyState` などの shared composite と並ぶ、ページレベルの "shell" コンポーネント群。`ResponsiveDialog` もこの分類。
- `.claude/rules/web-ui.md`: 「モバイル = Drawer、デスクトップ = Dialog」のルール本体。
- `.claude/rules/web-forms.md`: 「モバイルのフォームダイアログは bottom sheet」の根拠。
- メモリ `feedback_mobile_forms`: 過去にモバイルのフォームを Dialog で出して指摘された記録。Drawer に統一されたきっかけ。
- 実装ファイル: [`apps/web/src/shared/components/ui/responsive-dialog/responsive-dialog.tsx`](../../../apps/web/src/shared/components/ui/responsive-dialog/responsive-dialog.tsx)、[`apps/web/src/shared/components/ui/drawer/drawer.tsx`](../../../apps/web/src/shared/components/ui/drawer/drawer.tsx)、[`apps/web/src/shared/components/ui/dialog/dialog.tsx`](../../../apps/web/src/shared/components/ui/dialog/dialog.tsx)、[`apps/web/src/shared/hooks/use-media-query.ts`](../../../apps/web/src/shared/hooks/use-media-query.ts)、[`apps/web/src/features/dashboard/hooks/use-current-device.ts`](../../../apps/web/src/features/dashboard/hooks/use-current-device.ts)。
