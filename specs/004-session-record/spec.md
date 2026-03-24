# Feature Specification: Session Post-Recording

**Feature Branch**: `004-session-record`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "Session post-recording with currency and game linking for poker P&L tracking"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Cash Game Session (Priority: P1)

A user finishes a cash game session and wants to log the result. Cash games are characterized by flexible buy-ins: the user may buy in multiple times during a single session. The key data points are total buy-in amount (sum of all buy-ins during the session), cash-out amount (chips taken off the table), and session date. The user can also record game configuration details (variant, SB/BB, table size, ante settings, buy-in limits), session start/end times, and a free-text memo. If no existing ring game configuration is selected, a standalone ring game is auto-created from the entered game config fields. Optionally, the user can link the session to a store, a specific cash game configuration, and a currency.

**Why this priority**: Cash games are the most common format in amusement poker venues. Recording buy-in/cash-out is the simplest and most frequent use case.

**Independent Test**: Can be fully tested by creating a cash game session with total buy-in, cash-out, date, game config (SB/BB, table size), start/end time, and memo. Delivers full P&L tracking with game context.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a new cash game session entering total buy-in amount, cash-out amount, and session date, **Then** the session is saved and profit/loss (cash-out minus total buy-in) is displayed correctly.
2. **Given** a logged-in user, **When** they view their session list, **Then** all sessions (cash game and tournament) are displayed in reverse chronological order with profit/loss for each entry, and the session type (cash game or tournament) is clearly indicated.
3. **Given** a logged-in user with existing sessions, **When** they edit a cash game session's buy-in or cash-out amount, **Then** the profit/loss recalculates and the updated values are displayed.
4. **Given** a logged-in user with existing sessions, **When** they delete a session, **Then** the session is removed and no longer appears in the list or affects summary calculations.

---

### User Story 2 - Record a Tournament Session (Priority: P1)

A user finishes a tournament and wants to log the result. Tournaments have a fixed cost structure: buy-in amount, entry fee, and optional rebuys and add-ons. The result is expressed as placement (finishing position), total entries in the tournament, and prize money won. Optionally, the user can also record bounty prizes earned (for bounty tournaments).

**Why this priority**: Tournaments are equally common as cash games in amusement poker. The cost/prize structure is fundamentally different from cash games and requires dedicated fields.

**Independent Test**: Can be fully tested by creating a tournament session with buy-in, entry fee, placement, entries, prize, and date. P&L is calculated as prize money minus total cost.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a new tournament session entering buy-in, entry fee, placement, total entries, prize money, and session date, **Then** the session is saved and profit/loss (prize minus total cost) is displayed correctly.
2. **Given** a user recording a tournament session, **When** they add rebuy count and rebuy cost, **Then** the total cost includes (buy-in + entry fee + rebuy count × rebuy cost) and profit/loss recalculates accordingly.
3. **Given** a user recording a tournament session, **When** they add addon cost, **Then** the total cost includes the addon and profit/loss recalculates accordingly.
4. **Given** a user recording a bounty tournament session, **When** they enter bounty prizes earned, **Then** the total prize includes bounty prizes and profit/loss reflects (prize + bounty prizes - total cost).
5. **Given** a user recording a tournament session, **When** they leave rebuys, addon, and bounty fields empty, **Then** the session saves successfully with total cost as just buy-in + entry fee.

---

### User Story 3 - Link Session to Store, Game, and Currency (Priority: P2)

A user wants to record a session with full context: which store they played at, which specific game configuration (cash game or tournament setting), and which currency denomination was used. This enables richer filtering and analysis. All links are optional — a session can be recorded without any of them.

**Why this priority**: Linking sessions to existing entities provides the organizational structure needed for meaningful analysis, but requires those entities to already exist.

**Independent Test**: Can be tested by creating a session and selecting an existing store, game, and currency from selectors. Verify the linked entities are displayed on the session detail.

**Acceptance Scenarios**:

