# Feature Specification: Live Session Recalculation Redesign

**Feature Branch**: `009-session-recalculation-redesign`
**Created**: 2026-04-11
**Status**: Draft
**Input**: GitHub Issue #104 - "Redesign recalculation of live session results. Event history is the single source of truth for all derived data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Event History as Single Source of Truth for Cash Game (Priority: P1)

When a cash game live session's events are modified (created, updated, or deleted), the system derives all session record fields from the event history. This includes start/end times, break minutes, total buy-in, cash-out, EV cash-out, and the corresponding poker session and currency transaction. The user does not need to manually trigger recalculation; it happens automatically on every event change, regardless of whether the session is active or completed.

**Why this priority**: Cash games are the most frequently played format. Ensuring event history is the authoritative source eliminates data inconsistencies between live session metadata and the derived poker session. This is the core of the redesign.

**Independent Test**: Create a cash game live session, add events, complete the session, then edit/delete events on the completed session. Verify that the poker session (buyIn, cashOut, evCashOut, startedAt, endedAt, breakMinutes) and currency transaction are correctly recalculated from events alone.

**Acceptance Scenarios**:

1. **Given** a completed cash game session with a linked poker session, **When** a `chip_add` event is updated (amount changed), **Then** the poker session's `buyIn` is recalculated as the sum of all `chip_add` event amounts
2. **Given** a completed cash game session, **When** a `stack_record` event is deleted, **Then** the poker session's `cashOut` is recalculated from the last remaining `stack_record` event's `stackAmount`
3. **Given** a completed cash game session with multiple session_start/session_end pairs (from a reopen), **When** an event's `occurredAt` is updated, **Then** the poker session's `startedAt` is derived from the first `session_start` event and `endedAt` from the last `session_end` event
4. **Given** a completed cash game session that was reopened (has multiple session_end/session_start pairs), **When** a `session_end` or `session_start` event's `occurredAt` is updated, **Then** `breakMinutes` is recalculated from the gaps between session_end and the subsequent session_start events
5. **Given** a completed cash game session with a currency set, **When** any event that affects P&L is modified, **Then** the linked currency transaction amount is updated to match the new P&L

---

### User Story 2 - Event History as Single Source of Truth for Tournament (Priority: P1)

When a tournament live session's events are modified, the system derives all tournament-specific session record fields from the event history. This includes placement, total entries, prize money, bounty prizes, rebuy count/cost, addon cost, start/end times, and break minutes. Recalculation happens automatically on every event change.

**Why this priority**: Tournaments are a primary game format alongside cash games. The same single-source-of-truth principle must apply consistently.

**Independent Test**: Create a tournament live session, record stack records with chip purchases, complete the session with a tournament result, then modify events. Verify that all derived fields (placement, rebuyCost, addonCost, prizeMoney, bountyPrizes, breakMinutes, startedAt, endedAt) are correctly recalculated.

**Acceptance Scenarios**:

1. **Given** a completed tournament session, **When** a `tournament_stack_record` event with chip purchases is updated, **Then** the poker session's `rebuyCount`, `rebuyCost`, `addonCount`, and `addonCost` are recalculated from all `tournament_stack_record` events
2. **Given** a completed tournament session, **When** the `tournament_result` event's payload is updated (e.g., placement changed), **Then** the poker session's `placement`, `totalEntries`, `prizeMoney`, and `bountyPrizes` are recalculated
3. **Given** a completed tournament session with a currency set, **When** any event affecting P&L is modified, **Then** the currency transaction is updated to reflect the recalculated P&L
4. **Given** a completed tournament session, **When** events' `occurredAt` timestamps are modified, **Then** the poker session's `startedAt`, `endedAt`, and `breakMinutes` are recalculated from events

---

### User Story 3 - Unified Recalculation on Session Completion (Priority: P1)

When a session is completed, the system adds the completion events (final `stack_record`/`tournament_result` + `session_end`) and then uses the same recalculation path that handles event modifications. This eliminates duplicated P&L computation logic between the completion flow and the event-edit recalculation flow.

**Why this priority**: The current implementation has separate P&L computation in the completion flow and in the recalculation service, leading to potential inconsistencies. Unifying them is essential for correctness and maintainability.

**Independent Test**: Complete a cash game and a tournament session. Verify that the resulting poker session matches what would be produced by manually calling the recalculation service on the same event set.

**Acceptance Scenarios**:

1. **Given** an active cash game session with recorded events, **When** the session is completed with a final stack amount, **Then** the completion procedure adds `stack_record` + `session_end` events and delegates all poker session field computation to the unified recalculation service
2. **Given** an active tournament session with recorded events, **When** the session is completed with placement data, **Then** the completion procedure adds `tournament_result` + `session_end` events and delegates all poker session field computation to the unified recalculation service
3. **Given** a completed session that is reopened and then completed again, **When** the second completion occurs, **Then** the existing poker session is updated (not duplicated) via the unified recalculation service, with all fields derived from the full event history

---

### User Story 4 - Recalculation of Live Session Metadata from Events (Priority: P2)

The live session records themselves (`liveCashGameSession`, `liveTournamentSession`) derive their `startedAt` and `endedAt` fields from the event history during recalculation. When events are modified, these fields on the live session are kept consistent with the events.

**Why this priority**: While the poker session is the primary consumer of derived data, the live session's own timestamps should also remain consistent with its event history to prevent confusion.

