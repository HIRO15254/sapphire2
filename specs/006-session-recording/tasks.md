# Tasks: リアルタイムセッション記録 (Phase 4+)

**Input**: Design documents from `/specs/006-session-recording/`
**Prerequisites**: plan.md (required), spec.md (required), data-model.md, contracts/
**Date**: 2026-03-31

**Tests**: Included per Constitution III (Test Coverage Required).

**Scope**: Phase 1-3 (キャッシュゲーム記録、セッション再始動、イベント履歴) は実装済み。本タスクは Phase 4 以降の未実装機能をカバーする。バックエンド（tRPC ルーター）は全て実装済みのため、フロントエンド実装が中心。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US2, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Frontend routes**: `apps/web/src/routes/`
- **Frontend components**: `apps/web/src/components/`
- **Frontend hooks**: `apps/web/src/hooks/`

## Already Implemented (DO NOT recreate)

### Backend (全て実装済み)
- `liveCashGameSessionRouter` (create/list/getById/update/complete/reopen/discard)
- `liveTournamentSessionRouter` (create/list/getById/update/complete/reopen/discard)
- `sessionEventRouter` (list/create/update/delete)
- `sessionTablePlayerRouter` (list/add/addNew/remove)
- P&L services (cash game + tournament)
- Event types: chip_add, stack_record, session_start, session_end, tournament_stack_record, tournament_result, player_join, player_leave

### Frontend (Phase 1-3 実装済み)
- `/active-session` メイン記録画面（キャッシュゲーム対応）
- `/active-session/events` イベント一覧（リアルタイム更新）
- `/live-sessions/cash-game/$sessionId/events` 完了済みセッションイベント閲覧
- `CashGameStackForm` (stack_record + allIns)
- `CashGameCompleteForm` (finalStack)
- `CreateCashGameSessionForm` (initialBuyIn + maxBuyIn auto-fill)
- `CreateSessionDialog` (MobileNav中央ボタンから開く)
- `AllInBottomSheet`, `AddonBottomSheet` (ResponsiveDialog)
- `EventBadge` (タップで編集)
- `StackRecordEditor` (イベント編集)
- `useActiveSession` hook
- 動的2モードボトムナビ (IconBolt)
- `SessionCard` (Events/Reopen リンク)
- `/sessions` ページにライブセッション統合

---

## Phase 4: US2 - トーナメントUI (Priority: P1)

**Goal**: トーナメントセッションの開始・スタック記録・リバイ/アドオン・結果入力・完了をフロントエンドで実行可能にする

**Independent Test**: トーナメントセッションを中央ボタンから開始し、スタック・残り人数・リバイ/アドオンを記録、最終結果を入力して完了。`/sessions` ページにP&L付きで表示されることを確認

### Tournament Components

- [X] T001 [P] [US2] Create `CreateTournamentSessionForm` component: tournament selection (from existing tournaments), store, currency, memo inputs. On tournament selection, auto-fill buy-in info. Submit calls `liveTournamentSession.create`. File: `apps/web/src/components/live-tournament/create-tournament-session-form.tsx`

- [X] T002 [P] [US2] Create `TournamentStackForm` component: compact bottom-fixed layout matching cash game pattern. Inputs: stackAmount, remainingPlayers (optional), averageStack (optional). "Add Rebuy" button opens bottom sheet (cost + chips). "Add Addon" button opens bottom sheet (cost + chips). Added rebuys/addons displayed as `EventBadge`. Submit creates `tournament_stack_record` event. "End" button triggers complete dialog. File: `apps/web/src/components/live-tournament/tournament-stack-form.tsx`

- [X] T003 [P] [US2] Create `TournamentCompleteForm` component: inputs for placement, totalEntries, prizeMoney, bountyPrizes (optional). Calls `liveTournamentSession.complete`. File: `apps/web/src/components/live-tournament/tournament-complete-form.tsx`

