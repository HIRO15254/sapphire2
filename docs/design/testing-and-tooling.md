# Testing and Tooling

This document records decisions behind the test infrastructure. See [`.claude/rules/testing.md`](../../.claude/rules/testing.md) for contract- and risk-based test design, [`testing-environment.ja.md`](../testing-environment.ja.md) for execution commands and the scope of CI and fixtures, and [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) for migration conventions.

Pre-commit runs `vitest run --changed HEAD` when code changes are staged. Passing every changed path to `vitest related` exceeded the Windows argument-length limit during a large merge, so Vitest now obtains the change list from Git. This also includes tests related to unstaged changes; it is not a staged-only check. [Vitest CLI](https://vitest.dev/guide/cli.html#changed)

## The packages/api mock-db contract

[`packages/api/src/__tests__/test-utils.ts`](../../packages/api/src/__tests__/test-utils.ts) supplies shared helpers for schema checks and existing unit tests. SQL, ownership, persistence, and atomicity checks use real D1 through [`test-fixture.ts`](../../packages/api/src/__integration__/test-fixture.ts). Do not extend the existing mocks into a SQL interpreter.

**`createChainableMockDb`** is a minimal chainable Drizzle-style mock `db` for exercising router procedures without a real database. Beyond resolving the rows configured per table, it records the bound params of every join and `where(...)` call on select/update/delete (`selectJoinParams`, `selectWhereParams` / `updateWhereParams` / `deleteWhereParams`) so **ownership scoping can be asserted** (SA2-176, SA2-183). Execution is **eager**, unlike a real DB: an insert is already recorded when `.values()` runs, and `db.batch([...])` just awaits already-resolved statements together (SA2-116).

**`evaluateWhere` is opt-in.** Enabling it makes `where(cond)` actually filter the configured rows through `cond` and `limit(n)` truncate them, so a procedure that pushes its whole predicate into SQL (rather than re-filtering rows in JS) can be exercised — the motivating consumer is `filter-preset.ts`'s `assertNameAvailable`, which does no JS re-filtering. Two deliberate constraints:

- **Only `and` / `or` / `eq` / `ne` are understood; any other operator throws** rather than silently matching, so an enabled mock can never quietly report a filter the query does not really apply.
- **Off by default** because fixtures written before this option assume `where(...)` is a no-op.

**The projection contract (c35).** A `select({ ... })` projection with a single-key aggregate (`{ maxSort: max(table.sortOrder) }`) collapses to one computed row like a real DB would. Every **other** select shape returns the configured rows unchanged — every existing fixture is written keyed by the query's **output** field names (including join projections that alias a joined table's column), so re-deriving keys from the Column reference would break that established convention.

**The mock-placeholder gotcha.** The mock's post-insert lookup does **not** filter by the freshly inserted id, so a create-path test whose procedure re-reads the row after inserting must seed a dummy pre-existing row for that table — otherwise the lookup resolves to nothing and the procedure's post-insert branch is silently never exercised.

## Seed tests: module replacement

A test that `vi.mock`s the seed-constants module gets its own file, because the mock is module-wide. The two dedicated specs exist precisely because the real `DEFAULT_GAME_*` data cannot express their scenarios: [`seed-game-data-chunking.test.ts`](../../packages/api/src/__tests__/seed-game-data-chunking.test.ts) needs a mix wide enough to overflow D1's 100-bind-param cap, and [`seed-game-data-unresolvable-variant.test.ts`](../../packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts) needs a mix whose `variantKeys` do not all resolve to a seeded variant.

## Web test gotchas

### vi.mock factory hoisting (TDZ)

