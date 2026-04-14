# API Contracts: Session Event

**Date**: 2026-04-12

## tRPC Router: `sessionEvent`

### `sessionEvent.list`

**Input**:
```
{ liveCashGameSessionId?: string } | { liveTournamentSessionId?: string }
```

**Output**: `SessionEvent[]` (unchanged structure, new event types/payloads)

### `sessionEvent.create`

**Input**:
```
{
  liveCashGameSessionId?: string
  liveTournamentSessionId?: string
  eventType: SessionEventType  // new type union
  occurredAt?: number          // unix timestamp
  payload: unknown             // validated per eventType
}
```

**Validation Rules** (changes from current):
- Block manual creation of `session_start`, `session_end` (unchanged)
- Block manual creation of `session_pause`, `session_resume` (new — these are lifecycle-managed, OR allow manual? See note below)
- Validate event type is valid for session type (updated routing table)
- **New**: Validate session state allows this event type (active/paused check)
- Validate payload against event type schema

**Note on Pause/Resume**: `session_pause` and `session_resume` should be manually creatable by the user (unlike session_start/session_end which are auto-generated). They are NOT lifecycle events in the same sense. Update `MANUAL_CREATE_BLOCKED_EVENT_TYPES` to only block `session_start` and `session_end`.

**Side Effects** (changes):
- `player_join` / `player_leave`: unchanged
- All mutations: trigger `recalculateCashGameSession` or `recalculateTournamentSession`

### `sessionEvent.update`

**Input** (unchanged):
```
{
  id: string
  occurredAt?: number
  payload?: unknown
}
```

**Changes**: Validate payload against new event type schemas.

### `sessionEvent.delete`

**Input** (unchanged): `{ id: string }`

**Changes**:
- Block deletion of `session_start`, `session_end` (unchanged)
- Allow deletion of `session_pause`, `session_resume` (they are user-creatable)

## tRPC Router: `liveCashGameSession`

### `liveCashGameSession.create`

**Changes**:
- `session_start` event now includes `{ buyInAmount: initialBuyIn }` payload
- Remove auto-creation of initial `chip_add` event (buy-in is now in session_start)

### `liveCashGameSession.complete`

**Changes**:
- `session_end` event now includes `{ cashOutAmount: finalStack }` payload
- Remove auto-creation of final `stack_record` event (cash-out is now in session_end)

### `liveCashGameSession.reopen`

**Changes**:
- Instead of creating new `session_start`, perform the decomposition:
  1. Find `session_end` event, extract `cashOutAmount`
  2. Delete `session_end` event
  3. Create `update_stack` at same time with `{ stackAmount: cashOutAmount }`
  4. Create `session_pause` at same time (sortOrder after update_stack)
  5. Create `session_resume` at current time

## tRPC Router: `liveTournamentSession`

### `liveTournamentSession.create`

**Changes**: None (session_start payload remains empty for tournaments)

### `liveTournamentSession.complete`

**Changes**:
- `session_end` event now includes tournament result payload:
  - If `beforeDeadline`: `{ beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 }`
  - Otherwise: `{ beforeDeadline: false, placement, totalEntries, prizeMoney, bountyPrizes }`
- Remove auto-creation of `tournament_result` event (merged into session_end)

### `liveTournamentSession.reopen`

**Changes**: Procedure is **removed** (returns error). Tournament sessions cannot be reopened after completion.

## Zod Schemas (new/changed)

```typescript
// New event types
const SESSION_EVENT_TYPES = [
  "session_start", "session_end",
  "session_pause", "session_resume",
  "chips_add_remove", "update_stack", "all_in",
  "purchase_chips", "update_tournament_info",
  "player_join", "player_leave",
  "memo"
] as const

// New payload schemas
cashSessionStartPayload = z.object({ buyInAmount: z.number().int().min(0) })
cashSessionEndPayload = z.object({ cashOutAmount: z.number().int().min(0) })
tournamentSessionEndPayload = z.discriminatedUnion("beforeDeadline", [
  z.object({
    beforeDeadline: z.literal(false),
    placement: z.number().int().min(1),
    totalEntries: z.number().int().min(1),
    prizeMoney: z.number().int().min(0),
    bountyPrizes: z.number().int().min(0),
  }),
  z.object({
    beforeDeadline: z.literal(true),
    prizeMoney: z.number().int().min(0),
    bountyPrizes: z.number().int().min(0),
  }),
])
chipsAddRemovePayload = z.object({
  amount: z.number().int().min(0),
  type: z.enum(["add", "remove"]),
})
allInPayload = z.object({
  potSize: z.number().min(0),
  trials: z.number().int().min(1),
  equity: z.number().min(0).max(100),
  wins: z.number().min(0),
})
purchaseChipsPayload = z.object({
  name: z.string().min(1),
  cost: z.number().int().min(0),
  chips: z.number().int().min(0),
})
updateTournamentInfoPayload = z.object({
  remainingPlayers: z.number().int().min(1).nullable().default(null),
  totalEntries: z.number().int().min(1).nullable().default(null),
  averageStack: z.number().int().min(0).nullable().default(null),
})
updateStackPayload = z.object({ stackAmount: z.number().int().min(0) })
memoPayload = z.object({ text: z.string().min(1) })
sessionPausePayload = z.object({})
sessionResumePayload = z.object({})
```
