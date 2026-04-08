---
name: frontend
description: React 19 + TanStack Router + TanStack Query の現行フロントエンド実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Frontend Domain Expert

## Technology Stack

- **Framework**: React 19 + Vite
- **Routing**: TanStack Router file-based routing
- **Server State**: TanStack Query + `createTRPCOptionsProxy`
- **Persistence**: `PersistQueryClientProvider` + IndexedDB persister
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS v4
- **Auth**: better-auth client

## Key File Locations

| Purpose | Path |
|---------|------|
| App entry | `apps/web/src/main.tsx` |
| Route tree root | `apps/web/src/routes/__root.tsx` |
| Routes | `apps/web/src/routes/` |
| tRPC + Query setup | `apps/web/src/utils/trpc.ts` |
| Shared shell | `apps/web/src/components/authenticated-shell.tsx` |
| UI primitives | `apps/web/src/components/ui/` |
| Route and component tests | `apps/web/src/__tests__/` and nearby `__tests__/` folders |

## Current Patterns

### Data Fetching

- Queries use `trpc.<router>.<procedure>.queryOptions()` with React Query's `useQuery`
- Router context receives `trpc` and `queryClient` from `apps/web/src/main.tsx`
- Query cache is persisted and defaults to `networkMode: "offlineFirst"`

```typescript
const playersQuery = useQuery(trpc.player.list.queryOptions());
```

### Mutations

- The current codebase mainly uses React Query's `useMutation` with `trpcClient.*.mutate(...)` inside `mutationFn`
- Optimistic `onMutate` / rollback / invalidate patterns are already used heavily and should be preserved
- Do not assume `trpc.<router>.<procedure>.useMutation()` exists in this repo

```typescript
const createMutation = useMutation({
	mutationFn: (values: PlayerFormValues) =>
		trpcClient.player.create.mutate(values),
	onSettled: () => {
		queryClient.invalidateQueries({ queryKey: playerListKey });
	},
});
```

### Routing

- Route files export `Route` via `createFileRoute(...)`
- Important current routes include:
  - `/sessions`
  - `/stores`
  - `/stores/$storeId`
  - `/players`
  - `/currencies`
  - `/settings`
  - `/active-session`
  - `/active-session/events`
  - `/live-sessions/$sessionType/$sessionId/events`

### Layout and Navigation

- `AuthenticatedShell` owns the logged-in layout
- Mobile uses `MobileNav`
- Desktop uses `SidebarNav`
- The mobile center action changes based on active session state

## Testing Guidance

- Prefer existing route-level tests in `apps/web/src/__tests__/`
- Component-specific tests may live near the feature under `__tests__/`
- Use Testing Library + Vitest
- When changing behavior, update or add the narrowest useful test rather than creating broad snapshot coverage

## Code Quality Rules

- Keep user-facing strings in English
- Follow existing optimistic update utilities and invalidation patterns
- Preserve offline-first query behavior
- Prefer editing existing routes/components over introducing parallel abstractions
