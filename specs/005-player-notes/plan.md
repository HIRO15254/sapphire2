# Implementation Plan: プレイヤーメモ機能

**Branch**: `005-player-notes` | **Date**: 2026-03-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-player-notes/spec.md`

## Summary

プレイヤー（対戦相手）の登録・管理機能を追加し、プレイヤーに色付きタグを割り当て、Tiptapリッチテキストエディタを使ったHTML形式メモを作成できるようにする。既存のStore/SessionTag CRUDパターンを踏襲し、新規DBスキーマ・tRPCルーター・フロントエンドルートを追加する。

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: React 19, Hono, tRPC v11, Drizzle ORM, shadcn/ui, Tiptap (新規)
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM
**Testing**: Vitest, Testing Library
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (Web)
**Project Type**: Web application (monorepo: apps/web, apps/server, packages/*)
**Performance Goals**: プレイヤー一覧表示・検索1秒以内 (50人以上)
**Constraints**: Mobile-first UI, Offline-first data layer (TanStack Query + IndexedDB)
**Scale/Scope**: 個人ユーザーあたり50-200人程度のプレイヤー

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | PASS | Drizzle schema → Zod validation → tRPC type inference |
| II. Monorepo Package Boundaries | PASS | Schema in packages/db, routers in packages/api, UI in apps/web |
| III. Test Coverage Required | PASS | Unit (router), Component (forms), Schema tests planned |
| IV. Code Quality Automation | PASS | Biome/Ultracite, PostToolUse hook |
| V. English-Only UI | PASS | All UI text in English |
| VI. Mobile-First UI Design | PASS | Mobile-first layouts, responsive dialog pattern |
| VII. API Contract Discipline | PASS | tRPC protectedProcedure + Zod input schemas |
| VIII. Offline-First Data Layer | PASS | TanStack Query queryOptions/mutationOptions + optimistic updates |

## Project Structure

### Documentation (this feature)

```text
specs/005-player-notes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── player.ts        # Player router contract
│   ├── playerTag.ts     # PlayerTag router contract
│   └── playerMemo.ts    # PlayerMemo router contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/schema/
├── player.ts            # Player, PlayerTag, PlayerToPlayerTag tables + relations

packages/api/src/routers/
├── player.ts            # Player CRUD router
├── player-tag.ts        # PlayerTag CRUD router (with color)
├── player-memo.ts       # PlayerMemo update/get router

apps/web/src/
├── routes/
│   └── players/
│       └── index.tsx    # Player list page (with tag filtering, create/edit/delete)
├── components/
│   └── players/
│       ├── player-form.tsx       # Player create/edit form
│       ├── player-card.tsx       # Player list item card
│       ├── player-tag-manager.tsx # Tag management UI (standalone)
│       ├── player-memo-editor.tsx # Tiptap rich text editor wrapper
│       └── player-filters.tsx    # Tag-based filter controls
```

**Structure Decision**: Follows existing patterns - schema in packages/db, routers in packages/api, routes and components in apps/web. New `/players/` route parallels existing `/sessions/`, `/stores/`, `/currencies/` routes.

## Complexity Tracking

No constitution violations to justify.
