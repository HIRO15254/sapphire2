# Tasks: モバイル基本レイアウト（Mobile Shell）— Revision 2

**Input**: Design documents from `/specs/001-mobile-shell/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: 既存実装の確認と準備

- [ ] T001 既存の mobile-nav.tsx, __root.tsx, header.tsx の現状を確認
- [ ] T002 [P] プレースホルダーページ（/search, /settings）が存在することを確認

---

## Phase 2: Foundational — 共通ナビゲーション定義

**Purpose**: ボトムナビ・サイドナビで共有するナビゲーション項目定義を整理

- [ ] T003 NavigationItem 型と NAVIGATION_ITEMS 定数を共通化（mobile-nav.tsx から抽出するか、両コンポーネントで共有可能にする）

**Checkpoint**: 共通定義完了

---

## Phase 3: User Story 1 - モバイルボトムナビゲーション改善 (Priority: P1)

**Goal**: 等間隔配置、テーマ一貫性、z-index 調整

### Implementation

- [ ] T004 [US1] MobileNav の等間隔配置: `justify-around` → `justify-evenly` または各 `li` に `flex-1` を適用: `apps/web/src/components/mobile-nav.tsx`
- [ ] T005 [US1] MobileNav のテーマ統一: `bg-background` → `bg-sidebar` / `text-sidebar-foreground` 等 shadcn/ui テーマ変数に切替: `apps/web/src/components/mobile-nav.tsx`
- [ ] T006 [US1] MobileNav の z-index を z-40 に調整（開発ツールと共存）: `apps/web/src/components/mobile-nav.tsx`

**Checkpoint**: ボトムナビが等間隔、テーマ統一、devtools と共存

---

## Phase 4: User Story 2 - デスクトップサイドナビゲーション (Priority: P2)

**Goal**: デスクトップで画面左側にサイドナビゲーションを表示

### Implementation

- [ ] T007 [US2] SidebarNav コンポーネントを新規作成: 固定表示、アイコン+ラベル、アクティブ状態、shadcn/ui テーマ変数使用: `apps/web/src/components/sidebar-nav.tsx`
- [ ] T008 [US2] SidebarNav に UserMenu と ModeToggle をフッター部分に配置: `apps/web/src/components/sidebar-nav.tsx`
- [ ] T009 [US2] SidebarNav を `hidden md:flex` でモバイルでは非表示に設定: `apps/web/src/components/sidebar-nav.tsx`
- [ ] T010 [US2] __root.tsx にサイドナビを組み込み、レイアウトを再構成（flex で横並び）: `apps/web/src/routes/__root.tsx`
- [ ] T011 [US2] コンテンツ領域にデスクトップ用の左マージンを適用: `apps/web/src/routes/__root.tsx`

**Checkpoint**: デスクトップでサイドナビが表示、コンテンツと重ならない

---

## Phase 5: User Story 3 - ヘッダーナビゲーション削除 (Priority: P3)

**Goal**: ヘッダーナビを削除し、全機能をボトム/サイドナビに統合

### Implementation

- [ ] T012 [US3] __root.tsx から Header コンポーネントの参照とインポートを削除: `apps/web/src/routes/__root.tsx`
- [ ] T013 [US3] グリッドレイアウトを `grid-rows-[auto_1fr]` から `grid-rows-[1fr]` に変更（ヘッダー行削除）: `apps/web/src/routes/__root.tsx`
- [ ] T014 [US3] header.tsx ファイルを削除（UserMenu, ModeToggle は残す）: `apps/web/src/components/header.tsx`

**Checkpoint**: ヘッダーが表示されない、全機能にボトム/サイドナビからアクセス可能

---

## Phase 6: User Story 4 & 5 - テーマ一貫性 & 開発ツール非干渉 (Priority: P4-P5)

**Goal**: ダークモード追従の確認、開発ツールとの共存確認

### Implementation

- [ ] T015 [US4] ボトムナビ・サイドナビのダークモード追従を確認（CSS 変数ベースなので自動追従のはず）
- [ ] T016 [US5] TanStack Router Devtools の position 設定を確認・調整（ボトムナビと干渉しない位置）: `apps/web/src/routes/__root.tsx`
- [ ] T017 [US5] React Query Devtools の position 設定を確認・調整: `apps/web/src/routes/__root.tsx`

**Checkpoint**: ダークモード追従、devtools と共存

---

## Phase 7: テスト & Polish

**Purpose**: テスト更新と品質確認

- [ ] T018 mobile-nav.test.tsx を更新: テーマクラス変更の反映、等間隔配置の確認: `apps/web/src/__tests__/mobile-nav.test.tsx`
- [ ] T019 `bun run test` / `bun run check-types` / `bun run check` の全パス確認
- [ ] T020 ブラウザ前後ナビゲーション時のアクティブ状態同期を確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1-2**: 即時開始可能
- **Phase 3 (US1)**: Phase 2 完了後
- **Phase 4 (US2)**: Phase 2 完了後、Phase 3 と並行可能
- **Phase 5 (US3)**: Phase 3, 4 完了後（ヘッダー削除はサイドナビ完成後）
- **Phase 6 (US4-5)**: Phase 3, 4, 5 完了後
- **Phase 7**: 全フェーズ完了後

### Domain Classification

- 全タスク: **FRONTEND**（apps/web/ 内のみ）
- バックエンド・データベース変更なし