**Independent Test**: Modify the `occurredAt` of the first `session_start` event on a live session. Verify that the live session's `startedAt` is updated to match.

**Acceptance Scenarios**:

1. **Given** a live session (cash game or tournament), **When** the first `session_start` event's `occurredAt` is updated, **Then** the live session's `startedAt` is updated to match
2. **Given** a completed live session, **When** the last `session_end` event's `occurredAt` is updated, **Then** the live session's `endedAt` is updated to match

---

### Edge Cases

- What happens when all `stack_record` events are deleted from a completed cash game? The poker session's `cashOut` should be set to `null`, and `profitLoss` should be `null`.
- What happens when the `tournament_result` event is deleted from a completed tournament? The poker session's `placement`, `prizeMoney`, and related fields should be set to `null`, and `profitLoss` should be `null`.
- What happens when all `chip_add` events are deleted from a cash game? `buyIn` should be 0.
- What happens when events are modified on an active (non-completed) session? The recalculation should update the live session metadata (e.g., `startedAt`) but should NOT create or update a poker session (since the session is not completed yet).
- What happens when the first `session_start` event is deleted? This is an edge case that should be prevented (lifecycle events should remain non-deletable by users).
- How does recalculation behave when there are no events at all? This should not happen in practice (session creation always adds events), but if it did, all derived fields should be null/0.
- What if a currency is added to or removed from a live session after completion? Recalculation should handle creating/removing the currency transaction accordingly on next event change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST derive all poker session fields (`buyIn`, `cashOut`, `evCashOut`, `startedAt`, `endedAt`, `breakMinutes`, `placement`, `totalEntries`, `prizeMoney`, `bountyPrizes`, `rebuyCount`, `rebuyCost`, `addonCost`) from the live session's event history
- **FR-002**: The system MUST recalculate derived data whenever a session event is created, updated, or deleted
- **FR-003**: For completed sessions, recalculation MUST update the linked `pokerSession` record and its associated `currencyTransaction`
- **FR-004**: For active sessions, recalculation MUST update the live session metadata (`startedAt` from first `session_start`, `endedAt` remains null) but MUST NOT create or modify a `pokerSession`
- **FR-005**: The session completion flow (`complete` procedure) MUST use the same recalculation logic as event mutations, eliminating duplicated P&L computation code
- **FR-006**: The `pokerSession.startedAt` MUST be derived from the first `session_start` event's `occurredAt`
- **FR-007**: The `pokerSession.endedAt` MUST be derived from the last `session_end` event's `occurredAt`
- **FR-008**: The `pokerSession.breakMinutes` MUST be derived from the time gaps between `session_end` and subsequent `session_start` event pairs
- **FR-009**: Cash game P&L calculation: `totalBuyIn` = sum of all `chip_add` amounts, `cashOut` = last `stack_record.stackAmount`, `evCashOut` = `cashOut` + EV difference from all `stack_record.allIns`
- **FR-010**: Tournament P&L calculation: rebuy/addon counts and costs from all `tournament_stack_record` events, placement/totalEntries/prizeMoney/bountyPrizes from the latest `tournament_result` event
- **FR-011**: The `liveCashGameSession.startedAt` and `liveTournamentSession.startedAt` MUST be updated to match the first `session_start` event's `occurredAt` on recalculation
- **FR-012**: The `liveCashGameSession.endedAt` and `liveTournamentSession.endedAt` MUST be updated to match the last `session_end` event's `occurredAt` on recalculation (for completed sessions)
- **FR-013**: Recalculation MUST handle the case where a currency is set on the live session: if a `currencyTransaction` does not yet exist for the poker session, it MUST be created; if it exists, it MUST be updated
- **FR-014**: Recalculation MUST handle the case where `profitLoss` is `null` (e.g., no `stack_record` for cash game, no `tournament_result` for tournament): no `currencyTransaction` should be created, and any existing one should be preserved with its current amount
- **FR-015**: The `pokerSession.sessionDate` MUST be derived from the first `session_start` event's `occurredAt`
- **FR-016**: Lifecycle events (`session_start`, `session_end`) MUST remain non-deletable and non-manually-creatable by users (existing constraint preserved)

### Key Entities

- **Live Session (liveCashGameSession / liveTournamentSession)**: Session management entity. `startedAt` and `endedAt` are now derived from the event history during recalculation, not only set at creation/completion time.
- **SessionEvent**: Immutable-in-principle event records that serve as the single source of truth. All session metadata and poker session fields are computed by aggregating these events.
- **PokerSession**: Derived record that is fully computed from the live session's event history. Created on first completion, updated on subsequent recalculations.
- **CurrencyTransaction**: Derived from the P&L of the poker session. Created/updated as part of recalculation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All poker session fields for live-session-derived records are computed from events with zero inline P&L computation in the completion flow (unified recalculation path)
- **SC-002**: Modifying any event on a completed session produces a poker session record identical to what would be produced by completing the session fresh with the same event set
- **SC-003**: The `recalculateCashGamePL` and `recalculateTournamentPL` service functions handle all derived fields (P&L, timestamps, break minutes, currency transaction) in a single call
- **SC-004**: No regression in existing session creation, completion, reopen, or event editing flows
- **SC-005**: All existing tests continue to pass, and new tests cover the unified recalculation path including edge cases (event deletion, timestamp modification, reopen scenarios)
