# Research: プレイヤータグ編集画面のカラーピッカー改善

**Branch**: `007-improve-tag-colorpicker` | **Date**: 2026-04-10

## 1. 現状実装の調査

### 現行のカラー選択コンポーネント

- **ファイル**: `apps/web/src/players/components/player-tag-manager.tsx`（L62–81）
- **使用コンポーネント**: `ToggleGroup` + `ToggleGroupItem`（Radix UI ラッパー、`shared/components/ui/toggle-group.tsx`）
- **問題点**:
  1. 各ボタン内に `ColorBadge` で色名テキストが表示されており視認性が低い
  2. 選択状態（`data-[state=on]`）のスタイルが小さなボーダー変化のみで分かりにくい
  3. ToggleGroup は汎用コンポーネントであり、カラー選択特有のUXに最適化されていない

### 既存のカラー定数

- **ファイル**: `apps/web/src/players/constants/player-tag-colors.ts`
- **定義**: 8色 (`gray`, `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`)
- **現行クラス**: バッジ用の淡色背景（`bg-gray-100`、`bg-red-100` など）+ テキスト色
- **課題**: バッジ用の淡色クラスはスウォッチには不向き。スウォッチには目立つソリッドカラーが必要

---

## 2. 設計上の決定事項

### 決定 1: コンポーネント配置

- **Decision**: `players/components/tag-color-picker.tsx` に配置（`shared/components/ui/` ではない）
- **Rationale**: カラーセット（`TAG_COLOR_NAMES`, `TAG_COLORS`）は players ドメイン固有。汎用 UI ライブラリに配置すると依存関係が逆転する
- **Alternatives considered**:
  - `shared/components/ui/color-picker.tsx` → colors 定数への依存が生じるため棄却
  - `shared/components/ui/tag-color-picker.tsx` → 同上の理由で棄却

### 決定 2: スウォッチのビジュアルデザイン

- **Decision**: 丸型（`rounded-full`）の色付きブロックを横並びにする。テキストなし。選択状態はホワイトのリング（`ring-2 ring-offset-2 ring-white`）+ ダークモード対応リング + スケール拡大で表示
- **Rationale**:
  - 丸型スウォッチはカラーピッカーの標準的なパターン（macOS カラーピッカー、Notion タグ、Linear ラベルなど）
  - テキスト除去で視覚的ノイズを減らし、純粋に色で選択できる
  - リング + スケールで選択状態を明確に表現
- **Alternatives considered**:
  - チェックマークアイコン表示 → アイコンのインポートが必要になる。リングとスケールのみで十分
  - 正方形スウォッチ → 丸型より一般的ではないが機能的には同等。丸型を採用

### 決定 3: スウォッチ用ソリッドカラークラスの追加

- **Decision**: `TAG_COLORS` に `swatch: string` フィールドを追加し、各色のソリッド背景クラスを定義する
- **Rationale**: バッジ用の淡色（`bg-gray-100`）はスウォッチでは色が薄すぎて識別困難。ソリッドな中間トーン（`bg-gray-400`、`bg-red-500` など）を使う
- **Alternatives considered**:
  - コンポーネント内でハードコーディング → 定数の一元管理原則に反する
  - Tailwind の `bg-{color}-500` をプログラマティックに生成 → Tailwind のパージに引っかかる可能性があるため棄却

### 決定 4: スウォッチのサイズとタッチターゲット

- **Decision**: 視覚的な色円を `w-6 h-6`（24px）とし、タッチターゲット `h-[44px] w-[44px]` の透明な `<label>` でラップする。`flex items-center justify-center` で円を中央に配置。ラベル間のギャップはなし（`gap-0`）でコンパクトに詰める
- **Rationale**: 視覚的なスウォッチを小さくすることでUIがコンパクトに見える一方、Constitution VI の 44px タッチターゲット要件を透明ラッパーで引き続き満たす
- **Alternatives considered**:
  - ラベル全体を色付き円にする（`min-w/h-[44px]`）→ 実装はシンプルだが44px の円は大きすぎて視認上ノイズになるため棄却

### 決定 5: キーボードアクセシビリティ

- **Decision**: `role="radiogroup"` + 各スウォッチを `role="radio"` とし、`aria-checked` で選択状態を表現。キーボード矢印キーは各ボタンに `tabIndex` を設定して対応
- **Rationale**: カラーピッカーは単一選択のラジオグループとして意味論的に正しい。`ToggleGroup`の代替としてネイティブ `button` を使うことでシンプルに実装できる
- **Alternatives considered**:
  - 引き続き `ToggleGroup` を内部で使用 → 汎用コンポーネントへの依存を残すため棄却

---

## 3. 実装方針まとめ

| 項目 | 方針 |
|------|------|
| 新コンポーネント | `tag-color-picker.tsx`（`players/components/`） |
| Props | `value: TagColor`, `onChange: (color: TagColor) => void` |
| 内部構造 | `div[role=radiogroup]` > `button[role=radio]` × 8 |
| スウォッチビジュアル | `rounded-full`, ソリッドカラー, 44px タッチターゲット |
| 選択状態 | `ring-2 ring-offset-2` + `scale-110` |
| アクセシビリティ | `aria-label="Select {color} color"`, `aria-checked` |
| ダークモード | `dark:ring-offset-gray-900` でオフセット背景に対応 |
| 定数変更 | `TAG_COLORS` に `swatch` フィールド追加 |
| 既存変更 | `player-tag-manager.tsx` の `TagForm` でカラーピッカー差し替え |
| テスト | `tag-color-picker.test.tsx`（レンダリング・選択操作・初期値・aria） |
