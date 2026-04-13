# Implementation Plan: Session Event Redesign

**Branch**: `claude/redesign-session-events-yZdzR` | **Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-redesign-session-events/spec.md`

## Summary

ライブセッション記録のイベント体系を再設計する。現在の8種類のイベント（chip_add, stack_record, tournament_stack_record, tournament_result, player_join, player_leave, session_start, session_end）を、12種類の新しいイベント体系に移行する。主な変更点:

1. Session Start/End にペイロード（バイイン額/キャッシュアウト額/トーナメント結果）を追加
2. Session Pause/Resume イベントの新設（中断・再開管理）
3. 複合イベント（stack_record, tournament_stack_record）の分離（update_stack, all_in, purchase_chips, update_tournament_info）
4. Memo イベントの新設
5. 既存データのインプレースマイグレーション

## Technical Context

**Language/Version**: TypeScript ^6.0.2 (strict mode)
**Primary Dependencies**: tRPC v11, Hono, Drizzle ORM ^0.45.2, Zod ^4.3.6, React 19, TanStack Router/Query, shadcn/ui, Tailwind v4
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM
**Testing**: Vitest, Testing Library
**Target Platform**: Web (Cloudflare Workers backend, browser frontend)
**Project Type**: Full-stack web application (monorepo)
**Performance Goals**: Standard web app performance (personal use tool)
**Constraints**: Offline-first via TanStack Query persistence, D1 SQLite limitations
**Scale/Scope**: Single user personal tool, ~10 files modified across 3 packages + 1 app

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| I. Type Safety First | PASS | All new Zod schemas with strict typing. No `any`. Discriminated union for tournament session_end. |
| II. Monorepo Package Boundaries | PASS | Constants/schemas in `@sapphire2/db`, routers/services in `@sapphire2/api`, UI in `apps/web`. No cross-boundary violations. |
| III. Test Coverage Required | PASS | Unit tests for schemas, integration tests for routers, component tests for UI. |
| IV. Code Quality Automation | PASS | Biome/Ultracite formatting. No manual formatting. |
| V. English-Only UI | PASS | All event type labels, UI text in English. |
| VI. Mobile-First UI Design | PASS | Existing session-events-scene is mobile-first. New editors follow same pattern. |
| VII. API Contract Discipline | PASS | tRPC with Zod validation on all inputs. Protected procedures. |
| VIII. Offline-First Data Layer | PASS | TanStack Query with optimistic updates for event mutations. |

**Post-Phase 1 Re-check**: All gates continue to pass. No new packages or pattern violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/011-redesign-session-events/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── session-event-api.md
├── checklists/
│   └── requirements.md
├── spec.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/
├── src/
│   ├── constants/
│   │   └── session-event-types.ts    # Event types, Zod schemas, validation
│   ├── schema/
│   │   └── session-event.ts          # DB table definition (unchanged)
│   ├── migrations/
│   │   └── XXXX_redesign_session_events.sql  # Data migration
│   └── __tests__/
│       ├── session-event-types.test.ts
│       └── session-event.test.ts

packages/api/
├── src/
│   ├── routers/
│   │   ├── session-event.ts          # Event CRUD with state validation
│   │   ├── live-cash-game-session.ts # create/complete/reopen changes
│   │   └── live-tournament-session.ts # complete changes, reopen removal
│   └── services/
│       └── live-session-pl.ts        # P&L recalculation

apps/web/
└── src/
    └── live-sessions/
        ├── components/
        │   └── session-events-scene.tsx  # Event timeline UI
        └── hooks/
            └── use-session-events.ts     # Event hook with optimistic updates
```

**Structure Decision**: Existing monorepo structure maintained. Changes span `packages/db` (constants/schemas), `packages/api` (routers/services), and `apps/web` (UI). No new packages or directories needed.

## Complexity Tracking

No constitution violations. No complexity justification needed.
