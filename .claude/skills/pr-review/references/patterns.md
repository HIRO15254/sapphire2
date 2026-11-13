# Recurring patterns from the 2026-11 full review of `dev`

The full review of `dev` on 2026-11-11 (commit `8c49556`) reported 1,105 findings. The fix plan groups them into 221 patterns, each a mistake that recurred, tracked as SA2-456 to SA2-676 in the Linear review project (P-SA2-16). This file lists the 190 patterns that can recur in a new change, one line each; the other 31 were one-off defects with nothing to recur. Most of the findings were low severity and entered one PR at a time, so this list is the breadth pass of the review: the risk questions in `lean.md` find the deep defects, this list keeps the small ones from coming back.

## How to apply

1. Take the sections whose scope matches the paths the range changes. Skip the others.
2. For each line in those sections, decide whether the range adds a new instance: code, a test, a document statement or a workflow step that makes the described mistake. Decide from the files you have already read in full; a line that needs a search (a second copy of a helper, a caller, a reader of a stored id) gets that search.
3. A new instance is a candidate and goes through settlement like any other. It is important when a user-visible failure, wrong result, data loss or security gap is established; otherwise it is a nit. Report one row per pattern with every location, and start the scenario with the pattern id and its issue, for example `input-validation/raw-string-inputs (SA2-644)`.
4. An instance the range does not touch is out of scope under every label: it is already tracked in the pattern's issue, and a `pre-existing` row would be filed to Linear a second time. When the range copies an existing instance to a new place or widens one, that is a new instance.
5. When the range changes a path under a matching section and no line applies, say so in the coverage line by naming the sections checked.

Lines marked `[review]` have no mechanical guard planned: the review is the only place they are caught. The other lines have a guard planned in the fix plan (a `check:rules` rule, a test fixture, a shared helper, a CI gate, a type or a database constraint) that does not exist yet or covers only part of the pattern.

## Maintaining this file

Delete a line in the same PR that lands its mechanical guard, and delete a line whose pattern issue closes without a guard only when the mistake can no longer be written. Add a line when a later review finds a new recurring mistake, with its Linear issue. Do not copy finding lists here; the issue holds them.

## Server writes, reads and schema (`packages/api`, `packages/db`)

