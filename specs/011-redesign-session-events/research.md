# Research: Session Event Redesign

**Date**: 2026-04-12 | **Spec**: [spec.md](./spec.md)

## R1: Event Type Naming Convention

**Decision**: Use snake_case for all event type identifiers, consistent with existing codebase convention.

**New Event Types**:

| Old Type | New Type(s) | Session Type |
|----------|-------------|-------------|
| `chip_add` | `chips_add_remove` | Cash only |
| `stack_record` | `update_stack` + `all_in` (split) | `update_stack`: Both, `all_in`: Cash only |
| `tournament_stack_record` | `update_stack` + `purchase_chips` + `update_tournament_info` (split) | Tournament only (except `update_stack`) |
| `tournament_result` | Merged into `session_end` payload | Tournament only |
| `player_join` | `player_join` (unchanged) | Both |
| `player_leave` | `player_leave` (unchanged) | Both |
| `session_start` | `session_start` (payload added for cash) | Both |
| `session_end` | `session_end` (payload added for cash+tournament) | Both |
| *(new)* | `session_pause` | Both |
| *(new)* | `session_resume` | Both |
| *(new)* | `memo` | Both |
| *(new)* | `all_in` | Cash only |

**Rationale**: snake_case matches existing event type identifiers throughout the codebase. New names are descriptive and avoid ambiguity.

**Alternatives considered**: camelCase (rejected - inconsistent with DB column naming), kebab-case (rejected - not used in codebase).

## R2: Event Type Categorization

**Decision**: Restructure event type arrays to reflect new categories:

```
LIFECYCLE_EVENT_TYPES = ["session_start", "session_end"]  // auto-generated, 1 per session
PAUSE_RESUME_EVENT_TYPES = ["session_pause", "session_resume"]  // auto or manual
CASH_EVENT_TYPES = ["chips_add_remove", "all_in"]  // cash game only
TOURNAMENT_EVENT_TYPES = ["purchase_chips", "update_tournament_info"]  // tournament only
COMMON_EVENT_TYPES = ["update_stack", "player_join", "player_leave", "memo"]  // both
```

**Rationale**: Clear categorization enables validation logic per session type and state.

## R3: Session State Derivation from Events

**Decision**: Derive session state from the event stream:

| State | Condition |
|-------|-----------|
| `active` | Latest lifecycle/pause/resume event is `session_start` or `session_resume` |
| `paused` | Latest lifecycle/pause/resume event is `session_pause` |
| `completed` | `session_end` event exists |

**Rationale**: Event-sourced state derivation is the existing pattern. Adding `paused` state requires checking for pause/resume events in the derivation logic.

## R4: Migration Strategy

**Decision**: Use a Drizzle SQL migration that transforms event_type and payload in-place. No schema changes needed on the `session_event` table itself (event_type is text, payload is JSON text).

**Migration Steps**:

1. **Cash game `session_start`**: Find first `chip_add` event per cash session, extract amount, update `session_start` payload to `{"buyInAmount": <amount>}`
2. **Cash game first `chip_add`**: Delete after merging into `session_start`
3. **Remaining `chip_add`**: Rename event_type to `chips_add_remove`, update payload to `{"amount": <amount>, "type": "add"}`
4. **`stack_record`**: For each:
   - Create `update_stack` event with `{"stackAmount": <stackAmount>}`
   - Create individual `all_in` events for each entry in `allIns` array
   - Delete original `stack_record`
5. **Cash game `session_end`**: Find last `stack_record` before `session_end`, use its `stackAmount` as `{"cashOutAmount": <amount>}` in session_end payload
6. **`tournament_stack_record`**: For each:
   - Create `update_stack` event with `{"stackAmount": <stackAmount>}`
   - Create `purchase_chips` events for each `chipPurchases` entry
   - Create `update_tournament_info` if `remainingPlayers` or `totalEntries` present
   - Delete original
7. **`tournament_result`**: Merge into tournament `session_end` payload, delete `tournament_result` event
8. **Multiple `session_start` (reopen)**: 2nd+ `session_start` → `session_resume`, insert `session_pause` before it

**Rationale**: In-place migration avoids schema changes and keeps the single `session_event` table approach. D1/SQLite supports JSON operations for payload manipulation.

**Alternatives considered**: New table with data copy (rejected - unnecessary complexity, existing table structure is sufficient).

## R5: P&L Calculation Refactoring

**Decision**: Refactor `computeCashGamePLFromEvents` and `computeTournamentPLFromEvents` to read buy-in/cash-out from session lifecycle event payloads instead of scanning chip_add/stack_record events.

**Cash Game P&L**:
- `totalBuyIn` = `session_start.buyInAmount` + sum of `chips_add_remove` where type="add"
- `cashOut` = `session_end.cashOutAmount` (null if not completed)
- `addonTotal` = sum of `chips_add_remove` where type="add"
- `chipRemoveTotal` = sum of `chips_add_remove` where type="remove"
- `profitLoss` = `cashOut` + `chipRemoveTotal` - `totalBuyIn`
- `evCashOut` = adjusted by `all_in` events

**Tournament P&L**:
- Rebuys/addons from `purchase_chips` events
- Placement/prizes from `session_end` payload
- `beforeDeadline` flag determines which fields are available

**Rationale**: Aligns P&L with the new event structure. Centralizes key data in lifecycle events.

## R6: Cash Game Reopen Transformation

**Decision**: The `reopen` procedure for cash games will:
1. Find the `session_end` event and extract `cashOutAmount`
2. Delete the `session_end` event
3. Create `update_stack` event at same timestamp with `stackAmount = cashOutAmount`
4. Create `session_pause` event at same timestamp (sortOrder after update_stack)
5. Create `session_resume` event at current time
6. Recalculate session state (now "active")

**Rationale**: Preserves the cash-out amount as a stack record for history, while cleanly transitioning to active state via pause/resume.

## R7: Pause-State Event Validation

**Decision**: When creating events, check if session is in paused state. If paused, only allow `memo` and `session_resume` event types. Also allow `session_end` (completing from paused state).

**Implementation**: Add a helper function `getSessionCurrentState(events)` that scans events to determine current state (active/paused/completed), then validate against allowed events per state in the `create` procedure.

**Rationale**: Prevents logically impossible events (e.g., chip changes while not playing).
