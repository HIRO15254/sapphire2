# Quickstart: 002-store-currency-game

## Prerequisites

- Bun installed
- `bun install` completed at repo root

## Local Workflow

```bash
# Start the full app
bun run dev

# Generate a DB migration after schema changes
bun run db:generate

# Apply migrations to local D1
bun run db:migrate:local

# Run checks
bun run test
bun run check-types
bun run check
```

## Current Entry Points

- `/stores` - store list and create/edit/delete flow
- `/stores/$storeId` - store detail with `Cash Games` and `Tournaments` tabs
- `/currencies` - currency list, balance, and transaction history
- `/settings` - transaction type management

## Sanity Check

1. Open `/stores` and create a store.
2. Open a store and confirm the cash game and tournament tabs render.
3. Open `/currencies` and confirm balance plus transaction history work.
4. Open `/settings` and confirm transaction types are present and editable.
5. Run `bun run test` and `bun run check-types`.
