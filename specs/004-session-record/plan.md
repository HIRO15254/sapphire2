# Implementation Plan: Session Post-Recording

**Branch**: `004-session-record` | **Date**: 2026-03-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-session-record/spec.md`

## Summary

Implement session post-recording for poker P&L tracking. Users can record cash game sessions with full game configuration (variant, SB/BB, table size, ante), buy-in/cash-out, start/end times, memo, and optional EV tracking. Tournament sessions support buy-in/entry fee/placement/prize with rebuy/addon/bounty. When no existing ring game is selected, a standalone ring game (storeId=null) is auto-created from the entered game config. Sessions optionally link to stores, game configurations, and currencies. When linked to a currency, the system auto-generates a read-only currency transaction with the net P&L. The sessions page displays summary statistics (total P&L, win rate, EV metrics) with filters, followed by a paginated session list.

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun runtime
**Primary Dependencies**: React 19, TanStack Router, TanStack Query, tRPC v11, Hono, shadcn/ui, Tailwind v4, Zod
**Storage**: Cloudflare D1 (SQLite) via Drizzle ORM
**Testing**: Vitest, Testing Library
**Target Platform**: Web (PWA, offline-first), mobile-first responsive
**Project Type**: Full-stack web application (monorepo)
**Performance Goals**: Session list first page in < 2 seconds with 500+ sessions
**Constraints**: Offline-capable, mobile-first (360px+), English-only UI
**Scale/Scope**: Hundreds of sessions per user, single new DB table + one column addition + ringGame.storeId made nullable

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | PASS | Zod validation on all router inputs, Drizzle schema as source of truth, strict TypeScript |
| II. Monorepo Package Boundaries | PASS | Schema in `packages/db`, router in `packages/api`, UI in `apps/web`. No cross-boundary violations |
| III. Test Coverage Required | PASS | Router smoke tests planned. Component tests for form/card. Schema validation tests |
| IV. Code Quality Automation | PASS | Biome/Ultracite auto-format. lint-staged on commit |
| V. English-Only UI | PASS | All labels, buttons, messages in English |
| VI. Mobile-First UI Design | PASS | Session form in ResponsiveDialog, card-based list, single-column default |
| VII. API Contract Discipline | PASS | All procedures use protectedProcedure + Zod input schemas. See contracts/session-router.md |
| VIII. Offline-First Data Layer | PASS | TanStack Query with offlineFirst networkMode, optimistic mutations, IndexedDB persistence |

## Project Structure

### Documentation (this feature)

```text
specs/004-session-record/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── session-router.md  # tRPC router contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
packages/db/src/schema/
├── store.ts             # MODIFY: add sessionId to currencyTransaction
├── ring-game.ts         # MODIFY: make storeId nullable for standalone game configs
└── session.ts           # NEW: session table + relations

packages/api/src/
├── routers/
│   ├── index.ts         # MODIFY: register sessionRouter
│   ├── session.ts       # NEW: session CRUD + summary + currency sync
│   ├── currency-transaction.ts  # MODIFY: read-only check for session transactions
│   └── transaction-type.ts      # MODIFY: seed "Session Result" type
└── __tests__/
    └── session.test.ts  # NEW: router smoke tests

apps/web/src/
├── routes/
│   ├── __root.tsx       # MODIFY: add Sessions nav item (via mobile-nav.tsx NAVIGATION_ITEMS)
│   └── sessions/
│       └── index.tsx    # NEW: sessions page (summary + filters + list)
└── components/
    └── sessions/
        ├── session-form.tsx     # NEW: create/edit form (type-conditional)
        ├── session-card.tsx     # NEW: session list item card
        ├── session-summary.tsx  # NEW: summary statistics display
        └── session-filters.tsx  # NEW: filter controls
```

**Structure Decision**: Follows existing monorepo conventions. New schema file for session entity (consistent with ring-game.ts, tournament.ts pattern). Single router file handles all session operations including currency transaction sync. Frontend adds a new route under `/sessions/` with domain-specific components in `components/sessions/`.
