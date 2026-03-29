# Quickstart: プレイヤーメモ機能

## Prerequisites

- Bun runtime installed
- Repository cloned and on `005-player-notes` branch
- `bun install` completed

## New Dependencies

```bash
# Tiptap rich text editor (in apps/web)
cd apps/web
bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/pm
```

## Database Migration

After creating the schema files in `packages/db/src/schema/`:

```bash
cd packages/db
bun run drizzle-kit generate  # Generate migration SQL
bun run drizzle-kit push       # Apply to local D1 (dev)
```

## Key Files to Create/Modify

### 1. Database Schema (packages/db)
- **Create** `packages/db/src/schema/player.ts` - Player, PlayerTag, PlayerToPlayerTag tables
- **Modify** `packages/db/src/schema.ts` - Export new tables and relations

### 2. API Routers (packages/api)
- **Create** `packages/api/src/routers/player.ts` - Player CRUD
- **Create** `packages/api/src/routers/player-tag.ts` - PlayerTag CRUD (with color)
- **Modify** `packages/api/src/routers/index.ts` - Register new routers

### 3. Frontend (apps/web)
- **Create** `apps/web/src/routes/players/index.tsx` - Player list page
- **Create** `apps/web/src/components/players/player-form.tsx` - Create/Edit form
- **Create** `apps/web/src/components/players/player-card.tsx` - List item card
- **Create** `apps/web/src/components/players/player-tag-manager.tsx` - Tag management
- **Create** `apps/web/src/components/players/player-memo-editor.tsx` - Tiptap wrapper
- **Modify** `apps/web/src/components/mobile-nav.tsx` - Add Players nav item
- **Modify** `apps/web/src/components/sidebar-nav.tsx` - Add Players nav item

## Development Workflow

```bash
# Terminal 1: Start dev server
bun run dev

# Terminal 2: Run tests
bun run test

# Before committing
bun x ultracite fix
bun run check-types
```

## Patterns to Follow

| Pattern | Reference File |
|---------|---------------|
| DB Schema (CRUD entity) | `packages/db/src/schema/store.ts` |
| DB Schema (M2M junction) | `packages/db/src/schema/session-tag.ts` |
| tRPC Router (CRUD) | `packages/api/src/routers/store.ts` |
| tRPC Router (Tag) | `packages/api/src/routers/session-tag.ts` |
| Route Page (list + dialogs) | `apps/web/src/routes/sessions/index.tsx` |
| Form Component | `apps/web/src/components/stores/store-form.tsx` |
| Tag Input | `apps/web/src/components/ui/tag-input.tsx` |
| Responsive Dialog | `apps/web/src/components/ui/responsive-dialog.tsx` |
