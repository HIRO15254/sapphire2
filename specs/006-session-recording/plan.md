# Implementation Plan: リアルタイムセッション記録

**Branch**: `006-session-recording` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-session-recording/spec.md`

## Summary

既存のポーカーセッション記録機能に、リアルタイムのイベントベース記録機能を追加する。キャッシュゲームとトーナメントは構造が大きく異なるため、`liveCashGameSession`と`liveTournamentSession`の別テーブルで管理する。`sessionEvent`と`sessionTablePlayer`は共有テーブルとし、両セッションテーブルへのnullable FKで参照する。完了時に既存のpokerSessionレコードを生成して分析機能との互換性を維持する。イベントの直接編集・削除に対応し、完了済みセッションの編集時はP&L・通貨トランザクションを自動再計算する。

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
│   ├── live-cash-game-session-router.md
│   ├── live-tournament-session-router.md
│   ├── session-event-router.md
│   └── session-table-player-router.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/
├── schema/
│   ├── live-cash-game-session.ts    # NEW: liveCashGameSession
│   ├── live-tournament-session.ts   # NEW: liveTournamentSession
│   ├── session-event.ts            # NEW: sessionEvent (共有)
│   ├── session-table-player.ts     # NEW: sessionTablePlayer (共有)
│   └── session.ts                  # MODIFIED: liveCashGameSessionId, liveTournamentSessionId追加
├── schema.ts                       # MODIFIED: 新テーブルexport追加
└── __tests__/
    ├── live-cash-game-session.test.ts   # NEW: スキーマテスト
    ├── live-tournament-session.test.ts  # NEW: スキーマテスト
    ├── session-event.test.ts            # NEW: スキーマテスト
    └── session-table-player.test.ts     # NEW: スキーマテスト

packages/api/src/
├── routers/
│   ├── live-cash-game-session.ts    # NEW: キャッシュゲームセッションルーター
│   ├── live-tournament-session.ts   # NEW: トーナメントセッションルーター
│   ├── session-event.ts             # NEW: SessionEventルーター
│   ├── session-table-player.ts      # NEW: SessionTablePlayerルーター
│   ├── index.ts                     # MODIFIED: 新ルーター登録
│   └── session.ts                   # MODIFIED: liveSessionId対応
└── __tests__/
    ├── live-cash-game-session.test.ts   # NEW
    ├── live-tournament-session.test.ts  # NEW
    ├── session-event.test.ts            # NEW
    └── session-table-player.test.ts     # NEW

apps/web/src/
├── routes/
│   └── live-sessions/
│       ├── index.tsx                    # NEW: セッション一覧（両タイプ統合表示）
│       ├── cash-game/
│       │   └── $sessionId.tsx           # NEW: キャッシュゲーム詳細・記録
│       └── tournament/
│           └── $sessionId.tsx           # NEW: トーナメント詳細・記録
├── components/
│   ├── live-sessions/
│   │   ├── live-session-card.tsx        # NEW: セッションカード（共通）
│   │   ├── create-session-form.tsx      # NEW: セッション開始フォーム
│   │   ├── event-timeline.tsx           # NEW: イベント履歴表示（共通）
│   │   ├── table-player-list.tsx        # NEW: 同卓者リスト（共通）
│   │   ├── session-summary.tsx          # NEW: セッションサマリー（共通）
│   │   └── __tests__/                   # NEW: コンポーネントテスト
│   ├── live-cash-game/
│   │   ├── cash-game-stack-form.tsx     # NEW: キャッシュゲーム用スタック記録
│   │   ├── cash-game-complete-form.tsx  # NEW: キャッシュアウトフォーム
│   │   └── buy-in-form.tsx             # NEW: バイインフォーム
│   ├── live-tournament/
│   │   ├── tournament-stack-form.tsx    # NEW: トーナメント用スタック記録
│   │   └── tournament-complete-form.tsx # NEW: トーナメント結果フォーム
│   └── sessions/
│       └── session-card.tsx             # MODIFIED: イベント履歴リンク追加
```

**Structure Decision**: キャッシュゲームとトーナメントは別テーブル・別ルーター・別UIコンポーネントで管理。共有部分（イベント、同卓者、一覧表示）は共通化。既存のringGame/tournamentの分離パターンと一致。

## Complexity Tracking

No Constitution violations. Table not needed.
