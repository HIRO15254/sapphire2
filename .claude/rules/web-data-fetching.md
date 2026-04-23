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

**Do not** hand-roll `queryClient.setQueryData` + `invalidateQueries` chains, even inside hooks. If a case is not covered by the helpers, extend the helpers instead of bypassing them.

## Mutation hook shape

Return `{ on*Handler, is*Pending, error, … }`. Keep optimistic state changes isolated inside the mutation's `onMutate`; never leak `queryClient` calls to components.
