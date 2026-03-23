# Tasks: Session Post-Recording

**Input**: Design documents from `/specs/004-session-record/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/session-router.md

**Tests**: Included per Constitution Principle III (Test Coverage Required).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: Database schema and migration for session entity

- [x] T001 Create session table schema with type discriminator, all cash game fields (buyIn, cashOut, evCashOut), all tournament fields (tournamentBuyIn, entryFee, placement, totalEntries, prizeMoney, rebuyCount, rebuyCost, addonCost, bountyPrizes), common fields (sessionDate, startedAt, endedAt, memo), foreign keys (userId CASCADE, storeId SET NULL, ringGameId SET NULL, tournamentId SET NULL, currencyId SET NULL), indexes, and relations in `packages/db/src/schema/session.ts`
- [x] T002 Add sessionId nullable column (FK → session.id CASCADE) with index to currencyTransaction table and update currencyTransactionRelations in `packages/db/src/schema/store.ts`
- [x] T003 Generate and apply database migration via `bun run generate && bun run migrate`

**Checkpoint**: Database schema ready with session table and currencyTransaction.sessionId column

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Router registration, transaction type seeding, and shared infrastructure

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create session router skeleton with protectedProcedure imports, ownership validation helper, and P&L computation utility functions (computeCashGamePL, computeTournamentPL) in `packages/api/src/routers/session.ts`
- [x] T005 Register sessionRouter in appRouter in `packages/api/src/routers/index.ts`
- [x] T006 Add "Session Result" to default transaction type seeding logic in `packages/api/src/routers/transaction-type.ts`
- [x] T007 [P] Write schema validation tests for session table (column types, nullability, FK constraints, indexes) and currencyTransaction.sessionId addition in `packages/db/src/__tests__/session-schema.test.ts`
- [x] T007b [P] Write router smoke tests verifying all session procedures exist (list, getById, create, update, delete) and integration tests for session CRUD operations (create cash game, create tournament, list with pagination, update with ownership check, delete with cascade) using mocked DB in `packages/api/src/__tests__/session.test.ts`

**Checkpoint**: Foundation ready — session router registered, migration applied, tests pass

---

## Phase 3: User Story 1 — Record a Cash Game Session (Priority: P1) 🎯 MVP

**Goal**: Users can create, view, edit, and delete cash game sessions with buy-in, cash-out, and date. P&L calculated as cash-out minus buy-in.

**Independent Test**: Create a cash game session with buy-in=10000, cash-out=15000, date=today. Verify P&L shows +5000. Edit cash-out to 8000, verify P&L shows -2000. Delete session, verify it's gone.

### Implementation for User Story 1

- [ ] T008 [US1] Implement `session.create` mutation for cash game type with Zod input validation (type=cash_game, buyIn ≥ 0, cashOut ≥ 0, sessionDate required), UUID generation, and DB insert in `packages/api/src/routers/session.ts`
- [ ] T009 [US1] Implement `session.list` query with cursor-based pagination (PAGE_SIZE=20), ordered by sessionDate DESC then id DESC, filtered by userId, with computed profitLoss field (cashOut - buyIn for cash_game) in `packages/api/src/routers/session.ts`
- [ ] T010 [US1] Implement `session.getById` query with ownership validation in `packages/api/src/routers/session.ts`
- [ ] T011 [US1] Implement `session.update` mutation with ownership check, selective field updates (excluding type), and `session.delete` mutation with ownership check in `packages/api/src/routers/session.ts`
- [ ] T012 [P] [US1] Create session card component displaying session type badge, session date, profit/loss with color coding (green positive, red negative), and edit/delete actions in `apps/web/src/components/sessions/session-card.tsx`
- [ ] T013 [P] [US1] Create session form component with type selector (cash_game/tournament), conditional cash game fields (buyIn, cashOut, sessionDate as required), FormData-based submit handler, and loading state in `apps/web/src/components/sessions/session-form.tsx`
- [ ] T014 [US1] Create sessions page route with query hook for session.list, paginated session card list, create button with ResponsiveDialog wrapping session-form, edit/delete handlers with optimistic mutations (must include onMutate/onError/onSettled callbacks per Constitution VIII) in `apps/web/src/routes/sessions/index.tsx`
- [ ] T015 [US1] Add "Sessions" navigation item to top-level nav in `apps/web/src/routes/__root.tsx`

**Checkpoint**: Cash game session CRUD fully functional. Users can record, view, edit, and delete cash game sessions with P&L display.

---

## Phase 4: User Story 2 — Record a Tournament Session (Priority: P1)

**Goal**: Users can create tournament sessions with buy-in, entry fee, placement, entries, prize, rebuys, addon, bounty. P&L = (prize + bounty) - totalCost.

**Independent Test**: Create tournament session with buyIn=5000, entryFee=1000, rebuyCount=2, rebuyCost=5000, placement=3, totalEntries=50, prizeMoney=30000. Verify totalCost=16000, P&L=+14000.

### Implementation for User Story 2

- [ ] T016 [US2] Extend `session.create` mutation to handle tournament type with Zod validation (tournamentBuyIn ≥ 0, entryFee ≥ 0, placement > 0, placement ≤ totalEntries when both provided, all monetary amounts ≥ 0) in `packages/api/src/routers/session.ts`
- [ ] T017 [US2] Extend `session.list` query to compute tournament profitLoss ((prizeMoney + bountyPrizes) - (tournamentBuyIn + entryFee + rebuyCount * rebuyCost + addonCost)) using CASE expression on session type in `packages/api/src/routers/session.ts`
- [ ] T018 [US2] Extend session form with conditional tournament fields (tournamentBuyIn, entryFee, placement, totalEntries, prizeMoney, rebuyCount, rebuyCost, addonCost, bountyPrizes) shown when type=tournament in `apps/web/src/components/sessions/session-form.tsx`
- [ ] T019 [US2] Extend session card to display tournament-specific info (placement/entries, total cost breakdown) when session type is tournament in `apps/web/src/components/sessions/session-card.tsx`

**Checkpoint**: Both cash game and tournament sessions can be created, viewed, and managed. Mixed-type session list displays correctly.

---

## Phase 5: User Story 3 — Link Session to Store, Game, and Currency (Priority: P2)

**Goal**: Users can optionally link sessions to stores, game configurations, and currencies. Currency link auto-generates a read-only currency transaction with net P&L.

**Independent Test**: Create a cash game session linked to a store, cash game, and currency. Verify linked entity names display. Check currency transaction list shows auto-generated read-only entry. Edit session amounts, verify transaction updates. Delete session, verify transaction is removed.

### Implementation for User Story 3

- [ ] T020 [US3] Extend `session.create` and `session.update` mutations to accept optional storeId, ringGameId/tournamentId (matching session type), and currencyId with ownership validation of linked entities in `packages/api/src/routers/session.ts`
- [ ] T021 [US3] Implement currency transaction auto-generation: on create with currencyId, look up "Session Result" transactionType, insert currencyTransaction with net P&L amount and sessionId FK. On update, sync transaction amount or create/delete as currency link changes. On delete, cascade handles cleanup in `packages/api/src/routers/session.ts`
- [ ] T022 [US3] Extend `session.list` query with LEFT JOINs to store, ringGame, tournament, and currency tables to resolve entity names (storeName, ringGameName, tournamentName, currencyName) in `packages/api/src/routers/session.ts`
- [ ] T023 [US3] Add store-filtered game selector to session form: when storeId selected, fetch games of matching type (ringGame.listByStore for cash_game, tournament.listByStore for tournament) and populate game dropdown. When a game config is selected, pre-fill the form's buy-in/entry fee/rebuy/addon fields with values from the config (overridable by user). Add currency selector using currency.list in `apps/web/src/components/sessions/session-form.tsx`
- [ ] T024 [US3] Display linked entity names (store, game, currency) on session card with fallback text for deleted entities in `apps/web/src/components/sessions/session-card.tsx`
- [ ] T025 [US3] Add read-only indicator for session-generated transactions (where sessionId is not null) in currency transaction list: disable edit/delete buttons, show "Session" badge with link in `apps/web/src/components/stores/transaction-list.tsx`
- [ ] T026 [US3] Modify currencyTransaction update and delete mutations to reject operations on transactions where sessionId is not null (return FORBIDDEN error) in `packages/api/src/routers/currency-transaction.ts`

**Checkpoint**: Sessions can be linked to stores, games, and currencies. Currency transactions auto-sync. Read-only enforcement on currency page works.

---

## Phase 6: User Story 4 — View Session Summary and P&L Statistics (Priority: P2)

**Goal**: Display summary statistics (total sessions, total P&L, win rate, average P&L) at the top of the sessions page with filters by game type, store, and date range.

**Independent Test**: Create 5 cash game sessions (3 profitable, 2 losing) and 3 tournament sessions. Verify summary shows correct totals. Apply type filter "Tournament", verify summary recalculates with tournament metrics (avg placement, ITM rate). Apply date range filter, verify only matching sessions are included.

### Implementation for User Story 4

- [ ] T027 [US4] Extend `session.list` query to return summary object alongside paginated items: compute totalSessions, totalProfitLoss, winRate, avgProfitLoss via SQL aggregation. When type filter = "tournament", include avgPlacement, totalPrizeMoney, itmRate in `packages/api/src/routers/session.ts`
- [ ] T028 [US4] Add filter input parameters to `session.list`: type (cash_game/tournament), storeId, dateFrom, dateTo as optional Zod-validated inputs. Apply as WHERE conditions on the list and summary queries in `packages/api/src/routers/session.ts`
- [ ] T029 [P] [US4] Create session summary component displaying total sessions, total P&L, win rate, average P&L in a card grid. Conditionally show tournament metrics and EV metrics when available in `apps/web/src/components/sessions/session-summary.tsx`
- [ ] T030 [P] [US4] Create session filters component with game type toggle (All/Cash Game/Tournament), store selector dropdown, and date range picker (from/to) in `apps/web/src/components/sessions/session-filters.tsx`
- [ ] T031 [US4] Integrate summary and filters into sessions page: render SessionSummary above SessionFilters above session list. Pass filter state to session.list query params. Re-fetch on filter change in `apps/web/src/routes/sessions/index.tsx`

**Checkpoint**: Sessions page shows live summary statistics with working filters. All metrics update correctly when filters are applied.

---

## Phase 7: User Story 5 — Record EV Adjusted Result (Priority: P2)

**Goal**: Cash game sessions can optionally record EV-adjusted cash-out. EV P&L and EV diff displayed alongside actual P&L. Summary includes EV metrics for sessions with EV data.

**Independent Test**: Create cash game session with buyIn=10000, cashOut=15000, evCashOut=12000. Verify actual P&L=+5000, EV P&L=+2000, EV diff=-3000 (ran above EV). Verify tournament form has no EV field. Verify summary EV metrics aggregate correctly.

### Implementation for User Story 5

- [ ] T032 [US5] Add evCashOut to cash game Zod validation schema (optional, ≥ 0). Extend list query to compute evProfitLoss (evCashOut - buyIn) and evDiff (evProfitLoss - profitLoss) when evCashOut is not null in `packages/api/src/routers/session.ts`
- [ ] T033 [US5] Extend summary aggregation to include totalEvProfitLoss and totalEvDiff computed from cash game sessions where evCashOut IS NOT NULL in `packages/api/src/routers/session.ts`
- [ ] T034 [US5] Add optional evCashOut field to session form, shown only when type=cash_game, with label "EV Cash-out" and helper text explaining the concept in `apps/web/src/components/sessions/session-form.tsx`
- [ ] T035 [US5] Display EV P&L and EV diff on session card when evCashOut is set: show as secondary line below actual P&L with distinct styling in `apps/web/src/components/sessions/session-card.tsx`
- [ ] T036 [US5] Display EV summary metrics (total EV P&L, total EV diff) in session summary component when available in `apps/web/src/components/sessions/session-summary.tsx`

**Checkpoint**: EV tracking works end-to-end for cash game sessions. Summary EV metrics display correctly.

---

## Phase 8: User Story 6 — Record Session Duration and Memo (Priority: P3)

**Goal**: Users can record start/end times (auto-calculated duration) and free-text memo for any session type.

**Independent Test**: Create session with startedAt=14:00, endedAt=18:30. Verify duration displays "4h 30m". Add memo text, verify it persists and displays.

### Implementation for User Story 6

- [ ] T037 [US6] Add startedAt, endedAt, and memo to session create/update Zod schemas. Validate startedAt ≤ endedAt when both provided in `packages/api/src/routers/session.ts`
- [ ] T038 [US6] Add start time, end time (datetime-local inputs), and memo (textarea) fields to session form for both session types in `apps/web/src/components/sessions/session-form.tsx`
- [ ] T039 [US6] Display duration (computed from startedAt/endedAt as formatted string e.g. "4h 30m") and memo excerpt on session card in `apps/web/src/components/sessions/session-card.tsx`

**Checkpoint**: All session data fields are fully supported. Duration and memo work for both cash game and tournament sessions.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Quality, tests, and integration polish

- [ ] T040 [P] Write component tests for session-form (cash game mode, tournament mode, type switching, validation) in `apps/web/src/components/sessions/__tests__/session-form.test.tsx`
- [ ] T041 [P] Write component tests for session-card (cash game display, tournament display, EV display, linked entity display) in `apps/web/src/components/sessions/__tests__/session-card.test.tsx`
- [ ] T042 [P] Write component tests for session-summary (all metrics, tournament-specific metrics, EV metrics, empty state with guidance message) in `apps/web/src/components/sessions/__tests__/session-summary.test.tsx`
- [ ] T043 [P] Write component tests for session-filters (type toggle, store selector, date range picker, filter state changes) in `apps/web/src/components/sessions/__tests__/session-filters.test.tsx`
- [ ] T044 [P] Update transaction-list component tests to cover read-only behavior for session-generated transactions (disabled edit/delete, session badge display) in `apps/web/src/components/stores/__tests__/transaction-list.test.tsx`
- [ ] T045 Run `bun x ultracite fix` and `bun run check-types` to ensure code quality and type safety pass
- [ ] T046 Run full test suite `bun run test` and verify all tests pass including new session tests

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP, no other story dependencies
- **US2 (Phase 4)**: Depends on Phase 2 — Extends US1 files but independently testable
- **US3 (Phase 5)**: Depends on US1+US2 (needs both session types to exist for linking)
- **US4 (Phase 6)**: Depends on US1+US2 (summary needs sessions to aggregate)
- **US5 (Phase 7)**: Depends on US1 (EV is cash game only, extends existing fields)
- **US6 (Phase 8)**: Depends on US1 (adds optional fields to existing form/card)
- **Polish (Phase 9)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 → Phase 2 → US1 (P1) → US2 (P1) ─┬─→ US3 (P2)
                        │                   └─→ US4 (P2)
                        ├─→ US5 (P2)
                        └─→ US6 (P3)
```

