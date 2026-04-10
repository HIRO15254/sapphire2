# Quickstart: プレイヤータグ編集画面のカラーピッカー改善

**Branch**: `007-improve-tag-colorpicker` | **Date**: 2026-04-10

## 前提条件

- Node.js / Bun がインストール済み
- リポジトリルートで `bun install` 済み

## 開発サーバーの起動

```bash
# リポジトリルートで実行
bun run dev
```

ブラウザで `http://localhost:3000` を開き、Players ページへ移動する。

## カラーピッカーの確認手順

1. Players ページの「Tags」タブを開く
2. 「New Tag」ボタンをクリックして作成ダイアログを開く
3. 色選択セクションに `TagColorPicker` コンポーネントが表示されていることを確認する
4. 各色スウォッチをクリックして選択状態（リング）が変わることを確認する
5. タグ名を入力して「Save」を押し、作成されたタグの色が正しいことを確認する
6. 既存タグの「Edit」ボタンを押し、現在の色が初期選択状態で表示されることを確認する

## テストの実行

```bash
# 全テスト
bun run test

# players ディレクトリのテストのみ
bun run test apps/web/src/players

# 新規コンポーネントのテストのみ
bun run test apps/web/src/players/components/__tests__/tag-color-picker
```

## コード品質チェック

```bash
# フォーマット + 自動修正
bun x ultracite fix

# チェックのみ
bun x ultracite check

# 型チェック
bun run check-types
```

## 変更ファイル一覧

| ファイル | 変更種別 | 概要 |
|---------|---------|------|
| `apps/web/src/players/constants/player-tag-colors.ts` | 修正 | `TAG_COLORS` に `swatch` フィールド（ソリッドカラークラス）を追加 |
| `apps/web/src/players/components/tag-color-picker.tsx` | 新規 | 専用カラーピッカーコンポーネント |
| `apps/web/src/players/components/__tests__/tag-color-picker.test.tsx` | 新規 | コンポーネントテスト |
| `apps/web/src/players/components/player-tag-manager.tsx` | 修正 | `TagForm` 内の `ToggleGroup` を `TagColorPicker` に差し替え |

## 主要コンポーネントの Props

```typescript
// tag-color-picker.tsx
interface TagColorPickerProps {
  value: TagColor;
  onChange: (color: TagColor) => void;
}
```
