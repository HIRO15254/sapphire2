# Quickstart: Live Session Recalculation Redesign

**Branch**: `009-session-recalculation-redesign` | **Date**: 2026-04-11

## Overview

This is a code-only refactoring with no database schema changes. The goal is to unify the P&L computation and session metadata derivation into a single recalculation service that is called on every event mutation and on session completion.

## Files to Modify

### Service Layer (core changes)

1. **`packages/api/src/services/live-session-pl.ts`** — Main refactoring target
   - Add `computeTimestampsFromEvents()` pure function
   - Refactor `recalculateCashGamePL()` → `recalculateCashGameSession()` (expand to handle all derived fields)
   - Refactor `recalculateTournamentPL()` → `recalculateTournamentSession()` (expand to handle all derived fields)
   - Remove `getSessionResultTypeId` duplication (already exists in this file; consolidate with router copies)
   - Update exports

### Router Layer (simplification)

2. **`packages/api/src/routers/session-event.ts`** — Trigger changes
   - Remove `recalculateIfCompleted()` wrapper
   - In `create`, `update`, `delete`: call recalculation unconditionally
   - In `delete`: add lifecycle event deletion guard
   - Update imports

3. **`packages/api/src/routers/live-cash-game-session.ts`** — Completion simplification
   - Simplify `complete`: remove inline P&L computation (~40 lines), delegate to `recalculateCashGameSession()`
   - Remove local `getSessionResultTypeId()` and `createCurrencyTransactionForSession()` (moved to service)
   - Remove local `computeSummaryFromEvents()` (keep only for `getById` summary, or import from service)
   - Update imports

4. **`packages/api/src/routers/live-tournament-session.ts`** — Completion simplification
   - Simplify `complete`: remove inline P&L computation, delegate to `recalculateTournamentSession()`
   - Remove local `getSessionResultTypeId()` and `upsertCurrencyTransaction()` (moved to service)
   - Remove local `upsertPokerSession()` (logic moved to service)
   - Update imports

### Test Layer (new tests)

5. **`packages/api/src/__tests__/live-session-pl.test.ts`** — New test file
   - Unit tests for `computeCashGamePLFromEvents()`
   - Unit tests for `computeTournamentPLFromEvents()`
   - Unit tests for `computeBreakMinutesFromEvents()`
   - Unit tests for `computeTimestampsFromEvents()`
   - Edge case tests (empty events, missing stack_record, missing tournament_result, etc.)

## File Modification Order

```
Phase 1: Service Layer
  1. packages/api/src/services/live-session-pl.ts  (add + refactor)

Phase 2: Router Layer
  2. packages/api/src/routers/session-event.ts     (simplify triggers)
  3. packages/api/src/routers/live-cash-game-session.ts (simplify complete)
  4. packages/api/src/routers/live-tournament-session.ts (simplify complete)

Phase 3: Tests
  5. packages/api/src/__tests__/live-session-pl.test.ts (new)
```

## Key Patterns

### Unified Recalculation Function Pattern

```typescript
// packages/api/src/services/live-session-pl.ts

export async function recalculateCashGameSession(
  db: DbInstance,
  liveCashGameSessionId: string,
  userId: string
): Promise<void> {
  // 1. Fetch all events ordered by sortOrder
  const events = await db
    .select()
    .from(sessionEvent)
    .where(eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId))
    .orderBy(asc(sessionEvent.sortOrder));

  // 2. Derive timestamps
  const timestamps = computeTimestampsFromEvents(events);

  // 3. Update live session startedAt
  if (timestamps.startedAt) {
    await db
      .update(liveCashGameSession)
      .set({ startedAt: timestamps.startedAt, updatedAt: new Date() })
      .where(eq(liveCashGameSession.id, liveCashGameSessionId));
  }

  // 4. Fetch session to check status
  const [session] = await db
    .select()
    .from(liveCashGameSession)
    .where(eq(liveCashGameSession.id, liveCashGameSessionId));
  if (!session || session.status !== "completed") return;

  // 5. Update endedAt for completed sessions
  if (timestamps.endedAt) {
    await db
      .update(liveCashGameSession)
      .set({ endedAt: timestamps.endedAt, updatedAt: new Date() })
      .where(eq(liveCashGameSession.id, liveCashGameSessionId));
  }

  // 6. Compute P&L and break minutes
  const pl = computeCashGamePLFromEvents(events);
  const breakMinutes = computeBreakMinutesFromEvents(events);
  const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;

  // 7. Upsert pokerSession with ALL derived fields
  // ... (see contracts/recalculation-service.md for full spec)

  // 8. Sync currencyTransaction
  // ...
}
```

### Simplified Complete Pattern

```typescript
// packages/api/src/routers/live-cash-game-session.ts (complete procedure)

// 1. Add completion events
await db.insert(sessionEvent).values({ /* stack_record */ });
await db.insert(sessionEvent).values({ /* session_end */ });

// 2. Update status
await db.update(liveCashGameSession)
  .set({ status: "completed", updatedAt: now })
  .where(eq(liveCashGameSession.id, input.id));

// 3. Delegate ALL computation to the service
await recalculateCashGameSession(db, input.id, userId);

// 4. Find the created pokerSession ID to return
const [ps] = await db.select({ id: pokerSession.id })
  .from(pokerSession)
  .where(eq(pokerSession.liveCashGameSessionId, input.id));

return { id: input.id, pokerSessionId: ps?.id };
```

### Lifecycle Event Deletion Guard

```typescript
// packages/api/src/routers/session-event.ts (delete procedure)

if (event.eventType === "session_start" || event.eventType === "session_end") {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Lifecycle events cannot be deleted",
  });
}
```

## Commands

```bash
# Run all tests
bun run test

# Run API tests only
bun run test --filter api

# Run specific test file
cd packages/api && bun test src/__tests__/live-session-pl.test.ts

# Type check
bun run check-types

# Lint
bun x ultracite check
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Regression in P&L computation | Unit tests for all pure functions with known input/output pairs |
| Missing field in recalculation | Compare recalculated pokerSession with current complete-flow output for same events |
| Performance of recalculating on every event | Event count per session is small (<100); full recomputation is O(n) with n events |
| `endedAt` being set to null for active sessions | Guard: only update `endedAt` when session status is `"completed"` |
