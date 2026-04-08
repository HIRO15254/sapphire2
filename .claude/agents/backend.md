---
name: backend
description: Hono + tRPC v11 + better-auth の現行バックエンド API 実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Backend Domain Expert

## Technology Stack

- **Server Framework**: Hono on Cloudflare Workers
- **API Layer**: tRPC v11
- **Auth**: better-auth
- **Validation**: Zod
- **Database Access**: Drizzle via `createDb(D1Database)`

## Key File Locations

| Purpose | Path |
|---------|------|
| Worker entry | `apps/server/src/worker.ts` |
| tRPC init | `packages/api/src/index.ts` |
| Context factory | `packages/api/src/context.ts` |
| Router registry | `packages/api/src/routers/index.ts` |
| Router definitions | `packages/api/src/routers/*.ts` |
| API tests | `packages/api/src/__tests__/` |

## Current Patterns

### Server Wiring

- Hono worker entry is `apps/server/src/worker.ts`
- Auth and DB are created per request from Cloudflare bindings
- tRPC is mounted under `/trpc/*`
- better-auth routes live under `/api/auth/*`

### Router Design

- Routers are grouped by domain, for example:
  - `store`
  - `currency`
  - `currencyTransaction`
  - `ringGame`
  - `tournament`
  - `session`
  - `sessionEvent`
  - `sessionTablePlayer`
  - `liveCashGameSession`
  - `liveTournamentSession`
  - `player`
  - `playerTag`
- Input validation is done with Zod at every procedure boundary
- Authenticated data access uses `protectedProcedure`

```typescript
export const storeRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		return ctx.db.select().from(store).where(eq(store.userId, ctx.session.user.id));
	}),
});
```

### Error Handling

- Use `TRPCError`
- Prefer `NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, and `PRECONDITION_FAILED` where they match current behavior
- Follow the existing ownership-check pattern before mutating records

### Data Access

- Prefer `ctx.db` from the request context, not global DB singletons
- Import schema from `@sapphire2/db/schema/...`
- Preserve current ownership validation and derived-record sync rules, especially for:
  - session currency transactions
  - live session completion / reopen
  - table-player and event synchronization

## Testing Guidance

- Router tests already exist in `packages/api/src/__tests__/`
- Prefer extending domain-specific tests rather than adding synthetic example routers
- Mock request context and DB in the style already used by the repo

## Code Quality Rules

- Do not introduce sample `todo` routers or generic scaffolding
- Keep procedure names aligned with the current app router surface
- Maintain compatibility with the existing web client contracts before refactoring API shapes
