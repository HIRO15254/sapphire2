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
- `updateInfiniteQueryItems` — optimistically `map` (edit) / `filter` (delete) the items of every page in a `useInfiniteQuery` cache entry while preserving the page envelope. Reference: [`use-sessions.ts`](apps/web/src/features/sessions/hooks/use-sessions.ts).
- `prependInfiniteQueryItem` — optimistically prepend a new item to the first page of a `useInfiniteQuery` entry. Reference: [`use-sessions.ts`](apps/web/src/features/sessions/hooks/use-sessions.ts).
- `updateQueryEntity` — shallow-merge a `patch` (partial object, or a function of the current entity) into a **single-object** query cache entry; no-ops when the entry is unfetched. Reference: [`use-player-detail.ts`](apps/web/src/features/players/hooks/use-player-detail.ts), [`use-active-session-scene-state.ts`](apps/web/src/features/live-sessions/components/active-session-scene/use-active-session-scene-state.ts).
- `updateQueryItems` — `map` (edit) / `filter` (delete) a **plain-array** (`TItem[]`) query cache entry; no-ops when unfetched. Reference: [`use-session-events.ts`](apps/web/src/features/live-sessions/hooks/use-session-events.ts).

[`optimistic-session-event.ts`](apps/web/src/features/live-sessions/utils/optimistic-session-event.ts) is a sanctioned feature-level wrapper built on these helpers for the session-event timeline.

**Do not** hand-roll `queryClient.setQueryData` + `invalidateQueries` chains, even inside hooks (SA2-162 tracks migrating the remaining legacy call sites). If a case is not covered by the helpers, extend the helpers instead of bypassing them.

## Optimistic-update pitfalls (each caused a shipped bug)

- **Clearing a field**: `null` means "cleared" — merging with `updated.memo ?? old.memo` resurrects the old value. Use `updateQueryEntity`'s function-form patch and decide by key presence, not nullish-ness (SA2-132).
- **Optimistic ids**: use `crypto.randomUUID()`. `optimistic-${Date.now()}` collides within one millisecond and corrupts keyed rendering (SA2-143).
- **Edit ≠ create**: do not reuse create-oriented aggregation logic in an update mutation's `onMutate` — edited events double-counted EV and dropped deltas (SA2-147).
- **Polling coexistence**: with `refetchInterval` active, one `cancelTargets` in `onMutate` is not enough — a poll landing mid-mutation overwrites the optimistic state. Pause the poll (or guard the overwrite) until `onSettled` (SA2-152).
- **Invalidation completeness**: if the server recalculates derived state (e.g. editing a pause event updates `gameSession.status`), invalidate the queries that render that derived state too, not just the entity you mutated (SA2-167).

## Paginated lists use `useInfiniteQuery`

For cursor-paginated tRPC procedures (`{ items, nextCursor }`), drive the list with `trpc.<proc>.infiniteQueryOptions(input, { getNextPageParam: (last) => last.nextCursor })` + `useInfiniteQuery` — not `useQuery` plus a local-state accumulator. Keeping every page in one cache entry means a focus / reconnect / invalidate refetch re-fetches all loaded pages instead of collapsing back to page 1, and `fetchNextPage()` replaces hand-rolled load-more state. Reference: [`use-sessions.ts`](apps/web/src/features/sessions/hooks/use-sessions.ts).

## Persisted cache & sign-out

The query cache is persisted to IndexedDB (24h) and keyed by procedure name, not per-user.

- **Every sign-out entry point calls [`useSignOut`](apps/web/src/shared/hooks/use-sign-out.ts)** — never `authClient.signOut` directly. It clears the in-memory cache and the persisted store so the next account on a shared device cannot see the previous user's data (SA2-159).
- When a change alters a procedure's **output shape**, remember deployed clients rehydrate up to 24h of old-shaped cache into the new code — coordinate a `buster` / cache-invalidation strategy in the persister config (SA2-154).

## Mutation hook shape

Return `{ on*Handler, is*Pending, error, … }`. Keep optimistic state changes isolated inside the mutation's `onMutate`; never leak `queryClient` calls to components.