1. **Given** a user with at least one store and one cash game configured, **When** they create a cash game session and select a store and game, **Then** the session is saved with those associations and displays them correctly.
2. **Given** a user with at least one store and one tournament configured, **When** they create a tournament session and select a store and tournament, **Then** the session is saved with those associations.
3. **Given** a user creating a session, **When** they select a store, **Then** only games of the matching type (cash games for cash game sessions, tournaments for tournament sessions) belonging to that store are available for selection.
4. **Given** a user creating a session, **When** they optionally leave store, game, or currency unselected, **Then** the session is still saved successfully with only the provided links.
5. **Given** a session linked to a store that is later deleted, **When** the user views that session, **Then** the session still exists with the store reference shown as removed.

---

### User Story 4 - View Session Summary and Profit/Loss Statistics (Priority: P2)

A user wants to see an overview of their poker performance: total sessions played, overall profit/loss, win rate, and average profit per session. They want to filter by store, game type (cash game / tournament), or time period. Cash game and tournament sessions contribute to the same overall P&L but can be viewed separately.

**Why this priority**: Summaries transform raw session data into actionable insights, which is the core value proposition beyond simple record-keeping.

**Independent Test**: Can be tested by creating multiple sessions of both types with varying results and verifying that the summary statistics are calculated correctly.

**Acceptance Scenarios**:

1. **Given** a user with multiple recorded sessions of both types, **When** they view the session summary, **Then** they see total sessions, total profit/loss, win rate (percentage of profitable sessions), and average profit/loss per session.
2. **Given** a user viewing the summary, **When** they filter by game type "Cash Game", **Then** the summary recalculates using only cash game sessions.
3. **Given** a user viewing the summary, **When** they filter by game type "Tournament", **Then** the summary recalculates using only tournament sessions and includes tournament-specific metrics (average placement, total prize money, ITM rate).
4. **Given** a user viewing the summary, **When** they filter by a specific store, **Then** the summary recalculates using only sessions linked to that store.
5. **Given** a user viewing the summary, **When** they filter by a date range, **Then** the summary reflects only sessions within that period.
6. **Given** a user with no sessions recorded, **When** they view the summary, **Then** an empty state is displayed with guidance to record their first session.

---

### User Story 5 - Record EV (Expected Value) Adjusted Result (Priority: P2)

A user who experienced all-in situations during a session wants to record the difference between their actual result and the expected value result. In poker, when chips go all-in, the actual outcome (win/lose the pot) may differ from the mathematically expected outcome based on equity at the time of the all-in. By recording the EV-adjusted result, users can separate skill-based performance from variance (luck).

For a cash game session, the user enters an EV-adjusted cash-out amount (what their cash-out would have been if all all-in situations resolved exactly according to equity). The system calculates EV profit/loss and displays it alongside actual profit/loss, as well as the difference (EV diff = EV P&L minus actual P&L). This feature applies to cash game sessions only; tournament results are not EV-adjusted because tournament prize distributions are determined by placement, not individual hand outcomes.

**Why this priority**: EV tracking is a key analytical tool for serious poker players to evaluate their true performance independent of short-term variance. It is a natural extension of P&L recording and provides high analytical value.

**Independent Test**: Can be tested by creating a session with both actual and EV-adjusted amounts, verifying that actual P&L, EV P&L, and EV diff are all calculated and displayed correctly.

**Acceptance Scenarios**:

1. **Given** a user recording a cash game session, **When** they optionally enter an EV-adjusted cash-out amount, **Then** the system calculates EV P&L (EV cash-out minus total buy-in) and displays it alongside the actual P&L.
2. **Given** a user recording a tournament session, **When** they view the session form, **Then** no EV-adjusted fields are available (EV tracking is cash game only).
3. **Given** a cash game session with EV data recorded, **When** the user views the session in the list, **Then** the EV diff (EV P&L minus actual P&L) is displayed as a secondary indicator alongside the actual P&L.
4. **Given** a session without EV data, **When** the user views the session, **Then** only the actual P&L is displayed and no EV-related fields are shown.
5. **Given** a user viewing the session summary, **When** EV data exists for some sessions, **Then** the summary includes total EV P&L and total EV diff aggregated from sessions that have EV data.