- `concurrency/stale-read-not-reasserted` (SA2-659): A write is planned from values read earlier and the batch does not reassert them, so a concurrent change is silently overwritten.
- `concurrency/fk-race-unmapped-500` (SA2-526): A referenced row deleted between validation and the write batch surfaces as a raw foreign-key error (500) instead of CONFLICT.
- `lifecycle-gc/json-payload-soft-reference` (SA2-497): An id kept inside a JSON payload (no foreign key) is not considered by the delete of the thing it points to, leaving a dangling reference.
- `lifecycle-gc/orphan-rows-never-collected` (SA2-531): A delete, undo or relink leaves rows nothing can reach any more, and an in-use check still counts them.
- `api-contract/implicit-destructive-replace` (SA2-657): A replace-style update or undo deletes child data the input merely omitted (days, hands, tags, review times).
- `api-contract/read-write-shape-mismatch` (SA2-627): The shape a read returns, or a saved filter holds, is defined separately from the write or list input schema that must accept it.
- `api-contract/untyped-output-contract` (SA2-466): A procedure's output is left to inference: wider than the documented contract, an amount without its unit, an empty id, or a different error shape per path.
- `api-contract/dead-end-capability` (SA2-632) [review]: Something can be written but not read, used or corrected (or the reverse), with no recorded decision that this is intended.
- `input-validation/non-strict-input-objects` (SA2-532): An input object is not strict, so a misspelled or out-of-scope key is ignored while the call succeeds.
- `input-validation/raw-string-inputs` (SA2-644): A string input is a bare `z.string()`: no trim, no rule for the empty string, no length cap, no canonical form.
- `input-validation/unbounded-instant-inputs` (SA2-618): A stored instant has no upper bound or future limit, so a millisecond value or a far-future time is saved as given.
- `input-validation/unbounded-counts-and-totals` (SA2-658): A number or row count is not capped at write time, and a later read fails or exceeds the row or query budget.
- `input-validation/bound-param-undercount` (SA2-476): A chunk width is derived from the row's key count instead of the columns Drizzle actually binds.
- `input-validation/ai-output-normalisation` (SA2-620) [review]: Model output is accepted or rejected as a whole by the schema, with no normalisation of invariants and no partial salvage.
- `paid-api-cost/paid-call-without-user-quota` (SA2-465): A procedure calls a billed upstream API (OpenAI, Google Places) with no per-user rate limit or daily cap.
- `paid-api-cost/unbounded-request-payload` (SA2-520): An input such as a base64 image has no length cap and is validated, concatenated and forwarded to a billed API.
- `schema-constraints/fk-cascade-against-no-action-policy` (SA2-529): A foreign key to a row the owner does not own is declared `ON DELETE CASCADE` against the NO ACTION policy (INV-22), or differs from its sibling tables.
- `schema-constraints/api-only-invariant-without-check` (SA2-616): A range, pairing or integer invariant that a CHECK or partial unique index could hold is left to API validation alone, with no audit behind it.
- `schema-constraints/zod-bound-differs-from-check` (SA2-482): The same bound is written separately in the Zod registry, the router and the CHECK, and they disagree.
- `schema-constraints/enum-column-without-check` (SA2-494): A text column holding a closed set has no constant array, enum type or one-of CHECK, so unknown values can be stored.
- `migrations-ledger/migrated-rows-unaudited-invariant` (SA2-527): A data migration writes rows that break an invariant the API or a design doc states, and no audit item counts them in production.
- `migrations-ledger/generated-expression-index-sql` (SA2-469): `db:generate` emitted an expression index containing a comma as broken SQL and the hand fix is not applied.
- `migrations-ledger/ledger-policy-undefined` (SA2-630): A migration adds snapshots, extends the frozen chain or squashes a baseline without a stated ledger policy.
- `domain-logic/amount-unit-mixing` (SA2-544): Numbers of different assets or units are summed or keyed together without regard to asset id or decimal places.
- `domain-logic/implicit-default-inference` (SA2-587) [review]: An omitted input is inferred from array position, an empty table or a default master, producing a value or rejection the contract does not state.
- `domain-logic/noop-write-restamp` (SA2-640): An UPDATE touches rows already in the target state, or unrelated rows, and rewrites `archivedAt` / `updatedAt`.
- `domain-logic/rate-orientation` (SA2-648): An exchange rate lookup prefers the direct orientation and ignores a newer rate stored in the inverse orientation.
- `domain-logic/ledger-line-order-by-id-text` (SA2-488): The lexical order of unpadded id text is used as input or display order, which breaks from the tenth item.
- `domain-logic/progress-fold-missing-events` (SA2-501): A fold over events handles only some event kinds and returns a stale value after the others (bust, re-entry).
- `domain-logic/seat-fit-invariant` (SA2-513): The "seated players fit `tableSize`" rule is rewritten per path, so one path over-rejects and another skips the check.
- `domain-logic/stat-definition-missing-data` (SA2-533) [review]: Missing or partial data is replaced by 0 or by the first row, giving a statistic the wrong denominator or unit.
- `domain-logic/manual-live-rule-divergence` (SA2-633): One domain rule is implemented separately for the manual path and the live path, and the two accept or produce different things.
- `domain-logic/rounding-and-zero-edges` (SA2-570): Rounding order and the sign, zero and carry edges are left undecided, and a test pins whatever the code outputs.
- `time-and-dates/server-default-event-time-not-monotonic` (SA2-493): An omitted `occurredAt` defaults to server now, which can fall before an earlier event stamped in the future and make the write fail.
- `error-handling/zero-row-write-misreported` (SA2-601): A write that changed zero rows is not told apart: it reports the wrong error, or returns `undefined` as success.
- `error-handling/internal-error-cause-dropped` (SA2-569): A `catch` discards the original error without logging it or passing it as `cause`.
- `error-handling/post-commit-failure-misreported` (SA2-502) [review]: A failure in a step after the write or merge has committed is reported as if the main operation failed.
- `error-handling/stored-payload-parse-policy` (SA2-617) [review]: A stored JSON row that fails to parse either fails the whole request or is silently skipped; the one broken row is not reported as such.
- `error-handling/upstream-error-collapsed-to-500` (SA2-481) [review]: Failures of an upstream provider or auth API are all returned as 500, including those the caller caused.
- `read-cost/user-wide-query-plan` (SA2-541): Only the `user_id` predicate is indexed, so a read by parent id scans every row of the user.
- `read-cost/stats-population-id-chunks` (SA2-576): A population is read by id list in chunks of 99, sequentially, so query count grows with the population on every screen.
- `read-cost/heavy-unbounded-list` (SA2-460): A list returns the full detail body for every row with no cap on count or response size.
- `read-cost/redundant-round-trips` (SA2-612): Rows the caller already read are read again, statements run one by one, or unchanged rows are rewritten, inflating the statement count of one operation.
- `read-cost/per-call-index-rebuild` (SA2-479) [review]: A linear search or an index rebuild sits inside a loop, making the work quadratic.
- `read-cost/undefined-list-order` (SA2-629): A list query has no `ORDER BY`, or no unique final key to break ties.
- `read-cost/redundant-prefix-index` (SA2-607): An index repeats the left prefix of another unique index on the same columns.
- `read-cost/per-request-rebuild` (SA2-614): An auth instance or MCP handler that could be built once per isolate is rebuilt on every request.

