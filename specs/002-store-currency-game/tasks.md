# Tasks: 店舗・通貨・ゲーム設定マスターデータ管理

**Input**: Design documents from `/specs/002-store-currency-game/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/trpc-routers.md, research.md

**Tests**: Included per Constitution III (Test Coverage Required).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Remove sample todo feature and add required shadcn/ui components

- [ ] T001 Delete sample todo schema in `packages/db/src/schema/todo.ts`
- [ ] T002 Delete sample todo router in `packages/api/src/routers/todo.ts`
- [ ] T003 Delete sample todo page in `apps/web/src/routes/todos.tsx`
- [ ] T004 [P] Add shadcn/ui Tabs component in `apps/web/src/components/ui/tabs.tsx`
- [ ] T005 [P] Add shadcn/ui Dialog component in `apps/web/src/components/ui/dialog.tsx`
- [ ] T006 [P] Add shadcn/ui Select component in `apps/web/src/components/ui/select.tsx`
- [ ] T007 [P] Add shadcn/ui Badge component in `apps/web/src/components/ui/badge.tsx`
- [ ] T008 [P] Add shadcn/ui Separator component in `apps/web/src/components/ui/separator.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schemas, constants, migration, and navigation update. MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T009 Create game variant constants and blind label mapping in `packages/db/src/constants.ts` (GAME_VARIANTS, DEFAULT_TRANSACTION_TYPES)
- [ ] T010 [P] Create Store and Currency and TransactionType and CurrencyTransaction schemas with relations in `packages/db/src/schema/store.ts`
- [ ] T011 [P] Create RingGame schema with relations in `packages/db/src/schema/ring-game.ts`
- [ ] T012 [P] Create Tournament and BlindLevel schemas with relations in `packages/db/src/schema/tournament.ts`
- [ ] T013 Update schema aggregation exports in `packages/db/src/schema.ts` (remove todo, add store, ring-game, tournament schemas and all relations)
- [ ] T014 Generate Drizzle migration via `drizzle-kit generate` in `packages/db/`
- [ ] T015 Apply migration to local D1 via `wrangler d1 migrations apply` in `apps/server/`
- [ ] T016 Update navigation: add "Stores" item, remove "Todos" in `apps/web/src/components/mobile-nav.tsx`

**Checkpoint**: Database ready, navigation updated — user story implementation can begin

---

## Phase 3: User Story 1 — Store Management (Priority: P1) 🎯 MVP

**Goal**: Users can register, view, edit, and delete poker stores they visit.

**Independent Test**: Create store → list → edit → delete completes successfully; only own stores visible.

### Tests for User Story 1

- [ ] T017 [P] [US1] Schema structure tests for Store table in `packages/db/src/__tests__/store.test.ts`
- [ ] T018 [P] [US1] Integration tests for store tRPC router (list, create, update, delete, ownership) in `packages/api/src/__tests__/store.test.ts`

### Implementation for User Story 1

- [ ] T019 [US1] Implement store tRPC router (list, getById, create, update, delete with ownership validation) in `packages/api/src/routers/store.ts`
- [ ] T020 [US1] Register store router in `packages/api/src/routers/index.ts` (remove todo import)
- [ ] T021 [P] [US1] Create store form component (name + memo fields) in `apps/web/src/components/stores/store-form.tsx`
- [ ] T022 [P] [US1] Create store card component (name, memo, edit/delete actions) in `apps/web/src/components/stores/store-card.tsx`
- [ ] T023 [US1] Create store list page (empty state, create button, store cards) in `apps/web/src/routes/stores/index.tsx`
- [ ] T024 [US1] Create store detail page shell with tabs (Currency, Ring Games, Tournaments) in `apps/web/src/routes/stores/$storeId.tsx`

**Checkpoint**: Store CRUD fully functional. Users can manage their store list.

---

## Phase 4: User Story 2 — Currency Management (Priority: P1)

**Goal**: Users can define currencies per store, record transactions (purchase/bonus/etc), and track balances.

**Independent Test**: Define currency → add purchase transaction → balance reflects correctly → delete currency cascades transactions.

### Tests for User Story 2

