# Quickstart: 002-store-currency-game

## Prerequisites

- Bun installed
- `bun install` completed at repo root
- Local D1 database available (`bun run dev` sets this up)

## Development

```bash
# Start dev servers (API + Web)
bun run dev

# After schema changes, generate migration
cd packages/db
bun run drizzle-kit generate

# Apply migration to local D1
cd apps/server
bun run wrangler d1 migrations apply sapphire2-db --local

# Run all tests
bun run test

# Lint & format
bun x ultracite fix
bun x ultracite check

# Type check
bun run check-types
```

## Key Files to Modify

### Phase 1: Schema & Migration
1. `packages/db/src/schema/store.ts` — NEW: Store, Currency, CurrencyTransaction, TransactionType
2. `packages/db/src/schema/ring-game.ts` — NEW: RingGame
3. `packages/db/src/schema/tournament.ts` — NEW: Tournament, BlindLevel
4. `packages/db/src/schema.ts` — UPDATE: export new schemas
5. Delete `packages/db/src/schema/todo.ts`
6. Generate and apply migration

### Phase 2: API Routers
1. `packages/api/src/routers/store.ts` — NEW
2. `packages/api/src/routers/currency.ts` — NEW
3. `packages/api/src/routers/transaction-type.ts` — NEW
4. `packages/api/src/routers/ring-game.ts` — NEW
5. `packages/api/src/routers/tournament.ts` — NEW (includes blindLevel)
6. `packages/api/src/routers/index.ts` — UPDATE: register new routers, remove todo
7. Delete `packages/api/src/routers/todo.ts`

### Phase 3: Frontend
1. `apps/web/src/components/mobile-nav.tsx` — UPDATE: add Stores, remove Todos
2. `apps/web/src/routes/stores/index.tsx` — NEW: store list
3. `apps/web/src/routes/stores/$storeId.tsx` — NEW: store detail with tabs
4. `apps/web/src/components/stores/*` — NEW: all store-related components
5. Delete `apps/web/src/routes/todos.tsx`

## Verification

1. `bun run dev` — local servers start without errors
2. Navigate to `/stores` — empty state shown
3. Create a store → appears in list
4. Open store detail → Currency/Ring Games/Tournaments tabs
5. Create currency → add transaction → balance shown
6. Create ring game → SB/BB/Straddle labels shown
7. Create tournament → add blind levels → structure displayed
8. Archive/restore ring game → visibility toggles
9. Delete store → all child data removed
10. `bun run test` — all tests pass
11. `bun x ultracite check` — no lint errors
