# Quickstart: Session Event Redesign

## Prerequisites

```bash
bun install
```

## Development Commands

```bash
# Run tests
bun run test

# Type checking
bun run check-types

# Lint and format
bun x ultracite fix

# Generate DB migration after schema changes
bun run db:generate

# Apply migration locally
bun run db:migrate:local

# Start dev server
bun run dev
```

## Key Files to Modify

### 1. Event Type Constants (packages/db)
`packages/db/src/constants/session-event-types.ts`
- Replace event type arrays and Zod payload schemas
- Update `EVENT_PAYLOAD_SCHEMAS` map
- Update `isValidEventTypeForSessionType` routing
- Add session state validation helpers

### 2. Session Event Router (packages/api)
`packages/api/src/routers/session-event.ts`
- Update `create` to validate against session state (active/paused)
- Update `create` to use new event type schemas
- Update `delete` to block only `session_start`/`session_end`

### 3. Cash Game Session Router (packages/api)
`packages/api/src/routers/live-cash-game-session.ts`
- `create`: Embed buyIn in `session_start` payload, remove initial `chip_add`
- `complete`: Embed cashOut in `session_end` payload, remove final `stack_record`
- `reopen`: Decompose `session_end` → `update_stack` + `session_pause` + `session_resume`

### 4. Tournament Session Router (packages/api)
`packages/api/src/routers/live-tournament-session.ts`
- `complete`: Embed placement/prizes in `session_end` payload with `beforeDeadline` flag
- `reopen`: Remove or convert to error (reopening prohibited)

### 5. P&L Calculation Service (packages/api)
`packages/api/src/services/live-session-pl.ts`
- `computeCashGamePLFromEvents`: Read buyIn from `session_start`, cashOut from `session_end`
- `computeTournamentPLFromEvents`: Read placement/prizes from `session_end`
- `computeSessionStateFromEvents`: Add `paused` state derivation
- `computeBreakMinutesFromEvents`: Use `session_pause`/`session_resume` pairs

### 6. Data Migration
`packages/db/src/migrations/` (new SQL file)
- Transform existing event_type values and payloads in-place

### 7. Frontend Event Scene (apps/web)
`apps/web/src/live-sessions/components/session-events-scene.tsx`
- Add editors for new event types (memo, all_in standalone, purchase_chips, etc.)
- Update event type labels
- Update payload display summaries

### 8. Frontend Session Events Hook (apps/web)
`apps/web/src/live-sessions/hooks/use-session-events.ts`
- Update optimistic update logic for new event types

### 9. Tests
`packages/db/src/__tests__/session-event-types.test.ts`
- Update for new event types, schemas, validation functions

## Implementation Order

1. **Constants & Schemas** → Foundation for everything else
2. **Data Migration** → Ensure existing data works with new schemas
3. **P&L Service** → Core business logic
4. **Session Routers** → Create/complete/reopen procedures
5. **Event Router** → CRUD with state validation
6. **Frontend** → UI for new event types
7. **Tests** → Validate all layers