## Auth, OAuth and the Worker (`packages/auth`, `apps/server`, `packages/mcp`)

- `oauth-mcp-boundary/consent-destination-assumed-shape` (SA2-471): The consent page reads what the provider stored without checking its stored form, or shows registered destinations instead of this request's `redirect_uri`.
- `oauth-mcp-boundary/authorize-non-get-bypass` (SA2-485): A gate inspects only the query string, so a form POST to the same endpoint passes without it.
- `rate-limit/limiter-enabled-by-env-sniffing` (SA2-456): A protection is switched by `process.env` and verified only under Node, so it is off in the deployed Worker.
- `rate-limit/limiter-state-isolate-local` (SA2-674): A limit counter lives in isolate memory while the docs present it as the defence against an attacker's writes.
- `test-runtime-gap/node-env-gated-security-unobserved` (SA2-483): A rate limit, origin check or cookie attribute switches on `NODE_ENV`, and the tests observe a setting production (workerd) does not run.
- `web-auth-client/session-freshness-unhandled` (SA2-548): An operation better-auth guards with `freshAge` is called with no decision for sessions older than 24 hours and no way back for the user.
- `other/unversioned-password-hash` (SA2-650): Hash parameters are hard-coded in two places and the stored hash carries no marker of algorithm and cost.

## Web (`apps/web`)

