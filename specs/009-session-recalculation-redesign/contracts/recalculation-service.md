# Contract: Recalculation Service

**Branch**: `009-session-recalculation-redesign` | **Date**: 2026-04-11

## Service: `live-session-pl.ts`

### Existing Pure Functions (unchanged signatures)

These functions remain as-is. They are already correctly implemented.

```typescript
function computeCashGamePLFromEvents(
  events: { eventType: string; payload: string }[]
): CashGamePLResult;

function computeTournamentPLFromEvents(
  events: { eventType: string; payload: string }[],
  tournamentBuyIn?: number,
  tournamentEntryFee?: number
): TournamentPLResult;

function computeBreakMinutesFromEvents(
  events: { eventType: string; occurredAt: Date }[]
): number;
```

### New Pure Function: `computeTimestampsFromEvents`

```typescript
interface SessionTimestamps {
  startedAt: Date | null;  // first session_start occurredAt
  endedAt: Date | null;    // last session_end occurredAt
}

function computeTimestampsFromEvents(
  events: { eventType: string; occurredAt: Date }[]
): SessionTimestamps;
```

**Rules**:
- `startedAt` = `occurredAt` of the first event with `eventType === "session_start"` (ordered by sortOrder)
- `endedAt` = `occurredAt` of the last event with `eventType === "session_end"` (ordered by sortOrder)
- If no `session_start` found → `startedAt` is `null`
- If no `session_end` found → `endedAt` is `null`

### Refactored: `recalculateCashGameSession`

Replaces `recalculateCashGamePL`. Handles ALL derived fields.

```typescript
async function recalculateCashGameSession(
  db: DbInstance,
  liveCashGameSessionId: string,
  userId: string
): Promise<void>;
```

**Behavior**:
1. Fetch all events for the live session (ordered by sortOrder)
2. Compute timestamps via `computeTimestampsFromEvents`
3. Update `liveCashGameSession.startedAt` from computed `startedAt` (if non-null)
4. Fetch the live session record (for status, currencyId, storeId, etc.)
5. If session status is `"active"` → return (no pokerSession updates)
6. Update `liveCashGameSession.endedAt` from computed `endedAt`
7. Compute P&L via `computeCashGamePLFromEvents`
8. Compute break minutes via `computeBreakMinutesFromEvents`
9. Upsert `pokerSession`:
   - If exists: update `buyIn`, `cashOut`, `evCashOut`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`, `updatedAt`
   - If not exists: create with all fields including `userId`, `type`, `storeId`, `ringGameId`, `currencyId`, `liveCashGameSessionId`, `memo`
10. Sync `currencyTransaction`:
    - If `currencyId` is set and `profitLoss` is not null: upsert transaction
    - If `profitLoss` is null: skip (preserve existing transaction if any)

### Refactored: `recalculateTournamentSession`

Replaces `recalculateTournamentPL`. Handles ALL derived fields.

```typescript
async function recalculateTournamentSession(
  db: DbInstance,
  liveTournamentSessionId: string,
  userId: string
): Promise<void>;
```

**Behavior**:
1. Fetch all events for the live session (ordered by sortOrder)
2. Compute timestamps via `computeTimestampsFromEvents`
3. Update `liveTournamentSession.startedAt` from computed `startedAt` (if non-null)
4. Fetch the live session record (for status, currencyId, tournamentId, buyIn, entryFee, etc.)
5. If session status is `"active"` → return (no pokerSession updates)
6. Update `liveTournamentSession.endedAt` from computed `endedAt`
7. Fetch tournament master data (buyIn, entryFee) if tournamentId is set
8. Compute P&L via `computeTournamentPLFromEvents` (session-level buyIn/entryFee take precedence)
9. Compute break minutes via `computeBreakMinutesFromEvents`
10. Upsert `pokerSession`:
    - If exists: update `placement`, `totalEntries`, `prizeMoney`, `bountyPrizes`, `rebuyCount`, `rebuyCost`, `addonCost`, `startedAt`, `endedAt`, `breakMinutes`, `sessionDate`, `updatedAt`
    - If not exists: create with all fields including `userId`, `type`, `storeId`, `tournamentId`, `currencyId`, `liveTournamentSessionId`, `tournamentBuyIn`, `entryFee`, `memo`
11. Sync `currencyTransaction` (same logic as cash game)

## Router Changes

### `sessionEvent` Router

**`create`/`update`/`delete`**: Replace `recalculateIfCompleted()` with unconditional call to the appropriate recalculation function.

```typescript
// Before (current):
await recalculateIfCompleted(db, status, cashId, tournamentId, userId);

// After:
if (liveCashGameSessionId) {
  await recalculateCashGameSession(db, liveCashGameSessionId, userId);
} else if (liveTournamentSessionId) {
  await recalculateTournamentSession(db, liveTournamentSessionId, userId);
}
```

The `recalculateIfCompleted` wrapper function is removed.

### `liveCashGameSession` Router

**`complete`**: Simplified to:
1. Insert `stack_record` event (finalStack)
2. Insert `session_end` event
3. Update status to `"completed"`
4. Call `recalculateCashGameSession(db, id, userId)`

All inline P&L computation (~40 lines), pokerSession creation, and currencyTransaction creation are removed from the `complete` procedure.

### `liveTournamentSession` Router

**`complete`**: Simplified to:
1. Insert `tournament_result` event
2. Insert `session_end` event
3. Update status to `"completed"`
4. Call `recalculateTournamentSession(db, id, userId)`

All inline P&L computation, `upsertPokerSession`, and `upsertCurrencyTransaction` are removed from the `complete` procedure.

### `liveCashGameSession` / `liveTournamentSession` Routers

**`reopen`**: No behavioral change. Continues to delete pokerSession + currencyTransaction and add session_start event. The recalculation triggered by the event insertion will handle live session metadata.

## Lifecycle Event Protection

### `sessionEvent.delete`

Add guard to prevent deletion of lifecycle events:

```typescript
if (event.eventType === "session_start" || event.eventType === "session_end") {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Lifecycle events cannot be deleted",
  });
}
```
