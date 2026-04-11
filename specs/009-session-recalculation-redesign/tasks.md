# Tasks: Live Session Recalculation Redesign

**Input**: Design documents from `/specs/009-session-recalculation-redesign/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/recalculation-service.md, quickstart.md

**Tests**: Included — Constitution III mandates test coverage for all implementation tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project setup needed. This is a refactoring of existing code. Phase skipped.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the new pure function and refactor the recalculation service. These are blocking prerequisites for all user story router changes.

**CRITICAL**: No router simplification can begin until the unified recalculation functions are ready.

- [x] T001 Add `computeTimestampsFromEvents` pure function that derives `startedAt` (first `session_start`) and `endedAt` (last `session_end`) from an event array in `packages/api/src/services/live-session-pl.ts`
- [x] T002 Refactor `recalculateCashGamePL` into `recalculateCashGameSession` in `packages/api/src/services/live-session-pl.ts`: expand to derive all fields (P&L via `computeCashGamePLFromEvents`, timestamps via `computeTimestampsFromEvents`, break minutes via `computeBreakMinutesFromEvents`), update live session `startedAt`/`endedAt`, upsert `pokerSession` with all derived fields (`buyIn`, `cashOut`, `evCashOut`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`), and sync `currencyTransaction`. Skip `pokerSession` upsert when session status is `"active"`
- [x] T003 Refactor `recalculateTournamentPL` into `recalculateTournamentSession` in `packages/api/src/services/live-session-pl.ts`: expand to derive all fields (P&L via `computeTournamentPLFromEvents`, timestamps, break minutes), update live session `startedAt`/`endedAt`, upsert `pokerSession` with all derived fields (`placement`, `totalEntries`, `prizeMoney`, `bountyPrizes`, `rebuyCount`, `rebuyCost`, `addonCost`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`), and sync `currencyTransaction`. Skip `pokerSession` upsert when session status is `"active"`
- [x] T004 Consolidate duplicated `getSessionResultTypeId` helper: remove copies from `packages/api/src/routers/live-cash-game-session.ts` and `packages/api/src/routers/live-tournament-session.ts`, keep the single copy in `packages/api/src/services/live-session-pl.ts` and export it
- [x] T005 [P] Add unit tests for `computeTimestampsFromEvents` in `packages/api/src/__tests__/live-session-pl.test.ts`: test single session_start, multiple session_start/session_end pairs, empty events, events with no lifecycle events
- [x] T006 [P] Add unit tests for `computeCashGamePLFromEvents` in `packages/api/src/__tests__/live-session-pl.test.ts`: test single chip_add, multiple chip_adds (initial + addons), stack_records with allIns (EV calculation), missing stack_record (cashOut null), empty events
- [x] T007 [P] Add unit tests for `computeTournamentPLFromEvents` in `packages/api/src/__tests__/live-session-pl.test.ts`: test tournament_stack_record with chipPurchases (rebuy/addon counting), tournament_result extraction, missing tournament_result (profitLoss null), legacy rebuy/addon fields
- [x] T008 [P] Add unit tests for `computeBreakMinutesFromEvents` in `packages/api/src/__tests__/live-session-pl.test.ts`: test single session with no breaks, session with one break (session_end then session_start), multiple breaks (reopen scenario), no session_end events

**Checkpoint**: Unified recalculation service is ready with full test coverage. Router refactoring can now begin.

---

## Phase 3: User Story 1 — Event History as Single Source of Truth for Cash Game (Priority: P1) MVP

**Goal**: Cash game sessions derive all poker session fields from events. Recalculation triggers on every event mutation (not just completed sessions).

**Independent Test**: Create a cash game, complete it, then edit/delete events. Verify pokerSession fields (buyIn, cashOut, evCashOut, startedAt, endedAt, breakMinutes) and currencyTransaction are correctly recalculated.

### Implementation for User Story 1

- [x] T009 [US1] Simplify `complete` procedure in `packages/api/src/routers/live-cash-game-session.ts`: remove inline P&L computation (~40 lines), remove local `createCurrencyTransactionForSession` and `getSessionResultTypeId`, keep only event insertion + status update + call to `recalculateCashGameSession`. Return pokerSessionId by querying after recalculation
- [x] T010 [US1] Update `sessionEvent` router in `packages/api/src/routers/session-event.ts`: in `create`, `update`, and `delete` mutations, replace `recalculateIfCompleted()` with unconditional call to `recalculateCashGameSession` (when `liveCashGameSessionId` is set). Remove the `recalculateIfCompleted` wrapper function
- [x] T011 [US1] Add lifecycle event deletion guard in `packages/api/src/routers/session-event.ts`: in `delete` mutation, throw `TRPCError` with code `BAD_REQUEST` if `event.eventType` is `"session_start"` or `"session_end"`

**Checkpoint**: Cash game recalculation is unified. Editing events on completed cash game sessions recalculates all fields including timestamps and break minutes.

---

## Phase 4: User Story 2 — Event History as Single Source of Truth for Tournament (Priority: P1)

**Goal**: Tournament sessions derive all poker session fields from events via the same unified recalculation pattern as cash games.

**Independent Test**: Create a tournament, complete it with placement/prize data, then modify tournament_stack_record and tournament_result events. Verify all derived fields are recalculated.

### Implementation for User Story 2

- [x] T012 [US2] Simplify `complete` procedure in `packages/api/src/routers/live-tournament-session.ts`: remove inline P&L computation, remove local `upsertPokerSession`, `upsertCurrencyTransaction`, and `getSessionResultTypeId`, keep only event insertion + status update + call to `recalculateTournamentSession`. Return pokerSessionId by querying after recalculation
- [x] T013 [US2] Update `sessionEvent` router in `packages/api/src/routers/session-event.ts`: in `create`, `update`, and `delete` mutations, add unconditional call to `recalculateTournamentSession` (when `liveTournamentSessionId` is set). This completes the removal of `recalculateIfCompleted` for both session types

**Checkpoint**: Tournament recalculation is unified. Both cash game and tournament sessions use the same recalculation pattern.

---

## Phase 5: User Story 3 — Unified Recalculation on Session Completion (Priority: P1)

**Goal**: Verify that the completion flow produces identical results to what the recalculation service would produce independently. This is a validation story — the implementation is already done in US1/US2.

**Independent Test**: Complete a session and verify the pokerSession. Then reopen it, add more events, re-complete, and verify the pokerSession is correctly updated (not duplicated).

### Implementation for User Story 3

- [x] T014 [US3] Verify and clean up `reopen` procedure in `packages/api/src/routers/live-cash-game-session.ts`: ensure the event insertion after reopen triggers recalculation of live session metadata (startedAt should remain unchanged as it uses the first session_start). Remove any now-unnecessary code
- [x] T015 [US3] Verify and clean up `reopen` procedure in `packages/api/src/routers/live-tournament-session.ts`: same verification as cash game — ensure consistency after reopen + re-complete cycle

**Checkpoint**: Complete → reopen → re-complete cycle produces correct results for both session types.

---

## Phase 6: User Story 4 — Recalculation of Live Session Metadata from Events (Priority: P2)

**Goal**: Live session records themselves (startedAt/endedAt) stay consistent with their event history on every event mutation.

**Independent Test**: Edit the first `session_start` event's `occurredAt` on an active session. Verify the live session's `startedAt` is updated.

### Implementation for User Story 4

- [x] T016 [US4] Verify that `recalculateCashGameSession` in `packages/api/src/services/live-session-pl.ts` updates `liveCashGameSession.startedAt` even when session status is `"active"` (the early return should happen AFTER the startedAt update, not before). Adjust the function ordering if needed
- [x] T017 [US4] Verify that `recalculateTournamentSession` in `packages/api/src/services/live-session-pl.ts` updates `liveTournamentSession.startedAt` even when session status is `"active"`. Adjust the function ordering if needed

**Checkpoint**: Live session metadata is always consistent with event timestamps, regardless of session status.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Clean up, verify no regressions, remove dead code

- [x] T018 Remove unused imports and dead code from `packages/api/src/routers/live-cash-game-session.ts`: remove `computeCashGamePLFromEvents` import if no longer used in `getById`, remove `computeBreakMinutesFromEvents` import, remove `createCurrencyTransactionForSession` function, remove `getSessionResultTypeId` function
- [x] T019 [P] Remove unused imports and dead code from `packages/api/src/routers/live-tournament-session.ts`: remove `computeTournamentPLFromEvents` import if no longer used, remove `computeBreakMinutesFromEvents` import, remove `upsertPokerSession` function, remove `upsertCurrencyTransaction` function, remove `getSessionResultTypeId` function, remove `fetchTournamentMasterData` if moved to service
- [x] T020 [P] Run full test suite (`bun run test`) and fix any regressions
- [x] T021 [P] Run type checking (`bun run check-types`) and fix any type errors
- [x] T022 Run linter (`bun x ultracite check`) and fix any formatting issues

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — can start immediately
- **US1 Cash Game (Phase 3)**: Depends on T001-T004 (foundational service refactoring)
- **US2 Tournament (Phase 4)**: Depends on T001-T004 (foundational service refactoring). Can run in parallel with US1
- **US3 Unified Completion (Phase 5)**: Depends on US1 (T009-T011) and US2 (T012-T013)
- **US4 Live Session Metadata (Phase 6)**: Depends on T002-T003 (recalculation functions). Can run in parallel with US1/US2
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational phase only
- **US2 (P1)**: Depends on Foundational phase only. Can run in parallel with US1
- **US3 (P1)**: Depends on US1 + US2 (validation of their combined work)
- **US4 (P2)**: Depends on Foundational phase only. Can run in parallel with US1/US2

### Within Each User Story

- Service changes before router changes
- Router changes before verification
- Tests in Foundational phase cover pure functions; integration is verified by existing test suite

### Parallel Opportunities

- T005, T006, T007, T008 (all test tasks) can run in parallel
- T009 (US1 cash game router) and T012 (US2 tournament router) can run in parallel after Foundational
- T014 and T015 (US3 reopen verification) can run in parallel
- T016 and T017 (US4 metadata verification) can run in parallel
- T018, T019, T020, T021, T022 (polish tasks) can mostly run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all test tasks in parallel (different test suites in same file, but independent):
Task: "T005 Unit tests for computeTimestampsFromEvents"
Task: "T006 Unit tests for computeCashGamePLFromEvents"
Task: "T007 Unit tests for computeTournamentPLFromEvents"
Task: "T008 Unit tests for computeBreakMinutesFromEvents"
```

## Parallel Example: User Stories 1 + 2

```bash
# After Foundational phase, launch US1 and US2 router changes in parallel:
Task: "T009 [US1] Simplify cash game complete in live-cash-game-session.ts"
Task: "T012 [US2] Simplify tournament complete in live-tournament-session.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 2: Foundational (unified service + tests)
2. Complete Phase 3: US1 — Cash game recalculation unified
3. Complete Phase 4: US2 — Tournament recalculation unified
4. **STOP and VALIDATE**: Run full test suite, verify both session types
5. This covers 80% of the value (unified recalculation for both session types)

### Incremental Delivery

1. Foundational → Service layer ready
2. US1 (Cash Game) → Test independently → Core value delivered
3. US2 (Tournament) → Test independently → Full P1 coverage
4. US3 (Completion verification) → Confidence in reopen flows
5. US4 (Metadata sync) → Edge case coverage
6. Polish → Clean codebase

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database migration needed — all changes are in `packages/api`
- This is a refactoring: external API contracts are unchanged
- Total: 22 tasks across 7 phases
- The `computeSummaryFromEvents` function in `live-cash-game-session.ts` (used by `getById`) is NOT removed — it serves the real-time summary for the detail view, separate from the recalculation path