- `web-ui/pending-state-opt-in` (SA2-524): The pending flag is an optional prop and is not passed, leaving a double submit or a dead button.
- `concurrency/form-sheet-double-submit` (SA2-523): `FormSheet` gets no `isLoading`, so Save stays enabled and the same request is sent twice.
- `concurrency/web-stale-async-offer` (SA2-663) [review]: An in-flight operation or an earlier Undo offer is not bound to the target it started on, and its result lands on UI state that has since changed.
- `web-ui/primitive-a11y-contract` (SA2-561): `role`, `aria-required` or the label association is left to each call site instead of the primitive, and a call site omits it.
- `web-ui/media-query-first-render` (SA2-545): `useMediaQuery` returns false on first render and width alone decides the desktop treatment.
- `web-ui/saved-value-toggle-contract` (SA2-586): Each user of `ToggleGroup` writes its own handling of the empty value, the default and a saved value, and they differ.
- `web-ui/destructive-action-flow` (SA2-509) [review]: Confirmation, pending state, failure copy and undo window of a destructive action are hand-written per screen.
- `web-ui/release-body-format` (SA2-597): The accepted format of a release body is undefined and the parser shows unexpected lines as they are.
- `error-handling/web-auth-call-uncaught` (SA2-536): An awaited `authClient` call has no catch: a network failure shows nothing and becomes an unhandled rejection.
- `web-auth-client/auth-client-result-error-ignored` (SA2-505): The `error` of an `authClient` `{data,error}` result is not read, so a failure is treated as success or as empty data.
- `web-auth-client/login-search-params-handling` (SA2-517): `/login` reads its query through the router's JSON-coerced values, or leaves the parameters in the URL after reading them.
- `error-handling/web-mutation-failure-path` (SA2-562) [review]: A mutation's failure path does not roll the optimistic state back, shows the wrong copy, or skips cleanup.
- `domain-logic/optimistic-rollback-state` (SA2-514): An optimistic-update helper ignores keys not yet fetched or data already settled, leaving failed data or applying a change twice.
- `web-session-cache/query-state-ignores-rehydration` (SA2-491) [review]: A decision uses only `data`, `isPending` or `isError` and ignores a rehydrated stale cache or a paused (offline) query.
- `web-session-cache/session-result-collapsed` (SA2-495): A failed `get-session` (HTTP error, unreachable) is not told apart from signed-out, or `navigator.onLine` decides the branch.
- `web-session-cache/cache-wipe-not-owner-scoped` (SA2-638): The persisted cache is wiped only on the success path of the Sign out button; failure, a race or another way the session ends leaves the previous user's data.
- `read-cost/session-refetch` (SA2-477): A route guard fetches the session over the network again on each navigation or form although it already has it.
- `input-validation/web-form-schema-drift` (SA2-613) [review]: A client schema is defined twice, or the validated value differs from the submitted value or from the server's constraint.
- `time-and-dates/web-raw-date-for-calendar-values` (SA2-521): A calendar day is built from `Date` without the shared helpers: UTC shift, a date-only string moving a day, or "today" frozen at render.
- `domain-logic/update-notes-viewed-vs-announced` (SA2-589): "Announced" and "viewed" share one record, so the New badge and auto-open conditions cannot both hold.
- `domain-logic/latest-version-source` (SA2-525): A build constant depends on the order an external API returns, and the deployed version is treated as the latest release.
- `structure-duplication/hand-rolled-fetch-state` (SA2-585): An `authClient` list is fetched with hand-written `useState` / `useEffect` and a cast, and misses changes made elsewhere.
- `structure-duplication/web-raw-call-beside-wrapper` (SA2-535): A toast or the post-sign-in navigation is written out with the same settings at each call site instead of the wrapper.
- `structure-duplication/shared-single-consumer` (SA2-568): A component with one consumer is placed under `shared/` or keeps a name that no longer fits its use.

## Tests the range adds or changes (any package)

These lines judge the tests the range adds or changes, and the contracts the range adds or changes. They do not override the admission gate in `.claude/rules/testing.md`: a `test-missing/*` or `test-scope-unprotected/*` line applies only when the range adds or changes the contract it names and that contract is in an area `testing.md` says needs protection, and it never asks for a test of a shape listed under "Admitting a New Test". A `test-low-value/*` instance is the nit that asks for the test to be deleted.