`vi.mock()` factories are hoisted **before** variable declarations, so a factory that closes over a module-scope `const` throws a baffling TDZ `ReferenceError` at runtime. Create every `vi.fn()` inline inside the factory, or via `vi.hoisted` (AGENTS.md's mocking conventions).

### The trpc/env stub pattern

Importing `@/utils/trpc` loads environment validation and the real client. Unit tests of isolated state may mock the required network dependencies; UI integration exercises the real client, QueryClient, and forms with MSW controlling HTTP responses. Configure the environment with test URLs instead of requiring every jsdom test to replace the client. See [`web-platform.md`](web-platform.md) for the lazy environment proxy.

[`integration.tsx`](../../apps/web/src/__tests__/integration.tsx) uses the standard tRPC fetch adapter for batching and serialization, and creates independent memory history for each screen. Since jsdom has no animation timeline, this renderer sets animation-name to none so Radix Presence does not wait for an animationend event that cannot occur. These checks do not verify actual animations or layout.

### createTrpcMock and the queryKey shape

[`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) exposes `createTrpcMock()`: an auto-materializing mock of the tRPC client/proxy shape — access any path (`mock.currency.list.query`) and receive a typed `vi.fn()`. Two contracts around it:

- A test that hand-mocks `queryOptions` must return a **stable queryKey of shape `[namespace, procedure, input]`** so key-derivation helpers (e.g. `getSessionQueryKeys`) resolve predictable keys, and must import the module under test **after** `vi.mock` so it picks up the mocked trpc.
- For hooks driven by a **real** QueryClient, the mocked `list.queryOptions(input)` must build an input-scoped queryKey plus a queryFn forwarding the input, so the real QueryClient can seed cache entries and refetch predictably per `screenKey`.

### Rollback and overlapping mutations

An `onSettled` refetch that returns the recovered value can conceal a missing rollback. Rollback tests hold that refetch pending, inspect the real QueryClient immediately after failure, then release the response. Returning the expected recovery value from queryFn alone is not evidence that rollback works.

`beginOptimisticQueryUpdate` keeps operations on one query in submission order and reapplies them without failed operations. Even a create without an optimistic row joins the group, because its completion refetch could otherwise erase a pending edit or deletion. Writers cancel existing queries before starting, use synchronous immutable cache updates with deterministic values, and settle from `onSettled`. Only the last settlement requests the final refetch.

Session creates retain one temporary ID and timestamp across replays. On confirmation, `replaceApply` replaces that operation's projection and immediately rebuilds the group from the latest baseline. The confirmed projection inserts only when no page already contains the server-assigned ID; an existing server row retains its joined fields. Settled, removed, and previously discarded projections cannot be replaced. Replacement exceptions use the same isolation as other replay failures. A mutation context retains its starting query key so a filter change does not redirect final invalidation to a different list.

The rollback baseline follows successful query responses and authoritative cache replacements rather than remaining frozen at the first mutation. A query-cache subscription reapplies the active projections over that baseline, preserving server changes to other rows and fields during focus, reconnect, or manual refetches. The group suppresses its own cache events while restoring or replaying data. Other optimistic writers must join the group; an external cache replacement is treated as authoritative data, not another unregistered projection.

Infinite queries need one additional distinction: `fetchNextPage` and `fetchPreviousPage` copy existing cache pages, which may already contain optimistic values. For a successful fetch marked by TanStack Query's `fetchMore` metadata, the helper retains the baseline of existing pages by `pageParams` and adds the newly fetched page. A normal refetch replaces the full baseline. This preserves loaded pages and their envelopes without absorbing optimistic values into rollback data or disabling pagination. The implementation covers ordinary query data and TanStack `InfiniteData`; it does not infer arbitrary JSON patches or merge concurrent server writes.

An initial apply exception restores the immediately preceding cache and does not register the failed operation. If a projection becomes invalid while replaying newer server data, its partial writes are restored and only that projection is discarded; its actual mutation still participates in settlement and final invalidation. This keeps a successful fetch from becoming an error because an optimistic projection could not replay. Query removal releases the group immediately. After final settlement, an in-flight fetch retains the subscription until it succeeds, fails, or is cancelled: a late page response can still contain optimistic pages captured before rollback, especially after the screen becomes inactive. Without an in-flight fetch, final settlement releases the group immediately. Repeated settlement, including an old handle after the same query is recreated, has no effect and returns false. See [web-data-fetching.md](../../.claude/rules/web-data-fetching.md) for the caller contract.

## Deterministic time in tests

**`withTz`** ([`apps/web/src/__tests__/tz.ts`](../../apps/web/src/__tests__/tz.ts)) provides deterministic time-zone control for date-formatting tests (SA2-145 — CI/local divergence). Node/Bun re-reads `process.env.TZ` on every `Date` operation, so wrapping an assertion in `withTz` exercises a specific zone regardless of the host machine. Design points:

- The pristine host zone is captured once at module load and restored in a `finally`, so a test can never leak a zone into sibling files sharing the same worker.
- **When the host had no `TZ` set, the restore must actually delete the variable.** `process.env.TZ = undefined` coerces to the string `"undefined"`, which Node treats as an invalid zone and silently falls back to UTC (SA2-145) — leaking instead of restoring the pristine "no TZ" state. `Reflect.deleteProperty` is used because `lint/performance/noDelete` forbids the `delete` operator.
- Canonical zones: `TZ_WEST = "America/Los_Angeles"` (reproduces the original off-by-one bug), `TZ_EAST = "Asia/Tokyo"`, plus UTC itself.

The `mcp` Vitest project pins `env: { TZ: "Asia/Tokyo" }` for the same reason: date assertions must not depend on the host timezone, and a non-UTC zone makes any accidental local-getter usage fail loudly ([`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)).

