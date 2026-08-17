# Testing and Tooling

Design rationale for the repo's test infrastructure and mechanical tooling: the Vitest project topology, the `packages/api` mock-db contract, web-side test gotchas, deterministic time, the `bun:sqlite` migration-test mechanics, the preview/dev seed-restore pipeline tests, MCP/server test doctrine, and `scripts/check-rules.ts`. The TDD workflow, quality bar, and per-project run commands live in [`AGENTS.md`](../../AGENTS.md) (Testing section); migration-authoring rules live in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md). This doc records the *why* behind the shared infrastructure those documents point at.

## Vitest project topology

The web workspace is split into two Vitest projects so pure-function tests never pay the jsdom boot cost:

- **`web-dom`** ([`apps/web/vitest.dom.config.ts`](../../apps/web/vitest.dom.config.ts)) — jsdom: React component rendering, `renderHook`, DOM APIs (matchMedia, navigator, Tiptap, TanStack Router, authClient side effects). `isolate: true` (the default) stays **on** here because tests rely on per-file module mocks via `vi.mock`. With `isolate: false`, mocks for the same module (e.g. `@/lib/auth-client`) collide between the `use-sign-in` and `use-sign-up` test files and the last-write-wins shape breaks earlier tests.
- **`web-node`** ([`apps/web/vitest.node.config.ts`](../../apps/web/vitest.node.config.ts)) — pure utility tests (formatters, Zod schemas, helpers that do not touch the DOM). `isolate: false` reuses a single worker across files to amortize import cost; safe here because every test mocks via `vi.mock` at module scope and resets state in `beforeEach`. Inclusion is a single broad glob covering **all** feature-local pure-helper tests — a per-feature enumeration kept silently dropping new features (the rooms utils tests were never running). A "pure" helper that touches `navigator`/clipboard runs in the `web-dom` project instead.

