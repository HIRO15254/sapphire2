---
paths:
  - "**/__tests__/**"
  - "**/*.test.ts"
  - "**/*.test.tsx"
---

# Testing (behavioral contracts, measured detection)

Why this file exists: the coverage sweep (PR #226) grew the suite to ~6,900 `it()` whose count outran their detection power — 160+ existence probes (`expect(appRouter.x.y).toBeDefined()`), three-way duplicates across hook / component / data hook, and boundary loops nobody specified. The first Stryker baseline showed 55.8% on `packages/api/src/routers/session.ts` under near-total line coverage. The imperatives live in [`AGENTS.md`](../../AGENTS.md) (Test-Driven Development); this file carries the how. Rationale and mechanics: [`docs/design/testing-and-tooling.md`](../../docs/design/testing-and-tooling.md).

## What each layer fixes — and leaves to another layer

| Layer | Project | Fixes (assert these) | Does not fix (tested elsewhere or not at all) |
|---|---|---|---|
| Pure functions, Zod schemas, formatters | `web-node`, `api`, `db` | input → output, spec-named boundaries, error kinds | rendering, persistence |
| API procedures via `createChainableMockDb` | `api` | ownership WHERE bindings, batch composition, `TRPCError` code, returned shape | SQL semantics — the mock's `orderBy` / joins are no-ops; column lists; procedure existence |
| DB | `db` | FK `onDelete`, unique / partial indexes, CHECK constraints, migration behavior on `bun:sqlite` (mid-file failure, retry) | column lists, `notNull` / `hasDefault`, Zod key sets |
| Web hooks | `web-dom` | state transitions, handler outcomes, optimistic cache contents, side effects that are the contract | JSX binding |
| Web components | `web-dom` | what the user sees for a given hook state (text, disabled, roles) and that an interaction reaches the hook handler | hook logic through the DOM |
| Server worker (Hono) | `server` | route behavior through `app.request()` (status, headers, consent / register gates) and the pure helpers those routes call | Better Auth internals, tRPC procedure logic (owned by `api`) |

A behavior belongs to exactly one row. A Zod rule proven in `packages/api` is not re-proven from the web form; a hook rule proven with `renderHook` is not re-proven by clicking through the component.

## Patterns — copy, do not invent

| Target | Project | Reference |
|---|---|---|
| Pure util / Zod schema / formatter | `web-node` | [`apps/web/src/features/rooms/utils/__tests__/blind-level-helpers.test.ts`](../../apps/web/src/features/rooms/utils/__tests__/blind-level-helpers.test.ts), [`apps/web/src/utils/__tests__/format-number.test.ts`](../../apps/web/src/utils/__tests__/format-number.test.ts) |
| Simple hook (no tRPC) | `web-dom` | [`apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts`](../../apps/web/src/shared/hooks/__tests__/use-elapsed-time.test.ts) |
| Form hook (`@tanstack/react-form`) | `web-dom` | [`apps/web/src/features/auth/pages/login-page/sign-in-form/__tests__/use-sign-in.test.ts`](../../apps/web/src/features/auth/pages/login-page/sign-in-form/__tests__/use-sign-in.test.ts) |
| tRPC query + mutation hook | `web-dom` | [`apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts`](../../apps/web/src/features/currencies/hooks/__tests__/use-currencies.test.ts) |
| Optimistic flow with real QueryClient | `web-dom` / `web-node` | [`apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts`](../../apps/web/src/features/live-sessions/utils/__tests__/optimistic-session-event.test.ts) |
| Page hook / view hook | `web-dom` | [`apps/web/src/features/sessions/pages/sessions-page/__tests__/use-sessions-page.test.ts`](../../apps/web/src/features/sessions/pages/sessions-page/__tests__/use-sessions-page.test.ts) |
| API procedure — ownership / atomicity / error kinds | `api` | [`packages/api/src/__tests__/ownership-error-uniformity.test.ts`](../../packages/api/src/__tests__/ownership-error-uniformity.test.ts), [`packages/api/src/__tests__/db-batch-atomicity.test.ts`](../../packages/api/src/__tests__/db-batch-atomicity.test.ts), the `callerFor()` factory in [`packages/api/src/__tests__/session.test.ts`](../../packages/api/src/__tests__/session.test.ts) with `createChainableMockDb` from [`test-utils.ts`](../../packages/api/src/__tests__/test-utils.ts). No per-procedure existence tests; `expectAccepts` / `expectRejects` only for boundaries the spec names. |
| DB constraint / migration | `db` | [`packages/db/src/__tests__/session-schema.test.ts`](../../packages/db/src/__tests__/session-schema.test.ts) (FK `onDelete`, partial unique index via `getTableConfig`), [`packages/db/src/__tests__/migration-0049.test.ts`](../../packages/db/src/__tests__/migration-0049.test.ts) (`applyThrough` mid-file failure). FK / index / migration only — never `getTableColumns` column lists. `packages/db/src/__tests__/test-utils.ts` (`fkByColumn`, `indexesOf`, `indexByName`, `checksOf`) is the only way to read Drizzle metadata in a db spec; `check:rules` bans the shape accessors. |
| Shared helpers (web) | — | [`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) (`createTestQueryClient`, `renderWithQueryClient`, `createTrpcMock`, `createToastMock`, `createAuthClientMock`) |

If a target matches no row, extend the relevant `test-utils` file with a helper rather than hand-rolling a new pattern per file.

## Component tests that mock their own hook (`web-dom`)

The hook return value is the input and the DOM is the output; the test may hold at most one `it()` per binding class and nothing that re-proves a value the hook test already proved:

- **B1 state → subtree**: one `it()` per distinct rendered state (loading skeleton, error + retry, not found, empty).
- **B2 collection → rows**: one `it()` ("renders one row per item").
- **B3 handler wiring**: one `it()` per hook handler asserting `toHaveBeenCalledWith(args)`; several entry points for the same handler become one `it.each`.
- **B4 flag → attribute**: one `it()` per flag (pending disables Save; a toggling label asserted with both values in one `it()`).
- **B5 conditional mount**: one `it()` per sheet / drawer, both branches in one `it()`.

Delete "forwards X to Child" tests when the page-hook test asserts the pass-through and the child's own test asserts the rendering (keep one prop-reaches-child `it()` per child), per-sheet "Cancel closes" repeats, label-only variants, and any assertion on hook-internal branches. A component test mocks the component's own `use-*` hook — never `@tanstack/react-query`; a `useMutation` stub that derives the patch itself asserts against the mock, not the component.

## Zod input tests (`packages/api`)

- Keep an `it()` only for a boundary the spec names: 1-based placement and `placement <= totalEntries` (create and update alike), `tableSize` 2..10, seat 0..9, `limit` / cursor rules, name-length caps, every enum rejection, discriminated-union branch requirements, strict payloads, the D1 100-parameter chunking, money / chip / count fields non-negative and integer.
- Money, chip, and count fields share ONE `it.each` per schema ("rejects a negative or fractional %s"), never one `it()` per field.
- Do not write type enumerations: "rejects a non-string X", "rejects missing <required field>", "accepts {id}" triplets, boolean-flag enumerations, or a second happy path — TypeScript and Zod already guarantee them and they only pad the count.
- Procedure surface: one "exposes exactly the expected procedure set" `it()` plus one `expectProcedureSurface(appRouter.<ns>, { name: "query" | "mutation" })` call per router file; never a per-procedure existence or `expectProtected` `it()`.

## Mocking conventions

- `vi.hoisted(() => ({ … }))` for mutable mock state shared across `vi.mock` factories.
- `vi.mock("@/utils/trpc", () => ({ trpc, trpcClient }))` to replace the tRPC proxy at module scope.
- `@tanstack/react-form`: use the real `useForm`; drive via `result.current.form.setFieldValue(...)` + `await result.current.form.handleSubmit()` inside `act()`.
- Never mock the module under test; only its dependencies. A mock that re-implements the logic under test (a `useMutation` stub deriving the patch itself) proves nothing — assert against the real hook.

## Writing an it()

1. Name the scenario and the promised outcome; if the name needs "and", split it.
2. Arrange from the spec's example, not from the implementation's branches.
3. One act, then assert the outcome value (`toEqual` / `toBe` / `toHaveTextContent` / `rejects.toMatchObject({ code })`). Spies only when the side effect is the contract.
4. Boundaries: only the ones the spec names, as one `it.each` row set.
5. Zero-`expect` blocks are fine when a helper asserts (`expectRejects`, `findByText`); `toBeDefined` / `toBeTruthy` / `not.toThrow` as the only matcher is not.

## Detection gate (Stryker)

- `bun run mutate` (= `bun run mutate -- --changed --base origin/dev`) mutates the implementation files changed since the merge-base, for every project Stryker covers: `api`, `db`, `web-node`. `--project <name>` narrows to one project; `--mutate <file>` (repeatable) targets specific implementation files; `--all --project <name>` re-measures a whole project; `--no-incremental` / `--force` control reuse of the previous run; `--dry-run` only checks the runner wiring. The Stryker config is generated by [`scripts/mutate.ts`](../../scripts/mutate.ts) into `reports/mutation/<project>/stryker.config.json` — never hand-edit it.
- Reports: `reports/mutation/<project>/report.json` (machine), `index.html` (browse), `run.json` (mode, files, baseline, elapsed, cores); `bun run mutate summary` prints the per-project table with the survivors of the changed files.
- `web-dom` (and `server` / `mcp` / `env`) have no Stryker run; `bun run test:metrics` lists their untested files instead: flip three conditions by hand — copy the file to a scratch location, edit one condition, run `bunx vitest related --run --project web-dom <file>`, confirm red, restore with `git checkout -- <file>`, repeat.
- Reading survivors: `Survived` / `NoCoverage` in `ConditionalExpression`, `EqualityOperator`, `LogicalOperator`, `ArithmeticOperator`, `BlockStatement`, `OptionalChaining`, `MethodExpression` inside validation, ownership WHEREs, arithmetic, state transitions, date handling, sorting, error-code selection, or batch composition = a missing test. Add the `it()` that asserts the outcome the mutant breaks.
- Decorative survivors (`StringLiteral` in UI copy / toast / log / error `message` when the `code` is asserted, `ObjectLiteral` of icons or labels, `className` strings) are silenced at the line: `// Stryker disable next-line <Mutator>[,<Mutator>]: <why>`. This is a whitelisted machine directive ([`comments.md`](comments.md)); `check:rules` rejects ranged disables, `all`, and a missing reason.
- Equivalent mutants (cannot change observable behavior) get the same directive with a reason starting `equivalent:`.
- Thresholds: `break` is 0 (report-only); `high` 80 / `low` 60 color the report only. Coverage % is never collected and never a gate.
- Stryker runs Vitest in a worker-thread pool where `process.env.TZ` is ignored, so `withTz` tests in a `web-node` spec fail its initial run. Put them in a sibling `*-tz.test.ts` (Vitest still runs it; the Stryker config `apps/web/vitest.node.stryker.config.ts` excludes it, so time-zone branches show as `NoCoverage` in the report rather than breaking the run). `check:rules` enforces the file name.
- Bun's isolated linker hides the vitest runner from Stryker's default plugin discovery; `scripts/mutate.ts` resolves the runner by file path. Never symlink into `node_modules/.bun` and never add a `bunfig.toml` for this.

## Coverage

- Line coverage is not collected and is never a target: once suite size is controlled it barely correlates with detection (Inozemtseva & Holmes 2014), and this repo's coverage sweep (PR #226) is exactly what produced 6,900 `it()` with a 55 % mutation score on `routers/session.ts`. A coverage target rewards "run the line, assert nothing".
- What is measured instead is *reach*: `bun run test:metrics` writes `reports/test-metrics.{json,md}` with the `it()` count and collected tests per workspace / project, the mutation score / covered score / NoCoverage count per Stryker project with its lowest-scoring files, the source files no spec sits next to or imports (`use-*.ts`, `utils/**`, `shared/lib/**`, `apps/server`, `packages/mcp`), component specs that mock `@tanstack/react-query` wholesale, and specs over 30 `it()` / 600 lines. `--compare <dir>` diffs against a saved snapshot and lists files whose mutation score dropped with more `Survived` / `NoCoverage` mutants — the only drop that counts as a regression.
- A NoCoverage mutant or an untested file in domain logic is closed with a test that asserts the outcome; pure wiring (`packages/api/src/context.ts`, `routers/index.ts`) and label maps are excluded from the Stryker subjects or silenced with a directive, with the reason in `docs/design/testing-and-tooling.md`, never chased for the number.

## Deleting or rewriting tests

A test is deleted only when the PR shows, for its project, the before/after `it()` count, suite time, and mutation score, and the score did not drop. A failing test is never deleted, skipped, or loosened; a spec change rewrites it against the new spec in the same PR and says so in the body.

## Mechanical enforcement (`scripts/check-rules.ts`)

- Focused / skipped tests (`it.only`, `it.skip`, `test.todo`, `describe.only`, `xit`, `fit`, …) are banned in every `*.test.ts(x)`. Biome's `noFocusedTests` only warns; this check fails.
- `Stryker disable` must be `next-line`, name its mutators, and carry a reason.
- Stryker instrumentation in a source file (`stryNS_*`, `__stryker__`, or the bare `// @ts-nocheck` stamp it puts on every file under the mutated project's `src/`) fails `check:rules`: it means an in-place run was still active when the tree was staged (P2-web committed 87 instrumented `packages/api` files that way). Stop the run with SIGINT, `git checkout -- <files>`, and never run `bun run mutate` in a tree that another agent or editor is committing from.
- Smoke-only `it()` blocks (every `expect` ends in `toBeDefined` / `toBeTruthy`; `not.toThrow` stays prose-only because `bun:sqlite` migration specs prove constraint acceptance by not throwing) are banned by [`scripts/check-rules-tests.ts`](../../scripts/check-rules-tests.ts) across `packages/**/*.test.ts` and `apps/**/*.test.{ts,tsx}`.
- Schema-shape assertions in `packages/db` tests (`.notNull`, `.hasDefault`, `.dataType`, `.columnType`, `.primary`, `.onUpdateFn`, `getTableName(`, `.primaryKeys`) are banned; `.default` pins tied to a constant or incident and the better-auth column-presence tests in `oauth-schema` / `passkey-schema` are the deliberate exceptions.