**Expiry fixtures are relative, never fixed dates.** `buildMcpSession` rejects expired tokens, so a hard-coded future timestamp turns the whole suite red once the clock passes it — fixtures compute expiry relative to `Date.now()`.

## bun:sqlite migration tests

Migration specs (`packages/db/src/__tests__/migration-*.test.ts`, `preview-seed-restore.test.ts`) run against `bun:sqlite` — a real SQLite engine, matching what D1 executes. `bun:sqlite` is only available in the Bun runtime, so CI runs these files in a dedicated **`bun test` step** ("Test migrations with Bun SQLite" in [`ci.yml`](../../.github/workflows/ci.yml)), while a `skipIfNotBun` guard makes Vitest's Node projects intentionally skip the bodies — the skip that creates the silent-green hole `scripts/check-rules.ts` closes (see below). Every such spec needs the fixed two-directive import waiver — TypeScript has no `bun:sqlite` types under the workspace's Node-flavored config, and the `Bun` global only exists at runtime in Bun:

```ts
// @ts-expect-error -- bun:sqlite only exists in the Bun runtime.
// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
```

The shared `applyThrough(marker)` helper applies only the statements up to and including the first one matching `marker`, **without** a transaction — exactly the state a production apply that dies mid-file leaves behind (`wrangler` streams statements and records the migration only after the last succeeds). The rules these specs pin — mid-file death, abort-proof backfills, self-healing retry — live in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md).

## The preview/dev seed-restore pipeline tests

[`preview-seed-restore.test.ts`](../../packages/db/src/__tests__/preview-seed-restore.test.ts) pins the semantics of a pipeline that lives in **two hand-copied workflow siblings**: `preview-deploy.yml` (new preview DB) and `dev-deploy.yml` (every deploy — the dev DB is dropped and recreated each time) both seed a brand-new D1 by applying every migration and then replaying a `--no-schema` dump of production. The trigger-collision story and the stash design are owned by [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md); `bun run check:rules` separately asserts that every workflow performing the restore carries the stash. What the test file adds:

