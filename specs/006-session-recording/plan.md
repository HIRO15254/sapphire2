# Implementation Plan: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-session-recording/spec.md`

## Summary

既存のポーカーセッション記録機能に、リアルタイムのイベントベース記録機能を追加する。LiveSession + SessionEvent + SessionTablePlayerの3テーブルを新設し、スタック履歴・同卓者・トーナメント状況をイベントとして記録。完了時に既存のpokerSessionレコードを生成して分析機能との互換性を維持する。イベントの直接編集・削除に対応し、完了済みセッションの編集時はP&L・通貨トランザクションを自動再計算する。

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: Hono, tRPC v11, React 19, TanStack Router, TanStack Query, shadcn/ui, Drizzle ORM, Zod
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM
**Testing**: Vitest, Testing Library
**Target Platform**: Cloudflare Workers (backend), Vite SPA (frontend)
**Project Type**: Web application (monorepo: apps/server + apps/web + packages/*)
**Performance Goals**: イベント記録30秒以内（SC-001）、100件以上のイベントで表示支障なし（SC-006）
**Constraints**: Cloudflare D1のSQLite制限（JSON関数限定）、オフラインファースト（TanStack Query + IndexedDB永続化）
**Scale/Scope**: 個人利用、1セッションあたり最大100〜数百イベント

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ Pass | Zod schemas for event payloads, Drizzle for DB types, strict mode |
| II. Monorepo Package Boundaries | ✅ Pass | Schema in @sapphire2/db, routers in @sapphire2/api, UI in apps/web |
| III. Test Coverage Required | ✅ Pass | Schema tests, router tests, component tests planned |
| IV. Code Quality Automation | ✅ Pass | Biome/Ultracite, PostToolUse hook |
| V. English-Only UI | ✅ Pass | All UI text in English |
| VI. Mobile-First UI Design | ✅ Pass | Mobile-first layout for session recording UI |
| VII. API Contract Discipline | ✅ Pass | tRPC routers with Zod input validation, protectedProcedure |
| VIII. Offline-First Data Layer | ✅ Pass | TanStack Query with mutationOptions, optimistic updates |

**Gate Result**: All principles pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/006-session-recording/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── live-session-router.md
│   ├── session-event-router.md
│   └── session-table-player-router.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/
├── schema/
│   ├── live-session.ts          # NEW: LiveSession, SessionEvent, SessionTablePlayer
│   └── session.ts               # MODIFIED: liveSessionId追加
├── schema.ts                    # MODIFIED: 新テーブルexport追加
└── __tests__/
    └── live-session.test.ts     # NEW: スキーマテスト

packages/api/src/
├── routers/
│   ├── live-session.ts          # NEW: LiveSessionルーター
│   ├── session-event.ts         # NEW: SessionEventルーター
│   ├── session-table-player.ts  # NEW: SessionTablePlayerルーター
│   ├── index.ts                 # MODIFIED: 新ルーター登録
│   └── session.ts               # MODIFIED: liveSessionId対応
└── __tests__/
    ├── live-session.test.ts     # NEW: ルーターテスト
    ├── session-event.test.ts    # NEW: ルーターテスト
    └── session-table-player.test.ts # NEW: ルーターテスト

apps/web/src/
├── routes/
│   └── live-sessions/
│       ├── index.tsx            # NEW: セッション一覧
│       └── $liveSessionId.tsx   # NEW: セッション詳細・記録
├── components/
│   ├── live-sessions/
│   │   ├── live-session-card.tsx       # NEW: セッションカード
│   │   ├── live-session-form.tsx       # NEW: セッション開始フォーム
│   │   ├── event-timeline.tsx          # NEW: イベント履歴表示
│   │   ├── event-form.tsx             # NEW: イベント記録フォーム
│   │   ├── stack-record-form.tsx      # NEW: スタック記録フォーム
│   │   ├── complete-session-form.tsx  # NEW: セッション完了フォーム
│   │   ├── table-player-list.tsx      # NEW: 同卓者リスト
│   │   ├── session-summary.tsx        # NEW: セッションサマリー
│   │   └── __tests__/                 # NEW: コンポーネントテスト
│   └── sessions/
│       └── session-card.tsx           # MODIFIED: イベント履歴リンク追加
```

**Structure Decision**: 既存のmonorepo構造（packages/db, packages/api, apps/web）に従い、新テーブル・ルーター・ページを追加。既存のpokerSession機能への変更は最小限（liveSessionIdカラム追加とリンク表示のみ）。

## Complexity Tracking

No Constitution violations. Table not needed.
