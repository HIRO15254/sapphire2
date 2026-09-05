---
paths:
  - "apps/**"
  - "packages/**"
  - "scripts/**"
  - "e2e/**"
  - "testing/**"
  - "patches/**"
  - "vitest*.ts"
  - "playwright*.ts"
  - "package.json"
  - ".github/workflows/**"
  - ".husky/**"
  - ".claude/settings.json"
---

# Test Design and Maintenance

Blanket coverage of every branch and boundary value increased tests of declarations and mocks while hiding gaps in real authentication, SQL, and concurrency. Prioritize verifying required behavior and detecting important failures over test volume.

## Choose Tests Based on the Change

| Change | Required verification |
|---|---|
| Bug fix | Reproduce the bug and confirm that the test fails because the behavior differs from the expectation before fixing it. Type, import, and environment errors are not evidence of red |
| Added or changed behavior | Define requirements, success criteria, important failures, and meaningful input boundaries first, then test the contract at the layer that verifies it most directly |
| Refactoring that preserves behavior | Use existing tests. Add only missing contract protection. Do not deliberately break the implementation merely to manufacture a red result |
| Copy, styling, or type-only changes | No additional tests are needed when types, lint, visual inspection, and existing tests are sufficient. Verify the behavior if accessibility or input semantics change |
| Test consolidation or deletion | Check the protected contract, replacement verification, and remaining risks. For tests that freeze decorative structure or are exact duplicates, record why they are unnecessary |
| Test infrastructure, configuration, or migrations | In addition to running related tests, verify runner discovery, isolation, shutdown on failure, and preservation of diagnostic artifacts |

Derive expectations from requirements, public contracts, invariants, and known failures. AI must not copy the current implementation's output into expected values or duplicate its calculations in tests. When recording existing behavior whose intent is unclear, explicitly identify it as a characterization test and state which specifications remain unresolved. Review expectations for important monetary values and authorization, and changes that reduce protection, independently of the implementation.

Select success cases and failure or boundary cases that produce distinct business outcomes. There is no need to pass `null` / `undefined` / `NaN` / `Infinity` to every function. Do not omit reachable scenarios involving runtime validation of external inputs, authentication and ownership, monetary calculations, UTC date boundaries, partial failures, or concurrency. Use coverage to find untested areas; do not target 100% overall coverage or a deletion percentage.

## Verification Layers and Mock Boundaries

| Layer | Primary protection | Real implementations to exercise |
|---|---|---|
| Static checks | Type consistency, prohibited APIs, design constraints | TypeScript, Ultracite, and `scripts/check-rules.ts`. Do not duplicate the same constraints in tests |
| Unit / hook | Calculations, transformations, input schemas, independent state transitions | The function or hook under test. Control boundaries such as time, randomness, and network access as needed |
| UI integration | Input → validation → submission → display, input preservation on failure, cache updates | Real components, hooks, forms, and QueryClient. Control responses at the network boundary |
| API / DB integration | Ownership, JOINs, filtering, pagination, persistence, atomicity | Real callers, schemas, Drizzle, and a test-only D1 database. Read back persisted state as well as checking responses |
| Migration | Full migration history, data transformations, UNIQUE/FK/cascade, recovery | Real migrations and SQLite. Supplement Workers/D1-specific contracts with D1 verification |
| HTTP / MCP / E2E | Cookies/tokens, routing, serialization, reloads, account switching | Real authentication, Worker, DB, and required browser features. Control only external services such as IdPs and LLMs at their boundaries |

Do not repeat every case of the same contract across multiple layers. Separating UI logic into hooks is an implementation design rule, not a requirement to test every hook and component separately with mocks. Verify independent state machines through hooks and screen integration through actual user interactions.

Do not mock the subject under test. When mocking a dependency, be able to explain what is excluded from verification. Mocking DB calls can help exercise branches but does not guarantee SQL authorization, JOIN behavior, or atomicity. Middleware counts and the existence of procedures are not evidence of authentication rejection either. Exercise unauthenticated requests, another user's IDs, and successful requests by the owner; do not count cases that fail only input validation as authentication verification.

For UI tests, prioritize roles, labels, visible outcomes, and user interactions. Do not merely lock down CSS classes, decorative element counts, internal state, or props passed to mocked children. Exceptions apply only when these details are themselves product contracts. Assert side-effect counts and ordering when they are part of the contract, such as preventing duplicate saves or clearing the cache on logout.

## Asynchronous Behavior, State, and External Dependencies

