---
paths:
  - "packages/api/**"
  - "apps/server/**"
---

# API Security (Object-Level Authorization)

Why this file exists: the Fable review found ~15 IDOR bugs with one shared root cause — procedures validated *existence* of an input id but not *ownership* (SA2-175 umbrella; SA2-102, 111, 123, 129, 149, 172, 174, 176–183).

## Every foreign-key id in an input must be ownership-checked

Before any write, link, snapshot, or read that uses an id from `input` (`currencyId`, `roomId`, `tournamentId`, `ringGameId`, `tagIds`, `transactionTypeId`, ids in bulk arrays, cursor ids, …), verify the referenced row belongs to `ctx.session.user.id`.

- **An existence check (`WHERE id = ?`) is not authorization.** The `ringGame`/`tournament` branches of `validateEntityOwnership` had exactly this bug (SA2-111, 174).
- Use the shared helpers in [`packages/api/src/routers/session.ts`](packages/api/src/routers/session.ts): `validateEntityOwnership`, `validateTagsOwnership`, `validateLiveLinkOwnership`. For a new entity type, extend the helper — do not hand-roll a one-off existence query inside the router.
- Entities without a direct `userId` column (e.g. `ring_game` → `room.userId`) must resolve ownership through the full chain; a nullable link in that chain (`roomId = null`) must **fail closed**, not skip the check (SA2-181).

## Bulk / reorder mutations: re-bind every row to the validated parent

Validating `input.tournamentId` and then running `UPDATE … WHERE id = ?` per element of `input.ids` is a write-IDOR — any UUID can be passed in the array. Every per-row `WHERE` must also bind the parent: `WHERE id = ? AND tournament_id = ?` (SA2-123, 176).

## List queries: scope joins and cursor subqueries to the caller

- Every JOIN that can surface another table's columns must carry the `userId` filter — an unfiltered `innerJoin` leaks other users' tag names / type names (SA2-177–179).
- Keyset-pagination cursor subqueries must include the same ownership predicates as the outer query (`AND user_id = ?`), or the cursor becomes an existence/boundary oracle for other users' rows (SA2-182).

## Ownership failures return FORBIDDEN, never NOT_FOUND

Distinguishing "does not exist" from "owned by someone else" is an existence oracle. All ownership helpers throw a uniform `FORBIDDEN` (SA2-183).

## Never fetch user-supplied URLs server-side

`z.string().url()` is not SSRF protection. A Worker fetching arbitrary `input.url` values can be aimed at internal hosts (SA2-170). If a feature genuinely needs remote fetch, allowlist hosts explicitly.

## Self-check for every new/edited procedure

List every id that appears in the input schema. For each one, point to the line where its ownership is validated. If you cannot, the procedure is not done.