---

### User Story 6 - Record Session Duration and Memo (Priority: P3) — Merged into US1

**Note**: Duration (start/end time) and memo fields have been merged into US1 (Phase 3) as they are essential for practical session recording. This user story is retained for traceability but its implementation is handled in Phase 3.

A user wants to record how long a session lasted and add free-text notes about the session (table dynamics, mental state, notable events). This additional context enriches the session record for future review.

**Why this priority**: Duration and memos are supplementary data that enhance but are not essential to the core P&L tracking flow.

**Independent Test**: Can be tested by creating a session with start time, end time, and a memo field, then verifying all values persist and display correctly.

**Acceptance Scenarios**:

1. **Given** a user creating a session, **When** they enter a start time and end time, **Then** the session duration is calculated and displayed automatically.
2. **Given** a user creating a session, **When** they add a memo, **Then** the memo text is saved and displayed on the session detail.
3. **Given** a user with sessions that include duration, **When** they view the session list, **Then** the duration is shown alongside each session entry.

---

### Edge Cases

- What happens when a user enters a negative buy-in or cash-out for a cash game? The system rejects negative amounts.
- What happens when a user enters a tournament placement of 0 or a negative number? The system rejects it; placement must be a positive integer.
- What happens when a user enters a placement greater than total entries? The system rejects it; placement cannot exceed total entries.
- What happens when a user enters 0 rebuys but provides a rebuy cost? The system ignores the rebuy cost (0 rebuys means no rebuy expense).
- What happens when a linked game is archived after a session references it? The session retains the reference and displays the game as archived.
- What happens when a user enters the same date for start and end time? The system accepts it (zero-duration session is valid for tournaments that end immediately upon bust-out).
- What happens when a user has hundreds of sessions? The session list uses pagination to maintain performance.
- What happens when a session is created while offline? The session is saved locally and synced when connectivity is restored (offline-first pattern).
- What happens when a user wants to change a session's type (cash game to tournament or vice versa)? The user must delete the session and create a new one of the correct type. Type is immutable after creation.
- What happens when a user enters an EV cash-out less than the actual cash-out (i.e., they ran above EV)? The system accepts it; EV diff will be negative, indicating the user ran above expectation.
- What happens when a user enters EV data for some sessions but not others? Summary EV metrics are calculated only from sessions that have EV data. Sessions without EV data are excluded from EV aggregations but included in actual P&L aggregations.
- What happens when a session's linked currency is deleted? The currency reference becomes null, but the auto-generated currency transactions were already deleted by the currency cascade delete, so no orphaned transactions remain.
- What happens when a user changes the currency link on an existing session (e.g., from currency A to currency B)? The system deletes transactions under currency A and creates new transactions under currency B.

## Requirements *(mandatory)*

### Functional Requirements

#### Session Common

- **FR-001**: System MUST require users to select a session type (cash game or tournament) at creation time. The type is immutable after creation.
- **FR-002**: System MUST allow users to optionally link a session to an existing store, game configuration, and currency. When a store is selected, only games of the matching type belonging to that store are available for selection.
- **FR-002a**: When a session is linked to a currency, the system MUST automatically create a single currency transaction containing the session's net profit/loss amount. This transaction MUST be linked to the session so it can be identified as session-generated. Session-generated transactions MUST be displayed as read-only in the currency transaction list (not editable or deletable from the currency page).
- **FR-002b**: When a session linked to a currency is edited, the system MUST update the corresponding currency transactions to match the new amounts.
- **FR-002c**: When a session linked to a currency is deleted, the system MUST also delete the corresponding auto-generated currency transactions.
- **FR-002d**: When a currency link is added to or removed from an existing session, the system MUST create or delete the corresponding currency transactions accordingly.
- **FR-003**: System MUST allow users to view all their sessions in a paginated list, sorted by session date (newest first). Each session MUST display its type, profit/loss, and linked entities.
- **FR-004**: System MUST allow users to edit any field of an existing session (except session type).
- **FR-005**: System MUST allow users to delete a session.
- **FR-006**: System MUST allow users to optionally record start time, end time, and a free-text memo for each session.
- **FR-007**: System MUST automatically calculate session duration when both start and end times are provided.
- **FR-008**: System MUST ensure sessions remain accessible even when linked entities (store, game, currency) are deleted or archived.
- **FR-009**: System MUST scope all session data to the authenticated user (no cross-user data access).
- **FR-010**: System MUST support offline session creation and editing with synchronization upon connectivity restoration.