- `test-weak-assertion/fixture-cannot-discriminate` (SA2-641) [review]: Fixture values give the same result for the correct implementation and for the likely wrong one, so the test cannot fail.
- `test-weak-assertion/oracle-from-implementation` (SA2-470) [review]: The expected value is taken from the implementation's output, a constant or a hand copy, not from the specification or the real input shape.
- `test-weak-assertion/vacuous-assertion` (SA2-571) [review]: An assertion passes when its subject is broken: an empty loop, a selector that matches nothing, an any-value matcher.
- `test-weak-assertion/unanchored-throw` (SA2-609): `toThrow()` has no argument, so any error passes.
- `test-weak-assertion/title-overclaims` (SA2-480) [review]: The test name claims "all", "order" or "atomic" while the data or subject covers only part of it.
- `test-weak-assertion/boundary-value-untested` (SA2-500) [review]: The data never lands exactly on an inclusive bound or a limit, so an off-by-one is not detected.
- `test-weak-assertion/write-not-read-back` (SA2-676): A create or update is not read back and compared with the requested values, missing a dropped field, a field lost on partial update, or a null that clears.
- `test-weak-assertion/list-order-paging-unasserted` (SA2-566): List order or a cursor is checked with rows inserted in sorted order or without ties, so removing the sort still passes.
- `test-weak-assertion/race-guard-unexercised` (SA2-472): A concurrency or atomicity test never fires the competing write, and passes with the guard removed.
- `test-weak-assertion/web-action-wiring-unasserted` (SA2-573) [review]: A web test does not assert which row, provider or input value reaches the request, so a mix-up still passes.
- `test-weak-assertion/web-failure-path-untested` (SA2-516) [review]: A web failure is simulated only by throwing; the `{error}` result shape, the error display, retry and clearing of a stale error are not asserted.
- `test-weak-assertion/documented-rule-untested` (SA2-602): A calculation, rejection or branch rule the range writes into a design doc has no test at any layer.
- `test-weak-assertion/schema-agreement-shallow` (SA2-468): A declared-versus-installed schema comparison stops at names and does not compare expressions, predicates, defaults or extras.
- `test-weak-assertion/mcp-coupling-incomplete` (SA2-461): The coupling test does not pin a tool's name, annotations or union branch to its procedure.
- `test-weak-assertion/audit-part-no-violation-fixture` (SA2-584): A data-model audit item has no test with violating data, so emptying the check still passes.
- `test-missing/documented-rejection-untested` (SA2-608): A rejection rule in the Errors column of `api.md` (BAD_REQUEST / CONFLICT) has no case asserting the rejection and that the row is unchanged.
- `test-missing/success-output-unasserted` (SA2-492): A procedure, filter, output field or derived value is executed by no test, or its value is never asserted.
- `test-missing/write-time-guard-race-untested` (SA2-582): An in-batch reassert guard or a multi-statement write is never run with a competing write in between.
- `test-missing/auth-gate-negative-untested` (SA2-598) [review]: Removing a condition of an auth or token check (wrong password, expired, disabled, missing Origin) fails no test.
- `test-missing/foreign-id-rejection-untested` (SA2-645): A foreign-key id input has no FORBIDDEN case with another user's id or another entry's id.
- `test-missing/money-int-validation-untested` (SA2-590): A money or chip input writes `int().min(0)` by hand and has no rejection test at any layer.
- `test-missing/schema-boundary-unasserted` (SA2-475) [review]: A documented range, required, non-empty or URL-format bound has no pair of rows that separates accept from reject.
- `test-missing/migration-fixture-branch-gap` (SA2-619) [review]: A branch of the conversion rule stated at the top of a migration has no seed row, and its expected value is not asserted.
- `test-missing/migration-ledger-unchecked` (SA2-643): Nothing checks that applied migration SQL and the journal still correspond and are unchanged.
- `test-missing/worker-wiring-untested` (SA2-504): Worker wiring (secret hand-over, env validation, CORS, the 500 response, sign-up initialisation) is not exercised on the real path.
- `test-missing/web-async-edge-untested` (SA2-522) [review]: A hook's async edges (reject, double submit, retry, after a timer, unsupported environment, OAuth continuation) have no case.
- `test-missing/web-form-a11y-unprotected` (SA2-462) [review]: The binding of a validation error to its input by aria, suppression of native submit, and the alert role are not checked in a render test.
- `test-missing/web-section-without-test` (SA2-604): A screen section or navigation path is reached by no test at any layer.
- `test-missing/script-entry-untestable` (SA2-518): Decision logic sits in a script's `main` or in bash inside YAML, where it can be neither imported nor injected, and stays untested.
- `test-missing/script-rule-branch-untested` (SA2-537): A decision rule of a script that a design doc states (filter, cap, permission boundary) has no case.
- `test-scope-unprotected/other-user-rows-unobservable` (SA2-560): An integration test seeds only the caller's rows, so dropping the `userId` predicate fails nothing.
- `test-scope-unprotected/parent-filter-read-single-parent` (SA2-486) [review]: A list or verification read is tried with one parent only, so dropping the parent, version or archived filter still passes.
- `test-scope-unprotected/sibling-write-spill-unobservable` (SA2-625): Only one parent or sibling of the same user exists, so an update or delete that damages a neighbour's rows goes unnoticed.
- `test-scope-unprotected/foreign-id-matrix-incomplete` (SA2-496): The FORBIDDEN rows for another user's id and an unknown id are missing, or another check rejects first and the ownership check is never reached.
- `test-mock-boundary/sql-contract-on-chainable-mock-db` (SA2-631): A SQL contract (owner scope, order, bind limit, uniqueness) is asserted on a mock database that ignores WHERE.
- `test-mock-boundary/external-client-mocked-above-http` (SA2-636): An external service's SDK or response is replaced above the HTTP boundary, so the real request and response shape and retries are not exercised.
- `test-mock-boundary/auth-route-only-against-mocked-auth` (SA2-596): An auth or OAuth path is tested only against a mocked auth module, with no case through the real Worker and real better-auth.
- `test-mock-boundary/primitive-or-query-client-mocked` (SA2-610): `Drawer`, vaul or `QueryClient` is replaced by a hand-made mock and only the props passed are asserted.
- `test-mock-boundary/component-test-mocks-own-hook` (SA2-556): A component test mocks its own feature's hook or context, so state transitions and wiring are not tested through.
- `test-mock-boundary/integration-test-bypasses-entry-point` (SA2-467): An integration test uses a hand-built batch, a custom Proxy or a direct service call and does not go through the router.
- `test-mock-boundary/web-node-isolation-with-mocks` (SA2-624): A module mock is registered in the `web-node` project (`isolate: false`) and leaks across files.
- `test-runtime-gap/test-harness-diverges-from-production-defaults` (SA2-547): A shared test harness default differs from production (foreign keys off, its own `QueryClient`, no `matchMedia`, search parser bypassed).
- `test-runtime-gap/runner-tz-equals-app-default` (SA2-622): The runner's zone equals the product default (Asia/Tokyo), so a missing-zone fallback or a host-zone date derivation cannot be detected.
- `test-runtime-gap/test-side-effects-escape-sandbox` (SA2-634): A stub lets unknown outbound requests through, or a child process writes to the CI job summary.
- `test-low-value/cross-layer-duplicate` (SA2-577) [review]: One contract is asserted at several layers or files, and none is named as its owner.
- `test-low-value/same-path-duplicate` (SA2-511) [review]: A second case goes down a branch an existing case already takes, or is an exact duplicate.
- `test-low-value/declaration-restated` (SA2-512) [review]: A test restates a Zod declaration, a constant table, a config value or a library default as its expectation.
- `test-low-value/unreachable-or-cannot-fail` (SA2-478) [review]: A test sets up a state or input the API or config cannot produce, or an assertion that survives breaking the implementation.
- `test-low-value/implementation-internals-pinned` (SA2-579) [review]: A test pins internals that are not a contract: call counts, statement counts, generated source text, forwarding wrappers, its own mock's return value.
- `test-low-value/exact-wording-pinned` (SA2-554): Error text or UI copy that no machine interprets is pinned verbatim.
- `test-low-value/mega-case-mixed-contracts` (SA2-473) [review]: One test case packs many unrelated contracts, so its title and body diverge and a failure does not say which contract broke.
- `test-low-value/test-only-callers` (SA2-575): A test enters through a function, setter or test-defined component that production code never calls.
- `test-low-value/test-misplaced-file` (SA2-510) [review]: A test lives in a file or package other than its unit's, so the file name no longer says what it holds.
- `test-low-value/frozen-migration-specs` (SA2-463): A spec is kept or added for a migration already applied in production whose tables are gone.
- `test-cost/unlabeled-loop-assertions` (SA2-600) [review]: An `expect` inside a table or loop has no label, so a failure does not say which input, procedure or row broke.
- `test-cost/per-case-schema-replay` (SA2-484): Each integration case or file rebuilds the schema or reloads config that one worker needs once.
- `test-cost/expensive-setup-repeated-per-case` (SA2-519) [review]: A check of one shape, or of input validation only, pays expensive setup per case (database start, audit run, history rebuild).
- `test-cost/domain-seeding-in-shared-fixture` (SA2-550) [review]: Domain seed data is mixed into the shared fixture, or a test builds bulk data through the API or row by row.
- `test-cost/migration-spec-harness-copies` (SA2-558): A migration spec carries its own copy of apply / values / seed chain instead of the shared `sqlite.ts`.
- `test-cost/mega-case-mixed-contracts` (SA2-599) [review]: One long case holds independent contracts with no named stages.
- `test-cost/harness-cleanup-not-guaranteed` (SA2-626): Cleanup of temp directories, mocks or stubs is left to each test and does not run on failure or exit.

