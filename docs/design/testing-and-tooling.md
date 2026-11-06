# Testing and Tooling

This document owns test mechanisms and rationale. See [`.claude/rules/testing.md`](../../.claude/rules/testing.md) for contract- and risk-based test rules, [`testing-environment.ja.md`](../testing-environment.ja.md) for setup, commands and diagnostics, and [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) for migration conventions.

Pre-commit delegates changed-test selection to Vitest rather than passing every changed path to `vitest related`: the latter exceeded the Windows argument-length limit during a large merge. Git-based selection also includes tests related to unstaged changes; it is not staged-only. Hook obligations live in the [testing rules](../../.claude/rules/testing.md#placement-shared-helpers-and-execution). [Vitest CLI](https://vitest.dev/guide/cli.html#changed)

## API/D1 integration and browser infrastructure

### Local Miniflare/D1

Integration tests use local Miniflare/D1 with the repository's real migrations. Local D1 does not prove production distributed behavior. The [historical testing record](../archive/testing-and-tooling-history.md) describes the infrastructure selection and migration.

### Isolation and HTTP boundaries

The API [fixture](../../packages/api/src/__integration__/test-fixture.ts) creates and disposes a non-persistent Miniflare D1 database per case, using [the real migrations](../../packages/api/src/__integration__/test-database.ts). Its typed session caller tests SQL and router behavior, not Cookie or OAuth authentication. Those boundaries go through [`worker-http.ts`](../../packages/api/src/__integration__/worker-http.ts), which sends real HTTP requests to the server Worker's Hono app bound to the same D1 database and carries cookies between them; tests stub only the external IdP's token endpoint.

The browser [server harness](../../testing/serve-e2e.ts) bundles the production Worker entrypoint with Wrangler's dry-run build and serves the Web test build over HTTPS. API and Web use `https://localhost:18787` and `https://localhost:13001`: separate origins on the same site exercise Cookie attributes and CORS without weakening production settings. Test Chromium accepts the local self-signed certificate, including Service Worker fetches. This does not cover cross-site third-party Cookie restrictions, real external IdPs, physical biometric prompts, or a deployed PWA upgrade.

Both harnesses use [worker-compatibility.ts](../../testing/worker-compatibility.ts) to read only the production Wrangler compatibility date and flags, not production DB bindings or credentials. A missing date fails explicitly; suppressed Wrangler warnings avoid starting its external update check. Miniflare disables external metadata retrieval (`cf: false`), and the browser Worker's unknown outbound requests return 502. `.test-runtime/` holds bundles, not a persistent development D1. The Web build's test mode injects fixed release data instead of fetching GitHub.

Playwright's [configuration](../../playwright.config.ts) partitions the E2E specs between Desktop Chrome and Pixel 7, with two workers, no retries, and a separate browser `Asia/Tokyo` timezone. The harness owns process shutdown, including on Windows, and refuses to reuse an existing server. The real-account [fixtures](../../e2e/fixtures.ts) and [persistence spec](../../e2e/persistence.spec.ts) exercise authentication, built Service Worker and IndexedDB; the [passkey spec](../../e2e/passkeys.spec.ts) uses a CTAP2 CDP virtual authenticator with resident keys and user verification, exercising real registration, signatures and server checks rather than device UI.

### Discovery, CI and measurement

Vitest is the sole unit, migration and API-integration runner. Root [configuration](../../vitest.config.ts) registers workspace and infrastructure projects; [scripts](../../package.json) exclude only `api-integration` from `test:unit`, so new registered projects are not silently omitted by a fixed allowlist. [Discovery checking](../../testing/check-discovery.ts) compares specs under `apps/`, `packages/`, `scripts/` and `testing/` with Vitest discovery, and E2E specs with their Playwright assignments.

The reusable [checks.yml](../../.github/workflows/checks.yml) separates static checks, unit coverage, D1 integration and browser jobs. The caller workflows own aggregate deployment gating. Unit coverage includes unimported application sources but not the separate workerd process; it is not Worker-wide coverage. CI retains coverage and browser artifacts even after failure. The [run guide](../testing-environment.ja.md) owns commands and diagnostic locations.

## The packages/api mock-db contract

[`packages/api/src/__tests__/test-utils.ts`](../../packages/api/src/__tests__/test-utils.ts) supplies shared helpers for schema checks and existing unit tests. SQL, ownership, persistence, and atomicity checks use real D1 through [`test-fixture.ts`](../../packages/api/src/__integration__/test-fixture.ts). Do not extend the existing mocks into a SQL interpreter.

**`createChainableMockDb`** is a minimal chainable Drizzle-style mock `db` for exercising router procedures without a real database. Beyond resolving the rows configured per table, it records the bound params of every join and `where(...)` call on select/update/delete (`selectJoinParams`, `selectWhereParams` / `updateWhereParams` / `deleteWhereParams`), allowing assertions about predicate construction, not proof of SQL authorization. Execution is **eager**, unlike a real DB: an insert is already recorded when `.values()` runs, and `db.batch([...])` just awaits already-resolved statements together.

**The projection contract.** A `select({ ... })` projection with a single-key aggregate (`{ maxSort: max(table.sortOrder) }`) collapses to one computed row like a real DB would. Every **other** select shape returns the configured rows unchanged — fixtures are keyed by the query's **output** field names, including join aliases.

**The mock-placeholder gotcha.** The mock's post-insert lookup does **not** filter by the freshly inserted id, so a create-path test whose procedure re-reads the row after inserting must seed a dummy pre-existing row for that table — otherwise the lookup resolves to nothing and the procedure's post-insert branch is silently never exercised.

## Seed tests: module replacement

A test that `vi.mock`s the seed-constants module gets its own file, because the mock is module-wide. [`seed-game-data-unresolvable-variant.test.ts`](../../packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts) supplies a mix whose `variantKeys` do not all resolve to a seeded variant. [`batch.test.ts`](../../packages/api/src/__tests__/batch.test.ts) covers chunk arithmetic.

## Web test gotchas

### vi.mock factory hoisting (TDZ)

`vi.mock()` factories are hoisted **before** variable declarations, so a factory that closes over a module-scope `const` throws a baffling TDZ `ReferenceError` at runtime. Create every `vi.fn()` inline inside the factory, or via `vi.hoisted` (AGENTS.md's mocking conventions).

### The trpc/env stub pattern

Importing `@/utils/trpc` loads environment validation and the real client. Unit tests of isolated state may mock the required network dependencies; UI integration exercises the real client, QueryClient, and forms and controls only the HTTP boundary. Configure the environment with test URLs instead of requiring every jsdom test to replace the client. See [`web-platform.md`](web-platform.md) for the lazy environment proxy.

The screen-integration helpers live in [`integration.tsx`](../../apps/web/src/__tests__/integration.tsx). `trpcHttpHandler` passes intercepted `/trpc/*` requests to a supplied test router through the tRPC fetch adapter, preserving batching and serialization; the test owns the router and MSW server lifecycle, including resetting handlers and rejecting unhandled frames with `server.listen({ onUnhandledFrame: "error" })`. `renderIntegrationPage` wraps a page in the supplied per-test QueryClient and a fresh memory router. Since jsdom has no animation timeline, it also sets animation-name to none so Radix Presence does not wait for an animationend event that cannot occur; such checks do not verify actual animations or layout. The handler's empty context is for test routers, not production authentication or database integration.

[`trpc-keys.ts`](../../apps/web/src/__tests__/trpc-keys.ts) exposes keys from the real typed tRPC options proxy for cache tests; its client has no transport links and is not for making requests.

### Rollback and overlapping mutations

An `onSettled` refetch that returns the recovered value can conceal a missing rollback. Rollback tests hold that refetch pending, inspect the real QueryClient immediately after failure, then release the response. Returning the expected recovery value from queryFn alone is not evidence that rollback works.

`beginOptimisticQueryUpdate` keeps operations on one query in submission order and reapplies them without failed operations. Even a create without an optimistic row joins the group, because its completion refetch could otherwise erase a pending edit or deletion. Writers cancel existing queries before starting, use synchronous immutable cache updates with deterministic values, and settle from `onSettled`. Only the last settlement requests the final refetch.

A create retains one temporary ID and timestamp across replays. On confirmation, `replaceApply` replaces that operation's projection and immediately rebuilds the group from the latest baseline. The confirmed projection should insert only when no page already contains the server-assigned ID, so an existing server row retains its joined fields. Settled, removed, and previously discarded projections cannot be replaced. Replacement exceptions use the same isolation as other replay failures.

Projection and rollback use the query selected when the mutation starts. Final invalidation follows the affected data, independently of the current selection. When cached variants of one procedure can overlap — a row written under one filter can also belong to the filter selected before completion — writes invalidate the procedure prefix, marking all cached variants stale and refetching active ones; a pending group on another variant reapplies its own projections over that refetch. When variants are disjoint, such as lists scoped to different parents, the mutation context retains the starting key for targeted invalidation instead of refetching an unrelated selected variant.

The procedure prefix comes from `pathKey()` or `pathFilter()`, not `queryKey()`. The installed tRPC options proxy includes `type: "query"` in ordinary query keys and `type: "infinite"` in infinite keys; TanStack's partial matching treats them as distinct even without an input filter. Invalidation tests use the real options proxy for keys and control only query responses. A screen-integration fixture should return joined fields only after the successful write is refetched, so an optimistic ID replacement alone cannot satisfy its list assertion.

The rollback baseline follows successful query responses and authoritative cache replacements rather than remaining frozen at the first mutation. A query-cache subscription reapplies the active projections over that baseline, preserving server changes to other rows and fields during focus, reconnect, or manual refetches. The group suppresses its own cache events while restoring or replaying data. Other optimistic writers must join the group; an external cache replacement is treated as authoritative data, not another unregistered projection.

Infinite queries need one additional distinction: `fetchNextPage` and `fetchPreviousPage` copy existing cache pages, which may already contain optimistic values. For a successful fetch marked by TanStack Query's `fetchMore` metadata, the helper retains the baseline of existing pages by `pageParams` and adds the newly fetched page. A normal refetch replaces the full baseline. This preserves loaded pages and their envelopes without absorbing optimistic values into rollback data or disabling pagination. The implementation covers ordinary query data and TanStack `InfiniteData`; it does not infer arbitrary JSON patches or merge concurrent server writes.

An initial apply exception restores the immediately preceding cache and does not register the failed operation. If a projection becomes invalid while replaying newer server data, its partial writes are restored and only that projection is discarded; its actual mutation still participates in settlement and final invalidation. This keeps a successful fetch from becoming an error because an optimistic projection could not replay. Query removal releases the group immediately. After final settlement, an in-flight fetch retains the subscription until it succeeds, fails, or is cancelled: a late page response can still contain optimistic pages captured before rollback, especially after the screen becomes inactive. Without an in-flight fetch, final settlement releases the group immediately. Repeated settlement, including an old handle after the same query is recreated, has no effect and returns false. See [web-data-fetching.md](../../.claude/rules/web-data-fetching.md) for the caller contract.

## Deterministic time in tests

**`withTz`** ([`apps/web/src/__tests__/tz.ts`](../../apps/web/src/__tests__/tz.ts)) provides deterministic time-zone control for date-formatting tests. Node/Bun re-reads `process.env.TZ` on every `Date` operation, so wrapping an assertion in `withTz` exercises a specific zone regardless of the host machine. Design points:

- The pristine host zone is captured once at module load and restored in a `finally`, so a test can never leak a zone into sibling files sharing the same worker.
- **When the host had no `TZ` set, the restore must actually delete the variable.** `process.env.TZ = undefined` coerces to the string `"undefined"`, which Node treats as an invalid zone and silently falls back to UTC. `Reflect.deleteProperty` is used because `lint/performance/noDelete` forbids the `delete` operator.
- Canonical zones: `TZ_WEST = "America/Los_Angeles"`, `TZ_EAST = "Asia/Tokyo"`, plus UTC itself.

The root [`vitest.config.ts`](../../vitest.config.ts) sets `process.env.TZ = "Asia/Tokyo"` before any project starts, for the same reason: date assertions must not depend on the host timezone, and a non-UTC zone makes any accidental local-getter usage fail loudly ([`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)). It is the single pin for every Vitest project, locally and in CI; Playwright's `timezoneId` separately sets the emulated browser zone.

**Expiry fixtures are relative, never fixed dates.** `buildMcpSession` rejects expired tokens, so a hard-coded future timestamp turns the whole suite red once the clock passes it — fixtures compute expiry relative to `Date.now()`.

## node:sqlite migration tests

Migration specs (`packages/db/src/__tests__/migration-*.test.ts`, `preview-seed-restore.test.ts`) run against `node:sqlite` — a real SQLite engine, matching what D1 executes — inside the ordinary `db` Vitest project, so they are discovered, type-checked, and reported like every other test.

[`sqlite.ts`](../../packages/db/src/__tests__/sqlite.ts) is the shared harness: `openDatabase()`, migration listing and `--> statement-breakpoint` splitting, and typed row accessors. Differences from `bun:sqlite` that a ported or new spec must respect:

- `DatabaseSync` enforces foreign keys by default; `openDatabase()` passes `enableForeignKeyConstraints: false` so D1-style table rebuilds behave as before, and specs that need enforcement run `PRAGMA foreign_keys=ON` themselves.
- Array rows come from `statement.setReturnArrays(true)` (`rowValues`); a missing row is `undefined`, not `null`; there is no `db.transaction()` (use `BEGIN`/`COMMIT`/`ROLLBACK`) and no statement cache (`db.query()`).

The harness needs Node 22.16 or later (`setReturnArrays`; `node:sqlite` itself is unflagged from 22.13). `engines.node` sets a higher floor (`^22.22.2 || >=24.15.0`, Ultracite's requirement), and CI runs the `.node-version` release. Node 22 prints an `ExperimentalWarning` for `node:sqlite`; the warning is expected.

The `applyThrough(db, marker)` helpers in [migration-0049.test.ts](../../packages/db/src/__tests__/migration-0049.test.ts) and [migration-0050.test.ts](../../packages/db/src/__tests__/migration-0050.test.ts) apply statements through the first match **without** a transaction, modelling the committed prefix left by a failed production migration. Replay-safe migrations use them to test self-healing retry under the [migration rules](../../.claude/rules/db-migrations.md#a-migration-file-is-not-one-transaction-in-production). The [frozen v2 cutover](../archive/data-model-v2-history.md#164-migration-authorship-and-abort-gates) instead uses restore-and-fix; that exception applies to its migration chain, not future migrations.

## The preview/dev seed-restore pipeline tests

[`preview-seed-restore.test.ts`](../../packages/db/src/__tests__/preview-seed-restore.test.ts) checks that a production-style dump replays without any trigger deriving rows. The preview and dev workflows still stash and re-arm any live triggers around the restore; [`db-migrations.md`](../../.claude/rules/db-migrations.md) describes the generic safeguard, which `bun run check:rules` also checks.
- **Re-arm idempotency.** The workflows' re-arm file is `cat drop-triggers.sql restore-triggers.sql` — the drops are what make it idempotent. SQLite strips `IF NOT EXISTS` before storing DDL in `sqlite_master`, so the read-back CREATEs alone would abort on the first surviving trigger — and `wrangler d1 execute --file` stops there, skipping every CREATE behind it.

## scripts/check-rules.ts

[`scripts/check-rules.ts`](../../scripts/check-rules.ts) holds the deterministic conformance checks for the rules in AGENTS.md and `.claude/rules/*.md`. It runs in CI ([`checks.yml`](../../.github/workflows/checks.yml)), the Claude Code Stop hook, and manually via `bun run check:rules`.

**Standing invariant: only currently-green checks may live in the file.** A red check would block every turn (the Stop hook runs it after each Claude Code turn). Checks for known-but-unfixed issues wait here until their Linear issues are fixed.

### Matching soundness (excludeLine × multiline)

Each pattern is tested against the whole file first — so multiline patterns can match — and then per line for reporting; `excludeLine` filters individual line hits. A file that matched as a whole while **no single line matched** is reported as a genuine multiline violation. The guard for that fallback is "no line matched at all", not "the check has no excludeLine": this stays sound when a check combines an `excludeLine` with a multiline pattern — a file whose every hit line is excluded is not reported, but a real cross-line hit still is.

### The D1 trigger-stash check (delta beyond db-migrations.md)

- **It matches on the restore itself** (`--file=dump.sql`), not on a workflow allowlist — the seed step is a hand-copied sibling across `preview-deploy.yml` / `dev-deploy.yml`, and a copy is precisely what prose cannot keep in sync, so matching the restore marker catches the *next* copy of the step too.
- **The three stash markers are asserted separately** because each is a distinct half of the fix; in particular a workflow that dropped without re-arming would leave the DB permanently trigger-less, so a missing re-arm must fail on its own.
- Implementation trap: `dot: true` on the Glob scan is load-bearing — Bun's `Glob` skips dot-directories by default, so without it the scan of `.github/` yields an empty set and the check reports green forever.

### Regex-design deltas

- **Inline model-id check** (the rule and its why are owned by [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md)): it bans **quoted `claude-*` literals wholesale** rather than enumerating generation names — an enumeration would miss the old digit-first id format (`claude-3-5-sonnet-20241022`). Requiring the quotes keeps `.claude/rules/...` paths and prose out of scope; workflow YAML is excluded because its `--model claude-opus-5-5` flag is an unquoted CLI argument, pinned there so a stale CLI alias cannot silently run the review on an older Opus.
- **MCP direct-DB-import check** ([`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2 owns the rule): the pattern matches the `@sapphire2/db` **prefix**, so barrel imports (`createDb` / schema re-exports) are blocked as well as subpath imports — matching subpaths only would let the bare barrel import pass.