- [ ] T025 [P] [US2] Schema structure tests for Currency, CurrencyTransaction, TransactionType tables in `packages/db/src/__tests__/currency.test.ts`
- [ ] T026 [P] [US2] Integration tests for transactionType router (CRUD, delete block when in use) in `packages/api/src/__tests__/transaction-type.test.ts`
- [ ] T027 [P] [US2] Integration tests for currency and currencyTransaction routers (CRUD, balance calculation) in `packages/api/src/__tests__/currency.test.ts`

### Implementation for User Story 2

- [ ] T028a [US2] Implement default TransactionType seeding logic: on first access (or user registration hook), create 3 default types (Purchase, Bonus, Other) if none exist for the user, in `packages/api/src/routers/transaction-type.ts`
- [ ] T028 [US2] Implement transactionType tRPC router (list, create, update, delete with in-use check) in `packages/api/src/routers/transaction-type.ts`
- [ ] T029 [US2] Implement currency tRPC router (listByStore with balance, create, update, delete) in `packages/api/src/routers/currency.ts`
- [ ] T030 [US2] Implement currencyTransaction tRPC router (listByCurrency, create, delete) in `packages/api/src/routers/currency-transaction.ts`
- [ ] T031 [US2] Register transactionType, currency, currencyTransaction routers in `packages/api/src/routers/index.ts`
- [ ] T032 [P] [US2] Create currency form component (name + unit fields, create/edit mode) in `apps/web/src/components/stores/currency-form.tsx`
- [ ] T033 [P] [US2] Create transaction form component (amount, type select, date, memo) in `apps/web/src/components/stores/transaction-form.tsx`
- [ ] T034 [US2] Create transaction list component (history with running balance) in `apps/web/src/components/stores/transaction-list.tsx`
- [ ] T035 [US2] Create currency tab component (currency list with balances, add/edit/delete, expand to transaction history) in `apps/web/src/components/stores/currency-tab.tsx`

**Checkpoint**: Currency management fully functional. Users can track store chip balances.

---

## Phase 5: User Story 3 — Ring Game Management (Priority: P2)

**Goal**: Users can register ring game settings per store with structured blind/buy-in data, and archive inactive games.

**Independent Test**: Create ring game → SB/BB/Straddle labels display correctly → edit → archive → restore → delete.

### Tests for User Story 3

- [ ] T036 [P] [US3] Schema structure tests for RingGame table in `packages/db/src/__tests__/ring-game.test.ts`
- [ ] T037 [P] [US3] Integration tests for ringGame router (CRUD, archive, restore, ownership) in `packages/api/src/__tests__/ring-game.test.ts`

### Implementation for User Story 3

- [ ] T038 [US3] Implement ringGame tRPC router (listByStore with archive filter, create, update, archive, restore, delete) in `packages/api/src/routers/ring-game.ts`
- [ ] T039 [US3] Register ringGame router in `packages/api/src/routers/index.ts`
- [ ] T040 [P] [US3] Create ring game form component (name, variant select, blind1/2/3 with dynamic labels, ante, min/max buy-in, table size, currency select, memo) in `apps/web/src/components/stores/ring-game-form.tsx`
- [ ] T041 [US3] Create ring game tab component (active/archived toggle, game list with blind info, add/edit/archive/restore/delete actions) in `apps/web/src/components/stores/ring-game-tab.tsx`

**Checkpoint**: Ring game management fully functional. Blind labels display per variant.

---

## Phase 6: User Story 4 — Tournament Management (Priority: P2)

**Goal**: Users can register tournament settings with structured fields and a blind structure editor with break support.

**Independent Test**: Create tournament → add blind levels with break → reorder → edit → archive → restore → delete cascades levels.

### Tests for User Story 4

- [ ] T042 [P] [US4] Schema structure tests for Tournament and BlindLevel tables in `packages/db/src/__tests__/tournament.test.ts`
- [ ] T043 [P] [US4] Integration tests for tournament router (CRUD, archive, restore) in `packages/api/src/__tests__/tournament.test.ts`
- [ ] T044 [P] [US4] Integration tests for blindLevel router (CRUD, reorder, cascade delete) in `packages/api/src/__tests__/blind-level.test.ts`

