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

Tool handlers go through the tRPC caller so `protectedProcedure` auth and every `validateEntityOwnership` check runs exactly as for HTTP. No `drizzle-orm` or `@sapphire2/db` imports in `packages/mcp/src` at all — the package does not even depend on `@sapphire2/db` (enforced by `scripts/check-rules.ts`, which matches the barrel import too); the one user-row lookup lives in `apps/server`, which passes the loaded row into `buildMcpSession`. *Why: a direct query would bypass the object-level authorization rules in [`api-security.md`](api-security.md).*

## 3. Input schemas are the router's Zod objects — never redefined

A tool's `inputSchema` references the exact schema object the router validates with (named exports from `packages/api/src/routers/*`). Do not write an MCP-local copy, wrapper, or "LLM-friendly" variant. `coupling.test.ts` asserts identity with `toBe`. *Why: two schemas drift; one schema cannot.*

## 4. Every thrown error goes through `mapToolError`

[`packages/mcp/src/lib/errors.ts`](../../packages/mcp/src/lib/errors.ts) is the only translation point. `FORBIDDEN` / `NOT_FOUND` map to fixed, id-free texts — never echo router messages, ids, or `cause` for these codes. *Why: uniform FORBIDDEN prevents existence oracles ([`api-security.md`](api-security.md)); echoing would rebuild the oracle at the MCP layer.*

## 5. Outputs are the HTTP API's JSON, untrimmed

Tool results are `JSON.stringify(procedureResult)` — no column pruning, reformatting, or date conversion. Date-only values such as `playedOn` are `YYYY-MM-DD` text; timestamp inputs are epoch seconds, and outputs follow the router's JSON serialization. Amounts stay integers. If a response is too heavy for LLM consumption, fix it in the router so HTTP and MCP stay identical.

## 6. Adding a tool = registry entry + tests

A new tool needs: a `TOOL_DEFINITIONS` entry (description + mutation hints), the catalogue assertion update in `coupling.test.ts`, and handler coverage in `call.test.ts` if it deviates from plain pass-through. Tool names are the `snake_case` of the procedure path (for example, `room.list` → `room_list`). MCP requires an object input schema; if a future procedure has a discriminated union input, expose each branch as a separately named tool and extend `coupling.test.ts` to verify every branch is covered. The current test asserts each tool's schema is identical to its procedure's input schema; it does not check union branch coverage.

## 7. Master-data writes: no deletion, `destructiveHint` is not decoration, and the description is the contract

Rooms, ring games, tournaments and game masters (group / variant / mix) are writable through MCP, but **no `*.delete` is exposed**; archive/restore counterparts are exposed instead. Set hints from the actual call. If a tool **replaces a child list wholesale**, say so and verify that the recommended read returns every list the write replaces. Check the read tool's default filters too. *Why: `destructiveHint` feeds [`toolPermissionSummary()`](../../packages/mcp/src/tools/registry.ts) on the consent screen, so an understated hint under-represents the grant.*

The same duty covers **every input constraint the JSON Schema cannot carry** — cross-field coupling, an exact shape that must be assembled by joining two other list tools, or a field constrained by another field. The web UI hides these behind pickers; MCP has only the description. **Verify every claim against the handler and the read tool it names before you push it; the automated reviewer is not the oracle.** Iterating descriptions against review rounds produced a 36-round PR (see [`docs/design/pr-review.md`](../../docs/design/pr-review.md)).

- **Verify a recovery path against the handler before writing it.** Trace it end to end, including guards and required fields inherited from any other tool it uses. A path that writes something no one reads back is not a successful recovery.
- **Read the whole description back as one contract.** Individually true sentences can still contradict each other.
- **Check live references versus immutable snapshots before claiming an edit is retroactive.** Rule versions preserve their saved lineups and stakes; see [`docs/design/game-masters.md`](../../docs/design/game-masters.md). Describe precisely which existing data an update changes.

## 8. The consent screen describes real capability, not scopes

`buildMcpSession` ignores the token's OAuth scopes, so every issued token grants the whole tool surface. The consent page therefore renders [`toolPermissionSummary()`](../../packages/mcp/src/tools/registry.ts) (derived from `TOOL_DEFINITIONS`) instead of listing scopes, and shows the client's registered redirect hosts. *Why: listing `openid profile` while handing over read+write of the user's data under-represents the grant, and a DCR-registered client can name itself anything — the redirect host is the only trustworthy signal on that screen.* If scopes are ever made load-bearing, enforce them in `callTool` against `toolAnnotations(...).readOnlyHint` and update this rule.
