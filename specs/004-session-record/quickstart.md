# Quickstart: Session Post-Recording

## Prerequisites

- Bun installed
- Project dependencies installed (`bun install`)
- Local D1 database running (`bun run dev` in apps/server)

## Key Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/session.ts` | Session table + relations |
| `packages/api/src/routers/session.ts` | Session CRUD + summary + currency transaction sync |
| `apps/web/src/routes/sessions/index.tsx` | Sessions page (summary + list + filters) |
| `apps/web/src/components/sessions/session-form.tsx` | Create/edit form (type-conditional) |
| `apps/web/src/components/sessions/session-card.tsx` | Session list item card |
| `apps/web/src/components/sessions/session-summary.tsx` | Summary statistics display |
| `apps/web/src/components/sessions/session-filters.tsx` | Filter controls (type, store, date range) |
| `packages/api/src/__tests__/session.test.ts` | Router smoke tests |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/src/schema/store.ts` | Add `sessionId` column to `currencyTransaction` table |
| `packages/api/src/routers/index.ts` | Register `sessionRouter` |
| `packages/api/src/routers/currency-transaction.ts` | Mark session-generated transactions as read-only |
| `packages/api/src/routers/transaction-type.ts` | Seed "Session Result" default type |
| `apps/web/src/components/stores/transaction-list.tsx` | Show read-only indicator for session transactions |
| `apps/web/src/routes/__root.tsx` | Add "Sessions" nav item |

### Database Migration

```bash
# After schema changes
bun run generate  # Generate migration SQL
bun run migrate   # Apply migration
```

## Development Order

1. **Schema** → Add `session` table, modify `currencyTransaction`
2. **Migration** → Generate and apply
3. **Router** → Session CRUD with currency transaction sync
4. **Tests** → Router smoke tests
5. **Frontend** → Sessions page, form, card, summary, filters
6. **Integration** → Currency transaction read-only, nav update

## Pattern References

| Pattern | Reference File |
|---------|---------------|
| Table definition | `packages/db/src/schema/store.ts` (store, currencyTransaction) |
| CRUD router | `packages/api/src/routers/currency.ts` |
| Cursor pagination | `packages/api/src/routers/currency-transaction.ts` |
| Ownership validation | `packages/api/src/routers/ring-game.ts` |
| Page with list + summary | `apps/web/src/routes/currencies/index.tsx` |
| Form component | `apps/web/src/components/stores/ring-game-form.tsx` |
| Card component | `apps/web/src/components/stores/currency-card.tsx` |
| Optimistic mutations | `apps/web/src/routes/currencies/index.tsx` |