## Structure (any source file)

- `structure-duplication/dead-exports` (SA2-623): An export, barrel re-export, return value, column or helper is left with no production user.
- `structure-duplication/unreachable-branch` (SA2-490) [review]: A branch that cannot be reached, a guard that is trivially true, a repeated check or an unneeded piece of state is left in.
- `structure-duplication/api-helper-bypass` (SA2-621): A schema, guard, error function or `Db` type is rewritten in a file although a shared helper or type exists.
- `structure-duplication/rule-implemented-twice` (SA2-557) [review]: One business rule (validation, aggregation, guard condition) is implemented separately on the write side and the read side.
- `structure-duplication/hand-copied-shape` (SA2-642) [review]: A type, shape or name derivable from a schema or constant is copied by hand and reconciled with a cast.
- `structure-duplication/hand-kept-parallel-lists` (SA2-508): The same correspondence (rule to paths, tool name to procedure, linked versions) is written by hand in several places.
- `structure-duplication/misusable-helper-api` (SA2-515): A helper's API is safe only if the caller is careful: required adjacent ordering, hand-counted arguments, positional arguments, a fake context.
- `structure-duplication/closed-set-as-string` (SA2-661): A closed key set is typed as `string` and unknown keys fall into a default branch or one of several hand lists.
- `structure-duplication/ownership-helper-copies` (SA2-539) [review]: An ownership check is hand-written per entity: fetched by id alone and compared with `user_id` in JavaScript.
- `structure-duplication/kind-ops-asymmetry` (SA2-581): Cash and tournament expose differently shaped APIs for the same operation, and callers branch on kind and recompute.
- `structure-duplication/router-service-boundary` (SA2-664): Service-level logic sits in a router, leading to router-to-router imports or a copy in another router.
- `structure-duplication/oversized-mixed-module` (SA2-649): One file stacks several responsibilities (schemas, reads, writes) beyond the size guideline.
- `structure-duplication/infra-copy-paste` (SA2-667) [review]: Workflow shell, script constants or migration-spec helpers are copied between files.
- `structure-duplication/unused-deps-config` (SA2-506): An unused dependency, config option, CSS token or scaffold file is left in.

