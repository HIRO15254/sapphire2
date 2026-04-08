# Feature Specification: Live Session Recording

**Feature Branch**: `004-session-record`
**Created**: 2026-03-23
**Status**: Implemented (synced to current codebase)
**Input**: User description: "Live session recording with event timelines, seated player tracking, and historical session records for poker P&L analysis"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start and manage a live cash game session (Priority: P1)

A user starts a cash game session from the sessions area and records events while play is in progress. The live session tracks the current stack, chip adds, stack records, seated players, memo, hero seat, and lifecycle events. The user can reopen a completed cash game session later and continue the same live record.

**Independent Test**: Create a live cash game session, add chip and stack events, view the active-session screen, and confirm the summary, event timeline, and seated-player list update in real time.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a cash-game configuration, **When** they start a live cash game session, **Then** a `live_cash_game_session` record is created and the active session screen opens.
2. **Given** a live cash game session is active, **When** the user records `chip_add`, `stack_record`, `player_join`, or `player_leave` events, **Then** the event timeline and live summary update to reflect the new state.
3. **Given** a live cash game session has been completed or discarded, **When** the user reopens it from the session history list, **Then** the session returns to the active-session flow.

---

### User Story 2 - Start and manage a live tournament session (Priority: P1)

A user starts a tournament session from the sessions area and records tournament-specific events while play is in progress. The live session tracks stack records, remaining players, total entries, tournament result, memo, hero seat, and lifecycle events.

**Independent Test**: Create a live tournament session, record tournament stack and result events, and confirm the active-session screen and event timeline reflect the latest state.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a tournament configuration, **When** they start a live tournament session, **Then** a `live_tournament_session` record is created and the active session screen opens.
2. **Given** a live tournament session is active, **When** the user records `tournament_stack_record` or `tournament_result` events, **Then** the live summary and event list update accordingly.
3. **Given** a live session is already active, **When** the user tries to start another live session, **Then** the app prevents overlapping active sessions.

---

### User Story 3 - Review and edit live session events (Priority: P2)

A user opens the event timeline for a live session and edits event timestamps or payloads as play continues. The timeline supports both the generic active-session screen and the direct event route for a specific live session.

**Independent Test**: Open `/active-session/events` or `/live-sessions/$sessionType/$sessionId/events`, edit an event, and confirm the updated timestamp and payload are persisted.

**Acceptance Scenarios**:

1. **Given** a live session, **When** the user opens the event timeline, **Then** they can see events in chronological order with human-readable summaries.
2. **Given** an event is editable, **When** the user changes the time or payload, **Then** the event is saved and the live summary recalculates if the session is still active.
3. **Given** a user edits players in the session, **When** they add or remove a player, **Then** the seat and active-player state stay in sync with the event log.

---

### User Story 4 - Maintain session history and analysis records (Priority: P2)

A user views the historical session list after a live session is completed. The list shows cash game and tournament records together, including profit/loss, EV metrics where applicable, linked store/game/currency context, tags, and a reopen action for sessions that still have live state.

**Independent Test**: Open `/sessions`, filter the list, inspect a card, and confirm the linked entity names, tags, P&L, and EV fields match the underlying record.

**Acceptance Scenarios**:

1. **Given** a user has recorded sessions, **When** they open the session history list, **Then** the newest sessions appear first with type, P&L, and linked entity summaries.
2. **Given** a user applies filters by type, store, currency, or date range, **When** the list refreshes, **Then** the summary and results stay in sync with the selected filters.
3. **Given** a session is linked to a currency, **When** the session is created or updated, **Then** the corresponding currency transaction is created, updated, or deleted automatically.

---

### User Story 5 - Manage tags and session context (Priority: P3)

A user adds tags to a session while creating or editing it and manages the tag catalog from settings. Session cards show tag badges and linked context so the history remains useful after the live session is over.

**Independent Test**: Create a tag, attach it to a session, open the session history card, and verify the tag remains visible and editable through the tag manager.

**Acceptance Scenarios**:

1. **Given** a user is editing a session, **When** they create or select tags inline, **Then** the tags are stored through the session tag router and appear on the session card.
2. **Given** a user opens Settings, **When** they manage session tags, **Then** they can list, rename, and delete their own tags.
3. **Given** a session links to a store, game, or currency, **When** the linked entity is deleted later, **Then** the session record remains and shows the missing link as null or absent.

### Edge Cases

- Only one live session may be active at a time for a user.
- Session type is immutable after creation.
- Cash game and tournament sessions use different live event sets.
- Session history cards must keep working when a linked store, ring game, tournament, or currency is deleted.
- EV metrics apply only to cash game history records with EV data.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system must support separate live cash game and live tournament session flows.
- **FR-002**: The system must prevent more than one active live session for a user at a time.
- **FR-003**: The system must record live cash game events for chip adds, stack records, player joins, player leaves, and lifecycle events.
- **FR-004**: The system must record live tournament events for tournament stack records, tournament results, player joins, player leaves, and lifecycle events.
- **FR-005**: The system must persist historical poker sessions in a paginated list sorted by newest session date first.
- **FR-006**: The system must display profit/loss, EV metrics, tags, and linked store/game/currency context for historical sessions when available.
- **FR-007**: The system must auto-sync currency transactions for currency-linked sessions using the session as the source of truth.
- **FR-008**: The system must allow session tags to be created inline and managed separately in settings.

### Key Entities

- **Poker Session**: Historical session record used by the `/sessions` page. Stores the session type, date, linked entities, tags, memo, time range, and cash game or tournament summary fields.
- **Live Cash Game Session**: In-progress cash game record used by `/active-session` and live cash game event timelines.
- **Live Tournament Session**: In-progress tournament record used by `/active-session` and live tournament event timelines.
- **Session Event**: Ordered event log for a live session. Stores event type, timestamp, sort order, and JSON payload.
- **Session Table Player**: Active-player and seat tracking for live sessions.
- **Session Tag**: User-scoped label that can be attached to poker sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can start a live session and reach the active-session screen without leaving the sessions area.
- **SC-002**: Event changes appear on the active-session timeline immediately after save.
- **SC-003**: Session history loads with the newest records first and preserves tag and entity context.
- **SC-004**: Currency-linked sessions keep the corresponding currency transaction in sync after create, update, and delete.
- **SC-005**: Session tags remain available across the create, edit, and history flows.

## Assumptions

- The current implementation is split between live session state and historical session records.
- `pokerSession` is the authoritative history table for the sessions page.
- `sessionTag` management lives in Settings and inline session forms.
- Currency-linked history records are synchronized through `currencyTransaction.sessionId`.
