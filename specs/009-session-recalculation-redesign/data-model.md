# Data Model: Live Session Recalculation Redesign

**Branch**: `009-session-recalculation-redesign` | **Date**: 2026-04-11

## Design Decision

No schema changes are required. This feature is a pure refactoring of the service/business logic layer. All existing tables and columns remain unchanged. The change is in HOW fields are computed (from events) and WHEN recalculation is triggered (on every event mutation, not just for completed sessions).

## Unchanged Tables

### liveCashGameSession

No column changes. The `startedAt` and `endedAt` fields will now be updated by the recalculation service to match event timestamps, but the column definitions remain the same.

| Column | Type | Change |
|--------|------|--------|
| startedAt | integer (timestamp) | **Behavior change**: Updated on recalculation from first `session_start` event |
| endedAt | integer (timestamp) | **Behavior change**: Updated on recalculation from last `session_end` event |

### liveTournamentSession

Same as liveCashGameSession above.

| Column | Type | Change |
|--------|------|--------|
| startedAt | integer (timestamp) | **Behavior change**: Updated on recalculation from first `session_start` event |
| endedAt | integer (timestamp) | **Behavior change**: Updated on recalculation from last `session_end` event |

### sessionEvent

No changes. Continues to serve as the single source of truth.

### pokerSession

No column changes. All existing fields continue to be populated, but now ALL fields for live-session-derived records are computed from events via the unified recalculation service.

| Column | Derivation Source |
|--------|-------------------|
| sessionDate | First `session_start` event's `occurredAt` |
| buyIn | Sum of all `chip_add` amounts (cash game) |
| cashOut | Last `stack_record.stackAmount` (cash game) |
| evCashOut | `cashOut` + EV diff from `stack_record.allIns` (cash game) |
| tournamentBuyIn | From liveTournamentSession.buyIn or tournament master data |
| entryFee | From liveTournamentSession.entryFee or tournament master data |
| placement | From latest `tournament_result.placement` |
| totalEntries | From latest `tournament_result.totalEntries` |
| prizeMoney | From latest `tournament_result.prizeMoney` |
| bountyPrizes | From latest `tournament_result.bountyPrizes` |
| rebuyCount | Count of rebuy chip purchases across all `tournament_stack_record` events |
| rebuyCost | Sum of rebuy costs across all `tournament_stack_record` events |
| addonCost | Sum of addon costs across all `tournament_stack_record` events |
| startedAt | First `session_start` event's `occurredAt` |
| endedAt | Last `session_end` event's `occurredAt` |
| breakMinutes | Sum of gaps between `session_end`/`session_start` pairs |

### currencyTransaction

No changes. Created/updated as part of the unified recalculation.

## Event-to-Field Derivation Rules

### Cash Game

```
Events → pokerSession fields:

session_start (first)     → startedAt, sessionDate
session_start/end (pairs) → breakMinutes
session_end (last)        → endedAt
chip_add (all)            → buyIn (sum of amounts)
stack_record (last)       → cashOut (stackAmount)
stack_record (all allIns) → evCashOut (cashOut + EV diff)
```

### Tournament

```
Events → pokerSession fields:

session_start (first)           → startedAt, sessionDate
session_start/end (pairs)       → breakMinutes
session_end (last)              → endedAt
tournament_stack_record (all)   → rebuyCount, rebuyCost, addonCost
tournament_result (latest)      → placement, totalEntries, prizeMoney, bountyPrizes
```

## Recalculation Trigger Points

| Trigger | Scope |
|---------|-------|
| `sessionEvent.create` | Live session metadata + (if completed) pokerSession + currencyTransaction |
| `sessionEvent.update` | Same as create |
| `sessionEvent.delete` | Same as create |
| `liveCashGameSession.complete` | Adds events, then delegates to same recalculation |
| `liveTournamentSession.complete` | Adds events, then delegates to same recalculation |

## State Transitions (unchanged)

```
[新規作成] → active
active → completed (complete procedure adds events + recalculates)
completed → active (reopen: deletes pokerSession, adds session_start)
active → [破棄] (discard: deletes everything)
```

## Migration

No database migration required. This is a code-only refactoring.
