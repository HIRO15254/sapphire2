# tRPC Router Contract: `liveTournamentSession`

**Package**: `@sapphire2/api`

## Procedures

### `list`

Protected query with `status?`, `cursor?`, and `limit?`.

Returns paginated tournament live sessions with store, tournament, currency, timestamps, memo, current summary fields, and event count.

### `getById`

Protected query with `{ id }`.

Returns the live tournament session, its events, table players, and computed summary values:

- `rebuyCount`
- `rebuyCost`
- `addonCount`
- `addonCost`
- `placement`
- `totalEntries`
- `prizeMoney`
- `bountyPrizes`
- `profitLoss`
- `maxStack`
- `minStack`
- `currentStack`
- `remainingPlayers`
- `averageStack`

### `create`

Protected mutation with:

- `storeId?`
- `tournamentId?`
- `currencyId?`
- `buyIn?`
- `entryFee?`
- `memo?`

Behavior:

- Blocks creation if another live session is active for the user.
- Creates the live session in `active` state.
- Records `session_start`.

The current UI writes the initial `tournament_stack_record` immediately after this mutation succeeds.

### `complete`

Protected mutation with `{ id, placement, totalEntries, prizeMoney, bountyPrizes? }`.

Behavior:

- Rejects already completed sessions.
- Records `tournament_result`.
- Records `session_end`.
- Creates or updates the linked `pokerSession`.
- Creates or updates the linked `currencyTransaction` when a currency is set.

### `reopen`

Protected mutation with `{ id }`.

Behavior:

- Only completed sessions can reopen.
- Blocks reopening if another live session is active.
- Removes the derived `pokerSession` and `currencyTransaction`.
- Moves the session back to `active`.
- Appends a new `session_start`.

### `discard`

Protected mutation with `{ id }`.

Behavior:

- Only active sessions can be discarded.
- Deletes the live session and its cascaded events and table players.

### `updateHeroSeat`

Protected mutation with `{ id, heroSeatPosition }`.

Behavior:

- Updates the hero seat for the live tournament session.
