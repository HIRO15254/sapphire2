---
paths:
  - "apps/web/**"
---

# Data Fetching & Optimistic Updates

All tRPC query and mutation work lives inside custom hooks (never in components — see [`web-hooks-separation.md`](web-hooks-separation.md)).

## Optimistic updates must use the shared helpers

Use [`apps/web/src/utils/optimistic-update.ts`](apps/web/src/utils/optimistic-update.ts):

- `snapshotQuery` / `snapshotQueries` — capture rollback state before the optimistic write.
- `cancelTargets` — cancel in-flight queries on the same keys.
- `restoreSnapshots` — call from `onError`.
- `invalidateTargets` — call from `onSettled` with an array of targets.
- `updateInfiniteQueryItems` — optimistically `map` (edit) / `filter` (delete) the items of every page in a `useInfiniteQuery` cache entry while preserving the page envelope. Pair with `snapshotQuery` + `restoreSnapshots` for rollback. Reference: [`use-currencies.ts`](apps/web/src/features/currencies/hooks/use-currencies.ts) (`editTransaction` / `deleteTransaction`).
- `updateQueryEntity` — shallow-merge a `patch` (partial object, or a function of the current entity) into a **single-object** query cache entry; no-ops when the entry is unfetched (`undefined` / `null`). The single-object analog of `updateQueryItems`. Reference: [`use-poker-table-interaction.ts`](apps/web/src/features/players/hooks/use-poker-table-interaction.ts) (`heroMutation`), [`use-player-detail.ts`](apps/web/src/features/players/hooks/use-player-detail.ts) (`updateMutation`).
- `updateQueryItems` — `map` (edit) / `filter` (delete) a **plain-array** (`TItem[]`) query cache entry; no-ops when unfetched. The single-query analog of `updateInfiniteQueryItems`. Reference: [`use-session-events.ts`](apps/web/src/features/live-sessions/hooks/use-session-events.ts) (`updateMutation` / `deleteMutation`).

**Do not** hand-roll `queryClient.setQueryData` + `invalidateQueries` chains, even inside hooks. If a case is not covered by the helpers, extend the helpers instead of bypassing them.

## Paginated lists use `useInfiniteQuery`

For cursor-paginated tRPC procedures (`{ items, nextCursor }`), drive the list with `trpc.<proc>.infiniteQueryOptions(input, { getNextPageParam: (last) => last.nextCursor })` + `useInfiniteQuery` — not `useQuery` plus a local-state accumulator. Keeping every page in one cache entry means a focus / reconnect / `staleTime` / invalidate / remount refetch re-fetches all loaded pages instead of collapsing back to page 1, and `fetchNextPage()` replaces hand-rolled load-more (`txCursor` / `isLoadingMore` state). Reference: [`use-currencies.ts`](apps/web/src/features/currencies/hooks/use-currencies.ts).

## Mutation hook shape

Return `{ on*Handler, is*Pending, error, … }`. Keep optimistic state changes isolated inside the mutation's `onMutate`; never leak `queryClient` calls to components.