#### Cash Game Session

- **FR-011**: System MUST allow users to create a cash game session with at minimum a total buy-in amount, cash-out amount, and session date. The form MUST also accept game configuration fields (variant, SB/BB, straddle, ante type/amount, table size, min/max buy-in), start/end times, and a memo.
- **FR-011a**: When creating a cash game session without selecting an existing ring game configuration, the system MUST auto-create a standalone ring game (not linked to any store) using the game config fields entered in the session form, and link the session to it.
- **FR-012**: System MUST calculate and display cash game profit/loss as: cash-out minus total buy-in.
- **FR-013**: System MUST enforce that cash game buy-in and cash-out amounts are non-negative numbers.
- **FR-013a**: System MUST allow users to optionally record an EV-adjusted cash-out amount for a cash game session.
- **FR-013b**: System MUST calculate and display cash game EV P&L as: EV cash-out minus total buy-in (when EV cash-out is provided).

#### Tournament Session

- **FR-014**: System MUST allow users to create a tournament session with at minimum a buy-in amount, entry fee, and session date.
- **FR-015**: System MUST allow users to optionally record placement (finishing position) and total entries for a tournament session.
- **FR-016**: System MUST allow users to optionally record prize money won for a tournament session.
- **FR-017**: System MUST allow users to optionally record rebuy count and rebuy cost per rebuy for a tournament session.
- **FR-018**: System MUST allow users to optionally record addon cost for a tournament session.
- **FR-019**: System MUST allow users to optionally record bounty prizes earned for a tournament session.
- **FR-020**: System MUST calculate and display tournament total cost as: buy-in + entry fee + (rebuy count × rebuy cost) + addon cost.
- **FR-021**: System MUST calculate and display tournament profit/loss as: (prize money + bounty prizes) minus total cost.
- **FR-022**: System MUST enforce that placement is a positive integer not exceeding total entries (when both are provided).
- **FR-023**: System MUST enforce that all tournament monetary amounts (buy-in, entry fee, rebuy cost, addon cost, prize, bounty) are non-negative numbers.

#### Summary & Filtering

- **FR-024**: System MUST display overall summary statistics: total sessions, total profit/loss, win rate (percentage of profitable sessions), and average profit/loss per session.
- **FR-025**: System MUST display tournament-specific summary metrics when filtered to tournaments: average placement, total prize money, and ITM rate (percentage of sessions with prize money > 0).
- **FR-026**: System MUST allow filtering sessions and summaries by game type (cash game or tournament), store, and date range.
- **FR-027**: System MUST display EV-related summary metrics (total EV P&L, total EV diff) aggregated from cash game sessions that have EV data. Sessions without EV data and all tournament sessions MUST be excluded from EV aggregations.
- **FR-028**: System MUST display the EV diff (EV P&L minus actual P&L) for each session that has EV data, both in the session list and session detail.

### Key Entities

