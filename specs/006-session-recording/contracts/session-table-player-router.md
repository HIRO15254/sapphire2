# tRPC Router Contract: `sessionTablePlayer`

**Package**: `@sapphire2/api`

## Procedures

### `list`

Protected query with:

- `liveCashGameSessionId?`
- `liveTournamentSessionId?`
- `activeOnly?`

Returns the current table-player rows with player metadata, active state, join/leave timestamps, and optional seat position.

### `add`

Protected mutation with:

- `liveCashGameSessionId?`
- `liveTournamentSessionId?`
- `playerId`
- `seatPosition?`

Behavior:

- Requires exactly one live session id.
- Adds the player to the current table state.
- Writes a `player_join` event.

### `addNew`

Protected mutation with:

- `liveCashGameSessionId?`
- `liveTournamentSessionId?`
- `playerName`
- `playerMemo?`
- `seatPosition?`

Behavior:

- Requires exactly one live session id.
- Creates a new player, adds them to the current table state, and writes a `player_join` event.

### `remove`

Protected mutation with:

- `liveCashGameSessionId?`
- `liveTournamentSessionId?`
- `playerId`

Behavior:

- Requires exactly one live session id.
- Marks the player as inactive, stores `leftAt`, and writes a `player_leave` event.
