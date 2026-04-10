# Implementation Plan: プレイヤータグ編集画面のカラーピッカー改善

**Branch**: `007-improve-tag-colorpicker` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-improve-tag-colorpicker/spec.md`

## Summary

プレイヤータグ作成・編集ダイアログにおいて、汎用の ToggleGroup コンポーネントを廃止し、色スウォッチ（丸いカラーブロック）のみを並べる専用 `TagColorPicker` コンポーネントを新規作成する。選択状態はリングと内部のチェックマークで明確に表示する。既存の `player-tag-manager.tsx` の `TagForm` を更新して新コンポーネントを使用する。データモデルや API に変更はない。

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: React 19, Tailwind v4, Radix UI, Vitest, Testing Library
**Storage**: N/A（データモデル変更なし）
**Testing**: Vitest + @testing-library/react (jsdom)
**Target Platform**: Web browser（モバイルファースト）
**Project Type**: Web application (React SPA, monorepo)
**Performance Goals**: 標準的な Web アプリのレスポンス（インタラクションは即時）
**Constraints**: モバイルファースト、タッチターゲット 44×44px 以上、ダークモード対応

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Type Safety First | PASS | `TagColor` 型が既に定義済み。新コンポーネントは完全に型付けする |
| II | Monorepo Package Boundaries | PASS | 新コンポーネントは `players/components/` 内に配置。パッケージ境界を越えない |
| III | Test Coverage Required | PASS | `TagColorPicker` の Unit/Component テストを `__tests__/` に作成する |
| IV | Code Quality Automation | PASS | コミット前に `bun x ultracite fix` を実行する |
| V | English-Only UI | PASS | `aria-label` は英語の色名を使用（例: `"Select gray color"`） |
| VI | Mobile-First UI Design | PASS | スウォッチは 44×44px 以上のタッチターゲットを確保し、flex-wrap レイアウトを採用 |
| VII | API Contract Discipline | PASS | API 変更なし |
| VIII | Offline-First Data Layer | PASS | データ層変更なし |

**Constitution Check Result**: 全ゲート PASS。Phase 1 設計へ進行可能。

## Project Structure

### Documentation (this feature)

```text
specs/007-improve-tag-colorpicker/
├── plan.md              # このファイル
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # 仕様品質チェックリスト
```

### Source Code (repository root)

```text
apps/web/src/
├── players/
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── tag-color-picker.test.tsx   # [NEW] コンポーネントテスト
│   │   │   └── (既存テストファイル群)
│   │   ├── color-badge.tsx                  # [UNCHANGED]
│   │   ├── player-tag-manager.tsx           # [MODIFY] TagForm 内の色選択を差し替え
│   │   ├── tag-color-picker.tsx             # [NEW] 専用カラーピッカーコンポーネント
│   │   └── (その他既存ファイル群)
│   └── constants/
│       └── player-tag-colors.ts             # [MODIFY] swatch 用ソリッドカラークラス追加
```

**Structure Decision**: 既存の `players/components/` ディレクトリ内に新コンポーネントを追加。汎用コンポーネント（`shared/components/ui/`）ではなく、players 固有として配置する（カラーセットとロジックが players ドメインに依存するため）。

## Complexity Tracking

> 該当なし（Constitution 違反なし）
