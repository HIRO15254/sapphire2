# tRPC Router Contract: `sessionEvent`

**Package**: `@sapphire2/api`

## Event Types

### Shared event families

- `chip_add`
- `stack_record`
- `tournament_stack_record`
- `tournament_result`
- `player_join`
- `player_leave`
- `session_start`
- `session_end`

`session_start` and `session_end` cannot be created manually.

## Procedures

### `list`

Protected query with exactly one of:

- `liveCashGameSessionId`
- `liveTournamentSessionId`

Returns the session events sorted by `occurredAt` and `sortOrder`.

### `create`

Protected mutation with:

- `liveCashGameSessionId?`
- `liveTournamentSessionId?`
- `eventType`
- `occurredAt?`
- `payload`

Behavior:

- Requires exactly one session id.
- Validates ownership and session type.
- Validates the payload against the event schema.
- Rejects manual creation of `session_start` and `session_end`.
- Applies side effects for `player_join` and `player_leave`.
- Recalculates P&L when the affected session is already completed.

### `update`

Protected mutation with `{ id, occurredAt?, payload? }`.

Behavior:

- Validates ownership.
- Revalidates payload when changed.
- Recalculates P&L for completed sessions.

### `delete`

Protected mutation with `{ id }`.

Behavior:

- Validates ownership.
- Removes linked table-player state when deleting `player_join` or `player_leave`.
- Recalculates P&L for completed sessions.
