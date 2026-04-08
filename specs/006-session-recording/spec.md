# Feature Specification: Live Session Recording

**Feature Branch**: `006-session-recording`
**Status**: Implementation Synced
**Scope**: Current live-session implementation only

## Summary

This feature covers the current live poker session flow in the app:

- Cash games and tournaments are tracked as separate live session tables.
- The active live session is surfaced through `/active-session`.
- Event history is available at `/active-session/events` for the current session and `/live-sessions/$sessionType/$sessionId/events` for completed sessions.
- Session cards in `/sessions` expose `Events` and, for cash/tournament sessions, `Reopen` when applicable.

## User Scenarios

### 1. Start and record a cash game session

As a user, I can start a cash game live session from the create-session dialog, pick a store and ring game, enter an initial buy-in, and begin recording stack changes.

Current behavior:
- The ring game selection autofills `maxBuyIn` and `currencyId` when available.
- Starting a cash game creates `session_start` and `chip_add` events automatically.
- During the session, I can record `stack_record` events and add all-ins in the stack sheet.
- Additional buy-ins are recorded as separate `chip_add` events.
- Completing the session records a final `stack_record` and `session_end`, then generates or updates the linked `pokerSession`.

### 2. Start and record a tournament session

As a user, I can start a tournament live session, enter the tournament defaults, and record stack updates, chip purchases, and the final result.

Current behavior:
- Tournament selection autofills `buyIn`, `entryFee`, `startingStack`, and `currencyId` when available.
- The backend create call records `session_start`.
- The create dialog immediately records the initial `tournament_stack_record` for the starting stack.
- During the session, I can add more `tournament_stack_record` entries and complete the session with `placement`, `totalEntries`, `prizeMoney`, and optional `bountyPrizes`.
- Completing the session records `tournament_result` and `session_end`, then generates or updates the linked `pokerSession`.

### 3. Review, edit, and reopen sessions

As a user, I can inspect the current session's event history, edit event payloads and timestamps, and reopen completed sessions from the sessions list.

Current behavior:
- `sessionEvent.update` and `sessionEvent.delete` are available for editable events.
- Editing or deleting completed-session events triggers P&L recalculation.
- Completed sessions can be reopened only when no other session is active.
- Reopening appends a new `session_start` event and removes the linked `pokerSession` / `currencyTransaction` so the next completion recalculates them.

### 4. Manage table players

As a user, I can add existing players or create new ones while a session is active, and I can mark them as left later.

Current behavior:
- Table players are tracked in `sessionTablePlayer`.
- `player_join` and `player_leave` events stay in sync with the table-player state.
- The poker table UI is shared by cash game and tournament live sessions.

## Functional Requirements

- The app must support exactly two live session types: `cash_game` and `tournament`.
- Only one live session may be active at a time for a user across both live session tables.
- Cash game starts must record `session_start` and the initial `chip_add`.
- Tournament starts must record `session_start`, and the create dialog must write the initial `tournament_stack_record`.
- Cash game stack updates must support `stack_record` plus optional all-in entries.
- Tournament stack updates must support `tournament_stack_record` plus chip purchase details.
- Session events must support create, update, delete, and list by live session id.
- Completed sessions must expose event history routes and support reopen from the sessions list.
- Table players must support add, addNew, remove, and list.
- The mobile bottom navigation must switch its center action between session creation and stack recording based on whether a live session is active.

## Success Criteria

- A user can start a cash game live session, record a stack update, and complete it from the current UI.
- A user can start a tournament live session, record stack and result data, and complete it from the current UI.
- A completed session can be reopened from `/sessions` and resumes as the active live session.
- The active session event history and the completed-session event history both render the same event payloads currently stored in the database.
- The current implementation remains compatible with `pokerSession` for reporting and the sessions list.
