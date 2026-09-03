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
| DB constraint / migration | `db` | [`packages/db/src/__tests__/session-schema.test.ts`](../../packages/db/src/__tests__/session-schema.test.ts) (FK `onDelete`, partial unique index via `getTableConfig`), [`packages/db/src/__tests__/migration-0049.test.ts`](../../packages/db/src/__tests__/migration-0049.test.ts) (`applyThrough` mid-file failure). FK / index / migration only — never `getTableColumns` column lists. |
| Shared helpers (web) | — | [`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx) (`createTestQueryClient`, `renderWithQueryClient`, `createTrpcMock`, `createToastMock`, `createAuthClientMock`) |

If a target matches no row, extend the relevant `test-utils` file with a helper rather than hand-rolling a new pattern per file.

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
- `web-dom` (and `server` / `mcp` / `env`) have no Stryker run: flip three conditions by hand — copy the file to a scratch location, edit one condition, run `bunx vitest related --run --project web-dom <file>`, confirm red, restore with `git checkout -- <file>`, repeat.
- Reading survivors: `Survived` / `NoCoverage` in `ConditionalExpression`, `EqualityOperator`, `LogicalOperator`, `ArithmeticOperator`, `BlockStatement`, `OptionalChaining`, `MethodExpression` inside validation, ownership WHEREs, arithmetic, state transitions, date handling, sorting, error-code selection, or batch composition = a missing test. Add the `it()` that asserts the outcome the mutant breaks.
- Decorative survivors (`StringLiteral` in UI copy / toast / log / error `message` when the `code` is asserted, `ObjectLiteral` of icons or labels, `className` strings) are silenced at the line: `// Stryker disable next-line <Mutator>[,<Mutator>]: <why>`. This is a whitelisted machine directive ([`comments.md`](comments.md)); `check:rules` rejects ranged disables, `all`, and a missing reason.
- Equivalent mutants (cannot change observable behavior) get the same directive with a reason starting `equivalent:`.
- Thresholds: `break` is 0 (report-only); `high` 80 / `low` 60 color the report only. Coverage % is never collected and never a gate.
- Bun's isolated linker hides the vitest runner from Stryker's default plugin discovery; `scripts/mutate.ts` resolves the runner by file path. Never symlink into `node_modules/.bun` and never add a `bunfig.toml` for this.

## Deleting or rewriting tests

A test is deleted only when the PR shows, for its project, the before/after `it()` count, suite time, and mutation score, and the score did not drop. A failing test is never deleted, skipped, or loosened; a spec change rewrites it against the new spec in the same PR and says so in the body.

## Mechanical enforcement (`scripts/check-rules.ts`)

- Focused / skipped tests (`it.only`, `it.skip`, `test.todo`, `describe.only`, `xit`, `fit`, …) are banned in every `*.test.ts(x)`. Biome's `noFocusedTests` only warns; this check fails.
- `Stryker disable` must be `next-line`, name its mutators, and carry a reason.
- Arriving with the P2 cleanup PRs: smoke-only `it()` blocks (every `expect` ends in `toBeDefined` / `toBeTruthy`; `not.toThrow` stays prose-only because `bun:sqlite` migration specs prove constraint acceptance by not throwing) and schema-shape assertions in `packages/db` tests. The detector already lives in [`scripts/check-rules-tests.ts`](../../scripts/check-rules-tests.ts).
