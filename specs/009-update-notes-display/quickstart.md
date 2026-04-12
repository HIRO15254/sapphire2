# Quickstart: アップデートノート表示

**Feature**: 009-update-notes-display  
**Date**: 2026-04-11

## Prerequisites

- Bun runtime installed
- Dependencies installed (`bun install`)
- D1 database configured (local dev via `wrangler`)

## Development Steps

### 1. Database Schema & Migration

1. Create schema file: `packages/db/src/schema/update-note-view.ts`
2. Export from `packages/db/src/schema.ts`
3. Generate migration: `cd packages/db && bun run db:generate`
4. Apply migration locally: `bunx wrangler d1 migrations apply sapphire2-db --local`

### 2. Backend (tRPC Router)

1. Create router: `packages/api/src/routers/update-note-view.ts`
2. Register in `packages/api/src/routers/index.ts`

### 3. Frontend

1. Create update notes constants: `apps/web/src/update-notes/constants.ts`
2. Create context provider: `apps/web/src/update-notes/hooks/use-update-notes-sheet.tsx`
3. Create sheet component: `apps/web/src/update-notes/components/update-notes-sheet.tsx`
4. Add provider to `apps/web/src/shared/components/authenticated-shell.tsx`
5. Add trigger to `apps/web/src/shared/components/user-menu.tsx`

### 4. Testing

1. Schema tests: `packages/db/src/__tests__/update-note-view.test.ts`
2. Router tests: `packages/api/src/__tests__/update-note-view.test.ts`
3. Component tests: `apps/web/src/update-notes/__tests__/update-notes-sheet.test.tsx`

### 5. Verify

```bash
bun run check-types    # Type check
bun run test           # All tests
bun run check          # Lint
```

## Key Commands

```bash
# Dev server
bun run dev

# Generate DB migration
cd packages/db && bun run db:generate

# Run tests
bun run test

# Lint fix
bun x ultracite fix
```

## File Map

| Package | File | Purpose |
|---------|------|---------|
| db | `src/schema/update-note-view.ts` | Drizzle schema for view tracking |
| db | `src/schema.ts` | Schema export (add new table) |
| db | `src/migrations/0011_*.sql` | Auto-generated migration |
| api | `src/routers/update-note-view.ts` | tRPC router for view tracking |
| api | `src/routers/index.ts` | Router registration |
| web | `src/update-notes/constants.ts` | Static update note data |
| web | `src/update-notes/hooks/use-update-notes-sheet.tsx` | Sheet context provider + auto-open logic |
| web | `src/update-notes/components/update-notes-sheet.tsx` | UI component (ResponsiveDialog + Accordion) |
| web | `src/shared/components/authenticated-shell.tsx` | Add provider wrapping |
| web | `src/shared/components/user-menu.tsx` | Add menu trigger |
