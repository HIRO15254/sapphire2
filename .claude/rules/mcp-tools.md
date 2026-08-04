---
paths:
  - "packages/mcp/**"
  - "packages/api/**"
---

# MCP Tool Layer (packages/mcp)

Why this file exists: the MCP server at `/mcp` is deliberately a **projection of `appRouter`** — its tools must stay byte-identical to the tRPC API contract, and its authorization must be the API's own, never a re-implementation. These rules keep that coupling intact. The file is path-scoped to `packages/api/**` too, because rule 1 fires on backend edits, not MCP edits.

## 1. Backend changes must update the MCP surface in the same task

When a feature adds, changes, or removes an `appRouter` procedure (or its input schema), update `packages/mcp` in the same task: register every new procedure in either `TOOL_DEFINITIONS` (as a tool) or `DELIBERATELY_EXCLUDED` (with a reason) in [`packages/mcp/src/tools/registry.ts`](../../packages/mcp/src/tools/registry.ts), and re-check the affected tool descriptions after schema changes. `coupling.test.ts` enforces this mechanically — a red `bunx vitest run --project mcp` after an API change means the MCP-side registration is missing. *Why: the MCP surface is a projection of the router; an unregistered procedure is an undocumented decision.*

## 2. Tools call `appRouter.createCaller` only — never the DB

Tool handlers go through the tRPC caller so `protectedProcedure` auth and every `validateEntityOwnership` / `validateSessionOwnership` check runs exactly as for HTTP. No `drizzle-orm` or `@sapphire2/db` imports in `packages/mcp/src` at all — the package does not even depend on `@sapphire2/db` (enforced by `scripts/check-rules.ts`, which matches the barrel import too); the one user-row lookup lives in `apps/server`, which passes the loaded row into `buildMcpSession`. *Why: a direct query would bypass the object-level authorization rules in [`api-security.md`](api-security.md).*

## 3. Input schemas are the router's Zod objects — never redefined

A tool's `inputSchema` references the exact schema object the router validates with (named exports from `packages/api/src/routers/*`). Do not write an MCP-local copy, wrapper, or "LLM-friendly" variant. `coupling.test.ts` asserts identity with `toBe`. *Why: two schemas drift; one schema cannot.*

## 4. Every thrown error goes through `mapToolError`

[`packages/mcp/src/lib/errors.ts`](../../packages/mcp/src/lib/errors.ts) is the only translation point. `FORBIDDEN` / `NOT_FOUND` map to fixed, id-free texts — never echo router messages, ids, or `cause` for these codes. *Why: uniform FORBIDDEN prevents existence oracles ([`api-security.md`](api-security.md)); echoing would rebuild the oracle at the MCP layer.*

## 5. Outputs are the HTTP API's JSON, untrimmed

Tool results are `JSON.stringify(procedureResult)` — no column pruning, no reformatting, no date conversion (dates stay unix-seconds inputs / ISO-string outputs, amounts stay integers). If a response is too heavy for LLM consumption, fix it in the router (e.g. a column-selection parameter) so HTTP and MCP stay identical. *Why: "same as the API" is the product requirement; a trimmed variant is a second contract.*

## 6. Adding a tool = registry entry + tests

A new tool needs: a `TOOL_DEFINITIONS` entry (description + mutation hints), the catalogue assertion update in `coupling.test.ts`, and handler coverage in `call.test.ts` if it deviates from plain pass-through. Tool names are the `snake_case` of the procedure path (`session.list` → `session_list`). The one exception is a procedure whose input is a discriminated union: MCP requires `inputSchema.type === "object"`, so each branch becomes its own tool with a suffix naming the branch (`session.create` → `session_create_cash_game` / `session_create_tournament`), and every branch must be covered — `coupling.test.ts` asserts the union's member count matches the tools claiming that path.

## 7. Master-data writes: no deletion, and `destructiveHint` is not decoration

Rooms, ring games, tournaments and the game masters (group / variant / mix) are writable through MCP, but **no `*.delete` is exposed** — existing sessions reference those rows and a delete rewrites history the user cannot recover. Only `ringGame` and `tournament` have an archive/restore counterpart on the router; for rooms and the game masters, creation is exposed with no undo at all, so their descriptions point at the matching list tool first. Adding `room.archive` (etc.) later is what would make an undo exposable — do not reach for `delete` instead. When exposing a new master mutation, set the hints from what the call actually does, not from its name: an in-place edit of a referenced row is `destructiveHint: true, idempotentHint: true`; a create is `false / false`; archive and restore are `false / true` (reversible by their counterpart). If a tool **replaces a child list wholesale** rather than merging it (`tournament.updateWithLevels`, `gameMix.update`), say so in the description — a model that sends a partial list otherwise silently deletes the rest. *Why: `destructiveHint` is what [`toolPermissionSummary()`](../../packages/mcp/src/tools/registry.ts) turns into the "cannot be undone" line on the consent screen, so an understated hint under-represents the grant.*

The same duty covers **every input constraint the JSON Schema cannot carry** — cross-field coupling, an exact shape that must be assembled by joining two other list tools, a field silently frozen by another field's value. The web UI hides these behind pickers; MCP has only the description. Two habits make that description trustworthy, both learned the hard way on `ringGame.*` (`variant` + `mixGames`, which took eight review rounds):

- **Verify a recovery path against the handler before writing it.** "Clear X first" and "rebuild from the current masters" were both written from the shape of the validation rather than from running it, and both were instructions that fail 100% of the time. A wrong recovery path is worse than none — it spends the model's retries and points it away from the real cause.
- **Read the whole description back as one contract.** Individually true sentences still mislead when a later one contradicts a state an earlier one established, or when its stated reason ("because the variant still names a mix") stops holding in a case the description itself introduced.

Say this explicitly when the router's rejection names something other than the real cause — `mixGames` shape errors surface as "references an unavailable game master", which reads like an ownership problem and sends the model hunting for the wrong bug.

## 8. The consent screen describes real capability, not scopes

`buildMcpSession` ignores the token's OAuth scopes, so every issued token grants the whole tool surface. The consent page therefore renders [`toolPermissionSummary()`](../../packages/mcp/src/tools/registry.ts) (derived from `TOOL_DEFINITIONS`) instead of listing scopes, and shows the client's registered redirect hosts. *Why: listing `openid profile` while handing over read+write of the user's data under-represents the grant, and a DCR-registered client can name itself anything — the redirect host is the only trustworthy signal on that screen.* If scopes are ever made load-bearing, enforce them in `callTool` against `toolAnnotations(...).readOnlyHint` and update this rule.
