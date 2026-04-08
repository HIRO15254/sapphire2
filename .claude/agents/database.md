---
name: database
description: Drizzle ORM + Cloudflare D1(SQLite) の現行スキーマ・マイグレーション実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Database Domain Expert

## Technology Stack

- **ORM**: Drizzle ORM
- **Database**: Cloudflare D1 (SQLite)
- **Driver**: `drizzle-orm/d1`
- **Migration Tooling**: Drizzle Kit + Wrangler migration apply commands

## Key File Locations

| Purpose | Path |
|---------|------|
| DB factory | `packages/db/src/index.ts` |
| Schema aggregator | `packages/db/src/schema.ts` |
| Schema files | `packages/db/src/schema/*.ts` |
| Constants | `packages/db/src/constants*.ts` |
| SQL migrations | `packages/db/src/migrations/*.sql` |
| Schema tests | `packages/db/src/__tests__/` |

## Current Patterns

### Schema Definition

- Schemas use `sqliteTable`, not `pgTable`
- IDs are string primary keys, typically written by application code with `crypto.randomUUID()`
- Relations are defined alongside each schema file

```typescript
export const player = sqliteTable("player", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	name: text("name").notNull(),
	memo: text("memo"),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
```

### Schema Organization

- There is no `packages/db/src/schema/index.ts` barrel in current use
- The top-level exported schema object lives in `packages/db/src/schema.ts`
- Domain files currently include:
  - `auth.ts`
  - `store.ts`
  - `ring-game.ts`
  - `tournament.ts`
  - `tournament-tag.ts`
  - `session.ts`
  - `session-tag.ts`
  - `live-cash-game-session.ts`
  - `live-tournament-session.ts`
  - `session-event.ts`
  - `session-table-player.ts`
  - `player.ts`

### Migrations

- Generate SQL with `bun run db:generate`
- Apply with Wrangler D1 scripts from the repo root:
  - `bun run db:migrate:local`
  - `bun run db:migrate:remote`
- Do not describe the system as PostgreSQL or Neon

## Testing Guidance

- Existing schema tests live in `packages/db/src/__tests__/`
- Prefer updating those tests when columns, relations, or event constants change
- Use current schema names from the repo, not sample tables

## Code Quality Rules

- Match real SQLite column types and naming conventions already in use
- Preserve foreign key behavior and derived table relationships
- Avoid introducing fake example schemas such as `todo`