- **It pins both halves of the fix**: the collision is real (so nobody "simplifies" the trigger stash away), and stashing the triggers around the restore keeps the dump the single source of truth without leaving the DB permanently trigger-less. `readTriggers` in the test is **the exact query the seed steps run**; a post-seed write must still fire the compat trigger — the stash is scoped to the restore, not a permanent disarm.
- **The 0049-naming caveat.** Only the first test case names 0049's compat triggers; when the contract migration drops the legacy `games` mirror, that case stops throwing. The fix is to re-point it at whatever derived-table trigger remains (or delete the file once none do) — **not** to conclude the stash is unnecessary. Every other case reads live triggers out of `sqlite_master` and never names 0049.
- **Re-arm idempotency.** The workflows' re-arm file is `cat drop-triggers.sql restore-triggers.sql` — the drops are what make it idempotent. SQLite strips `IF NOT EXISTS` before storing DDL in `sqlite_master`, so the read-back CREATEs alone would abort on the first surviving trigger — and `wrangler d1 execute --file` stops there, skipping every CREATE behind it.

## scripts/check-rules.ts

[`scripts/check-rules.ts`](../../scripts/check-rules.ts) holds the deterministic conformance checks for the rules in AGENTS.md and `.claude/rules/*.md`. It runs in CI ([`ci.yml`](../../.github/workflows/ci.yml)), the Claude Code Stop hook, and manually via `bun run check:rules`.

**Standing invariant: only currently-green checks may live in the file.** A red check would block every turn (the Stop hook runs it after each Claude Code turn). Checks for known-but-unfixed issues wait here until their Linear issues are fixed — currently the ColorBadge / PlayerAvatar wrapper bans (SA2-112, SA2-119).

### Matching soundness (excludeLine × multiline)

Each pattern is tested against the whole file first — so multiline patterns can match — and then per line for reporting; `excludeLine` filters individual line hits. A file that matched as a whole while **no single line matched** is reported as a genuine multiline violation. The guard for that fallback is "no line matched at all", not "the check has no excludeLine": this stays sound when a check combines an `excludeLine` with a multiline pattern — a file whose every hit line is excluded is not reported, but a real cross-line hit still is.

### The bun:sqlite listing check

`bun:sqlite` spec bodies sit behind `skipIfNotBun`, so Vitest reports them as *skipped*, not failed — a spec also missing from ci.yml's dedicated `bun test` step **runs nowhere and reports green**. The check is a **cross-file existence assertion** (every `{apps,packages}/**/__tests__/*.test.ts` mentioning `bun:sqlite` must be named in the step), which is why it lives outside the file's generic `CHECKS` table. The glob spans **every workspace**, not just `packages/db`: tests are colocated next to code, so the next bun:sqlite spec plausibly lands in some other `__tests__/`, and `*` does not cross `/` — a narrower glob would let such a spec escape both this check and the `bun test` step, the exact hole the check exists to close.

### The D1 trigger-stash check (delta beyond db-migrations.md)

- **It matches on the restore itself** (`--file=dump.sql`), not on a workflow allowlist — the seed step is a hand-copied sibling across `preview-deploy.yml` / `dev-deploy.yml`, and a copy is precisely what prose cannot keep in sync, so matching the restore marker catches the *next* copy of the step too.
- **The three stash markers are asserted separately** because each is a distinct half of the fix; in particular a workflow that dropped without re-arming would leave the DB permanently trigger-less, so a missing re-arm must fail on its own.
- Implementation trap: `dot: true` on the Glob scan is load-bearing — Bun's `Glob` skips dot-directories by default, so without it the scan of `.github/` yields an empty set and the check reports green forever.

### Regex-design deltas

- **Inline model-id check** (the rule and its why are owned by [`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md)): it bans **quoted `claude-*` literals wholesale** rather than enumerating generation names — an enumeration would miss the old digit-first id format (`claude-3-5-sonnet-20241022`). Requiring the quotes keeps `.claude/rules/...` paths and prose out of scope; workflow YAML is excluded because `--model opus` is a movable alias, not a pinned ID.
- **MCP direct-DB-import check** ([`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2 owns the rule): the pattern matches the `@sapphire2/db` **prefix**, so barrel imports (`createDb` / schema re-exports) are blocked as well as subpath imports — matching subpaths only would let the bare barrel import pass.
