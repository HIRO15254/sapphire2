# Tasks: プレイヤーメモ機能

**Input**: Design documents from `/specs/005-player-notes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure project for player notes feature

- [x] T001 Install Tiptap dependencies in apps/web: `bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/pm`
- [x] T002 Define TAG_COLORS preset constant (color names and Tailwind class mappings) in packages/db/src/constants/player-tag-colors.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and API routers that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create Player, PlayerTag, and PlayerToPlayerTag tables with relations and indexes in packages/db/src/schema/player.ts following the patterns in packages/db/src/schema/store.ts and packages/db/src/schema/session-tag.ts. Player has: id, userId, name, memo (nullable text), createdAt, updatedAt. PlayerTag has: id, userId, name, color (default "gray"), createdAt, updatedAt. PlayerToPlayerTag is a junction table with composite PK (playerId, playerTagId), both FK cascade delete.
- [ ] T004 Export new tables and relations from packages/db/src/schema.ts by adding player, playerRelations, playerTag, playerTagRelations, playerToPlayerTag, playerToPlayerTagRelations to the schema object
- [ ] T005 Generate database migration by running `bun run drizzle-kit generate` in packages/db
- [ ] T006 [P] Create playerTag tRPC router in packages/api/src/routers/player-tag.ts with list, create (name + color with Zod enum validation), update (name and/or color), delete (cascade cleanup of playerToPlayerTag) procedures. Follow the pattern in packages/api/src/routers/session-tag.ts.
- [ ] T007 [P] Create player tRPC router in packages/api/src/routers/player.ts with list (search + tagIds filter), getById (with tags), create (name + optional memo + optional tagIds), update (name, memo, tagIds replacement), delete procedures. Follow the pattern in packages/api/src/routers/store.ts. Player list must JOIN playerToPlayerTag and playerTag to return tags with color.
- [ ] T008 Register player and playerTag routers in packages/api/src/routers/index.ts by importing and adding them to the appRouter object
- [ ] T009 [P] Add "Players" navigation item to apps/web/src/components/sidebar-nav.tsx in the NAVIGATION_ITEMS array with path "/players" and IconUsers icon from @tabler/icons-react
- [ ] T010 [P] Add "Players" navigation item to apps/web/src/components/mobile-nav.tsx (uses same NAVIGATION_ITEMS from sidebar-nav.tsx, so this may already be covered if shared)

**Checkpoint**: Database schema, API routers, and navigation ready. User story implementation can begin.

---

## Phase 3: User Story 1 - プレイヤーの登録と管理 (Priority: P1) MVP

**Goal**: Users can create, view, edit, and delete players. The player list serves as an "opponent roster".

**Independent Test**: Create a player with a name, see it in the list, edit the name, delete it.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create player-card.tsx in apps/web/src/components/players/player-card.tsx displaying player name, edit/delete action buttons, and createdAt date. Follow the card pattern in apps/web/src/components/sessions/session-card.tsx. Include a delete confirmation via alert dialog.
- [ ] T012 [P] [US1] Create player-form.tsx in apps/web/src/components/players/player-form.tsx with a name input field (required, min 1 char) and a Save button. Support defaultValues for edit mode. Follow the form pattern in apps/web/src/components/stores/store-form.tsx using native FormData.
- [ ] T013 [US1] Create the Players list page in apps/web/src/routes/players/index.tsx with: useQuery for player.list, create/edit via ResponsiveDialog + PlayerForm, delete via PlayerCard, optimistic updates for create/update/delete mutations, empty state with "No players yet" message and a "New Player" button. Follow the page pattern in apps/web/src/routes/stores/index.tsx.

**Checkpoint**: Player CRUD is fully functional. Users can manage an opponent roster.

---

## Phase 4: User Story 2 - プレイヤーへのタグ割り当て (Priority: P2)

**Goal**: Users can create color-coded tags, assign them to players, and filter the player list by tags.

**Independent Test**: Create tags with different colors, assign them to players, filter the list by a specific tag.

### Implementation for User Story 2

- [ ] T014 [P] [US2] Create a ColorBadge utility component in apps/web/src/components/players/color-badge.tsx that renders a Badge with background/text colors based on the TAG_COLORS preset. Accept color name and children as props.
- [ ] T015 [P] [US2] Create player-tag-manager.tsx in apps/web/src/components/players/player-tag-manager.tsx as a standalone tag management UI. Display all user tags in a list with color badges. Support: create new tag (name + color picker from preset palette), edit tag name/color inline, delete tag with confirmation dialog showing cascade warning. Use ResponsiveDialog for create/edit forms. Follow CRUD patterns from stores page.
- [ ] T016 [US2] Extend tag-input.tsx (or create a new player-tag-input.tsx in apps/web/src/components/players/player-tag-input.tsx) to support color display. Show ColorBadge for each selected tag and in the suggestion dropdown. Accept tag objects with {id, name, color} instead of {id, name}.
- [ ] T017 [US2] Create player-filters.tsx in apps/web/src/components/players/player-filters.tsx with tag-based multi-select filter. Display available tags as color badges that can be toggled on/off. Pass selected tagIds to the player.list query. Follow the filter pattern in apps/web/src/components/sessions/session-filters.tsx.
- [ ] T018 [US2] Update PlayerForm in apps/web/src/components/players/player-form.tsx to include the player tag input component for assigning tags during create/edit. Pass tagIds in the form submission payload.
- [ ] T019 [US2] Update PlayerCard in apps/web/src/components/players/player-card.tsx to display assigned tags as ColorBadges below the player name.
- [ ] T020 [US2] Update the Players page in apps/web/src/routes/players/index.tsx to: add PlayerFilters with tag filtering state, add a "Manage Tags" button that opens PlayerTagManager in a ResponsiveDialog, pass tag filter state to the player.list query, wire up inline tag creation from PlayerForm.

**Checkpoint**: Tag management and player-tag assignment are fully functional. Players can be categorized and filtered.

---

## Phase 5: User Story 3 - リッチテキストエディタによるメモ作成 (Priority: P3)

**Goal**: Users can create and edit rich text (HTML) memos for each player using a WYSIWYG editor with formatting toolbar.

**Independent Test**: Open a player, write a memo with bold text, headings, and a list, save it, reopen and verify formatting is preserved.

### Implementation for User Story 3

- [ ] T021 [US3] Create player-memo-editor.tsx in apps/web/src/components/players/player-memo-editor.tsx as a Tiptap wrapper component. Initialize useEditor with StarterKit and Link extensions. Include a compact formatting toolbar with buttons for: bold, italic, heading (h2, h3), bullet list, ordered list, link. Include a Save button that calls onSave with editor.getHTML(). Support initialContent prop for loading existing memo HTML. Style the editor area with Tailwind prose classes for readable formatting. Mobile-first toolbar layout.
- [ ] T022 [US3] Add unsaved changes detection to player-memo-editor.tsx: track dirty state by comparing current HTML to initialContent, show visual indicator when unsaved, use beforeunload event and TanStack Router's navigation blocking to warn on page leave with unsaved changes.
- [ ] T023 [US3] Update the Players page in apps/web/src/routes/players/index.tsx to add a memo editing flow: add a "Memo" action button to PlayerCard that opens PlayerMemoEditor in a ResponsiveDialog (fullHeight mode), load existing memo content from player.memo via player.getById query, save memo via player.update mutation with the HTML content, show success toast on save.
- [ ] T024 [US3] Update PlayerCard in apps/web/src/components/players/player-card.tsx to show a memo preview: if player.memo exists, render a truncated plain-text excerpt (strip HTML tags, max ~100 chars) below the tags. Add a memo icon indicator when memo content exists.

**Checkpoint**: Rich text memo editing is fully functional. All three user stories are independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Refinements that affect multiple user stories

- [ ] T025 [P] Run `bun x ultracite fix` to format all new files and verify no lint errors
- [ ] T026 [P] Run `bun run check-types` to verify TypeScript compilation succeeds with all new files
- [ ] T027 Verify all acceptance scenarios from spec.md by manually testing the complete flow: create player, assign colored tags, filter by tag, create/edit memo with formatting, delete player with cascade cleanup

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T002) - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Story 2 (Phase 4)**: Depends on Phase 2 and Phase 3 (US1 provides the player list page and components to extend)
- **User Story 3 (Phase 5)**: Depends on Phase 2 and Phase 3 (US1 provides the player page and card to extend). Independent of US2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No other story dependencies
- **User Story 2 (P2)**: Depends on US1 (extends PlayerForm, PlayerCard, Players page)
- **User Story 3 (P3)**: Depends on US1 (extends PlayerCard, Players page). Does NOT depend on US2.

### Within Each User Story

- Components marked [P] can be built in parallel (different files)
- Page integration tasks depend on component tasks completing first
- US2 and US3 can run in parallel after US1 completes (they extend different aspects of the same components)

### Parallel Opportunities

- T006 + T007: Player and PlayerTag routers can be built in parallel
- T009 + T010: Navigation updates are independent
- T011 + T012: PlayerCard and PlayerForm are independent components
- T014 + T015: ColorBadge and TagManager are independent components
- T025 + T026: Lint and type checks are independent

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T003-T005 (schema + migration):
# Launch router tasks in parallel:
Task T006: "Create playerTag router in packages/api/src/routers/player-tag.ts"
Task T007: "Create player router in packages/api/src/routers/player.ts"
Task T009: "Add Players nav to sidebar-nav.tsx"
Task T010: "Add Players nav to mobile-nav.tsx"
# Then register routers:
Task T008: "Register routers in packages/api/src/routers/index.ts"
```

## Parallel Example: User Story 1

```bash
# Launch component tasks in parallel:
Task T011: "Create player-card.tsx"
Task T012: "Create player-form.tsx"
# Then integrate into page:
Task T013: "Create Players list page"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T010)
3. Complete Phase 3: User Story 1 (T011-T013)
4. **STOP and VALIDATE**: Player CRUD works independently
5. Deploy if ready - users can manage an opponent roster

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test player CRUD → Deploy (MVP!)
3. Add User Story 2 → Test tag assignment and filtering → Deploy
4. Add User Story 3 → Test memo editing with formatting → Deploy
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Follow reference patterns listed in quickstart.md for each task
- All UI text MUST be in English (constitution requirement)
- Mobile-first layouts using ResponsiveDialog (Drawer on mobile, Dialog on desktop)