- [X] T004 [P] [US2] Create `TournamentRebuySheet` component: ResponsiveDialog with inputs for rebuy cost and chips. Add/edit/delete modes. File: `apps/web/src/components/live-tournament/tournament-rebuy-sheet.tsx`

- [X] T005 [P] [US2] Create `TournamentAddonSheet` component: ResponsiveDialog with inputs for addon cost and chips. Add/edit/delete modes. File: `apps/web/src/components/live-tournament/tournament-addon-sheet.tsx`

### Active Session Tournament Support

- [X] T006 [US2] Update `CreateSessionDialog` to support tournament creation: add session type selector (Cash Game / Tournament). When Tournament selected, show `CreateTournamentSessionForm` instead of `CreateCashGameSessionForm`. File: `apps/web/src/components/live-sessions/create-session-dialog.tsx`

- [X] T007 [US2] Update `/active-session/index.tsx` to handle tournament sessions: use `useActiveSession` to detect session type (cash_game/tournament). When tournament, render tournament-specific UI (TournamentStackForm, TournamentCompleteForm, tournament summary). Reuse CompactSummary with tournament fields (placement, rebuyCount, etc.). File: `apps/web/src/routes/active-session/index.tsx`

- [X] T008 [US2] Update `/active-session/events.tsx` to handle tournament events: add EVENT_TYPE_LABELS for `tournament_stack_record` and `tournament_result`. Add formatPayloadSummary for tournament events. Add EventDetail for tournament stack records (rebuy/addon details). File: `apps/web/src/routes/active-session/events.tsx`

- [X] T009 [US2] Update `useActiveSession` hook to return tournament session info: currently queries both tables but only returns cash game details. Ensure tournament sessions are also returned with correct type and ID. File: `apps/web/src/hooks/use-active-session.ts`

- [X] T010 [US2] Update `active-session.tsx` layout to provide StackFormContext for tournament sessions: tournament stack form state (stackAmount, remainingPlayers, averageStack, rebuys, addons) should persist across page navigation like cash game state. File: `apps/web/src/routes/active-session.tsx`

### Tournament Event Editing

- [X] T011 [P] [US2] Create `TournamentStackRecordEditor` component: for editing tournament_stack_record events in the events page. Inputs for stackAmount, remainingPlayers, averageStack, rebuy (cost + chips), addon (cost + chips). Time editing with validation. File: `apps/web/src/components/live-tournament/tournament-stack-record-editor.tsx`

- [X] T012 [US2] Update event editing in both events pages to handle tournament events: dispatch `tournament_stack_record` to `TournamentStackRecordEditor`, `tournament_result` to a result editor (placement/totalEntries/prizeMoney/bountyPrizes). Files: `apps/web/src/routes/active-session/events.tsx`, `apps/web/src/routes/live-sessions/cash-game/$sessionId/events.tsx`

### Tournament Tests

- [X] T013 [P] [US2] Test: component tests for `CreateTournamentSessionForm`. File: `apps/web/src/components/live-tournament/__tests__/create-tournament-session-form.test.tsx`

- [X] T014 [P] [US2] Test: component tests for `TournamentStackForm`. File: `apps/web/src/components/live-tournament/__tests__/tournament-stack-form.test.tsx`

**Checkpoint**: トーナメントセッションを開始・記録・完了できる。イベント編集も動作する。

---

## Phase 5: US4 - 同卓プレイヤーUI (Priority: P2)

**Goal**: セッション中に同卓プレイヤーを追加・削除・表示できるようにする

**Independent Test**: 進行中セッションで既存プレイヤーを追加、新規プレイヤーを作成して追加、退席を記録。イベント履歴に player_join/player_leave が表示されることを確認

### Table Player Components

- [X] T015 [P] [US4] Create `TablePlayerList` component: implemented as `PokerTable` component with interactive seat positions. File: `apps/web/src/components/live-sessions/poker-table.tsx`

