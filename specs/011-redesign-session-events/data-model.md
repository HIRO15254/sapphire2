# Data Model: Session Event Redesign

**Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)

## Schema Changes

The `session_event` table structure remains **unchanged**. The `event_type` column (text) and `payload` column (JSON text) accommodate the new event types and payloads without schema migration.

### Table: `session_event` (unchanged)

| Column | Type | Constraint |
|--------|------|-----------|
| id | TEXT | PRIMARY KEY |
| live_cash_game_session_id | TEXT | FK → live_cash_game_session.id (CASCADE) |
| live_tournament_session_id | TEXT | FK → live_tournament_session.id (CASCADE) |
| event_type | TEXT | NOT NULL |
| occurred_at | INTEGER (timestamp) | NOT NULL |
| sort_order | INTEGER | NOT NULL |
| payload | TEXT (JSON) | NOT NULL |
| created_at | INTEGER (timestamp) | NOT NULL, DEFAULT unixepoch() |
| updated_at | INTEGER (timestamp) | NOT NULL |

## Event Types

### Lifecycle Events (auto-generated, 1 per session max)

#### `session_start`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| buyInAmount | integer (min 0) | Cash only | Initial buy-in for cash games |

- Cash game: `{ buyInAmount: number }`
- Tournament: `{}`

#### `session_end`

**Cash game**: `{ cashOutAmount: number }`

| Field | Type | Required |
|-------|------|----------|
| cashOutAmount | integer (min 0) | Yes |

**Tournament**: `{ beforeDeadline: boolean, placement?: number, totalEntries?: number, prizeMoney: number, bountyPrizes: number }`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| beforeDeadline | boolean | Yes | true = busted before late reg deadline |
| placement | integer (min 1) | If !beforeDeadline | Final placement |
| totalEntries | integer (min 1) | If !beforeDeadline | Total entries |
| prizeMoney | integer (min 0) | Yes | Prize money won |
| bountyPrizes | integer (min 0) | Yes | Bounty prizes won |

### Pause/Resume Events

#### `session_pause`
Payload: `{}`

#### `session_resume`
Payload: `{}`

### Cash Game Events

#### `chips_add_remove`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| amount | integer (min 0) | Yes | Chip amount |
| type | "add" \| "remove" | Yes | Add = buy more chips, Remove = partial cash-out |

#### `all_in`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| potSize | number (min 0) | Yes | Total pot size |
| trials | integer (min 1) | Yes | Number of trials (run it twice etc.) |
| equity | number (0-100) | Yes | Equity percentage |
| wins | number (min 0) | Yes | Actual wins (can be fractional for splits) |

### Tournament Events

#### `purchase_chips`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string (min 1) | Yes | Purchase type name (e.g. "Rebuy", "Addon") |
| cost | integer (min 0) | Yes | Real money cost |
| chips | integer (min 0) | Yes | Chips received |

#### `update_tournament_info`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| remainingPlayers | integer (min 1) \| null | No | Remaining player count |
| totalEntries | integer (min 1) \| null | No | Total entries |
| averageStack | integer (min 0) \| null | No | Average stack |

### Common Events (both session types)

#### `update_stack`

| Field | Type | Required |
|-------|------|----------|
| stackAmount | integer (min 0) | Yes |

#### `player_join`

| Field | Type | Required |
|-------|------|----------|
| playerId | string (min 1) | Yes |

#### `player_leave`

| Field | Type | Required |
|-------|------|----------|
| playerId | string (min 1) | Yes |

#### `memo`

| Field | Type | Required |
|-------|------|----------|
| text | string (min 1) | Yes |

## Event Type Routing

### By Session Type

| Event Type | Cash Game | Tournament |
|-----------|-----------|-----------|
| session_start | Yes (buyInAmount) | Yes (empty) |
| session_end | Yes (cashOutAmount) | Yes (placement/prizes) |
| session_pause | Yes | Yes |
| session_resume | Yes | Yes |
| chips_add_remove | Yes | No |
| all_in | Yes | No |
| purchase_chips | No | Yes |
| update_tournament_info | No | Yes |
| update_stack | Yes | Yes |
| player_join | Yes | Yes |
| player_leave | Yes | Yes |
| memo | Yes | Yes |

### By Session State

| Event Type | Active | Paused | Completed |
|-----------|--------|--------|-----------|
| session_pause | Yes | No | No |
| session_resume | No | Yes | No |
| session_end | Yes | Yes | No |
| chips_add_remove | Yes | No | No |
| all_in | Yes | No | No |
| purchase_chips | Yes | No | No |
| update_tournament_info | Yes | No | No |
| update_stack | Yes | No | No |
| player_join | Yes | No | No |
| player_leave | Yes | No | No |
| memo | Yes | Yes | No |

## State Transitions

```
[Session Created] → session_start → ACTIVE
                                       ↓
ACTIVE → session_pause → PAUSED
PAUSED → session_resume → ACTIVE
ACTIVE → session_end → COMPLETED
PAUSED → session_end → COMPLETED
COMPLETED (cash only) → reopen procedure → ACTIVE
```

## Data Migration Mapping

### Cash Game Events

| Old Event | New Event(s) | Payload Mapping |
|-----------|-------------|-----------------|
| 1st `chip_add` | Merge into `session_start` | `{buyInAmount: old.amount}` |
| Other `chip_add` | `chips_add_remove` | `{amount: old.amount, type: "add"}` |
| `stack_record` | `update_stack` + N × `all_in` | Stack: `{stackAmount: old.stackAmount}`, AllIn: individual entries from `old.allIns` |
| Last `stack_record` before `session_end` | Additionally merge into `session_end` | `{cashOutAmount: old.stackAmount}` |

### Tournament Events

| Old Event | New Event(s) | Payload Mapping |
|-----------|-------------|-----------------|
| `tournament_stack_record` | `update_stack` + N × `purchase_chips` + `update_tournament_info` | Stack: `{stackAmount}`, Purchases: from `chipPurchases`/`chipPurchaseCounts`, Info: `{remainingPlayers, totalEntries, averageStack}` |
| `tournament_result` | Merge into `session_end` | `{beforeDeadline: false, placement, totalEntries, prizeMoney, bountyPrizes: old.bountyPrizes ?? 0}` |

### Lifecycle Events (Reopen Migration)

| Old Pattern | New Pattern |
|-------------|------------|
| 1st `session_start` | `session_start` (unchanged) |
| 2nd+ `session_start` | `session_pause` (inserted before) + `session_resume` (replaces) |
| Non-final `session_end` | `session_pause` (replaced) |