## Docs and rule files (`docs/`, `.claude/`, READMEs)

- `docs-drift/design-doc-contradicts-behaviour` (SA2-552) [review]: A design doc states behaviour the code in the range does not have, and which one is intended is not decided.
- `docs-drift/api-contract-row-incomplete` (SA2-588) [review]: A procedure's error codes, order, required conditions or response shape are missing from `api.md` or the MCP description.
- `docs-drift/load-bearing-mechanism-undocumented` (SA2-635) [review]: A mechanism, constraint or reason that other code or operations rely on is written neither in code nor in a design doc.
- `docs-drift/tooling-doc-claims-absent-behaviour` (SA2-592) [review]: A rule file or tooling doc describes a check, test harness or code that does not exist or was deleted.
- `docs-drift/rule-duplicated-across-docs` (SA2-457) [review]: One rule is written in two docs (`api.md` and `data-model.md`, for example) and the range updates only one.
- `docs-drift/dead-doc-reference` (SA2-464): A doc or rule refers to a path, link, anchor or check that does not exist.
- `docs-drift/doc-restates-code-owned-list` (SA2-594): A doc hand-copies a list the code owns (routers, rule files, workflows, counts) and the range adds to the code only.
- `docs-drift/bilingual-doc-mirror-drift` (SA2-565): Only one of an English / Japanese document pair is updated.
- `docs-drift/migration-lifecycle-unrecorded` (SA2-606) [review]: The frozen-chain boundary, whether a migration is applied, when its spec retires, or what happens on failure is not recorded in one place.
- `docs-drift/workflow-secret-scope-claim` (SA2-580): A doc says only the base-side job holds a secret while a job that checks out PR code holds it too.
- `docs-drift/rule-prescribes-unsafe-raw-form` (SA2-660): A rule prescribes a raw form that produces the mistake (`Number()`, `rows[0]` column count) where a shared helper should exist.

## Workflows, scripts and agent configuration (`.github/`, `scripts/`, `.claude/`, `.husky/`)

