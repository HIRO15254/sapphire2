---
paths:
  - "packages/mcp/**"
  - "packages/api/**"
---

# MCP Tool Layer (packages/mcp)

Why this file exists: the MCP server at `/mcp` is deliberately a **projection of `appRouter`** — its tools must stay byte-identical to the tRPC API contract, and its authorization must be the API's own, never a re-implementation. These rules keep that coupling intact. The file is path-scoped to `packages/api/**` too, because rule 1 fires on backend edits, not MCP edits.

## 1. Backend changes must update the MCP surface in the same task

When a feature adds, changes, or removes an `appRouter` procedure (or its input schema), update `packages/mcp` in the same task: register every new procedure in either `EXPOSED` (as a tool) or `DELIBERATELY_EXCLUDED` (with a reason) in [`packages/mcp/src/tools/registry.ts`](../../packages/mcp/src/tools/registry.ts), and re-check the affected tool descriptions after schema changes. `coupling.test.ts` enforces this mechanically — a red `bunx vitest run --project mcp` after an API change means the MCP-side registration is missing. *Why: the MCP surface is a projection of the router; an unregistered procedure is an undocumented decision.*

## 2. Tools call `appRouter.createCaller` only — never the DB

Tool handlers go through the tRPC caller so `protectedProcedure` auth and every `validateEntityOwnership` / `validateSessionOwnership` check runs exactly as for HTTP. No `drizzle-orm` or `@sapphire2/db/schema` imports in `packages/mcp/src` (enforced by `scripts/check-rules.ts`); the one user-row lookup lives in `apps/server`, which passes the loaded row into `buildMcpSession`. *Why: a direct query would bypass the object-level authorization rules in [`api-security.md`](api-security.md).*

## 3. Input schemas are the router's Zod objects — never redefined

A tool's `inputSchema` references the exact schema object the router validates with (named exports from `packages/api/src/routers/*`). Do not write an MCP-local copy, wrapper, or "LLM-friendly" variant. `coupling.test.ts` asserts identity with `toBe`. *Why: two schemas drift; one schema cannot.*

## 4. Every thrown error goes through `mapToolError`

[`packages/mcp/src/lib/errors.ts`](../../packages/mcp/src/lib/errors.ts) is the only translation point. `FORBIDDEN` / `NOT_FOUND` map to fixed, id-free texts — never echo router messages, ids, or `cause` for these codes. *Why: uniform FORBIDDEN prevents existence oracles ([`api-security.md`](api-security.md)); echoing would rebuild the oracle at the MCP layer.*

## 5. Outputs are the HTTP API's JSON, untrimmed

Tool results are `JSON.stringify(procedureResult)` — no column pruning, no reformatting, no date conversion (dates stay unix-seconds inputs / ISO-string outputs, amounts stay integers). If a response is too heavy for LLM consumption, fix it in the router (e.g. a column-selection parameter) so HTTP and MCP stay identical. *Why: "same as the API" is the product requirement; a trimmed variant is a second contract.*

## 6. Adding a tool = registry entry + tests

A new tool needs: an `EXPOSED` entry (description + mutation hints), the catalogue assertion update in `coupling.test.ts`, and handler coverage in `call.test.ts` if it deviates from plain pass-through. Tool names are derived `snake_case` of the procedure path (`session.list` → `session_list`).