- **US1 + US2**: Sequential (US2 extends US1 files)
- **US3, US4**: Can run in parallel after US1+US2
- **US5, US6**: Can run in parallel after US1, independent of US3/US4

### Within Each User Story

- Router changes before frontend changes
- Form component before page integration
- Card component can be parallel with form

### Parallel Opportunities

- T007 + T007b (schema tests + router tests) can run in parallel
- T012 + T013 (session-card + session-form) can run in parallel
- T029 + T030 (session-summary + session-filters) can run in parallel
- T040 + T041 + T042 + T043 + T044 (all component tests) can run in parallel
- US5 + US6 can run in parallel after US1

---

## Parallel Example: User Story 1

```bash
# After T011 (router complete), launch frontend tasks in parallel:
Task T012: "Create session-card.tsx"
Task T013: "Create session-form.tsx"

# Then sequential:
Task T014: "Create sessions page (depends on card + form)"
Task T015: "Add nav item"
```

## Parallel Example: User Story 4

```bash
# After T028 (router filters complete), launch in parallel:
Task T029: "Create session-summary.tsx"
Task T030: "Create session-filters.tsx"

# Then sequential:
Task T031: "Integrate into sessions page"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (router skeleton + registration)
3. Complete Phase 3: US1 — Cash game session CRUD
4. Complete Phase 4: US2 — Tournament session CRUD
5. **STOP and VALIDATE**: Both session types work end-to-end
6. Deploy/demo if ready — basic P&L tracking is functional

### Incremental Delivery

1. Setup + Foundational → Schema and router ready
2. US1 + US2 → Core session recording (MVP!)
3. US3 → Entity linking + currency transaction sync
4. US4 → Summary statistics + filters
5. US5 → EV tracking for cash games
6. US6 → Duration and memo
7. Polish → Tests + code quality

### Parallel Team Strategy

With multiple developers after US1+US2:
- Developer A: US3 (entity linking + currency sync)
- Developer B: US4 (summary + filters)
- Developer C: US5 + US6 (EV + duration/memo)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tournament session type default values from linked tournament configuration is handled in US3 (T023)
