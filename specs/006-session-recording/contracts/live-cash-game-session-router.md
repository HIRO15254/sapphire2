# tRPC Router Contract: `liveCashGameSession`

**Package**: `@sapphire2/api`

## Procedures

### `list`

Protected query with `status?`, `cursor?`, and `limit?`.

Returns paginated cash-game live sessions with store, ring game, currency, timestamps, memo, current summary fields, and event count.

### `getById`

Protected query with `{ id }`.

Returns the live cash-game session, its events, table players, and computed summary values:

- `totalBuyIn`
- `cashOut`
- `profitLoss`
- `evCashOut`
- `addonCount`
- `maxStack`
- `minStack`
- `currentStack`

### `create`

Protected mutation with:

- `storeId?`
- `ringGameId?`
- `currencyId?`
- `memo?`
- `initialBuyIn`

Behavior:

- Blocks creation if another live session is active for the user.
- Creates the live session in `active` state.
- Records `session_start`.
- Records the initial `chip_add`.

### `complete`

Protected mutation with `{ id, finalStack }`.

Behavior:

- Rejects already completed sessions.
- Records the final `stack_record`.
- Records `session_end`.
- Creates or updates the linked `pokerSession`.
- Creates or updates the linked `currencyTransaction` when a currency is set.

### `reopen`

Protected mutation with `{ id }`.

Behavior:

- Only completed sessions can reopen.
- Blocks reopening if another live session is active.
- Moves the session back to `active`.
- Appends a new `session_start`.
- Removes the derived `pokerSession` and `currencyTransaction` so the next completion recomputes them.

### `discard`

Protected mutation with `{ id }`.

Behavior:

- Only active sessions can be discarded.
- Deletes the live session and its cascaded events and table players.

### `updateHeroSeat`

Protected mutation with `{ id, heroSeatPosition }`.

Behavior:

- Updates the hero seat for the live cash-game session.
