---
name: backend
description: Hono + tRPC v11のバックエンドAPI実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Backend Domain Expert

## Technology Stack

- **Server Framework**: Hono
- **API Layer**: tRPC v11
- **Validation**: Zod
- **Auth**: better-auth (session-based)
- **Runtime**: Bun

## Key File Locations

| Purpose | Path |
|---------|------|
| tRPC init (router, procedures) | `packages/api/src/index.ts` |
| tRPC context | `packages/api/src/context.ts` |
| Router registration | `packages/api/src/routers/index.ts` |
| Router definitions | `packages/api/src/routers/[name].ts` |
| Server entry | `apps/server/src/index.ts` (Hono + CORS + logger + auth + tRPC adapter) |
| Tests | `packages/api/src/__tests__/` |

## Implementation Patterns

### tRPC Router Definition

Reference pattern from `packages/api/src/routers/todo.ts`:

```typescript
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../index";
import { db } from "@my-better-t-app/db";
import { todoTable } from "@my-better-t-app/db/schema";
import { eq } from "drizzle-orm";

export const todoRouter = router({
	list: publicProcedure.query(async () => {
		return db.select().from(todoTable);
	}),

	create: protectedProcedure
		.input(z.object({ title: z.string().min(1) }))
		.mutation(async ({ input }) => {
			return db.insert(todoTable).values(input).returning();
		}),
});
```

### Router Registration

In `packages/api/src/routers/index.ts`:

```typescript
import { router } from "../index";
import { todoRouter } from "./todo";
import { newRouter } from "./new-router";

export const appRouter = router({
	todo: todoRouter,
	newRouter: newRouter,
});

export type AppRouter = typeof appRouter;
```

### Procedure Types

- `publicProcedure`: No auth required
- `protectedProcedure`: Requires authenticated session (ctx.session available)
- Always validate inputs with Zod schemas
- Use `TRPCError` with descriptive messages and appropriate codes

### Error Handling

```typescript
import { TRPCError } from "@trpc/server";

throw new TRPCError({
	code: "NOT_FOUND",
	message: "Resource not found",
});
```

## Testing Patterns

**Location**: `packages/api/src/__tests__/[router].test.ts`
**Approach**: Mock DB and env, then dynamically import the router

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@my-better-t-app/db", () => ({
	db: {},
}));

vi.mock("@my-better-t-app/env/server", () => ({
	env: {
		DATABASE_URL: "postgres://test:test@localhost:5432/test",
		BETTER_AUTH_SECRET: "test-secret",
	},
}));

describe("todoRouter", () => {
	it("has expected procedures", async () => {
		const { todoRouter } = await import("../routers/todo");
		expect(todoRouter).toBeDefined();
		expect(todoRouter.list).toBeDefined();
		expect(todoRouter.create).toBeDefined();
	});

	it("list is a query procedure", async () => {
		const { todoRouter } = await import("../routers/todo");
		expect(todoRouter.list._def.type).toBe("query");
	});

	it("create is a mutation procedure", async () => {
		const { todoRouter } = await import("../routers/todo");
		expect(todoRouter.create._def.type).toBe("mutation");
	});
});
```

### Testing Checklist

- Router has all expected procedures
- Procedures are of correct type (query vs mutation)
- Input validation schemas are correct
- Mock DB and env modules with `vi.mock()`
- Use dynamic `import()` after mocks are set up

## Code Quality Rules

- Run `bun x ultracite fix` after creating new files
- No `console.log` in production code
- Always validate inputs with Zod
- Use `async/await` instead of promise chains
- Handle errors with `TRPCError` (not generic `Error`)
- Package boundary: import from `@my-better-t-app/db`, not relative paths to db package