- **Session (common fields)**: A single poker playing occasion. Has a type (cash game or tournament, immutable). Contains session date and optionally links to a store, game configuration, and currency. May include start time, end time, and a free-text memo.
- **Cash Game Session (type-specific fields)**: Total buy-in amount, cash-out amount, EV-adjusted cash-out (optional). Profit/loss = cash-out minus total buy-in. EV P&L = EV cash-out minus total buy-in. EV diff = EV P&L minus actual P&L.
- **Tournament Session (type-specific fields)**: Buy-in amount, entry fee, placement, total entries, prize money, rebuy count, rebuy cost per rebuy, addon cost, bounty prizes. Total cost = buy-in + entry fee + (rebuy count × rebuy cost) + addon cost. Profit/loss = (prize + bounty prizes) minus total cost. EV tracking is not applicable to tournament sessions.
- **Session-Store relationship**: Optional many-to-one. A session may be associated with one store. Deletion of a store sets the reference to null (session preserved).
- **Session-Game relationship**: Optional many-to-one. A cash game session may link to one cash game configuration; a tournament session may link to one tournament configuration. Archiving or deletion of a game preserves the session.
- **Session-Currency relationship**: Optional many-to-one. A session may reference one currency. When linked, the system auto-generates currency transactions reflecting costs and winnings. These transactions are tagged as session-generated and are managed (created/updated/deleted) in sync with the session. Deletion of a currency cascades to its transactions and sets the session's currency reference to null.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can record a basic session (buy-in, cash-out, date) in under 30 seconds.
- **SC-002**: Users can record a fully linked session (with store, game, currency, duration, memo) in under 90 seconds.
- **SC-003**: Session list loads and displays the first page within 2 seconds, even with 500+ recorded sessions.
- **SC-004**: Summary statistics (total P&L, win rate, average) update correctly within 2 seconds after any session is created, edited, or deleted.
- **SC-005**: 100% of sessions created offline are successfully persisted and available after connectivity is restored.
- **SC-006**: All session operations (create, read, update, delete) function correctly on mobile viewports (360px width and above).

## Clarifications

### Session 2026-03-23

- Q: Cash game buy-in tracking granularity — single total field or individual buy-in entries? → A: Single total field. User enters aggregated buy-in amount. Individual buy-in tracking is deferred to real-time session recording (005 branch).
- Q: Currency link behavior — display-only reference or auto-generate currency transactions? → A: Auto-generate currency transactions. When a session is linked to a currency, the system creates a corresponding currency transaction to reflect the session's P&L in the currency balance.
- Q: Auto-generated transaction granularity — how many transactions per session? → A: One transaction per session containing the net P&L amount. Cost/revenue breakdown is viewable on the session detail, not split across multiple transactions.
- Q: Session list and summary layout — same page or separate pages? → A: Same page. Summary statistics at the top, filters below, paginated session list at the bottom. Consistent with existing currency page pattern.
- Q: Auto-generated currency transaction editability from currency page? → A: Read-only in currency transaction list. Visible with session link indicator, but editing and deletion only possible via the session. Ensures data integrity between session P&L and currency balance.

## Assumptions

- All monetary amounts are stored as integers (smallest currency unit, consistent with existing currency transaction patterns).
- Session date represents the calendar date of the session, not a precise timestamp. Start/end times are optional and provide more granular timing when desired.
- The session list uses cursor-based pagination consistent with the existing currency transaction list pattern.
- Summary statistics are calculated on-the-fly from session data (no separate aggregation table needed at this scale).
- Cash game sessions and tournament sessions are stored in a single entity with a type discriminator. Type-specific fields (e.g., placement, rebuys) are nullable and only relevant for their respective type.
- Game configuration linking uses two optional foreign key fields (one for cash game, one for tournament), with at most one populated per session, matching the session type.
- The session feature adds a new top-level navigation item ("Sessions") alongside existing "Stores" and "Currencies" entries.
- Tournament entry fee is separated from buy-in because in Japanese amusement poker, the entry fee (参加費) is paid to the venue while the buy-in (バイイン) contributes to the prize pool. Both are required for accurate cost tracking.
- When a tournament session is linked to an existing tournament configuration, the buy-in, entry fee, rebuy, and addon values from the configuration are used as defaults but can be overridden per session (actual costs may differ from the template).
- The `ringGame.storeId` column is made nullable to support standalone ring game configurations auto-created from session recording. Existing store-linked ring games are unaffected.
- Cash game session forms include all ring game configuration fields (variant, SB/BB, straddle, ante, table size, buy-in limits) inline. When no existing ring game is selected, a standalone ring game is auto-created and linked to the session.
