# Implementation Plan: Live Session Recalculation Redesign

**Branch**: `009-session-recalculation-redesign` | **Date**: 2026-04-11 | **Spec**: `specs/009-session-recalculation-redesign/spec.md`
**Input**: Feature specification from `/specs/009-session-recalculation-redesign/spec.md`

## Summary

Redesign the live session recalculation flow so that event history is the single source of truth for all derived session data. Currently, P&L computation is duplicated between the session completion flow (inline in router) and the recalculation service (called on event edits). The redesign unifies these into a single recalculation service that derives ALL fields—P&L, timestamps, break minutes—from events, and is called consistently on every event mutation and on session completion.

## Technical Context

**Language/Version**: TypeScript (strict mode)
**Primary Dependencies**: tRPC v11, Hono, Drizzle ORM, Zod
**Storage**: Cloudflare D1 (SQLite)
**Testing**: Vitest
**Target Platform**: Cloudflare Workers (server-side only; no frontend changes)
**Project Type**: Web service (backend API refactoring)
**Performance Goals**: N/A (event count per session is <100; full recomputation is O(n))
**Constraints**: No database migration; code-only refactoring
**Scale/Scope**: 4 files modified, 1 new test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Type Safety First | PASS | All functions are fully typed. Pure functions use explicit input/output types. No `any`. |
| II | Monorepo Package Boundaries | PASS | Changes are within `packages/api` (routers + services). No cross-package boundary violations. |
| III | Test Coverage Required | PASS | New unit tests for all pure computation functions in `packages/api/src/__tests__/live-session-pl.test.ts`. |
| IV | Code Quality Automation | PASS | Biome/Ultracite formatting applies. No new tooling needed. |
| V | English-Only UI | N/A | No UI changes. |
| VI | Mobile-First UI Design | N/A | No UI changes. |
| VII | API Contract Discipline | PASS | tRPC router procedures maintain existing input/output contracts. Internal service functions are refactored but external API shape is unchanged. |
| VIII | Offline-First Data Layer | N/A | No frontend changes. Server-side recalculation only. |

**Gate result**: PASS — No violations.

## Project Structure

### Documentation (this feature)

```text
specs/009-session-recalculation-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── recalculation-service.md  # Service contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (files to modify)

```text
packages/api/
├── src/
│   ├── services/
│   │   └── live-session-pl.ts         # MODIFY: Unified recalculation service
│   ├── routers/
│   │   ├── session-event.ts           # MODIFY: Unconditional recalculation trigger
│   │   ├── live-cash-game-session.ts  # MODIFY: Simplify complete procedure
│   │   └── live-tournament-session.ts # MODIFY: Simplify complete procedure
│   └── __tests__/
│       └── live-session-pl.test.ts    # NEW: Unit tests for pure functions
```

**Structure Decision**: All changes are within the existing `packages/api` package. No new packages, directories, or architectural changes needed.

## Complexity Tracking

No constitution violations to justify. This is a simplification refactoring that reduces code duplication.