The `mcp` project ([`packages/mcp/vitest.config.ts`](../../packages/mcp/vitest.config.ts)) pins `env: { TZ: "Asia/Tokyo" }`: date assertions must not depend on the host timezone, and a non-UTC zone makes any accidental local-getter usage fail loudly (aligning with [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md)'s UTC-getters rule).

## The packages/api mock-db contract

[`packages/api/src/__tests__/test-utils.ts`](../../packages/api/src/__tests__/test-utils.ts) is the single home of the router-test infrastructure. Its helpers exist to keep every router test file concise and consistent; extend this file rather than hand-rolling a new pattern per test (AGENTS.md).

**Procedure-shape helpers.** They lean on the runtime shape of a tRPC v11 procedure: `procedure._def.inputs` is a Zod schema array (first element is the top-level schema), `procedure._def.middlewares` is the middleware chain, `procedure._def.type` is `"mutation" | "query" | "subscription"`. A protected procedure has the base resolver + the protection middleware (plus an input/query/mutation middleware); public procedures have exactly 1 middleware — that count difference is what `expectProtected` asserts.

**`createChainableMockDb`** is a minimal chainable Drizzle-style mock `db` for exercising router procedures/helpers end-to-end without a real database:

- `select(projection?)` chains (`.from().where().limit().orderBy()`) resolve to the rows configured for the table passed to `.from(table)` (matched via `getTableName`), narrowed/aggregated through `projection` when one is given; `insert(table).values(rows)` records the inserted payload.
- It tracks which tables were read (`selectedTables`), every `limit(...)` argument (`selectLimits`), and the bound params of every join and `where(...)` call on select/update/delete (`selectJoinParams`, `selectWhereParams` / `updateWhereParams` / `deleteWhereParams`) so **ownership scoping can be asserted** (SA2-176, SA2-183), and which tables were written (`inserted`).
- The chain is a real Promise (so `await`-ing any step resolves the rows natively) with Drizzle's builder methods attached. Non-terminal steps (`where` / `limit` / `orderBy` / joins) return a chain again — a fresh one when `evaluateWhere` narrowed the rows, otherwise the same promise. A dedicated guard keeps `await` from confusing the chain into thenable resolution mid-build.
- **Execution is eager**, unlike a real DB: the insert has already been recorded when `.values()` runs. `.onConflictDoNothing()` / `.onConflictDoUpdate()` are chainable no-ops so callers that guard concurrent-seed races (c08) do not need a different mock shape.
- `db.batch([...])` mirrors D1's batch: each statement is an already-resolved promise (eager execution again), so the batch just awaits them together (SA2-116). Real batch atomicity semantics are owned by [`data-integrity.md`](data-integrity.md).
- A legacy-fixture converter turns mix compositions expressed as `games` into the normalized junction rows the API reads; explicit junction fixtures win, so tests can cover malformed, empty, or specially ordered data.

**`evaluateWhere` is opt-in.** Enabling it makes `where(cond)` actually filter the configured rows through `cond` and `limit(n)` truncate them, so a procedure that pushes its whole predicate into SQL (rather than re-filtering rows in JS) can be exercised — the motivating consumer is `filter-preset.ts`'s `assertNameAvailable`, whose name-collision check does no JS re-filtering, so the mock has to honour `where(...)` for those behaviour tests to mean anything. Two deliberate constraints:

- **Only `and` / `or` / `eq` / `ne` are understood; any other operator throws** rather than silently matching, so an enabled mock can never quietly report a filter the query does not really apply.
- **Off by default** because fixtures written before this option assume `where(...)` is a no-op.

Condition-tree evaluation exploits Drizzle's SQL chunk structure: `and(...)` / `or(...)` nest their operands as inner `SQL` chunks joined by an `" and "` / `" or "` string chunk, so a condition that contains nested SQL is a combination and any other condition is a leaf comparison. A single-operand wrapper (`and()` with one surviving operand, or the `sql.join` node inside a multi-operand `and`) has no keyword of its own.

**The projection contract (c35).** A `select({ ... })` projection with a single-key aggregate (`{ maxSort: max(table.sortOrder) }`) collapses to one computed row like a real DB would. Every **other** select shape (bare `select()`, or a narrow/renamed column list) returns the configured rows unchanged — every existing fixture in this codebase is written keyed by the query's **output** field names (including cross-table join projections that alias a joined table's column, e.g. `stats.ts`'s `cashVariant: sessionCashDetail.variant`), so re-deriving those keys from the Column reference would only break that established convention. Only `MAX` is needed by any current caller.

**The mock-placeholder gotcha.** The mock's post-insert lookup does **not** filter by the freshly inserted id, so a create-path test whose procedure re-reads the row after inserting must seed a dummy pre-existing row for that table — otherwise the lookup resolves to nothing and the procedure's post-insert branch is never exercised. This is the convention followed throughout the game-variant / game-mix router tests; it is a property of `createChainableMockDb`, not of those tests.

## Seed tests: module replacement and cross-package placement

**A test that `vi.mock`s the seed-constants module gets its own file, because the mock is module-wide.** Two dedicated files exist precisely because the real `DEFAULT_GAME_*` data cannot express their scenarios:

- [`seed-game-data-chunking.test.ts`](../../packages/api/src/__tests__/seed-game-data-chunking.test.ts) — needs a builtin mix wide enough to overflow D1's 100-bind-param cap in a single INSERT, which the real `DEFAULT_GAME_MIXES` (max 10 variants) cannot express. (The cap itself and the chunk math are owned by [`data-integrity.md`](data-integrity.md).)
- [`seed-game-data-unresolvable-variant.test.ts`](../../packages/api/src/__tests__/seed-game-data-unresolvable-variant.test.ts) — needs the failure mode where a mix's `variantKeys` do **not** all resolve to a seeded variant, which cannot be expressed with the real (self-consistent) data.

**Cross-package test placement (c13).** `runUserCreatedHook` lives in `packages/auth`, which has no Vitest project of its own (see AGENTS.md's project list) — but `packages/api` already depends on `@sapphire2/auth`, so it is exercised from [`packages/api/src/__tests__/auth-signup-hook.test.ts`](../../packages/api/src/__tests__/auth-signup-hook.test.ts). The hook body is deliberately extracted out of better-auth's `databaseHooks.user.create.after` wiring so it is directly unit-testable without going through better-auth's internals, which are impractical to invoke from a unit test. (The signup-survives-seed-failure decision itself is owned by [`game-masters.md`](game-masters.md).)

## Web test gotchas

### vi.mock factory hoisting (TDZ)

`vi.mock()` factories are hoisted **before** variable declarations, so a factory that closes over a module-scope `const` throws a TDZ `ReferenceError` at runtime. All `vi.fn()` instances must be created **inline inside the factory** (or via `vi.hoisted`, per AGENTS.md's mocking conventions).

### The trpc/env stub pattern

Importing `@/utils/trpc` drags the env-validating import chain into module initialization, which crashes under jsdom where `import.meta.env` handling differs. Consequences, applied consistently across the web tests:

- Modules whose unit tests exercise pure state **lazy-load** trpc so tests never touch the chain (e.g. `use-session-form-state.ts`).
- jsdom tests of anything that transitively imports `@/utils/trpc` stub that module. When the rendered tree also contains components using real react-query hooks against the proxy (e.g. `VariantSelect` / `useVariantLabels` on `trpc.gameVariant.list`), the stub must provide a `queryFn` and the test must render through the `renderWithQueryClient` wrapper.
- Heavy renderers are stubbed for the same boot-cost reason: recharts is stubbed so jsdom does not render SVG.
- Some tests exist purely to guard against **accidental** trpc imports pulling env into a module that should stay pure (e.g. `seat-screenshot.test.ts`).

The lazy `env` proxy that makes importing `packages/env`'s web schema safe in the first place is documented in [`web-platform.md`](web-platform.md).

### createTrpcMock and the queryKey shape

[`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) exposes `createTrpcMock()`: an auto-materializing mock of the tRPC client/proxy shape. Access any namespace/procedure path (`mock.currency.list.query`, `mock.player.create.mutate`) and receive a typed `vi.fn()` you can seed and assert on. Typical usage:

```ts
const trpcClient = createTrpcMock();
const trpc = createTrpcMock();
vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }));
```

Two contracts around it:

- When a test hand-mocks `queryOptions`, it must return a **stable queryKey of shape `[namespace, procedure, input]`** so key-derivation helpers (e.g. `getSessionQueryKeys`) resolve predictable keys. Import the module under test **after** `vi.mock` so it picks up the mocked trpc.
- For hooks driven by a **real** QueryClient (e.g. `use-filter-presets`), the mocked `list.queryOptions(input)` must build an input-scoped queryKey plus a queryFn forwarding the input, so the real QueryClient can drive `useQuery`, seed cache entries, and refetch predictably per `screenKey` — required for per-screen independence assertions.

### The refetch-mirroring race (optimistic-rollback assertions)

In real-QueryClient tests of optimistic mutations (the `use-currencies` / `use-blind-levels` suites), the mutation's `onSettled` invalidation triggers a refetch. A rollback assertion therefore races the refetch: if the mocked queryFn serves its default (empty) payload, the refetch wipes the state `onError` just restored before the assertion runs. The fix is structural, not a `waitFor`: **mirror the rollback state in the mocked queryFn** so the post-invalidate refetch reseeds with the same data the `onError` handler restores. The per-test-overridable queryFn exists precisely to control refetch payloads for these assertions.

### QueryClient gcTime for observer-less seeded queries

A manually seeded query with no observer is collected immediately under the default test client's `gcTime: 0`. When the code under test resolves data from the live cache — e.g. `VariantSelect` seeds a newly created row into `gameVariant.list` and calls `onChange` synchronously, so the label must be resolved from the cache rather than the stale `variants` prop (c19) — the test client's `gcTime` must be non-zero, mirroring the app where `gameVariant.list` always has an observer (`useGameGroups`).

### Rendering patterns

- **Real react-query over module mocks**: components whose children use real react-query hooks keep the real `@tanstack/react-query` and wrap in a `QueryClientProvider` instead of mocking the module.
- **FormSheet external submit**: forms render no submit button of their own — the surrounding `FormSheet` owns Save and submits via the `form` attribute. Tests mirror that with an external button so they exercise the `id={formId}` wiring. Where the form body mounts only after the game-master lists load (c05), callers await a stable field before interacting.
- **vaul Drawer**: needs a real pointer environment; when the sheet's *body* is what is under test, render it inline instead of through the Drawer.

### jsdom quirks and async traps

- jsdom reports `scrollHeight` as 0; override it per test so overflow measurements can be driven deterministically.
- A hook that chains `.then()` without `.catch()` leaves a rejected mutation as an unhandled rejection — intercept `unhandledRejection` for that specific test rather than letting it fail the process.

### Honest fixtures and derived guards

- When mocking a data hook that another hook composes (e.g. `useFilterPresets` under `use-default-filter-preset`), derive the mock's outputs the same way the real hook derives them — so "no rows" and "rows but none default" stay honest scenarios rather than hand-set nulls.
- **Derive guard inputs from the generated source of truth instead of hard-coding.** The SA2-163 regression guard ([`pwa-manifest.test.ts`](../../apps/web/src/shared/lib/__tests__/pwa-manifest.test.ts)) asserts the PWA manifest `start_url` resolves to a route that actually exists — the bug was `start_url: "/dashboard"`, a route removed in PR #341/#363, which made the installed PWA launch onto TanStack Router's not-found shell. The test derives the set of real routes from `src/routeTree.gen.ts` so it keeps working as routes come and go, and it sanity-checks that its route-extraction regex actually found routes — otherwise the guard would pass vacuously.

## Deterministic time in tests

**`withTz`** ([`apps/web/src/__tests__/tz.ts`](../../apps/web/src/__tests__/tz.ts)) provides deterministic time-zone control for date-formatting tests (SA2-145). Node/Bun re-reads `process.env.TZ` on every `Date` operation, so wrapping an assertion in `withTz` exercises a specific zone regardless of the host machine's local time. Design points:

- The pristine host zone is captured once at module load and restored in a `finally`, so a test can never leak a zone into sibling files sharing the same worker under `isolate: false` (both `web-node` and `web-dom` run this way).
- **When the host had no `TZ` set, the restore must actually delete the variable.** `process.env.TZ = undefined` coerces to the string `"undefined"`, which Node treats as an invalid zone and silently falls back to UTC (SA2-145) — that would leak instead of restoring the pristine "no TZ" state. `Reflect.deleteProperty` is used because `lint/performance/noDelete` forbids the `delete` operator.
- Canonical zones: `TZ_WEST = "America/Los_Angeles"` (UTC-8/-7 — reproduces the original off-by-one bug), `TZ_EAST = "Asia/Tokyo"` (UTC+9), plus UTC itself.

Representative consumers: the share-session text's 📅 line must show the UTC calendar day the user saved (sessionDate is a UTC-midnight ISO string), and the live-linked-edit tests build events from local-time components so the local-time round trip the form performs (date input + time input → timestamp) holds in any TZ. The UTC-midnight convention itself is owned by [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md); round-trip drift specifics by [`data-integrity.md`](data-integrity.md).

**Expiry fixtures are relative, never fixed dates.** `buildMcpSession` rejects expired tokens, so a hard-coded future timestamp turns the whole suite red once the clock passes it — fixtures compute expiry relative to `Date.now()`.

## bun:sqlite migration tests

Migration specs (`packages/db/src/__tests__/migration-*.test.ts`, `preview-seed-restore.test.ts`) run against `bun:sqlite` — a real SQLite engine, matching what D1 executes. `bun:sqlite` is only available in the Bun runtime, so CI runs these files in a dedicated **`bun test` step** ("Test migrations with Bun SQLite" in [`ci.yml`](../../.github/workflows/ci.yml)), while a `skipIfNotBun` guard makes Vitest's Node projects intentionally skip the bodies. That skip is what creates the silent-green hole `scripts/check-rules.ts` closes (see below).

The import boilerplate is a fixed two-directive pattern, required in every such spec:

```ts
// @ts-expect-error -- bun:sqlite only exists in the Bun runtime.
// biome-ignore lint/correctness/noUndeclaredVariables: Bun is a runtime global
```

— TypeScript has no types for `bun:sqlite` under the workspace's Node-flavored config, and the `Bun` global only exists at runtime in Bun, so both the type system and Biome need per-site waivers.

Mechanics shared by the migration specs, whose underlying rules live in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md):

- **`applyThrough(marker)`** applies only the statements up to and including the first one matching `marker`, **without** a transaction — this is exactly what a production apply that dies mid-file leaves behind (`wrangler` streams statements to D1 and only records the migration once the last one succeeds). See db-migrations.md §"A migration file is NOT one transaction in production".
- The 0049 backfill tests pin why the backfill must never abort: pre-0041 writes had no DB-side protection on `game_mix.games`, so legacy rows can still violate the junction table's PK / owner FK — the backfill drops what the API already treats as unusable instead of aborting (db-migrations.md §"Make backfills unable to abort").
- The interrupted-apply test pins the self-healing-retry requirement: a first attempt that dies mid-file leaves the junction populated, the compat triggers absent, and `d1_migrations` still at 0048 — so the old Worker keeps serving and keeps rewriting `games` with nothing syncing it. The retry must rebuild from `games`, not merely top up missing rows (db-migrations.md §"Make the retry self-healing").

## The preview/dev seed-restore pipeline tests

[`preview-seed-restore.test.ts`](../../packages/db/src/__tests__/preview-seed-restore.test.ts) pins the semantics of a pipeline that lives in **two hand-copied workflow siblings**: `preview-deploy.yml` (new preview DB) and `dev-deploy.yml` (every deploy — the dev DB is dropped and recreated each time) both seed a brand-new D1 by applying every migration and then replaying a `--no-schema` dump of production. The trigger-collision story, the stash design, and the "adding a trigger needs no workflow change" rule are owned by [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) §"Triggers must not be armed while a DB is seeded from the master dump"; `bun run check:rules` separately asserts that every workflow performing the restore carries the stash. What the test file adds on top of the rule:

- **It pins both halves of the fix**: the collision is real (so nobody "simplifies" the trigger stash away), and stashing the triggers around the restore makes the dump the single source of truth without leaving the DB permanently trigger-less. `readTriggers` in the test is **the exact query the seed steps run** to stash the triggers.
- **The 0049-naming caveat.** Only the first test case names 0049's compat triggers. When the contract migration drops the legacy `games` mirror they stop firing and that case stops throwing — the fix is to re-point it at whatever derived-table trigger remains (or delete the file once none do), **not** to conclude the stash is unnecessary. The stash guards the restore against triggers in general; every other case reads whatever triggers exist out of `sqlite_master` and never names 0049.
- **Re-arm idempotency.** The workflows' re-arm file is `cat drop-triggers.sql restore-triggers.sql` — the drops are what make it idempotent. SQLite strips `IF NOT EXISTS` before storing DDL in `sqlite_master`, so the read-back CREATEs alone would abort on the first surviving trigger — and `wrangler d1 execute --file` stops there, skipping every CREATE behind it.
- **Partial-drop fixtures are derived, never literal.** The `halfOf` helper derives the count from the live trigger list: the contract migration in db-migrations.md leaves exactly six triggers, so a hard-coded `slice(0, 6)` would quietly become a FULL drop and both partial-drop cases would stop testing what they name.
- **Dump-order fidelity.** `replayProductionDump` replays in the order `wrangler d1 export` writes: `game_mix` (carrying the legacy JSON mirror) before `game_mix_variant` (carrying the authoritative junction rows production already normalized).
- **Post-seed writes are application writes again**: after the restore and re-arm, the compat trigger must still mirror `games` into the junction — the stash is scoped to the restore, not a permanent disarm.

## MCP and server-worker test doctrine

The OAuth/MCP flows themselves are owned by [`mcp-and-oauth.md`](mcp-and-oauth.md); these are the *test-design* decisions.

**Watch the seam, not the status code.** The consent gate is the security core of the MCP OAuth flow: better-auth's mcp plugin issues an authorization code with no consent step unless the request carries `prompt=consent`, and DCR lets anyone register a client. [`consent-gate.test.ts`](../../apps/server/src/__tests__/consent-gate.test.ts) captures the URL the Worker actually hands to better-auth, so it fails if the gate is unwired — unlike status-code assertions, which pass whether or not the middleware ran. The wiring has already changed shape twice (`app.get` → `app.on([...])` → `app.use`) and depends on Hono routing semantics, so it needs a test that watches the seam itself.

**Pin the assumption separately from the gate.** The better-auth authorize-surface suite in `mcp-route.test.ts` pins what better-auth 1.6.0 actually serves — the assumption behind the consent gate having exactly one live path to protect. Those tests deliberately say nothing about the gate itself (they stay green with it removed, because the fallthrough reaches the same handler); `consent-gate.test.ts` covers the wiring.

**A count floor guards against vacuous coverage.** `coupling.test.ts`'s procedure-count assertion (≥124) is a floor, not an exact count: additions are caught by the coverage test above it (which names the unregistered path), while the floor catches a resolver returning an empty/partial list and making that coverage test vacuous.

**Assert consent copy per entity, not by line presence.** The consent copy once named only sessions and session tags while the catalogue had grown room/game-master creates — the grant read smaller than it was. Line presence alone is too weak; the test asserts every entity individually.

**Track description-borne constraints mechanically.** `assertNamedMixComposition` demands an exact reproduction of the named mix and silently drops the flat blinds, and none of that reaches the JSON Schema — so the set of tools carrying `MIX_RULE` in their description has to track the set of tools accepting the field. It drifted once: `session_update` and `session_create_cash_game` accepted `mixGames` with no explanation, which only surfaced when `ring_game_update` started naming `session_update` as the way to edit a mixed session's blinds ([`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 7 owns the description duty; the coupling test owns the drift detection).