- For concurrent updates, use deferred Promises or similar controls to keep multiple requests genuinely pending and produce the required success, failure, and response ordering. Do not call sequentially awaited requests a concurrency test.
- Hold refetching pending when testing rollback, and verify recovery immediately after failure. Do not let refetched results hide a missing rollback.
- Control time, randomness, and timers, and wait for completion conditions. Do not stabilize tests with fixed sleeps. Reset handlers, mocks, timers, and DB data between cases; do not confuse file isolation with case isolation.
- Create a QueryClient per case and control retries. Verify browser persistence isolation with real IndexedDB, and keep the same browser context when testing logout → reload → another user.
- Do not depend on external network availability. Use fixed fixtures and fail unknown application requests. Do not fake authentication or the entire caller in real HTTP success cases.
- Separate test databases, bindings, ports, and accounts from development and production resources. Isolate state between parallel workers and cases, and release resources on exit. Do not weaken product Cookie or CORS settings to make tests pass.

## Deciding When to Remove Existing Tests

For deletion or consolidation, record "contract protected by the old test → replacement test / existing check → remaining risks" in the PR or migration record. When a replacement is needed, add and verify it before deleting the old test. Tests of decorative structure without a product contract and exact duplicates need no new replacement if the rationale is explained.

Do not delete tests solely because they are long, use many mocks, or execute the same lines. Retain corresponding protection for known failures, profit and loss calculations, migrations, recovery from optimistic updates, and MCP coupling. For important replacements, verify defect detection by reproducing an old failure or introducing a limited intentional fault, and always revert temporary faults. A 100% overall mutation score is not required.

Do not modify, skip, exclude, or weaken assertions in tests to hide implementation failures. For a specification change, record why expectations change and distinguish it from cleanup that preserves behavior. Do not count tests that could not run due to the environment as successes. Remove unused mocks, fixtures, and helpers once they have no callers.

## Placement, Shared Helpers, and Execution

See [`docs/testing-environment.ja.md`](../../docs/testing-environment.ja.md) for current startup instructions, new reference examples, and measurement scope. `bun run check:test-discovery` checks all specs for missing or duplicate assignments.

Keep unit, hook, and component tests in `__tests__/foo.test.ts(x)` or `foo.test.tsx` within the component folder, following the existing convention. Register integration and E2E tests for discovery by their dedicated runners. When changing placement, check include/exclude settings and leave no undiscovered tests or unintended duplicate execution.

Reuse existing shared helpers, such as QueryClient creation in [`apps/web/src/__tests__/test-utils.tsx`](../../apps/web/src/__tests__/test-utils.tsx). Use only the necessary schema extraction and fixtures from the API's `test-utils.ts`; do not expand existing DB mocks into SQL emulators. Extract shared code when repetition appears, and do not create a generic DSL that obscures expectations and scenarios. `vi.hoisted` may be used for shared state across module mocks. Use the real `@tanstack/react-form` for form integration.

| Target | Command for local iteration |
|---|---|
| Pure functions / Web schemas | `bunx vitest run --project web-node <path>` |
| Hooks / components / UI integration | `bunx vitest run --project web-dom <path>` |
| API | `bunx vitest run --project api <path>` |
| Real D1 / caller integration | `bunx vitest run --project api-integration <path>` (all integration tests: `bun run test:integration`) |
| Server | `bunx vitest run --project server <path>` |
| DB | `bunx vitest run --project db <path>` |
| MCP | `bunx vitest run --project mcp <path>` |
| Env | `bunx vitest run --project env` |
| Bun SQLite migration | `bun test packages/db/src/__tests__/<target>.test.ts` |
| Browser / real HTTP | `bunx playwright test <path> --project <desktop-or-mobile>` (all E2E tests: `bun run test:e2e`) |
| Missing or duplicate runner registrations | `bun run check:test-discovery` |
| Types for test infrastructure, E2E, and D1 fixtures | `bun run check:testing-types` |

Run related scopes locally. Since `--changed` / `related` alone can miss SQL, configuration, and dynamic references, explicitly select targets for those changes. A new execution setup is complete only after it is registered in both package scripts and CI.

Playwright starts test-only HTTPS Web/Worker servers and D1. Do not overlap runs that use the dedicated ports in the same working directory. Reuse the E2E fixtures for real account registration and login, and preserve process cleanup on exit and trace/log retention on failure. For local dependency patches, document the target version, rationale, regression tests, and removal conditions in `patches/README.md`, and verify reproducibility with `bun install --frozen-lockfile`.

For a PR, verify `bun run lint`, `bun run check-types`, `bun run check:rules`, and the relevant tests. CI runs all Vitest tests, Bun migration tests, and registered important integration/E2E tests. Report tests that were not run, skipped, failed, or passed only after retries separately. Do not confuse file counts, declaration counts, and executed case counts after parameter expansion.

`.husky/pre-commit` runs `vitest run --changed HEAD` when code changes are staged. Let Vitest obtain the change list from Git because enumerating many paths reaches the Windows argument-length limit. Tests related to unstaged changes are included too. The Stop hook in `.claude/settings.json` runs formatting, the same changed-test command, lint, and `check:rules`. Neither replaces the full suite; CI performs final verification of all targets. The existing `scripts/check-rules.ts` checks for missing CI registration of Bun SQLite tests. Do not reimplement checks already provided by runners, types, or lint, and do not automatically delete "low-value tests" with regular expressions.
