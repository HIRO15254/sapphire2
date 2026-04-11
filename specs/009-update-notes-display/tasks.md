# Tasks: アップデートノート表示

**Input**: Design documents from `/specs/009-update-notes-display/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Static data definition and project structure

- [ ] T001 [P] Create update notes static data constants with UpdateNote type definition and initial release data in `apps/web/src/update-notes/constants.ts` (FR-001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and tRPC router that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 Create Drizzle schema for `update_note_view` table with id, userId (FK→user, CASCADE), version, viewedAt fields, unique index on (userId, version), and index on userId in `packages/db/src/schema/update-note-view.ts` (data-model.md)
- [ ] T003 Export `updateNoteView` table and relations from `packages/db/src/schema.ts`
- [ ] T004 Add `updateNoteView` many-relation to existing `userRelations` in `packages/db/src/schema/auth.ts`
- [ ] T005 Generate database migration by running `cd packages/db && bun run db:generate`
- [ ] T006 Create tRPC router `updateNoteViewRouter` in `packages/api/src/routers/update-note-view.ts` with three protected procedures: `list` (query: return all viewed versions for user), `markViewed` (mutation: idempotent upsert of version view record), `getLatestViewedVersion` (query: return latest viewed version or null) per contracts/trpc-router.md
- [ ] T007 Register `updateNoteViewRouter` as `updateNoteView` in `packages/api/src/routers/index.ts`

**Checkpoint**: Backend API ready — `updateNoteView.list`, `updateNoteView.markViewed`, `updateNoteView.getLatestViewedVersion` endpoints available

---

## Phase 3: User Story 1 - 初回アクセス時のアップデートノート自動表示 (Priority: P1)

**Goal**: After an app update, automatically open the update notes sheet on the user's first access

**Independent Test**: Log in after updating app version, verify sheet auto-opens. Close sheet, re-access, verify no auto-open.

### Implementation for User Story 1

- [ ] T008 [US1] Create `UpdateNotesProvider` context and `useUpdateNotesSheet` hook in `apps/web/src/update-notes/hooks/use-update-notes-sheet.tsx` — manage sheet open/close state, fetch `getLatestViewedVersion` via tRPC query, compare with `LATEST_VERSION` constant, auto-open sheet via `useEffect` when unviewed version detected (skip if `viewedVersion === null` for first-time users) (FR-006, FR-007)
- [ ] T009 [US1] Create `UpdateNotesSheet` component in `apps/web/src/update-notes/components/update-notes-sheet.tsx` — use `ResponsiveDialog` with title "Update Notes", render latest version's title and changes list, consume `useUpdateNotesSheet` context for open/close state (FR-002)
- [ ] T010 [US1] Integrate into `AuthenticatedShell` in `apps/web/src/shared/components/authenticated-shell.tsx` — wrap children with `UpdateNotesProvider`, render `UpdateNotesSheet` at shell level alongside `LiveStackFormSheet`

**Checkpoint**: Auto-open on first access after update works. Sheet displays latest version info. Closing prevents re-open.

---

## Phase 4: User Story 2 - アップデートノート一覧の閲覧 (Priority: P2)

**Goal**: Users can manually open and browse all update notes with version name, release date, and unread highlighting

**Independent Test**: Open user menu, click "Update Notes", verify all versions listed with dates. Unviewed versions show "NEW" badge.

### Implementation for User Story 2

- [ ] T011 [US2] Add "Update Notes" `DropdownMenuItem` to `UserMenu` in `apps/web/src/shared/components/user-menu.tsx` — on click, call `useUpdateNotesSheet().open()` from context (FR-008, SC-002)
- [ ] T012 [US2] Enhance `UpdateNotesSheet` component to display full update notes list using `Accordion` — fetch `updateNoteView.list` to determine viewed versions, render each version as `AccordionItem` with version name + release date in `AccordionTrigger`, show `Badge` with "NEW" for unviewed versions, sort by releasedAt descending (FR-002, FR-004, FR-010, SC-003)
- [ ] T013 [US2] Handle empty state in `UpdateNotesSheet` — when no update notes exist in constants, display "No update notes available" message

**Checkpoint**: Manual trigger via UserMenu works. All versions listed with dates. Unviewed versions highlighted with "NEW" badge.

---

## Phase 5: User Story 3 - アップデート詳細の確認 (Priority: P3)

**Goal**: Users can expand accordion items to view detailed changes and mark versions as viewed

**Independent Test**: Expand an unviewed version's accordion, verify changes list displays. Re-open sheet, verify "NEW" badge is removed.

### Implementation for User Story 3

- [ ] T014 [US3] Add `AccordionContent` with changes list to each `AccordionItem` in `UpdateNotesSheet` — render each change as a list item inside the accordion content area (FR-005)
- [ ] T015 [US3] Fire `markViewed` mutation on accordion expand — use `onValueChange` callback on `Accordion` to detect expansion, call `updateNoteView.markViewed` tRPC mutation with the expanded version, invalidate `list` and `getLatestViewedVersion` queries on success to update UI (FR-009)
- [ ] T016 [US3] Handle optimistic update for viewed state — after `markViewed` mutation fires, immediately remove "NEW" badge from the expanded item without waiting for server response (offline-first, Constitution VIII)

**Checkpoint**: All user stories fully functional. Accordion expand/collapse works. Viewing marks version as read. Badge disappears after viewing.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Testing, edge cases, and quality assurance

- [ ] T017 [P] Write schema tests in `packages/db/src/__tests__/update-note-view.test.ts` — verify table structure, unique constraint on (userId, version), cascade delete when user is deleted (Constitution III)
- [ ] T018 [P] Write tRPC router integration tests in `packages/api/src/__tests__/update-note-view.test.ts` — test `list` returns user's views, `markViewed` is idempotent, `getLatestViewedVersion` returns null for new user and correct version for existing user (Constitution III)
- [ ] T019 [P] Write component tests in `apps/web/src/update-notes/__tests__/update-notes-sheet.test.tsx` — test sheet renders with accordion items, "NEW" badge appears for unviewed versions, accordion expand/collapse works (Constitution III)
- [ ] T020 Run `bun run check-types && bun run test && bun run check` to verify all checks pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: T002 → T003 → T004 (sequential, same schema files); T005 depends on T004; T006 depends on T002; T007 depends on T006
- **User Story 1 (Phase 3)**: Depends on Phase 1 (T001) + Phase 2 (T006, T007). T008 → T009 → T010 (sequential)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (T008, T009, T010). T011 and T012 can run in parallel. T013 depends on T012.
- **User Story 3 (Phase 5)**: Depends on Phase 4 (T012). T014 → T015 → T016 (sequential, same file)
- **Polish (Phase 6)**: T017, T018, T019 can all run in parallel. T020 depends on all previous tasks.

### Parallel Opportunities

```text
Phase 1:  T001 (standalone)
Phase 2:  T002 → T003 → T004 → T005
          T002 → T006 → T007  (T006 can start after T002, parallel with T003-T005)
Phase 3:  T008 → T009 → T010
Phase 4:  T011 ──┐
          T012 ──┤ (parallel) → T013
Phase 5:  T014 → T015 → T016
Phase 6:  T017 ┐
          T018 ├ (all parallel) → T020
          T019 ┘
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 + Phase 2 → Backend ready
2. Complete Phase 3 (US1) → Auto-open on first access works
3. **STOP and VALIDATE**: Test auto-open independently

### Incremental Delivery

1. Setup + Foundational → API ready
2. User Story 1 → Auto-open sheet (MVP)
3. User Story 2 → Full list with manual trigger + badges
4. User Story 3 → Accordion details + mark-as-viewed
5. Polish → Tests + final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All UI text MUST be in English (Constitution V)
- Use `mutationOptions()` for tRPC mutations, never direct `trpcClient.*.mutate()` (Constitution VIII)
- Commit after each task or logical group
