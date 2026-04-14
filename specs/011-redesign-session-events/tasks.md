# Tasks: セッションイベント再設計

**Input**: Design documents from `/specs/011-redesign-session-events/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/session-event-api.md

**Tests**: Included per project constitution (III. Test Coverage Required).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **packages/db**: Database schemas, constants, migrations
- **packages/api**: tRPC routers, services
- **apps/web**: React frontend

---

## Phase 1: Setup

**Purpose**: No setup needed — existing monorepo project with all infrastructure in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New event type definitions, Zod schemas, validation helpers, and core router/service updates that ALL user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Rewrite event type arrays (CASH_EVENT_TYPES, TOURNAMENT_EVENT_TYPES, COMMON_EVENT_TYPES, LIFECYCLE_EVENT_TYPES, PAUSE_RESUME_EVENT_TYPES, ALL_EVENT_TYPES) and SessionEventType union in `packages/db/src/constants/session-event-types.ts`
- [ ] T002 Rewrite all Zod payload schemas (cashSessionStartPayload, cashSessionEndPayload, tournamentSessionEndPayload with discriminatedUnion, chipsAddRemovePayload, allInPayload, updateStackPayload, purchaseChipsPayload, updateTournamentInfoPayload, memoPayload, sessionPausePayload, sessionResumePayload, playerJoinPayload, playerLeavePayload) in `packages/db/src/constants/session-event-types.ts`
- [ ] T003 Update EVENT_PAYLOAD_SCHEMAS map, isValidEventTypeForSessionType routing, validateEventPayload, and MANUAL_CREATE_BLOCKED_EVENT_TYPES (session_start + session_end only) in `packages/db/src/constants/session-event-types.ts`
- [ ] T004 Add getSessionCurrentState(events) helper that derives session state (active/paused/completed) from event stream, and isEventAllowedInState(eventType, state) validator in `packages/db/src/constants/session-event-types.ts`
- [ ] T005 Update computeSessionStateFromEvents to support paused state (check for session_pause/session_resume events) in `packages/api/src/services/live-session-pl.ts`
- [ ] T006 Update computeBreakMinutesFromEvents to use session_pause/session_resume pairs instead of session_start/session_end pairs in `packages/api/src/services/live-session-pl.ts`
- [ ] T007 Update sessionEvent.create procedure: add session state validation using getSessionCurrentState (block events during paused state except memo/session_resume/session_end), use new event type schemas in `packages/api/src/routers/session-event.ts`
- [ ] T008 Update sessionEvent.update and sessionEvent.delete procedures: use new event type schemas, allow deletion of session_pause/session_resume in `packages/api/src/routers/session-event.ts`
- [ ] T009 [P] Update session-event-types tests for new event type arrays, schemas, validation functions, state helpers in `packages/db/src/__tests__/session-event-types.test.ts`

**Checkpoint**: Foundation ready — new event type system is in place, core router and state management updated. User story implementation can begin.

---

## Phase 3: User Story 1 — Cash Game Events (Priority: P1) 🎯 MVP

**Goal**: Cash game sessions use new event types with buyIn in Session Start and cashOut in Session End. Chips Add/Remove, Update Stack, All-in, and Memo events work correctly.

**Independent Test**: Create a cash game session with buyIn, record chip add/remove, stack updates, all-in, memo events, then complete with cashOut. Verify P&L calculates correctly.

### Implementation for User Story 1

- [ ] T010 [US1] Update computeCashGamePLFromEvents: read buyIn from session_start payload, cashOut from session_end payload, sum chips_add_remove (add/remove), compute EV from all_in events in `packages/api/src/services/live-session-pl.ts`
- [ ] T011 [US1] Update liveCashGameSession.create: embed initialBuyIn in session_start payload as `{buyInAmount}`, remove auto-creation of initial chip_add event in `packages/api/src/routers/live-cash-game-session.ts`
- [ ] T012 [US1] Update liveCashGameSession.complete: embed finalStack in session_end payload as `{cashOutAmount}`, remove auto-creation of final stack_record event in `packages/api/src/routers/live-cash-game-session.ts`
- [ ] T013 [US1] Update liveCashGameSession.getById summary computation for new event types (buyIn from session_start, cashOut from session_end, currentStack from update_stack, addonTotal from chips_add_remove) in `packages/api/src/routers/live-cash-game-session.ts`
- [ ] T014 [P] [US1] Add ChipsAddRemoveEditor (amount + add/remove toggle), AllInEditor (potSize, trials, equity, wins), MemoEditor (text input), and update event type labels/summaries for new cash event types in `apps/web/src/live-sessions/components/session-events-scene.tsx`
- [ ] T015 [US1] Update useSessionEvents optimistic update logic for new cash event types (chips_add_remove, update_stack, all_in, memo, session_start with buyIn, session_end with cashOut) in `apps/web/src/live-sessions/hooks/use-session-events.ts`
- [ ] T016 [P] [US1] Write unit tests for computeCashGamePLFromEvents with new event types in `packages/api/src/services/__tests__/live-session-pl.test.ts`

**Checkpoint**: Cash game sessions fully functional with new event types. P&L calculates correctly from session_start buyIn and session_end cashOut.

---

## Phase 4: User Story 2 — Tournament Events (Priority: P1)

**Goal**: Tournament sessions use new event types with placement/prizes in Session End (with beforeDeadline flag). Purchase Chips and Update Tournament Info work as independent events.

**Independent Test**: Create a tournament session, record purchase_chips, update_tournament_info, then complete with placement/prizes. Also test completing before deadline (no placement/totalEntries).

### Implementation for User Story 2

- [ ] T017 [US2] Update computeTournamentPLFromEvents: read placement/prizeMoney/bountyPrizes from session_end payload, read rebuy/addon costs from purchase_chips events in `packages/api/src/services/live-session-pl.ts`
- [ ] T018 [US2] Update liveTournamentSession.complete: embed tournament result in session_end payload with beforeDeadline discriminated union, remove auto-creation of tournament_result event in `packages/api/src/routers/live-tournament-session.ts`
- [ ] T019 [US2] Remove or convert liveTournamentSession.reopen to return TRPCError (tournament reopen prohibited) in `packages/api/src/routers/live-tournament-session.ts`
- [ ] T020 [US2] Update liveTournamentSession.getById summary computation for new event types (purchase_chips for rebuy/addon, update_tournament_info for remaining/entries, session_end for placement/prizes) in `packages/api/src/routers/live-tournament-session.ts`
- [ ] T021 [P] [US2] Add PurchaseChipsEditor (name, cost, chips), UpdateTournamentInfoEditor (remainingPlayers, totalEntries, averageStack), and update tournament completion UI with beforeDeadline flag in `apps/web/src/live-sessions/components/session-events-scene.tsx`
- [ ] T022 [US2] Update useSessionEvents optimistic update logic for new tournament event types (purchase_chips, update_tournament_info, session_end with tournament payload) in `apps/web/src/live-sessions/hooks/use-session-events.ts`
- [ ] T023 [P] [US2] Write unit tests for computeTournamentPLFromEvents with new event types (both beforeDeadline=true and false) in `packages/api/src/services/__tests__/live-session-pl.test.ts`

**Checkpoint**: Tournament sessions fully functional with new event types. P&L calculates correctly from session_end payload. Reopen is blocked.

---

## Phase 5: User Story 4 — Session Pause/Resume (Priority: P1)

**Goal**: Users can pause and resume sessions. Cash game reopen decomposes Session End into Update Stack + Pause + Resume. Session Start/End limited to 1 per session.

**Independent Test**: Pause an active session, verify only memo/resume are allowed, resume it. Reopen a completed cash game and verify the decomposition.

### Implementation for User Story 4

- [ ] T024 [US4] Update liveCashGameSession.reopen: delete session_end, create update_stack (cashOutAmount) + session_pause at same time, create session_resume at current time in `packages/api/src/routers/live-cash-game-session.ts`
- [ ] T025 [P] [US4] Add Session Pause/Resume display, pause/resume action buttons, and Session End editing UI (for completed sessions) in `apps/web/src/live-sessions/components/session-events-scene.tsx`
- [ ] T026 [P] [US4] Write unit tests for getSessionCurrentState and isEventAllowedInState, and integration test for cash game reopen decomposition in `packages/db/src/__tests__/session-event-types.test.ts` and `packages/api/src/routers/__tests__/live-cash-game-session.test.ts`

**Checkpoint**: Pause/resume works. Cash game reopen correctly decomposes. Paused sessions only allow memo and resume.

---

## Phase 6: User Story 3 — Player Hero Support (Priority: P2)

**Goal**: Player Join/Leave events support hero (self) as a target player, not just other players.

**Independent Test**: Record a player_join with hero's playerId, verify it appears in table players list.

### Implementation for User Story 3

- [ ] T027 [US3] Verify and update player_join/player_leave handling in sessionEvent.create to support hero playerId (ensure sessionTablePlayer record created for hero) in `packages/api/src/routers/session-event.ts`
- [ ] T028 [US3] Update player selection UI to include hero option in player join/leave event creation in `apps/web/src/live-sessions/components/session-events-scene.tsx`

**Checkpoint**: Hero can be added/removed as table player via standard player_join/player_leave events.

---

## Phase 7: User Story 5 — Data Migration (Priority: P2)

**Goal**: Existing event data is safely migrated to new event types without errors.

**Independent Test**: Run migration on test data with all old event types, verify new events display correctly.

### Implementation for User Story 5

- [ ] T029 [US5] Write SQL data migration: transform chip_add → session_start buyIn (1st) + chips_add_remove (rest), stack_record → update_stack + all_in events, tournament_stack_record → update_stack + purchase_chips + update_tournament_info, tournament_result → session_end payload, multiple session_start → session_pause + session_resume in `packages/db/src/migrations/XXXX_redesign_session_events.sql`
- [ ] T030 [US5] Generate Drizzle migration (bun run db:generate) and test migration locally (bun run db:migrate:local) with existing data
- [ ] T031 [P] [US5] Write migration verification tests: seed old event data, run migration, verify new event types and payloads are correct in `packages/db/src/__tests__/migration-session-events.test.ts`

**Checkpoint**: All existing data migrates without errors. Sessions display correctly after migration.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration testing, cleanup, and validation.

- [ ] T032 [P] Update session-event.test.ts schema tests for new event types in `packages/db/src/__tests__/session-event.test.ts`
- [ ] T033 Run full test suite (`bun run test`) and fix any failures
- [ ] T034 Run type checking (`bun run check-types`) and lint (`bun x ultracite fix`)
- [ ] T035 Validate end-to-end: create cash game → record all event types → complete → verify P&L → reopen → pause → resume → complete again
- [ ] T036 Validate end-to-end: create tournament → record all event types → complete (both beforeDeadline modes) → verify P&L

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories.
- **US1 Cash Game (Phase 3)**: Depends on Foundational
- **US2 Tournament (Phase 4)**: Depends on Foundational. Can run in parallel with US1.
- **US4 Pause/Resume (Phase 5)**: Depends on Foundational. Can run in parallel with US1/US2.
- **US3 Player Hero (Phase 6)**: Depends on Foundational. Can run in parallel with US1/US2/US4.
- **US5 Migration (Phase 7)**: Depends on ALL implementation phases (needs final event type definitions stable).
- **Polish (Phase 8)**: Depends on all phases.

### User Story Dependencies

- **US1 (Cash Game)**: Independent after Foundational. No dependency on other stories.
- **US2 (Tournament)**: Independent after Foundational. No dependency on other stories.
- **US4 (Pause/Resume)**: Independent after Foundational. Reopen task depends on US1 cash session router being updated.
- **US3 (Player Hero)**: Fully independent after Foundational.
- **US5 (Migration)**: Depends on final event type definitions from US1+US2+US4.

### Within Each User Story

- P&L service changes before router changes
- Router changes before frontend changes
- Tests can be written in parallel with implementation

### Parallel Opportunities

- T009 (foundational tests) can run in parallel with T005-T008
- US1, US2, US4, US3 can all start in parallel after Foundational
- Within US1: T014 (frontend) and T016 (tests) can run in parallel
- Within US2: T021 (frontend) and T023 (tests) can run in parallel
- Within US5: T031 (migration tests) can run in parallel with T029

---

## Parallel Example: After Foundational

```
# All user story implementations can start simultaneously:
Agent 1: US1 - Cash game P&L + router + frontend
Agent 2: US2 - Tournament P&L + router + frontend
Agent 3: US4 - Pause/resume + reopen decomposition
Agent 4: US3 - Player hero support
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 2: Foundational (event types + schemas + core router)
2. Complete Phase 3: US1 (cash game events + P&L)
3. **STOP and VALIDATE**: Test cash game sessions end-to-end
4. This delivers working cash game sessions with new event architecture

### Incremental Delivery

1. Foundational → Foundation ready
2. US1 (Cash Game) → Test independently → MVP!
3. US2 (Tournament) → Test independently
4. US4 (Pause/Resume) → Test independently
5. US3 (Player Hero) → Test independently
6. US5 (Migration) → Test with real data
7. Polish → Full validation

### Recommended Approach

With agent teams:
1. Complete Foundational phase together
2. Dispatch US1+US2+US4 in parallel (3 agents)
3. US3 is small enough to fold into any agent's remaining work
4. US5 migration written last once event types are stable
5. Polish phase validates everything together

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable after Foundational
- Constitution requires tests — test tasks included per project standards
- Session event table schema is unchanged — only event_type values and payload JSON change
- Migration (US5) should be written LAST to ensure stable event type definitions
