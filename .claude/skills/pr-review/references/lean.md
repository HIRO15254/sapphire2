# PR review — full read, risk questions and evidence

Review the supplied committed range. This review is the last check before a human merges, and the human reads `approve` as "nothing in this change will hurt a user". A defect that passes stays in `dev` until someone trips over it: approved PRs later turned out to carry lost updates, dangling references, unbounded inputs and authentication gaps, on paths the reviews had never opened or had named as unchecked in a closing sentence. The job is therefore to finish the review of everything the range changes, at the depth the change needs, and to state for each risk what is established, what is refuted and what is still open. A large diff takes a long review. Do not trade coverage for speed and do not stop at the first finding.

Read AGENTS.md and the rule files applying to changed paths. The specification is the linked Linear issue (description and comments); the author intent is the commit message for this range. Review only; do not edit tracked files or post unless explicitly instructed. A full review covers the supplied range; an incremental review covers changes since the last reviewed SHA and checks previous findings first.

## Read the change

Use one reviewer context. Read every changed source file in the range at HEAD in full, not only its hunks; generated files (lockfile, Drizzle `meta/`, route tree) need only a consistency check against their source. Then follow what the diff cannot show: callers of changed functions, the other writers and readers of the tables, columns and stored payloads the change touches, the schema, and the installed source of a library whose behaviour the change relies on. Leave mechanical lint, type and `check:rules` results to CI.

For changed guards, defaults, filters, mappings or deleted hooks/routes, enumerate the affected inputs and entry points with focused searches. Include untouched callers that still reach the changed behavior. In a removed authentication continuation, search all calls that create a session, including multiline call syntax, preview/background entry points, signup and social login; do not stop at the login form.

For each changed aggregate, compare the contributing rows and units of related outputs. Distinguish missing from zero, absent from explicitly supplied, finished from live, cash from tournament, currency from BB. A numeric difference is a candidate only if the public contract or intended use requires equality/comparability.

If API/MCP descriptions, schemas, or their handlers change, make a compact internal claim ledger: each changed factual claim → implementing handler/schema → supported / contradicted / unsettled. Check required/optional fields, response shape, overwrite/merge behavior, contributing rows, units and defaults.

## Ask the risk questions

For every procedure, handler, service function, migration and hook the range adds or changes, answer each question below that applies, and keep the answers in an internal ledger: unit → question → code read or command run → safe / defect / open. These are the ways changes in this codebase have gone wrong; the rule files give the background for several. Only code you read or ran answers a question. Not having looked is `open`, never `safe`, and an `open` answer is reported (see Report), not dropped.

- **Write after read.** Does a write depend on something read in an earlier statement (existence, ownership, a parent link, a current value, a count, an order position)? Then look for that fact asserted inside the write batch. Walk through two requests interleaving between the read and the write — a double submit, two tabs, the web and an MCP client — and say what each one persists. A request that answers success while its effect is overwritten or was planned from a value another request has since replaced, and a row committed for a request that then answers an error, are defects, not acceptable last-writer-wins: the batch reasserts what was read and the loser gets CONFLICT.
- **Multi-statement writes.** Are they one `db.batch()`? What state remains if the second statement fails? Can a multi-row statement exceed 100 bound parameters at the largest input the schema allows?
- **Delete, archive, rename.** What still refers to the removed or changed thing? Search foreign keys and their `onDelete`, and also ids kept outside foreign keys: JSON columns, saved filters and presets, snapshots, client caches. What does each reader do when it meets the dangling id — skip it, or fail the whole request?
- **Migration against existing rows.** Take rows as earlier migrations and the old code left them, including rows this migration backfills or defaults, and pass them through the validators and procedures of this range: read, partial update, copy, delete. Does any reject or corrupt them? Is the migration safe on the data shapes production can hold, not only on the fixture?
- **Input shape.** Are numbers, timestamps, string lengths and array sizes bounded where an extreme value would corrupt a result or cost money? Do create and update carry the same cross-field rules? Is a stored payload validated on write by the same schema that later re-parses it?
- **Ownership.** Is every id in the input checked against the caller, including ids nested in arrays and payloads, and are joins, bulk statements and cursors scoped to the caller?
- **Sessions, OAuth and state-changing endpoints.** For a changed endpoint that changes state or issues a credential: which requests reach it (each method, parameters in the query or in the body), and does every one of them pass the gate the change relies on? Where the flow depends on what an auth library stores, returns, requires or enforces by default (how a stored field is encoded, how old a session may be for a sensitive action, how long a token lives), read the installed source instead of the type or the documentation.
- **What the screen or message claims.** When the change shows the user a fact to decide on (a consent target, an amount, a count, a status), trace the displayed value back to the data of this request and confirm it is that fact, as stored, and not a neighbouring one.
- **Paid or limited upstream calls.** Is a new call to a paid or rate-limited service bounded per user and per request, and what happens on retry?
- **Failure and repeat.** What does the user see when the request fails at the network level or returns an error, and what happens on a second submit while the first is pending?
- **Lifetime of the assumption.** Does the code assume a state that can change outside this flow (a clock, a row still present, a setting, the order in which migration and code deploy)?

