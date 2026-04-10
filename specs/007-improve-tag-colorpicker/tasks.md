# Tasks: プレイヤータグ編集画面のカラーピッカー改善

**Input**: Design documents from `/specs/007-improve-tag-colorpicker/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: Constitution III により、全実装タスクに対応するテストが必要。

**Organization**: 単一のユーザーストーリー（US1）を中心に構成。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 対応するユーザーストーリー（US1）
- 各タスクに正確なファイルパスを記載

---

## Phase 1: Foundational（ブロッキング前提条件）

**Purpose**: 全ユーザーストーリーが依存するカラー定数の拡張。US1 の実装開始前に完了が必須。

**⚠️ CRITICAL**: T001 が完了するまで US1 の実装タスクは開始不可。

- [ ] T001 `TAG_COLORS` に `swatch` フィールドを追加する `apps/web/src/players/constants/player-tag-colors.ts`（各色のソリッドカラー Tailwind クラスを定義: gray→`bg-gray-400`, red→`bg-red-500`, orange→`bg-orange-500`, yellow→`bg-yellow-400`, green→`bg-green-500`, blue→`bg-blue-500`, purple→`bg-purple-500`, pink→`bg-pink-500`）

**Checkpoint**: `TAG_COLORS` に `swatch` フィールドが追加され、型定義が更新されたことを確認 → US1 実装へ進む

---

## Phase 2: User Story 1 - 色スウォッチでのカラー選択（Priority: P1）🎯 MVP

**Goal**: テキストなしの色スウォッチを並べた専用カラーピッカーコンポーネントを新規作成し、プレイヤータグ作成・編集ダイアログで使用する。

**Independent Test**: タグ作成ダイアログを開き、カラーピッカーが 8 色のスウォッチのみを表示すること、スウォッチをクリックすると選択状態（リング）が変わることを手動で確認できる。

### Tests for User Story 1

> **NOTE: T002 のテストを実装 (T003) の前に作成し、テストが FAIL することを確認してから実装へ進む**

- [ ] T002 [P] [US1] `TagColorPicker` のコンポーネントテストを作成する `apps/web/src/players/components/__tests__/tag-color-picker.test.tsx`（以下のケースをカバー: ①8色のスウォッチがすべてレンダリングされる ②`value` prop に対応するスウォッチが `aria-checked="true"` である ③スウォッチをクリックすると `onChange` が正しいカラー名で呼ばれる ④各スウォッチに `aria-label="Select {color} color"` が付与されている ⑤未選択スウォッチは `aria-checked="false"` である）

### Implementation for User Story 1

- [ ] T003 [US1] `TagColorPicker` コンポーネントを新規作成する `apps/web/src/players/components/tag-color-picker.tsx`（Props: `value: TagColor`, `onChange: (color: TagColor) => void`; `div[role="radiogroup"][aria-label="Tag color"]` を root に、各色を `button[role="radio"]` で実装; `rounded-full` の丸型スウォッチ、`TAG_COLORS[color].swatch` を背景色に使用; 選択状態は `ring-2 ring-offset-2 ring-white dark:ring-offset-gray-900` + `scale-110` で表現; タッチターゲット `min-w-[44px] min-h-[44px]` を確保; `aria-label="Select {color} color"`, `aria-checked={value === color}` を設定; `type="button"` を明示）（T001、T002 に依存）

- [ ] T004 [US1] `player-tag-manager.tsx` の `TagForm` を更新して `TagColorPicker` を使用する `apps/web/src/players/components/player-tag-manager.tsx`（`ToggleGroup`/`ToggleGroupItem` のインポートを削除し `TagColorPicker` をインポート; `<ToggleGroup ...>...</ToggleGroup>` ブロックを `<TagColorPicker value={selectedColor} onChange={setSelectedColor} />` に置き換える）（T003 に依存）

**Checkpoint**: タグ作成・編集ダイアログを開き、8 色スウォッチが表示され、選択状態が明確に視認でき、選択した色でタグが保存されることを確認

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: コード品質・テスト通過の最終確認

- [ ] T005 [P] `bun x ultracite fix` を実行して変更ファイルのフォーマット・lint を修正する（対象: `player-tag-colors.ts`, `tag-color-picker.tsx`, `player-tag-manager.tsx`）
- [ ] T006 `bun run test` を実行して全テストが通過することを確認する（T005 に依存）
- [ ] T007 `bun run check-types` を実行して型エラーがないことを確認する

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: 即座に開始可能 — US1 をブロック
- **User Story 1 (Phase 2)**: Phase 1（T001）完了後に開始可能
  - T002（テスト作成）は T001 と並列で作成可能だが、T003 の前に確認が必要
  - T003（実装）は T001 と T002 の完了後
  - T004（統合）は T003 の完了後
- **Polish (Phase 3)**: Phase 2 完了後

### User Story Dependencies

- **User Story 1 (P1)**: Phase 1 完了後に開始可能、他のストーリーへの依存なし（本機能はストーリーが 1 つのみ）

### Within User Story 1

```
T001（定数追加）
  ├── T002（テスト作成）[並列可]
  └── T003（コンポーネント実装）← T001 + T002 完了後
        └── T004（統合: player-tag-manager 更新）
              └── T005, T006, T007（ポリッシュ）
```

### Parallel Opportunities

- T001 と T002 は別ファイルのため並列実行可能
- T005, T006, T007 の lint/type チェックは並列実行可能

---

## Parallel Example: User Story 1

```bash
# T001 と T002 を並列で開始:
Task T001: "TAG_COLORS に swatch フィールドを追加 in player-tag-colors.ts"
Task T002: "tag-color-picker.test.tsx を作成"

# T001 + T002 完了後:
Task T003: "tag-color-picker.tsx コンポーネント実装"

# T003 完了後:
Task T004: "player-tag-manager.tsx を更新"

# T004 完了後（並列）:
Task T005: "ultracite fix を実行"
Task T007: "bun run check-types を実行"
```

---

## Implementation Strategy

### MVP First（User Story 1 のみ）

1. T001: `TAG_COLORS` に `swatch` フィールド追加
2. T002: テスト作成（FAIL することを確認）
3. T003: `TagColorPicker` 実装（テストが PASS になることを確認）
4. T004: `player-tag-manager.tsx` を更新
5. T005–T007: 品質チェック
6. **STOP and VALIDATE**: タグ作成・編集ダイアログを手動確認

### Incremental Delivery

単一ストーリーのため、上記 MVP ファーストがそのまま完成形。

---

## Notes

- [P] タスク = 異なるファイル、依存なし
- [US1] ラベルで仕様書のユーザーストーリー 1 にトレーサブル
- T002 のテストは T003 の実装前に FAIL することを確認すること（TDD）
- `ToggleGroup` / `ToggleGroupItem` のインポートは T004 で完全に除去し、未使用インポートを残さない
- Constitution V 準拠: `aria-label` は英語（例: `"Select gray color"`）
- Constitution VI 準拠: タッチターゲット `min-w-[44px] min-h-[44px]` を実装時に確認
