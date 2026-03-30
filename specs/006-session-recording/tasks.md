# Tasks: リアルタイムセッション記録 (UX Feedback Delta)

**Input**: Design documents from `/specs/006-session-recording/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/, quickstart.md
**Date**: 2026-03-30

**Tests**: Included per Constitution III (Test Coverage Required).

**Scope**: These tasks cover the DELTA from the current implementation to match the updated spec (UX Feedback 2026-03-30). Phases 1-3 of the original implementation are already complete. All DB schemas, migrations, basic routers, P&L service, and frontend components exist but need modification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Database schemas**: `packages/db/src/schema/`
- **API routers**: `packages/api/src/routers/`
- **API services**: `packages/api/src/services/`
- **Frontend routes**: `apps/web/src/routes/`
- **Frontend components**: `apps/web/src/components/`
- **DB constants**: `packages/db/src/constants/`
- **DB tests**: `packages/db/src/__tests__/`
- **API tests**: `packages/api/src/__tests__/`

## Already Implemented (DO NOT recreate)

- DB schemas: `live-cash-game-session`, `live-tournament-session`, `session-event`, `session-table-player`
- Migration 0007 applied
- Schema tests for all 4 tables
- `liveCashGameSessionRouter` at `packages/api/src/routers/live-cash-game-session.ts`
- `sessionEventRouter` at `packages/api/src/routers/session-event.ts`
- P&L service at `packages/api/src/services/live-session-pl.ts`
- Event type constants at `packages/db/src/constants/session-event-types.ts`
- Frontend components in `apps/web/src/components/live-cash-game/` and `live-sessions/`
- Live sessions pages at `apps/web/src/routes/live-sessions/`

---

## Phase 1: Setup (Refactor Existing Constants & Types)

- [ ] T001 [P] Update session-event-types.ts: remove `paused` from `SESSION_STATUSES`, keep only `["active", "completed"]`. Remove `session_pause` and `session_resume` from `COMMON_EVENT_TYPES`. Remove `sessionPausePayload` and `sessionResumePayload` schemas. Remove corresponding entries from `EVENT_PAYLOAD_SCHEMAS` map. File: `packages/db/src/constants/session-event-types.ts`

- [ ] T002 [P] Update session-event-types.ts: change `allInSchema` from `{ actualResult: number, evResult: number }` to `{ potSize: number, trials: number, equity: number, wins: number }`. `potSize` is `z.number().min(0)`, `trials` is `z.number().int().min(1)`, `equity` is `z.number().min(0).max(100)`, `wins` is `z.number().min(0)` (decimal allowed for chop). Update `cashGameStackRecordPayload` to use the new `allInSchema`. File: `packages/db/src/constants/session-event-types.ts`

- [ ] T003 [P] Update session-event-types.ts: add a `MANUAL_CREATE_BLOCKED_EVENT_TYPES` constant containing `["cash_game_buy_in"]` to mark event types that cannot be manually created via `sessionEvent.create` (auto-created by session lifecycle only). File: `packages/db/src/constants/session-event-types.ts`

- [ ] T004 Test: update schema tests to verify new `SESSION_STATUSES` (no "paused"), new `allInSchema` fields (potSize/trials/equity/wins), removal of session_pause/session_resume from event types, and `MANUAL_CREATE_BLOCKED_EVENT_TYPES`. File: `packages/db/src/__tests__/session-event-types.test.ts`

---

## Phase 2: Foundational (Backend Modifications)

### Cash Game Router Updates

- [ ] T005 Update `liveCashGameSessionRouter.create`: add `initialBuyIn` (required, `z.number().min(0)`) to input schema. After inserting session, auto-create a `cash_game_buy_in` event with `{ amount: initialBuyIn }`. Add single-session guard: before creating, check no other session with `status = "active"` exists for the user; throw `BAD_REQUEST` if one does. File: `packages/api/src/routers/live-cash-game-session.ts`

- [ ] T006 Update `liveCashGameSessionRouter.list`: change status enum from `["active", "paused", "completed"]` to `["active", "completed"]`. File: `packages/api/src/routers/live-cash-game-session.ts`

- [ ] T007 Add `liveCashGameSessionRouter.reopen` procedure: input `{ id: string }`, validate session is `status === "completed"` and no other active session exists for user (check both `liveCashGameSession` and `liveTournamentSession` tables). Set `status = "active"`, clear `endedAt`. Delete linked `pokerSession` and its `currencyTransaction` (will be recreated on next complete). Return `{ id }`. File: `packages/api/src/routers/live-cash-game-session.ts`

- [ ] T008 Update `liveCashGameSessionRouter.complete`: on reopen+re-complete scenario, check if a `pokerSession` already exists for this `liveCashGameSessionId` and update it instead of creating a duplicate. Also update or recreate the `currencyTransaction`. File: `packages/api/src/routers/live-cash-game-session.ts`

- [ ] T009 Update `liveCashGameSessionRouter.discard`: ensure validation checks `status !== "completed"` (currently checks `status === "completed"`, which is correct, but verify "active" is the only non-completed status now). File: `packages/api/src/routers/live-cash-game-session.ts`

### Session Event Router Updates

- [ ] T010 Update `sessionEventRouter.create`: block manual creation of `cash_game_buy_in` events. When `eventType` is in `MANUAL_CREATE_BLOCKED_EVENT_TYPES`, throw `BAD_REQUEST` with message "This event type is auto-created and cannot be manually added". Remove handling of `session_pause`/`session_resume` (already invalid since they are removed from `ALL_EVENT_TYPES`). File: `packages/api/src/routers/session-event.ts`

### P&L Service Updates

- [ ] T011 Update `computeCashGamePLFromEvents` in P&L service: change EV calculation from `allIn.evResult - allIn.actualResult` to new formula. For each allIn: `evAmount = potSize * (equity / 100) * trials`, `actualAmount = potSize * wins`, `evDiff = evAmount - actualAmount`. Sum all evDiffs. `evCashOut = cashOut + totalEvDiff`. File: `packages/api/src/services/live-session-pl.ts`

### Tournament Router (New)

- [ ] T012 Create `liveTournamentSessionRouter` with procedures: `list`, `getById`, `create`, `update`, `complete`, `reopen`, `discard`. Follow the contract in `specs/006-session-recording/contracts/live-tournament-session-router.md`. `create` must enforce single-session guard (no active session across both cash game and tournament tables). `complete` must create `tournament_result` event, `pokerSession`, and `currencyTransaction`. `reopen` must validate no other active session and delete linked `pokerSession`/`currencyTransaction`. Register in `packages/api/src/routers/index.ts`. File: `packages/api/src/routers/live-tournament-session.ts`

### Session Table Player Router (New)

- [ ] T013 Create `sessionTablePlayerRouter` with procedures: `list`, `add`, `addNew`, `remove`. Follow the contract in `specs/006-session-recording/contracts/session-table-player-router.md`. Register in `packages/api/src/routers/index.ts`. File: `packages/api/src/routers/session-table-player.ts`

### Router Tests

- [ ] T014 Test: write router tests for `liveCashGameSessionRouter` changes: test `create` with `initialBuyIn` auto-creates buy-in event, test single-session guard on create, test `reopen` procedure, test `reopen` blocks when another active session exists, test `complete` after reopen updates existing pokerSession. File: `packages/api/src/__tests__/live-cash-game-session.test.ts`

- [ ] T015 Test: write router tests for `liveTournamentSessionRouter`: test `create`, `list`, `getById`, `complete` (creates pokerSession), `reopen`, `discard`, single-session guard. File: `packages/api/src/__tests__/live-tournament-session.test.ts`

- [ ] T016 Test: write router tests for `sessionEventRouter` changes: test `cash_game_buy_in` manual create is blocked, test event creation with new allIn format (potSize/trials/equity/wins), test recalculation on completed session event edit/delete. File: `packages/api/src/__tests__/session-event.test.ts`

- [ ] T017 Test: write router tests for `sessionTablePlayerRouter`: test `add`, `addNew`, `remove`, test player_join/player_leave events auto-created. File: `packages/api/src/__tests__/session-table-player.test.ts`

- [ ] T018 Test: write unit tests for P&L service with new allIn format: verify `computeCashGamePLFromEvents` with potSize/trials/equity/wins calculates correct evCashOut. Test `computeTournamentPLFromEvents`. File: `packages/api/src/__tests__/live-session-pl.test.ts`

---

## Phase 3: US1 - Cash Game UX Overhaul (P1) MVP

### Create Form Updates

- [ ] T019 Update `CreateCashGameSessionForm`: add `initialBuyIn` number input field (required). Add `ringGames` prop to include `maxBuyIn` and `currencyId` per ring game. When a ring game is selected, auto-fill `initialBuyIn` input with `ringGame.maxBuyIn` and auto-set `currencyId` from `ringGame.currencyId` (frontend only). Include `initialBuyIn` in `onSubmit` values. File: `apps/web/src/components/live-cash-game/create-cash-game-session-form.tsx`

- [ ] T020 Update live sessions list page: pass `initialBuyIn` to `createMutation`. Update `ringGames` data to include `maxBuyIn` and `currencyId` fields from the API. Pass enriched ring game data to `CreateCashGameSessionForm`. File: `apps/web/src/routes/live-sessions/index.tsx`

### Stack Form Redesign (Bottom Sheet + Badge Pattern)

- [ ] T021 Create `AllInBottomSheet` component: a Drawer (bottom sheet) with inputs for `potSize`, `trials` (default 1), `equity` (0-100%), `wins`. Support both "add" and "edit" modes. On submit, return the allIn object. File: `apps/web/src/components/live-sessions/all-in-bottom-sheet.tsx`

- [ ] T022 Create `AddonBottomSheet` component: a Drawer with input for addon `amount`. Support both "add" and "edit" modes. On submit, return the addon object. File: `apps/web/src/components/live-sessions/addon-bottom-sheet.tsx`

- [ ] T023 Create `EventBadge` component: displays a compact badge for an allIn or addon record. Shows summary text (e.g., "All-in: 500 pot, 65%"). On tap, opens a popover or action sheet with "Edit" and "Delete" options. File: `apps/web/src/components/live-sessions/event-badge.tsx`

- [ ] T024 Redesign `CashGameStackForm`: replace inline allIn fields (actualResult/evResult) with "Add All-in" button that opens `AllInBottomSheet`. Replace checkbox addon with "Add Addon" button that opens `AddonBottomSheet`. Display added allIns and addon as `EventBadge` components. Badge tap opens edit bottom sheet or delete confirmation. Update `onSubmit` to pass new allIn format `{ potSize, trials, equity, wins }`. Ensure form fits in viewport (1-screen design). File: `apps/web/src/components/live-cash-game/cash-game-stack-form.tsx`

### Cash Game Detail Page Redesign

- [ ] T025 Update cash game detail page: remove "Record Buy-in" section entirely (buy-in is handled at session creation and via addon). Remove `BuyInForm` import and usage. Remove "paused" references from `STATUS_BADGE_CLASS` and `STATUS_LABEL`. Add "Reopen" button for completed sessions. Update `isActive` check to only check `status === "active"` (no paused). Redesign layout for 1-screen viewport fit. File: `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx`

- [ ] T026 Update cash game detail page: add reopen mutation calling `liveCashGameSession.reopen`. On success, invalidate queries and stay on same page. Show reopen button only when session is completed and no other active session exists. File: `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx`

- [ ] T027 Update cash game detail page: update `formatPayloadSummary` for new allIn format. For `cash_game_stack_record` with allIns, show potSize/equity instead of actualResult/evResult. File: `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx`

### Session Summary Update

- [ ] T028 Update `SessionSummary` component: add EV P&L display (evCashOut - totalBuyIn) alongside regular P&L. The new allIn EV format means evCashOut is calculated differently (equity-based). No schema change needed, just display logic. File: `apps/web/src/components/live-sessions/session-summary.tsx`

### Delete BuyInForm

- [ ] T029 Delete `BuyInForm` component (no longer needed - initial buy-in is part of session creation, subsequent buy-ins are addons). File: `apps/web/src/components/live-cash-game/buy-in-form.tsx`

### Remove "paused" from Session Card

- [ ] T030 Update `LiveSessionCard`: remove "paused" from `StatusBadge` type and class map. Update session prop type to `"active" | "completed"`. File: `apps/web/src/components/live-sessions/live-session-card.tsx`

### Component Tests

- [ ] T031 Test: write component tests for `AllInBottomSheet`: test renders with empty state, test submitting potSize/trials/equity/wins, test edit mode pre-fills values. File: `apps/web/src/components/live-sessions/__tests__/all-in-bottom-sheet.test.tsx`

- [ ] T032 Test: write component tests for `AddonBottomSheet`: test renders, test submit returns amount, test edit mode. File: `apps/web/src/components/live-sessions/__tests__/addon-bottom-sheet.test.tsx`

- [ ] T033 Test: write component tests for `EventBadge`: test renders badge text, test tap opens edit/delete actions. File: `apps/web/src/components/live-sessions/__tests__/event-badge.test.tsx`

- [ ] T034 Test: write component tests for updated `CashGameStackForm`: test allIn add via bottom sheet, test addon add via bottom sheet, test badge display, test submit with new allIn format. File: `apps/web/src/components/live-cash-game/__tests__/cash-game-stack-form.test.tsx`

---

## Phase 4: US2 - Tournament Recording (P1)

### Tournament UI Components

- [ ] T035 Create `CreateTournamentSessionForm` component: tournament selection, store, currency, memo inputs. No initialBuyIn (tournament buy-in comes from tournament settings). File: `apps/web/src/components/live-tournament/create-tournament-session-form.tsx`

- [ ] T036 Create `TournamentStackForm` component: inputs for `stackAmount`, `remainingPlayers`, `averageStack`. "Add Rebuy" and "Add Addon" buttons open bottom sheets. Rebuy bottom sheet: `cost` and `chips` inputs. Addon bottom sheet: `cost` and `chips` inputs. Added rebuys/addons displayed as `EventBadge`. File: `apps/web/src/components/live-tournament/tournament-stack-form.tsx`

- [ ] T037 Create `TournamentCompleteForm` component: inputs for `placement`, `totalEntries`, `prizeMoney`, `bountyPrizes` (optional). File: `apps/web/src/components/live-tournament/tournament-complete-form.tsx`

- [ ] T038 Create `TournamentSummary` component: displays tournament-specific summary (rebuyCount, rebuyCost, addonCount, addonCost, placement, totalEntries, prizeMoney, bountyPrizes, P&L). File: `apps/web/src/components/live-tournament/tournament-summary.tsx`

### Tournament Pages

- [ ] T039 Create tournament detail page: session header, status badge, TournamentSummary, TournamentStackForm (active only), event list, complete/discard/reopen actions. 1-screen design. File: `apps/web/src/routes/live-sessions/tournament/$sessionId.tsx`

- [ ] T040 Update live sessions list page: add "New Tournament" button alongside "New Cash Game". Show tournament sessions in the list alongside cash game sessions (query both routers). Route tournament card clicks to tournament detail page. File: `apps/web/src/routes/live-sessions/index.tsx`

### Tournament Component Tests

- [ ] T041 Test: write component tests for `TournamentStackForm`: test stack input, test rebuy/addon bottom sheet add, test badge display, test submit payload. File: `apps/web/src/components/live-tournament/__tests__/tournament-stack-form.test.tsx`

- [ ] T042 Test: write component tests for `CreateTournamentSessionForm`: test renders, test submit. File: `apps/web/src/components/live-tournament/__tests__/create-tournament-session-form.test.tsx`

---

## Phase 5: US3 - Session Reopen (P2)

### Reopen UI

- [ ] T043 Update live sessions list page: add "Reopen" action to completed session cards. Before reopen, check if an active session exists and show warning if so. On successful reopen, navigate to the session detail page. File: `apps/web/src/routes/live-sessions/index.tsx`

- [ ] T044 Add `useActiveSession` hook: queries both `liveCashGameSession.list({ status: "active" })` and `liveTournamentSession.list({ status: "active" })` to determine if any active session exists. Returns `{ hasActive: boolean, activeSession: { id, type } | null }`. Used by create forms and reopen buttons to enforce single-session guard in UI. File: `apps/web/src/hooks/use-active-session.ts`

- [ ] T045 Update create session UI: use `useActiveSession` to disable "New Cash Game" and "New Tournament" buttons when an active session exists. Show inline message directing user to the active session or to complete it first. File: `apps/web/src/routes/live-sessions/index.tsx`

### Reopen Tests

- [ ] T046 Test: write component tests for reopen flow in list page: test reopen button visibility for completed sessions, test reopen button disabled when active session exists, test successful reopen navigates to detail. File: `apps/web/src/routes/live-sessions/__tests__/reopen-flow.test.tsx`

---

## Phase 6: US4 - Table Players (P2)

### Table Player UI

- [ ] T047 Create `TablePlayerList` component: displays current table players (active/inactive). Shows player name, joined time, left time. "Add Player" button opens player selection. "Remove" button marks player as left. File: `apps/web/src/components/live-sessions/table-player-list.tsx`

- [ ] T048 Create `AddPlayerSheet` component: bottom sheet for adding a table player. Two modes: select existing player from list, or create new player inline (name + optional memo). Calls `sessionTablePlayer.add` or `sessionTablePlayer.addNew`. File: `apps/web/src/components/live-sessions/add-player-sheet.tsx`

- [ ] T049 Integrate `TablePlayerList` into cash game detail page: add table players section for active sessions. Query `sessionTablePlayer.list` for current players. File: `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx`

- [ ] T050 Integrate `TablePlayerList` into tournament detail page: add table players section for active sessions. File: `apps/web/src/routes/live-sessions/tournament/$sessionId.tsx`

### Table Player Tests

- [ ] T051 Test: write component tests for `TablePlayerList`: test renders player list, test add player triggers mutation, test remove player triggers mutation. File: `apps/web/src/components/live-sessions/__tests__/table-player-list.test.tsx`

- [ ] T052 Test: write component tests for `AddPlayerSheet`: test existing player selection, test new player creation. File: `apps/web/src/components/live-sessions/__tests__/add-player-sheet.test.tsx`

---

## Phase 7: US5 - Event History (P3)

### Event Timeline

- [ ] T053 Create `EventTimeline` component: displays all session events in chronological order. Each event shows type label, timestamp, payload summary. For `cash_game_stack_record`: show stack amount, allIn badges (potSize/equity), addon badge. For completed sessions, allow edit/delete of events via tap. File: `apps/web/src/components/live-sessions/event-timeline.tsx`

- [ ] T054 Create `EditEventSheet` component: bottom sheet for editing an existing event's payload. Dynamically renders the correct form based on `eventType`. Calls `sessionEvent.update`. File: `apps/web/src/components/live-sessions/edit-event-sheet.tsx`

- [ ] T055 Add event delete functionality: confirmation dialog before deleting an event via `sessionEvent.delete`. After delete, invalidate session queries to trigger P&L recalculation display. Integrate into `EventTimeline` component. File: `apps/web/src/components/live-sessions/event-timeline.tsx`

- [ ] T056 Integrate `EventTimeline` into cash game detail page: replace simple event list with `EventTimeline`. File: `apps/web/src/routes/live-sessions/cash-game/$sessionId.tsx`

- [ ] T057 Integrate `EventTimeline` into tournament detail page: add event timeline section. File: `apps/web/src/routes/live-sessions/tournament/$sessionId.tsx`

### Event History Tests

- [ ] T058 Test: write component tests for `EventTimeline`: test renders events in order, test edit opens sheet, test delete shows confirmation. File: `apps/web/src/components/live-sessions/__tests__/event-timeline.test.tsx`

---

## Phase 8: Bottom Nav + Polish

### Dynamic Bottom Navigation

- [ ] T059 Update bottom navigation (sidebar-nav or root layout): add `useActiveSession` hook to check for active sessions. When active session exists, change center/primary nav button to navigate to the active session detail page. When no active session, center button navigates to `/live-sessions/` for new session creation. File: `apps/web/src/routes/__root.tsx` (or the component containing bottom nav)

- [ ] T060 Update bottom navigation: when active session exists, add secondary nav items for event history and table players views of the current session. When no active session, show normal navigation items. File: `apps/web/src/routes/__root.tsx` (or the component containing bottom nav)

### 1-Screen Design Validation

- [ ] T061 Audit all live session screens for 1-screen viewport fit: cash game detail (active), cash game detail (completed), tournament detail (active), tournament detail (completed), session list, create forms. Adjust layouts as needed using compact spacing, collapsible sections, or removal of non-essential elements. Ensure no vertical scroll is required on standard mobile viewport (375x667). Files: `apps/web/src/routes/live-sessions/**`, `apps/web/src/components/live-cash-game/**`, `apps/web/src/components/live-tournament/**`

### Final Integration Tests

- [ ] T062 Test: write integration test for full cash game lifecycle: create session with initialBuyIn -> record stack with allIn (new format) and addon -> complete -> verify P&L -> reopen -> add more events -> re-complete -> verify updated P&L. File: `apps/web/src/__tests__/cash-game-lifecycle.test.tsx`

- [ ] T063 Test: write integration test for single-session guard: create cash game session -> attempt to create another -> verify blocked. Create tournament -> verify blocked. Complete first -> create second -> verify allowed. File: `apps/web/src/__tests__/single-session-guard.test.tsx`

- [ ] T064 Test: write navigation test for dynamic bottom nav: verify nav changes when active session exists vs. not. File: `apps/web/src/__tests__/dynamic-nav.test.tsx`