### Implementation for User Story 4

- [ ] T045 [US4] Implement tournament tRPC router (listByStore, getById with levels, create, update, archive, restore, delete) in `packages/api/src/routers/tournament.ts`
- [ ] T046 [US4] Implement blindLevel tRPC router (listByTournament, create, update, delete, reorder) in `packages/api/src/routers/blind-level.ts`
- [ ] T047 [US4] Register tournament and blindLevel routers in `packages/api/src/routers/index.ts`
- [ ] T048 [P] [US4] Create blind level editor component (add/edit/delete/reorder levels, break toggle, dynamic blind labels, minutes field) in `apps/web/src/components/stores/blind-level-editor.tsx`
- [ ] T049 [P] [US4] Create tournament form component (name, variant, buy-in, entry fee, starting stack, rebuy/addon toggles with conditional fields, bounty, table size, currency select, memo) in `apps/web/src/components/stores/tournament-form.tsx`
- [ ] T050 [US4] Create tournament tab component (active/archived toggle, tournament list, add/edit/archive/restore/delete, expand to blind structure view) in `apps/web/src/components/stores/tournament-tab.tsx`

**Checkpoint**: Tournament management fully functional with full blind structure editing.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T051 Run `bun x ultracite fix` and resolve any remaining lint/format issues
- [ ] T052 Run `bun run check-types` and fix any type errors across all packages
- [ ] T053 Run full test suite `bun run test` and ensure all tests pass
- [ ] T054 Run quickstart.md validation: manually test all 11 verification steps
- [ ] T055 Verify mobile-first responsive design across all new pages and components

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 Store (Phase 3)**: Depends on Foundational (Phase 2)
- **US2 Currency (Phase 4)**: Depends on US1 (store detail page must exist for currency tab)
- **US3 Ring Game (Phase 5)**: Depends on US1 (store detail page must exist for ring game tab). Can run in parallel with US2.
- **US4 Tournament (Phase 6)**: Depends on US1 (store detail page must exist for tournament tab). Can run in parallel with US2 and US3.
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Store)**: Foundation only — no other story dependencies
- **US2 (Currency)**: Depends on US1 (needs store detail page with tabs)
- **US3 (Ring Game)**: Depends on US1 (needs store detail page with tabs). Independent of US2.
- **US4 (Tournament)**: Depends on US1 (needs store detail page with tabs). Independent of US2 and US3.

### Within Each User Story

- Tests can run in parallel with each other
- Schema tests before router tests (for development flow)
- Routers before frontend components
- Forms before container components (tabs)
- Register routers before building UI that calls them

### Parallel Opportunities

- T004-T008 (shadcn/ui components): All parallelizable
- T010-T012 (schema files): All parallelizable
- T017-T018, T025-T027, T036-T037, T042-T044 (tests within each story): Parallelizable
- US2, US3, US4 backend work can start in parallel after US1 backend is done
- US3 and US4 are fully independent and can run in parallel

---

## Parallel Example: After Phase 2

```text
# US2, US3, US4 backend routers can start in parallel after US1:
Task: T028 transactionType router
Task: T038 ringGame router
Task: T045 tournament router

# Within US4, forms and blind editor can be built in parallel:
Task: T048 blind-level-editor.tsx
Task: T049 tournament-form.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (delete todo)
2. Complete Phase 2: Foundational (schemas, migration, nav)
3. Complete Phase 3: User Story 1 (Store CRUD)
4. **STOP and VALIDATE**: Test store management independently
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (Store) → Test independently → Deploy (MVP!)
3. Add US2 (Currency) → Test independently → Deploy
4. Add US3 (Ring Game) → Test independently → Deploy
5. Add US4 (Tournament) → Test independently → Deploy
6. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All tRPC routers use `protectedProcedure` and validate ownership
- All UI text must be in English (Constitution V)
- All layouts must be mobile-first (Constitution VI)
- Game variant constants are shared between ring game and tournament
- Blind labels (SB/BB/Straddle) are resolved at display time via GAME_VARIANTS constant
- BlindLevel supports `isBreak` flag for tournament break entries