**`createFakeEnv` DB is a stub.** [`apps/server/src/__tests__/test-utils.ts`](../../apps/server/src/__tests__/test-utils.ts) builds a minimal env satisfying `serverEnvSchema`, but its DB is a stub — worker-route tests using it may only exercise paths that never reach a real query.

## scripts/check-rules.ts

[`scripts/check-rules.ts`](../../scripts/check-rules.ts) holds the deterministic conformance checks for the rules in AGENTS.md and `.claude/rules/*.md`. It runs in three places: CI ([`ci.yml`](../../.github/workflows/ci.yml)), the Claude Code Stop hook (see `.claude/settings.json`), and manually via `bun run check:rules`.

**Standing invariant: only currently-green checks may live in the file.** A red check would block every turn (the Stop hook runs it after each Claude Code turn). Checks for known-but-unfixed issues wait in the header's queue until their Linear issues are fixed — currently the ColorBadge / PlayerAvatar wrapper bans (SA2-112, SA2-119).

### Matching soundness (excludeLine × multiline)

Each pattern is tested against the whole file first — so multiline patterns (e.g. an `<input>` whose attributes span lines) can match — and then per line for reporting; `excludeLine` filters individual line hits. A file that matched as a whole while **no single line matched** is reported as a genuine multiline violation. The guard for that fallback is "no line matched at all", not "the check has no excludeLine": this keeps the logic sound once a check combines an `excludeLine` with a multiline pattern — a file whose every hit line is excluded is not reported, but a real cross-line hit still is.

