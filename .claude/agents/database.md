---
name: database
description: Drizzle ORM + PostgreSQLのスキーマ・マイグレーション実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Database Domain Expert

## Technology Stack

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Migration**: Drizzle Kit (`bun run db:generate`)
- **Schema Location**: `packages/db/src/schema/`

## Key File Locations

| Purpose | Path |
|---------|------|
| Schema definitions | `packages/db/src/schema/[table].ts` |
| Schema barrel export | `packages/db/src/schema/index.ts` |
| DB instance | `packages/db/src/index.ts` (drizzle() with schema) |
| Auth schema | `packages/db/src/schema/auth.ts` |
| Example schema | `packages/db/src/schema/todo.ts` |
| Tests | `packages/db/src/__tests__/` |

## Implementation Patterns

### Schema Definition (pgTable)

Reference pattern from `packages/db/src/schema/todo.ts`:

```typescript
import {
	boolean,
	pgTable,
	serial,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

export const todoTable = pgTable("todo", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	completed: boolean("completed").notNull().default(false),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
```

### Common Column Types

```typescript
import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
	jsonb,
	uuid,
} from "drizzle-orm/pg-core";
```

### Relations

```typescript
import { relations } from "drizzle-orm";

export const todoRelations = relations(todoTable, ({ one, many }) => ({
	author: one(userTable, {
		fields: [todoTable.authorId],
		references: [userTable.id],
	}),
	tags: many(tagTable),
}));
```

### Schema Export

All schemas MUST be re-exported from `packages/db/src/schema/index.ts`:

```typescript
export * from "./auth";
export * from "./todo";
export * from "./new-table";
```

### After Schema Changes

Run `bun run db:generate` to create migration files.

## Testing Patterns

**Location**: `packages/db/src/__tests__/[schema].test.ts`
**Approach**: Import schema directly, validate structure with `getTableColumns()`

```typescript
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { todoTable } from "../schema/todo";

describe("todoTable schema", () => {
	const columns = getTableColumns(todoTable);

	it("has expected columns", () => {
		expect(Object.keys(columns)).toEqual(
			expect.arrayContaining([
				"id",
				"title",
				"completed",
				"createdAt",
				"updatedAt",
			]),
		);
	});

	it("has id as primary key", () => {
		expect(columns.id.primary).toBe(true);
	});

	it("has correct not-null constraints", () => {
		expect(columns.title.notNull).toBe(true);
		expect(columns.completed.notNull).toBe(true);
	});

	it("has default values where expected", () => {
		expect(columns.completed.hasDefault).toBe(true);
		expect(columns.createdAt.hasDefault).toBe(true);
	});
});
```

### Testing Checklist

- Table has expected columns (list all column names)
- Primary key is correctly set
- Not-null constraints are correct
- Default values are set where expected
- Foreign key references are valid (if applicable)

## Code Quality Rules

- Run `bun x ultracite fix` after creating new files
- Use descriptive table and column names
- Always include `createdAt` and `updatedAt` timestamps
- Use `serial` for auto-increment IDs, `uuid` for UUID-based IDs
- Define relations alongside schemas
- Package boundary: export through `packages/db/src/schema/index.ts`
