# Implementation Plan: アップデートノート表示

**Branch**: `009-update-notes-display` | **Date**: 2026-04-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-update-notes-display/spec.md`

## Summary

アプリケーションのアップデート履歴を表示するモーダル/シートを追加する。ユーザーはアップデートノート一覧をバージョン名・リリース日とともに閲覧でき、アコーディオンで詳細を確認できる。未確認のアップデートは強調表示される。リリース後の初回アクセスでシートが自動的に開く。

アップデートノートデータはフロントエンドの静的定数として管理し、確認状態のみD1データベースで永続化する。既存のResponsiveDialog + Context Providerパターンに沿った実装。

## Technical Context

**Language/Version**: TypeScript (strict mode)  
**Primary Dependencies**: React 19, TanStack Router, TanStack Query, shadcn/ui (Accordion, ResponsiveDialog, Badge), Tailwind v4, tRPC v11, Hono, Drizzle ORM  
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM — `update_note_view` テーブルを追加  
**Testing**: Vitest, Testing Library  
**Target Platform**: Web (Cloudflare Workers backend, Vite SPA frontend)  
**Project Type**: Web application (monorepo: apps/web, apps/server, packages/db, packages/api)  
**Performance Goals**: 標準Webアプリ水準（即時UI応答）  
**Constraints**: Offline-first (TanStack Query), Mobile-first UI, English-only UI  
**Scale/Scope**: 単一テーブル追加、tRPCルーター1件、フロントエンドコンポーネント3件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Type Safety First | PASS | TypeScript strict mode、Zod入力バリデーション、Drizzle型生成 |
| II. Monorepo Package Boundaries | PASS | db → api → web の方向でのみ依存。静的定数はweb内に配置 |
| III. Test Coverage Required | PASS | スキーマテスト、ルーターテスト、コンポーネントテストを計画 |
| IV. Code Quality Automation | PASS | Biome/Ultraciteによる自動フォーマット適用 |
| V. English-Only UI | PASS | 全UIテキスト（タイトル、ラベル、バッジ、変更内容）を英語で記述 |
| VI. Mobile-First UI Design | PASS | ResponsiveDialog（モバイル:Drawer, デスクトップ:Dialog）、タッチフレンドリーなアコーディオン |
| VII. API Contract Discipline | PASS | tRPC protectedProcedure、Zod入力スキーマ |
| VIII. Offline-First Data Layer | PASS | TanStack Query queryOptions/mutationOptions パターン、offlineFirst networkMode |

**Post-Phase 1 Re-check**: 全ゲートPASS。設計変更による追加違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/009-update-notes-display/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── trpc-router.md   # tRPC endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/
├── src/
│   ├── schema/
│   │   └── update-note-view.ts    # NEW: Drizzle schema
│   ├── schema.ts                  # MODIFY: export追加
│   └── migrations/
│       └── 0011_*.sql             # NEW: auto-generated migration

packages/api/
├── src/
│   └── routers/
│       ├── update-note-view.ts    # NEW: tRPC router
│       └── index.ts               # MODIFY: router登録

apps/web/
├── src/
│   ├── update-notes/              # NEW: feature module
│   │   ├── constants.ts           # 静的アップデートノートデータ
│   │   ├── hooks/
│   │   │   └── use-update-notes-sheet.tsx  # Context provider + auto-open
│   │   └── components/
│   │       └── update-notes-sheet.tsx      # ResponsiveDialog + Accordion UI
│   └── shared/
│       └── components/
│           ├── authenticated-shell.tsx  # MODIFY: Provider追加
│           └── user-menu.tsx            # MODIFY: メニューアイテム追加

tests/
├── packages/db/src/__tests__/
│   └── update-note-view.test.ts         # Schema tests
├── packages/api/src/__tests__/
│   └── update-note-view.test.ts         # Router integration tests
└── apps/web/src/update-notes/__tests__/
    └── update-notes-sheet.test.tsx      # Component tests
```

**Structure Decision**: 既存のモノレポ構成（packages/db, packages/api, apps/web）に従い、フロントエンド側はfeature moduleパターン（`update-notes/`ディレクトリ）で整理。既存の`live-sessions/`ディレクトリと同じパターン。

## Implementation Design

### Phase 1: Database & Backend

#### 1.1 Drizzle Schema (`packages/db/src/schema/update-note-view.ts`)

```typescript
// Table: update_note_view
// Fields: id (PK), userId (FK→user), version (text), viewedAt (timestamp)
// Unique constraint: userId + version
// Index: userId
```

- 既存の`session-tag.ts`や`player.ts`のパターンに従う
- `userRelations`にmanyリレーションを追加（既存の`schema/auth.ts`を修正）

#### 1.2 tRPC Router (`packages/api/src/routers/update-note-view.ts`)

3つのprocedure:
- `list`: 全確認済みバージョンを返す
- `markViewed`: バージョンを確認済みにする（冪等）
- `getLatestViewedVersion`: 最終確認バージョンを返す（自動表示判定用）

詳細: [contracts/trpc-router.md](./contracts/trpc-router.md)

### Phase 2: Frontend

#### 2.1 静的データ (`apps/web/src/update-notes/constants.ts`)

```typescript
// UpdateNote型定義
// UPDATE_NOTES配列（最新バージョンが先頭）
// LATEST_VERSION定数（自動表示トリガー用）
```

#### 2.2 Context Provider (`apps/web/src/update-notes/hooks/use-update-notes-sheet.tsx`)

- `StackSheetProvider`パターンに従ったContext Provider
- シートのopen/close状態管理
- 自動表示ロジック:
  1. `getLatestViewedVersion`クエリでユーザーの最終確認バージョンを取得
  2. `LATEST_VERSION`と比較
  3. 未確認の場合、`useEffect`でシートを自動オープン
- 初回ユーザー（viewedVersionがnull）の場合は自動表示しない（Edge Case対応）

#### 2.3 Sheet Component (`apps/web/src/update-notes/components/update-notes-sheet.tsx`)

- `ResponsiveDialog`でラップ
- タイトル: "Update Notes"
- 内容: `Accordion`コンポーネントで各バージョンを表示
  - トリガー: バージョン名 + リリース日 + 未確認Badge("NEW")
  - コンテンツ: 変更内容リスト
- アコーディオン展開時に`markViewed` mutationを発火
- 降順（新しい順）で表示

#### 2.4 Integration

- `AuthenticatedShell`: `UpdateNotesProvider`をProviderチェーンに追加、`UpdateNotesSheet`コンポーネントを配置
- `UserMenu`: "Update Notes"ドロップダウンアイテムを追加、クリックでシートをオープン

### Phase 3: Testing

- **Schema tests**: テーブル作成、ユニーク制約、カスケード削除の検証
- **Router tests**: list/markViewed/getLatestViewedVersionの正常・異常系
- **Component tests**: シート表示、アコーディオン展開、Badge表示、自動表示ロジック

## Complexity Tracking

> 違反なし。全Constitution Gateクリア。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (なし) | — | — |