- `automation-trust/secret-reaches-pr-code` (SA2-549): A secret is given to a whole workflow, to a job or shell string that runs PR code, instead of the one step that needs it.
- `automation-trust/decision-trusts-pr-controlled-input` (SA2-652): An automatic decision (auto-merge) trusts a value computed by PR-side code or a comment whose author is not verified.
- `automation-trust/agent-boundary-client-side-only` (SA2-534): A ban on merge, production release or audit actions is enforced only by a `settings.json` prefix match or by prose, with nothing server-side.
- `automation-trust/workflow-least-privilege` (SA2-669): A workflow has no `permissions` block, no SHA pin, no concurrency or no actor restriction and runs with the broad default.
- `prod-data-in-preview/raw-prod-dump-seed` (SA2-458): A raw production D1 export is loaded into a preview or dev database without removing credentials and personal data.
- `prod-data-in-preview/prod-secret-in-nonprod-worker` (SA2-507): A preview or dev Worker receives the production secret as is (`wrangler secret put`).
- `prod-data-in-preview/credential-in-client-env` (SA2-675): A credential is defined as a `VITE_*` client variable and inlined in the public bundle.
- `deploy-pipeline/production-entry-unguarded` (SA2-487): A production deploy or migration can run from a ref that is not a release tag, from an unused trigger, or from a local machine.
- `deploy-pipeline/preview-lifecycle-leak` (SA2-647): Preview start conditions and cleanup (trigger, exclusivity, failure detection) do not match, leaving or needlessly creating resources.
- `deploy-pipeline/deploy-step-not-rerun-safe` (SA2-591) [review]: A destructive step, or a side step that can fail, runs before the main one, so a mid-way failure or a re-run leaves a broken state.
- `deploy-pipeline/optional-secret-pushed-raw` (SA2-578): A secret documented as optional is pushed by each workflow even when empty.
- `local-gates-ci/gate-scope-allowlist` (SA2-503): The scope of type checking, test assignment or coverage is an explicit list, so a new config or harness file falls outside every check.
- `local-gates-ci/check-matches-one-spelling` (SA2-611): A `check-rules` or trailer regular expression matches one spelling only, and another way of writing the same thing passes.
- `local-gates-ci/greppable-rule-without-check` (SA2-559): A rule that can be detected mechanically is added as prose with no matching `check-rules` check.
- `local-gates-ci/hook-separation-denylist` (SA2-546): The hook-separation check relies on a hand-written deny list and file exclusions and misses `useContext` and `use-*.tsx`.
- `local-gates-ci/stop-hook-gate-ineffective` (SA2-459): The Stop hook tests nothing after a commit, or does not exit non-zero on failure.
- `local-gates-ci/changed-selection-blind-spots` (SA2-595): `--changed` selects no test for a change to SQL, TOML, YAML or a file without a dependency edge.
- `local-gates-ci/drizzle-ledger-unchecked` (SA2-639): Agreement of the schema with `migrations/meta` is left to a written procedure and not checked in CI.
- `local-gates-ci/ci-workflow-hygiene` (SA2-567): A workflow job has no timeout, concurrency or cache, or reports only the first failure of a run.
- `review-workflow-state/linear-status-ownership` (SA2-499): A workflow moves a Linear status by an ad-hoc condition instead of the owner table, leaving an issue stuck or overwriting a human's status.
- `review-workflow-state/workflow-concurrency-cancel` (SA2-603): Workflow-level concurrency is evaluated before `if`, so an unrelated event cancels a run in progress.
- `review-workflow-state/review-round-state-marker` (SA2-605): The state comment marker cannot tell required states apart, and the gate returns a decision for an invalid combination.
- `review-workflow-state/ci-status-single-definition` (SA2-671): "CI passed" is defined separately in `pr-watch` and the review workflow, with different checks or failure sets.
- `review-workflow-state/release-pr-window` (SA2-615): The PRs in a release are approximated instead of derived from git history, and notes and the Released move pick the wrong set.
- `audit-gate/audit-invariant-stricter-than-writer` (SA2-668): A deploy-blocking audit checks an invariant that the API or the registration path does not guarantee.
- `audit-gate/audit-cli-unvalidated-input` (SA2-572) [review]: An audit CLI accepts arguments or ledger content without validation and silently corrupts the ledger.