## Check the recurring patterns

The risk questions look for the deep defects. Most of what the full review of `dev` found was smaller: 1,105 findings, mostly low, that entered one PR at a time and recur as 190 patterns. Read [patterns.md](patterns.md), take the sections whose scope matches the changed paths, and decide for every line in them whether the range adds a new instance, following "How to apply" in that file. Do this after the full read, from the files already read; it is a pass over the list, not a second reading of the code. An instance the range does not touch is out of scope.

## Check against the issue

With a readable issue, write a compact internal requirement ledger before judging the diff: each acceptance criterion, requested behaviour, constraint and recorded decision → implementing file:line → met / missing / contradicted / deferred / unsettled. Comments record decisions made after the description (answered questions, dropped controls, user-directed changes, phase splits); a later decision supersedes the earlier text it addresses. A requirement is met only when the code path a user or client reaches delivers it — not because a name, test title or the PR description says so. Existing code untouched by the diff can meet a requirement; cite it.

- **missing / contradicted** is a candidate like any other and goes through settlement. Quote the requirement as the answer to "why is this wrong". Important when the issue promises user/client-visible behaviour, a data or security contract, or a persisted result and a reachable path does not deliver it; otherwise nit.
- **deferred** requires a named destination: a split or deferral recorded in the issue or the PR body naming another issue. A deferral without one is a nit, not a missing requirement.
- **unsettled**: wording admits several readings or needs a product decision → unverified, quoting the requirement and the competing readings. A departure from the issue justified only in the PR body or commit message is also unverified: the decision is not recorded in the issue.
- Changes beyond the issue's scope are not findings by themselves; review them like any other change.

In incremental mode, re-check only requirements left missing / contradicted / unsettled in the previous round and those the new diff touches.

## Settle each candidate

Record every `defect` and `open` answer and every other concrete candidate with all affected locations, then settle each one in this context. Merge by root cause but keep distinct entry points and their individual status. There is no minimum finding count; do not manufacture issues.

Each candidate needs two separate answers:

1. Can a reachable input produce the behavior? Trace it from the public input or persisted data through upstream mapping to the changed code, or run it. A hand-built helper input that public callers cannot produce is not proof of a production failure. Where the defect is something absent (no guard in the batch, no cleanup of a stored id, no ownership check, no bound), reading establishes it: cite the read and the dependent write, or the delete and the surviving reference, and where the missing piece would have to be. An interleaving or a hostile request does not have to be executed to count as reachable.
2. Why is that behavior wrong for this change? Cite a concrete promised behavior, input contract or harmful consequence. Read the established semantics, including design rationale in `docs/design/` and callers, before interpreting ambiguous words in the commit message. Intentionally computed observations and defaults are not automatically missing data. A matching field name in two APIs does not by itself promise identical semantics, and a scoped fix does not by itself promise to change every other API. Mark an incomplete fix only when a demonstrated path violates the behavior this change promises. If intent is unsettled, report a question rather than an important defect.

