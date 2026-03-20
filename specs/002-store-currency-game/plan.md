# Implementation Plan: 店舗・通貨・ゲーム設定マスターデータ管理

**Branch**: `002-store-currency-game` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-store-currency-game/spec.md`

## Summary

アミューズメントポーカーの成績管理アプリの基盤となるマスターデータ管理機能を実装する。店舗・通貨・トランザクション種別・リングゲーム・トーナメント・ブラインドレベルの6エンティティをDrizzle ORMスキーマとして定義し、tRPCルーターでCRUD APIを提供、TanStack Router + shadcn/uiでモバイルファーストUIを構築する。

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun runtime
**Primary Dependencies**: React 19, TanStack Router/Query/Form, Hono, tRPC v11, shadcn/ui, Tailwind v4
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM
**Testing**: Vitest, Testing Library
**Target Platform**: Cloudflare Workers (API) + Cloudflare Pages (Web/PWA)
**Project Type**: Full-stack web application (monorepo)
**Performance Goals**: Standard web app expectations (sub-second page loads)
**Constraints**: D1 SQLite制約（JOINは可能だがサブクエリ制限あり）、オフライン非対応（Phase 1）
**Scale/Scope**: 個人利用、1店舗あたり数個〜十数個のエンティティ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ Pass | Zod input validation, Drizzle schema as source of truth |
| II. Monorepo Package Boundaries | ✅ Pass | Schema in `db`, routers in `api`, UI in `web` |
| III. Test Coverage Required | ✅ Pass | Schema tests, router integration tests, component tests planned |
| IV. Code Quality Automation | ✅ Pass | Biome/Ultracite enforced via hooks |
| V. English-Only UI | ✅ Pass | All UI text in English |
| VI. Mobile-First UI Design | ✅ Pass | Mobile-first layouts, touch-friendly targets |
| VII. API Contract Discipline | ✅ Pass | protectedProcedure for all routes, Zod validation |

## Project Structure

### Documentation (this feature)

```text
specs/002-store-currency-game/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (tRPC router contracts)
├── checklists/          # Quality checklists
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/
├── schema/
│   ├── auth.ts              # (existing) Auth tables
│   ├── todo.ts              # (to delete) Sample todo
│   ├── store.ts             # NEW: store, currency, currencyTransaction, transactionType
│   ├── ring-game.ts         # NEW: ringGame
│   └── tournament.ts        # NEW: tournament, blindLevel
├── schema.ts                # UPDATE: export new schemas
├── index.ts                 # (existing) createDb factory
└── migrations/              # NEW: generated migration

packages/api/src/
├── routers/
│   ├── index.ts             # UPDATE: add new sub-routers, remove todo
│   ├── todo.ts              # (to delete)
│   ├── store.ts             # NEW: store CRUD
│   ├── currency.ts              # NEW: currency CRUD (user-level, not store-level)
│   ├── currency-transaction.ts  # NEW: currency transaction CRD
│   ├── transaction-type.ts      # NEW: transaction type CRUD + default seeding
│   ├── ring-game.ts             # NEW: ring game CRUD + archive
│   ├── tournament.ts            # NEW: tournament CRUD + archive
│   └── blind-level.ts           # NEW: blind level CRUD + reorder
└── index.ts                 # (existing)

apps/web/src/
├── routes/
│   ├── stores/
│   │   ├── index.tsx        # NEW: store list page
│   │   └── $storeId.tsx     # NEW: store detail (tabs: currency/ring/tournament)
│   ├── todos.tsx             # (to delete)
│   └── ...                   # (existing routes unchanged)
├── components/
│   ├── mobile-nav.tsx       # UPDATE: add Stores nav item, remove Todos
│   ├── stores/              # NEW: store-related components
│   │   ├── store-form.tsx
│   │   ├── store-card.tsx
│   │   ├── currency-tab.tsx
│   │   ├── currency-form.tsx
│   │   ├── transaction-list.tsx
│   │   ├── transaction-form.tsx
│   │   ├── ring-game-tab.tsx
│   │   ├── ring-game-form.tsx
│   │   ├── tournament-tab.tsx
│   │   ├── tournament-form.tsx
│   │   └── blind-level-editor.tsx
│   └── ui/                  # NEW shadcn/ui components as needed
│       ├── tabs.tsx
│       ├── dialog.tsx
│       ├── select.tsx
│       ├── badge.tsx
│       └── separator.tsx
└── ...
```

**Structure Decision**: 既存のモノレポ構造に従い、`db`パッケージにスキーマ、`api`パッケージにルーター、`web`アプリにUI。スキーマはドメイン単位でファイル分割（store.ts, ring-game.ts, tournament.ts）。