### The bun:sqlite listing check

`bun:sqlite` spec bodies sit behind `skipIfNotBun`, so Vitest's Node projects report them as *skipped*, not failed. A spec that is also missing from ci.yml's dedicated `bun test` step therefore **runs nowhere and reports green** — a failure mode prose in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md) cannot catch, which is exactly when AGENTS.md ("Procedure for adding a rule", step 5) calls for a mechanical check. It is expressed as a **cross-file existence assertion** (every `{apps,packages}/**/__tests__/*.test.ts` mentioning `bun:sqlite` must be named in the step) rather than a banned pattern, which is why it lives outside the file's generic `CHECKS` table. Design details:

- The glob spans **every workspace**, not just `packages/db`: AGENTS.md colocates tests next to the code, so the next bun:sqlite spec plausibly lands in some other `__tests__/` — `apps/server`'s included. `*` does not cross `/`, so a narrower glob would let such a spec escape both this check and the `bun test` step — the exact silent-green hole the check exists to close.
- Parsing stops at the next `- name:` step, so a spec named in an unrelated ci.yml step does not count as listed.
- The step is located by its literal name ("Test migrations with Bun SQLite"); renaming the step in ci.yml requires updating the constant in the check, and the check says so when the step is missing.

### The D1 trigger-stash check (delta beyond db-migrations.md)