Seek counterevidence as actively as evidence: existing guards, unique indexes, upstream validation, intended compatibility behavior, the library implementation, tests. A file/line citation by itself is not proof that the behavior is erroneous, and existing tests can show behavior but cannot alone establish that it is correct.

Prefer settling to deferring. Read library source for library claims. Run the narrow existing test that exercises the path. When reading leaves a result in doubt and file writing is available, add a temporary test beside the code under test, run it with the scoped Vitest project, and remove it afterwards; it is never committed. For a claim that a test detects a regression, execute the test and confirm it ran: zero selected tests, all skipped, or a nonexistent `-t` name are not verification. Never present a proposed command as executed. A test harness can switch a protection off (better-auth skips its origin check when `NODE_ENV` is `test`); before reporting that a protection is missing, confirm the result with the deployed settings. Run scoped Vitest projects only; the full suite, installs, builds and blanket type-checking belong to CI.

Rules guide intent but do not override observable runtime behavior. If a rule contradicts the installed dependency, give both citations and leave the policy conflict unresolved. New findings, incomplete fixes, and pre-existing problems have separate labels; do not count the latter two as new regressions.

Review the tests the range adds as well. A new test whose shape is listed under "Admitting a New Test" in `.claude/rules/testing.md` is a nit (scope new): name the test, quote the listed shape and suggest deleting it. Group a file's offending tests into one row. An existing test the range does not touch is out of scope. A missing test is not important by itself; when the range changes a contract in an area `testing.md` names as needing protection (authentication, authorization, money, persistence, concurrency, date boundaries) and nothing would fail if that contract broke, report it as a nit naming the regression a test would catch.

## Report

Return Japanese, at most 60 lines. Three tiers:

- **important** — an established user/client failure, incorrect result, data loss/corruption or security gap. It blocks the merge.
- **unverified** — a question a human or the author must close before relying on this review: a risk question still `open` on a changed write, delete, migration, authentication or money path; a candidate with a plausible path that could not be settled; an unsettled requirement. Each row says what is not settled and the command, test, source file or decision that would settle it. A coverage gap of this kind is a row here, never only a remark in the coverage line.
- **nit** — nonblocking and cheap to fix in this PR, costly to rediscover later: a new instance of a pattern in `patterns.md` with no established harm, a statement in `docs/` or a rule file the range makes false, dead code or an unused export the range leaves behind, a new test of a non-admitted shape, the missing protection described above, a rule-file convention CI does not check. One row per pattern or kind, listing its locations; a pattern row starts its scenario with the pattern id and issue. Style preferences and harmless leftovers are omitted.

Use one table with tier, scope (new / incomplete-fix / pre-existing / spec), every affected file:line, the scenario, and evidence. Scope `spec` marks an issue requirement that is missing or contradicted; its evidence quotes the requirement. An uncertain contract interpretation is unverified, not important. Intentional behavior with no demonstrated harm is omitted. Empty findings is valid when the ledger has no `defect` and no `open` answer left and no pattern line applies. If the table would pass the line limit, keep the important and unverified rows whole and merge the remaining pattern nits into one row of `pattern id: locations`. Do not precede the table with a general assurance that contracts are correct.

Add one issue line with met/total requirements and deferred items (or why no issue was checked), and one coverage line: the units whose risk questions were answered, the `patterns.md` sections checked, the areas not reviewed and why, and the tests actually executed with selected/pass/fail counts. Mark an interrupted or incomplete review as incomplete rather than approve.

For compatibility with the PR workflow, end with:
<!-- pr-review: {"verdict":"approve","important":0,"nit":0,"unverified":0,"resolved":[]} -->

Use changes-requested only for established important issues. `approve` with `unverified` above zero means "no established defect, and these questions are open"; say so in the verdict line. In incremental mode, resolve a previous finding only when its recorded path is fixed; rejected or unverified findings are not marked resolved. No posting in evaluation runs.
