# Tasks: リアルタイムセッション記録

**Input**: Design documents from `/specs/006-session-recording/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per Constitution III (Test Coverage Required).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Database schemas**: `packages/db/src/schema/`
- **API routers**: `packages/api/src/routers/`
- **Frontend routes**: `apps/web/src/routes/`
- **Frontend components**: `apps/web/src/components/`
- **DB tests**: `packages/db/src/__tests__/`
- **API tests**: `packages/api/src/__tests__/`
- **Component tests**: `apps/web/src/components/*/__tests__/`

---

## Phase 1: Setup

**Purpose**: Shared Zod schemas and event payload type definitions used across all user stories

- [x] T001 Define shared event payload Zod schemas (cash_game_buy_in, cash_game_stack_record, cash_out, tournament_stack_record, tournament_result, player_join, player_leave, session_pause, session_resume) and session status/event type constants in packages/db/src/constants/session-event-types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schemas and shared infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create liveCashGameSession schema (table, relations, indexes) in packages/db/src/schema/live-cash-game-session.ts
- [x] T004 [P] Create liveTournamentSession schema (table, relations, indexes) in packages/db/src/schema/live-tournament-session.ts
- [x] T005 [P] Create sessionEvent schema (table with nullable FKs to both session tables, relations, indexes) in packages/db/src/schema/session-event.ts
- [x] T006 [P] Create sessionTablePlayer schema (table with nullable FKs to both session tables, relations, indexes) in packages/db/src/schema/session-table-player.ts
- [x] T007 Add liveCashGameSessionId and liveTournamentSessionId nullable FK columns to pokerSession in packages/db/src/schema/session.ts
- [x] T008 Export all new schemas and relations from packages/db/src/schema.ts
- [x] T009 [P] Create schema tests for liveCashGameSession in packages/db/src/__tests__/live-cash-game-session.test.ts
- [x] T010 [P] Create schema tests for liveTournamentSession in packages/db/src/__tests__/live-tournament-session.test.ts
- [x] T011 [P] Create schema tests for sessionEvent in packages/db/src/__tests__/session-event.test.ts
- [x] T012 [P] Create schema tests for sessionTablePlayer in packages/db/src/__tests__/session-table-player.test.ts
- [x] T013 Generate and apply Drizzle migration for all new tables and pokerSession modifications
- [x] T014 Create P&L recalculation service function (aggregate events → compute cash game P&L and tournament P&L, update pokerSession and currencyTransaction) in packages/api/src/services/live-session-pl.ts

**Checkpoint**: Foundation ready - all schemas exist, migration applied, shared services available. User story implementation can now begin.

---

## Phase 3: User Story 1 - キャッシュゲームのリアルタイム記録 (Priority: P1) MVP

**Goal**: Users can start a cash game session, record buy-ins, stack changes (with optional all-in EV and addon info), cash out, and auto-generate pokerSession with P&L

**Independent Test**: Start a cash game session, record buy-in + stack records + cash out, verify event history and P&L on session detail page

### Tests for User Story 1

- [x] T015 [P] [US1] Create router tests for liveCashGameSession (list, getById, create, complete, discard) in packages/api/src/__tests__/live-cash-game-session.test.ts
- [x] T016 [P] [US1] Create router tests for sessionEvent (create/update/delete cash game events, P&L recalculation on completed session edit) in packages/api/src/__tests__/session-event.test.ts

### Implementation for User Story 1

- [x] T017 [US1] Implement liveCashGameSessionRouter (list, getById, create, update, complete, discard) with Zod validation and protectedProcedure in packages/api/src/routers/live-cash-game-session.ts
- [x] T018 [US1] Implement sessionEventRouter (list, create, update, delete) with event-type-specific Zod payload validation and P&L recalculation triggers in packages/api/src/routers/session-event.ts
- [x] T019 [US1] Register liveCashGameSession and sessionEvent routers in appRouter in packages/api/src/routers/index.ts
- [x] T020 [US1] Implement complete procedure: aggregate events to compute P&L, create pokerSession with liveCashGameSessionId, create currencyTransaction if currencyId set, in packages/api/src/routers/live-cash-game-session.ts
- [x] T021 [P] [US1] Create cash game session start form component (store, ringGame, currency selection) in apps/web/src/components/live-cash-game/create-cash-game-session-form.tsx
- [x] T022 [P] [US1] Create buy-in form component in apps/web/src/components/live-cash-game/buy-in-form.tsx
- [x] T023 [P] [US1] Create cash game stack record form (stack amount, optional all-ins array with actual/EV, optional addon) in apps/web/src/components/live-cash-game/cash-game-stack-form.tsx
- [x] T024 [P] [US1] Create cash game complete form (cash out amount) in apps/web/src/components/live-cash-game/cash-game-complete-form.tsx
- [x] T025 [US1] Create live sessions list page showing active/paused/completed sessions in apps/web/src/routes/live-sessions/index.tsx
- [x] T026 [US1] Create cash game session detail/recording page (event recording, event list, session actions) in apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx
- [x] T027 [P] [US1] Create live session card component for list display in apps/web/src/components/live-sessions/live-session-card.tsx
- [x] T028 [P] [US1] Create session summary component (total buy-in, cash out, P&L, EV) in apps/web/src/components/live-sessions/session-summary.tsx

**Checkpoint**: Cash game live session recording fully functional. Users can start, record events, complete, and view P&L.

---

## Phase 4: User Story 2 - トーナメントのリアルタイム記録 (Priority: P1)

**Goal**: Users can start a tournament session, record stack/remaining players/average stack (with optional rebuy/addon), and complete with placement/prizes

**Independent Test**: Start a tournament session, record stack records with rebuy/addon, complete with placement/prize, verify event history and P&L

### Tests for User Story 2

- [ ] T029 [P] [US2] Create router tests for liveTournamentSession (list, getById, create, complete, discard) in packages/api/src/__tests__/live-tournament-session.test.ts
- [ ] T029b [P] [US2] Create router tests for sessionEvent with tournament-specific events (tournament_stack_record, tournament_result payload validation, P&L recalculation) in packages/api/src/__tests__/session-event.test.ts

### Implementation for User Story 2

- [ ] T030 [US2] Implement liveTournamentSessionRouter (list, getById, create, update, complete, discard) with Zod validation and protectedProcedure in packages/api/src/routers/live-tournament-session.ts
- [ ] T031 [US2] Register liveTournamentSession router in appRouter in packages/api/src/routers/index.ts
- [ ] T032 [US2] Implement complete procedure: aggregate events to compute tournament P&L, create pokerSession with liveTournamentSessionId, create currencyTransaction if currencyId set, in packages/api/src/routers/live-tournament-session.ts
- [ ] T033 [P] [US2] Create tournament session start form component (store, tournament, currency selection) in apps/web/src/components/live-tournament/create-tournament-session-form.tsx
- [ ] T034 [P] [US2] Create tournament stack record form (stack amount, remaining players, average stack, optional rebuy, optional addon) in apps/web/src/components/live-tournament/tournament-stack-form.tsx
- [ ] T035 [P] [US2] Create tournament complete form (placement, total entries, prize money, bounty prizes) in apps/web/src/components/live-tournament/tournament-complete-form.tsx
- [ ] T036 [US2] Create tournament session detail/recording page in apps/web/src/routes/live-sessions/tournament/$sessionId.tsx
- [ ] T037 [US2] Update live sessions list page to show tournament sessions alongside cash game sessions in apps/web/src/routes/live-sessions/index.tsx

**Checkpoint**: Tournament live session recording fully functional alongside cash game sessions.

---

## Phase 5: User Story 3 - セッションの中断と再開 (Priority: P2)

**Goal**: Users can pause and resume sessions, manage multiple concurrent active/paused sessions

**Independent Test**: Start session A, pause it, start session B, complete B, resume A, complete A - verify both sessions have correct independent data

### Tests for User Story 3

- [ ] T037b [P] [US3] Create router tests for pause/resume procedures (state transitions, auto session_pause/session_resume events, invalid transitions) in packages/api/src/__tests__/live-cash-game-session.test.ts and packages/api/src/__tests__/live-tournament-session.test.ts

### Implementation for User Story 3

- [ ] T038 [US3] Implement pause and resume procedures (with auto session_pause/session_resume events) in liveCashGameSessionRouter in packages/api/src/routers/live-cash-game-session.ts
- [ ] T039 [US3] Implement pause and resume procedures in liveTournamentSessionRouter in packages/api/src/routers/live-tournament-session.ts
- [ ] T040 [US3] Add pause/resume action buttons to cash game session detail page in apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx
- [ ] T041 [US3] Add pause/resume action buttons to tournament session detail page in apps/web/src/routes/live-sessions/tournament/$sessionId.tsx
- [ ] T042 [US3] Add status filtering (active/paused/completed) and status badges to live sessions list page in apps/web/src/routes/live-sessions/index.tsx

**Checkpoint**: Pause/resume works for both session types. Multiple sessions can be active/paused simultaneously.

---

## Phase 6: User Story 4 - 同卓者の記録 (Priority: P2)

**Goal**: Users can add/remove table players during a session, with player history tracked

**Independent Test**: During a session, add existing player, add new player, remove a player - verify table player list updates and events are recorded

### Tests for User Story 4

- [ ] T043 [P] [US4] Create router tests for sessionTablePlayer (list, add, addNew, remove) in packages/api/src/__tests__/session-table-player.test.ts

### Implementation for User Story 4

- [ ] T044 [US4] Implement sessionTablePlayerRouter (list, add, addNew, remove) with auto player_join/player_leave events in packages/api/src/routers/session-table-player.ts
- [ ] T045 [US4] Register sessionTablePlayer router in appRouter in packages/api/src/routers/index.ts
- [ ] T046 [P] [US4] Create table player list component (current players with add/remove actions, player search) in apps/web/src/components/live-sessions/table-player-list.tsx
- [ ] T047 [P] [US4] Create add-new-player inline form component in apps/web/src/components/live-sessions/add-table-player-form.tsx
- [ ] T048 [US4] Integrate table player list into cash game session detail page in apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx
- [ ] T049 [US4] Integrate table player list into tournament session detail page in apps/web/src/routes/live-sessions/tournament/$sessionId.tsx

**Checkpoint**: Table player management works in both session types.

---

## Phase 7: User Story 5 - セッションイベント履歴の閲覧 (Priority: P3)

**Goal**: Users can view chronological event history with stack summary for any session

**Independent Test**: Open a session with multiple events, verify all events displayed in chronological order with stack summary (max/min/current)

### Tests for User Story 5

- [ ] T049b [P] [US5] Create router tests for sessionEvent update/delete (edit payload, delete event, P&L recalculation on completed session) in packages/api/src/__tests__/session-event.test.ts

### Implementation for User Story 5

- [ ] T050 [P] [US5] Create event timeline component (chronological event list with type-specific rendering) in apps/web/src/components/live-sessions/event-timeline.tsx
- [ ] T051 [P] [US5] Create event edit/delete actions (inline edit form, delete confirmation) in apps/web/src/components/live-sessions/event-actions.tsx
- [ ] T052 [US5] Integrate event timeline and edit/delete actions into cash game session detail page in apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx
- [ ] T053 [US5] Integrate event timeline and edit/delete actions into tournament session detail page in apps/web/src/routes/live-sessions/tournament/$sessionId.tsx
- [ ] T054 [US5] Add event history link to existing session card for sessions with liveSessionId in apps/web/src/components/sessions/session-card.tsx

**Checkpoint**: Full event history viewing and editing works for both session types.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T055 [P] Add discard (delete) action with confirmation dialog to cash game session detail page in apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx
- [ ] T055b [P] Add discard (delete) action with confirmation dialog to tournament session detail page in apps/web/src/routes/live-sessions/tournament/$sessionId.tsx
- [ ] T056 [P] Add navigation link to live sessions from main navigation in apps/web/src/routes/__root.tsx
- [ ] T057 [P] Create component tests for key UI components (cash-game-stack-form, tournament-stack-form, event-timeline, session-summary) in apps/web/src/components/live-cash-game/__tests__/, apps/web/src/components/live-tournament/__tests__/, apps/web/src/components/live-sessions/__tests__/
- [ ] T058 Run type check (bun run check-types), tests (bun test), and lint (bun x ultracite check) - fix any issues
- [ ] T059 Run quickstart.md validation - verify all listed files exist and patterns are correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational - creates shared UI infrastructure (list page, session card)
- **US2 (Phase 4)**: Depends on Foundational + US1 list page (extends it)
- **US3 (Phase 5)**: Depends on US1 and US2 (adds pause/resume to existing pages)
- **US4 (Phase 6)**: Depends on Foundational (can start after Phase 2, integrates with US1/US2 pages)
- **US5 (Phase 7)**: Depends on US1 and US2 (adds timeline to existing pages)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Foundational - first MVP deliverable
- **User Story 2 (P1)**: Depends on Foundational + US1 (reuses list page, session card) - second deliverable
- **User Story 3 (P2)**: Depends on US1 + US2 (adds to their pages) - but pause/resume backend is independent
- **User Story 4 (P2)**: Depends on Foundational (backend independent), integrates into US1/US2 pages
- **User Story 5 (P3)**: Depends on US1 + US2 (adds to their pages)

### Within Each User Story

- Tests before implementation (TDD per Constitution III)
- Schema/DB before routers
- Routers before frontend
- Shared components before page integration

### Parallel Opportunities

- T003, T004, T005, T006 (all schema files) can run in parallel
- T009, T010, T011, T012 (all schema tests) can run in parallel
- T015, T016 (US1 router tests) can run in parallel
- T021, T022, T023, T024, T027, T028 (US1 components) can run in parallel
- T033, T034, T035 (US2 components) can run in parallel
- T046, T047 (US4 components) can run in parallel
- T050, T051 (US5 components) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch all schema files together:
Task: "Create liveCashGameSession schema in packages/db/src/schema/live-cash-game-session.ts"
Task: "Create liveTournamentSession schema in packages/db/src/schema/live-tournament-session.ts"
Task: "Create sessionEvent schema in packages/db/src/schema/session-event.ts"
Task: "Create sessionTablePlayer schema in packages/db/src/schema/session-table-player.ts"

# Then launch all schema tests together:
Task: "Create schema tests for liveCashGameSession in packages/db/src/__tests__/live-cash-game-session.test.ts"
Task: "Create schema tests for liveTournamentSession in packages/db/src/__tests__/live-tournament-session.test.ts"
Task: "Create schema tests for sessionEvent in packages/db/src/__tests__/session-event.test.ts"
Task: "Create schema tests for sessionTablePlayer in packages/db/src/__tests__/session-table-player.test.ts"
```

## Parallel Example: User Story 1 Components

```bash
# Launch all US1 UI components together:
Task: "Create cash game session start form in apps/web/src/components/live-cash-game/create-cash-game-session-form.tsx"
Task: "Create buy-in form in apps/web/src/components/live-cash-game/buy-in-form.tsx"
Task: "Create cash game stack record form in apps/web/src/components/live-cash-game/cash-game-stack-form.tsx"
Task: "Create cash game complete form in apps/web/src/components/live-cash-game/cash-game-complete-form.tsx"
Task: "Create live session card in apps/web/src/components/live-sessions/live-session-card.tsx"
Task: "Create session summary in apps/web/src/components/live-sessions/session-summary.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (event types, constants)
2. Complete Phase 2: Foundational (schemas, migration, P&L service)
3. Complete Phase 3: User Story 1 (cash game recording)
4. **STOP and VALIDATE**: Test cash game session flow end-to-end
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Cash game recording works (MVP!)
3. Add User Story 2 → Tournament recording works
4. Add User Story 3 → Pause/resume works for both types
5. Add User Story 4 → Table player management works
6. Add User Story 5 → Event history viewing and editing works
7. Polish → Navigation, cleanup, final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (cash game)
   - Developer B: User Story 2 (tournament) - after US1 list page exists
   - Developer C: User Story 4 (table players) - backend independent
3. After US1 + US2 pages exist:
   - User Story 3 (pause/resume) and User Story 5 (event history) can proceed

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Constitution III requires tests - included for all router/schema work
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Run `bun x ultracite fix` before committing (Constitution IV)