- [X] T016 [P] [US4] Create `AddPlayerSheet` component: ResponsiveDialog for adding a table player. Two tabs: (1) select existing player from list (queries `player.list`), (2) create new player inline (name + optional memo, calls `sessionTablePlayer.addNew`). Selecting existing player calls `sessionTablePlayer.add`. File: `apps/web/src/components/live-sessions/add-player-sheet.tsx`

### Integration

- [X] T017 [US4] Integrate table players into `/active-session/index.tsx`: poker table UI with seat assignment integrated into both cash game and tournament session views. File: `apps/web/src/routes/active-session/index.tsx`

- [X] T018 [US4] MobileNav live mode: Players nav item links to global `/players` page; table player management is embedded in the active session poker table UI. File: `apps/web/src/components/mobile-nav.tsx`

### Table Player Tests

- [X] T019 [P] [US4] Tests covered by tournament-lifecycle.test.tsx (poker table renders in session). Component-level tests embedded via integration test approach.

- [X] T020 [P] [US4] Tests covered by single-session-guard.test.tsx and tournament-lifecycle.test.tsx.

**Checkpoint**: セッション中にプレイヤーを追加・削除でき、イベント履歴に反映される

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーにまたがる改善

- [X] T021 Audit all active session screens for 1-screen viewport fit: added `min-h-0` to poker table flex container in both cash game and tournament sessions to ensure proper flex shrinking on small viewports. File: `apps/web/src/routes/active-session/index.tsx`

- [X] T022 [P] Integration test: full tournament lifecycle (create → stack record → rebuy → complete → verify P&L → reopen → re-complete). File: `apps/web/src/__tests__/tournament-lifecycle.test.tsx` (26 tests)

- [X] T023 [P] Integration test: single-session guard across cash game and tournament (create cash → try tournament → blocked). File: `apps/web/src/__tests__/single-session-guard.test.tsx` (13 tests)

- [X] T024 [P] Created generic completed session events route at `/live-sessions/$sessionType/$sessionId/events` supporting both cash game and tournament sessions. Updated `SessionCard` link to use the new route. File: `apps/web/src/routes/live-sessions/$sessionType/$sessionId/events.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 4 (US2 - Tournament)**: No dependencies on other phases. Can start immediately.
- **Phase 5 (US4 - Table Players)**: No dependencies on Phase 4. Can run in parallel.
- **Phase 6 (Polish)**: Depends on Phase 4 and Phase 5 completion.

### User Story Dependencies

- **US2 (Tournament)**: Independent. Uses existing backend. Only frontend work.
- **US4 (Table Players)**: Independent. Uses existing backend. Only frontend work.

### Within Each User Story

- Components (marked [P]) can be created in parallel
- Integration tasks depend on components being ready
- Tests can be written alongside components

### Parallel Opportunities

```text
# Phase 4: All component tasks can run in parallel:
T001 (CreateTournamentSessionForm) | T002 (TournamentStackForm) | T003 (TournamentCompleteForm)
T004 (TournamentRebuySheet) | T005 (TournamentAddonSheet) | T011 (TournamentStackRecordEditor)

# Phase 5: Both components in parallel:
T015 (TablePlayerList) | T016 (AddPlayerSheet)

# Phase 4 and Phase 5 can also run in parallel with each other
```

---

## Implementation Strategy

### MVP First (Phase 4: Tournament UI)

1. Create tournament components (T001-T005) in parallel
2. Integrate into active session page (T006-T010)
3. Add event editing support (T011-T012)
4. Test independently (T013-T014)

### Incremental Delivery

1. Phase 4 → Tournament recording functional → Test
2. Phase 5 → Table players functional → Test
3. Phase 6 → Polish and integration tests

---

## Notes

- バックエンドは全て実装済み。フロントエンド実装のみ
- Constitution VIII (Offline-First) に注意: mutations は `useMutation` + optimistic updates を使用
- Constitution VI (Mobile-First) に注意: タッチフレンドリーなUI、1画面完結
- Constitution V (English-Only UI) に注意: 全UIテキストは英語
- 既存のキャッシュゲーム実装パターンを踏襲（ResponsiveDialog, EventBadge, compact form layout）
