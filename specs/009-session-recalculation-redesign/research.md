# Research: Live Session Recalculation Redesign

**Branch**: `009-session-recalculation-redesign` | **Date**: 2026-04-11

## R-001: Unified Recalculation vs. Separate Paths

**Decision**: Single unified `recalculateSession` function per session type that handles ALL derived fields (P&L, timestamps, break minutes, currency transaction, live session metadata).

**Rationale**: The current implementation has two separate computation paths:
1. Inline P&L in `complete` procedures (live-cash-game-session.ts:508-511, live-tournament-session.ts:666-670)
2. `recalculateCashGamePL`/`recalculateTournamentPL` in live-session-pl.ts (called on event mutations)

These paths compute overlapping but different subsets of fields. The `complete` path handles `breakMinutes`, `startedAt`, `endedAt`, `sessionDate` while the recalculate path only handles P&L fields and currency transactions. This duplication is the root cause of inconsistencies.

**Alternatives considered**:
- Keep separate paths but ensure field parity: Rejected because maintaining two paths that must stay in sync is error-prone.
- Event-sourcing with materialized views: Over-engineered for this use case; Cloudflare D1 (SQLite) doesn't support materialized views natively.

## R-002: When to Trigger Recalculation

**Decision**: Recalculate on EVERY event mutation (create, update, delete), regardless of session status. For active sessions, update live session metadata only. For completed sessions, also update pokerSession and currencyTransaction.

**Rationale**: The current `recalculateIfCompleted` guard (session-event.ts:185-200) skips recalculation for active sessions. This means editing events on an active session doesn't update the live session's `startedAt` if the first `session_start` event's timestamp is changed. Removing the guard ensures consistency at all times.

**Alternatives considered**:
- Recalculate only on completion + event edits of completed sessions (current approach): Leaves active sessions inconsistent.
- Recalculate only the changed fields based on event type: Too complex; different event types affect overlapping fields, and the full recomputation is cheap (just iterating events).

## R-003: Timestamp Derivation Strategy

**Decision**: Derive `startedAt` from the first `session_start` event's `occurredAt`, and `endedAt` from the last `session_end` event's `occurredAt`. Apply to both the live session record and the poker session record.

**Rationale**: Currently, `startedAt` is set once at creation time (liveCashGameSession create, line 371) and never updated. `endedAt` is set at completion time (line 495). If a user edits the `session_start` event's timestamp (e.g., to correct a mistake), the live session and poker session timestamps remain stale. Deriving from events ensures consistency.

**Alternatives considered**:
- Keep `startedAt` set at creation, only derive `endedAt`: Inconsistent; if one is derived, both should be.
- Add a separate "sync timestamps" function: Unnecessary complexity when it can be part of the unified recalculation.

## R-004: Completion Flow Refactoring Approach

**Decision**: The `complete` procedure will:
1. Insert completion events (`stack_record`/`tournament_result` + `session_end`)
2. Update session status to "completed"
3. Call the unified recalculation function (which creates/updates pokerSession, currencyTransaction, and syncs timestamps)

**Rationale**: This eliminates ~50 lines of inline P&L computation from each `complete` procedure. The recalculation function already needs to handle all these fields for the event-edit case, so reusing it for completion is a natural fit.

**Alternatives considered**:
- Keep completion flow separate but call recalculate at the end as validation: Still duplicates logic and risks divergence.
- Make completion a thin wrapper that only adds events and delegates everything: This is effectively the chosen approach.

## R-005: Handling Active vs. Completed Session Recalculation

**Decision**: The unified recalculation function accepts the session status as input. When status is "active", it only updates the live session's `startedAt`. When status is "completed", it additionally upserts the pokerSession with all derived fields and syncs the currencyTransaction.

**Rationale**: Active sessions should not have a pokerSession yet (it's created on completion). But the live session's own metadata should still stay consistent with events.

**Alternatives considered**:
- Create a "draft" pokerSession for active sessions: Over-engineered; the pokerSession is only meaningful when the session is complete.
- Skip recalculation entirely for active sessions: Misses the opportunity to keep live session metadata accurate.

## R-006: Testing Strategy for Recalculation

**Decision**: Add unit tests for the pure computation functions (`computeCashGamePLFromEvents`, `computeTournamentPLFromEvents`, `computeBreakMinutesFromEvents`, and the new timestamp derivation function) in the `packages/api` test suite. These functions take event arrays and return computed values, making them trivially testable without DB mocking.

**Rationale**: Currently, these functions have NO tests (confirmed by codebase search). They are pure functions that take `{ eventType, payload }[]` arrays and return computed objects. This is the highest-value testing target for this feature.

**Alternatives considered**:
- Full integration tests with mocked DB for router procedures: High effort, low incremental value over unit testing the pure functions. The router logic is thin (fetch events → compute → write).
- Only test through component tests: Too indirect; computation bugs would be hard to diagnose.

## R-007: `sessionDate` Field Derivation

**Decision**: `pokerSession.sessionDate` will be derived from the first `session_start` event's `occurredAt`, matching the `startedAt` derivation.

**Rationale**: `sessionDate` is used for sorting/filtering sessions by date. Currently it's set to `session.startedAt` at creation time (live-cash-game-session.ts:569). If the user corrects the start timestamp by editing the event, `sessionDate` should follow.

**Alternatives considered**:
- Keep `sessionDate` static: Would cause date sorting to be incorrect after timestamp edits.
- Use a separate "session date" field on the live session: Unnecessary indirection.

## R-008: Lifecycle Event Deletion Protection

**Decision**: Preserve the existing constraint that `session_start` and `session_end` events cannot be manually created. Additionally, extend protection to prevent deletion of these events by users. Allow editing `occurredAt` only.

**Rationale**: Deleting a `session_start` or `session_end` event would break timestamp derivation and break-time calculation. These events are structural to the session lifecycle and should be immutable in terms of existence. However, allowing `occurredAt` edits enables correcting timestamps.

**Alternatives considered**:
- Allow deletion of lifecycle events and handle gracefully: Would require complex fallback logic (e.g., "if no session_start, use creation timestamp").
- Make lifecycle events completely immutable (no edits): Too restrictive; users may need to correct timestamps.

## R-009: Impact on `reopen` Flow

**Decision**: The `reopen` procedure will continue to:
1. Delete the linked pokerSession and currencyTransaction
2. Add a new `session_start` event
3. Set status to "active"

No change needed. The recalculation triggered by the new `session_start` event insertion will handle live session metadata updates (startedAt stays unchanged as it uses the FIRST session_start).

**Rationale**: The reopen flow already correctly handles the event history (appends new session_start, preserves all previous events). The recalculation will naturally maintain consistency when the session is re-completed.

**Alternatives considered**:
- Keep the pokerSession on reopen and just mark it as "draft": Conflicts with the principle that active sessions don't have pokerSessions.