The collision story and the three-part stash are documented in [`.claude/rules/db-migrations.md`](../../.claude/rules/db-migrations.md); the check adds two design decisions:

- **It matches on the restore itself** (`--file=dump.sql`), not on a workflow allowlist — the seed step is a hand-copied sibling across `preview-deploy.yml` / `dev-deploy.yml`, and a copy is precisely what prose cannot keep in sync, so matching the restore marker means the *next* copy of the step is caught too.
- **The three markers are asserted separately** because each is a distinct half of the fix: reading the live trigger DDL back out of `sqlite_master` (not re-running a migration), `DROP TRIGGER IF EXISTS`, and re-arming from any state via the drops-then-creates `rearm-triggers.sql`. A workflow that dropped without re-arming would leave the DB permanently trigger-less, so a missing re-arm must fail on its own.
- Implementation trap: `dot: true` on the Glob scan is load-bearing — Bun's `Glob` skips dot-directories by default, so without it the scan of `.github/` yields an empty set and the check reports green forever.

### Regex design: the inline model-id check (delta beyond ai-models.md)

[`.claude/rules/ai-models.md`](../../.claude/rules/ai-models.md) owns the model-id single-source rule and why the type system cannot enforce it. The check's pattern design:

- It bans **quoted `claude-*` literals wholesale** rather than enumerating generation names — an enumeration would miss the old id format where a digit follows `claude-` (e.g. `claude-3-5-sonnet-20241022`).
- Requiring the quotes keeps path strings like `.claude/rules/...` and prose mentions of `claude-*` out of scope.
- Workflow YAML is deliberately excluded: `pre-merge-review.yml`'s `--model opus` is a movable alias that always points at the latest Opus, so it is not a pinned ID under this rule's management.

### Regex design: the MCP direct-DB-import check (delta beyond mcp-tools.md)

[`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2 owns the "tools go through `createCaller`, never the DB" rule. The check's pattern matches the `@sapphire2/db` **prefix**, so barrel imports (`createDb` / schema re-exports via `from "@sapphire2/db"`) are blocked as well as subpath imports — matching subpaths only would let the bare barrel import pass through.
