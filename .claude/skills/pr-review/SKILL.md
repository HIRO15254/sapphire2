---
name: pr-review
description: Multi-agent pull-request review for sapphire2 — parallel finders (generic bugs, logic/security, one reviewer per touched rule file), one validator per candidate that must run tests or read library source, confidence-gated posting, three severity tiers, a fixed summary. Use when invoked as `/pr-review` from CI or locally to review a diff before pushing.
---

## User Input

```text
$ARGUMENTS
```

Arguments, all optional except `mode`:

- `full` | `incremental` — `full` reviews the whole range; `incremental` reviews only what changed since the previous review and settles that round's threads first.
- `--range <base>...<head>` — the diff under review. CI passes `origin/<base>...HEAD`. Locally, default to `origin/dev...HEAD`.
- `--since <sha>` — incremental only: the head the previous round reviewed. The incremental scope is `git diff <sha>...HEAD`.
- `--round <n> --max <n>` — the automatic round number and cap; only used for the closing line of the summary.
- `--pr <number>` — the pull request; enables `gh pr view` for title/body and is required for `--post`.
- `--post` — post inline comments with `mcp__github_inline_comment__create_inline_comment`. Without it, report only (local use and evaluation runs).

Why this skill exists, and the data behind every rule below: [`docs/design/pr-review.md`](../../../docs/design/pr-review.md). Its shape is the official `code-review` plugin (finders → one validator per candidate → confidence gate → post) with this repository's rule files injected into the finders and test execution injected into the validators.

**Agent assumptions (repeat verbatim to every subagent):** all tools work; do not test tools or make exploratory calls; call a tool only when the task needs it; never write to the working tree except temporary files under `$TMPDIR`; ignore the working-tree state and review committed history only.

**Subagent mechanics:** launch every finder and validator with `run_in_background: false` so its result comes back in the tool result. If a launch still returns an asynchronous notice, do not poll (`ReadNotifications`, `sleep`, `Monitor` loops); stop and wait for the completion notifications, then continue. If no subagent tool is available at all, run each finder pass and each validation yourself, in this context, one after another, with the same instructions and the same output schemas.

## Step 0 — Scope

1. Resolve the range. Run `git diff --name-only <range>` and `git diff --stat <range>`. In `incremental` mode the range for finding is `<since>...HEAD`; the full range is still available to validators for context.
2. If `--pr` is given, run `gh pr view <n> --json title,body` once for the author's intent. Otherwise use `git log --format='%s%n%b' <range>`.
3. Map touched paths to rule files (from the table in `AGENTS.md`), and read only the files that apply:

   | Touched path | Rule files |
   |---|---|
   | `apps/web/**` | `web-architecture.md`, `web-hooks-separation.md`, `web-forms.md`, `web-ui.md`, `web-data-fetching.md`, `web-theme.md`, `datetime-and-numbers.md` |
   | `packages/api/**`, `apps/server/**` | `api-security.md`, `api-data-integrity.md`, `datetime-and-numbers.md`, `ai-models.md`, `mcp-tools.md` |
   | `packages/db/**` | `api-data-integrity.md`, `db-migrations.md` |
   | `packages/mcp/**` | `mcp-tools.md` |
   | `apps/**`, `packages/**`, `scripts/**` | `comments.md` (mechanically enforced by `check:rules`; only flag what the script cannot see) |

4. In `incremental` mode, collect the previous round's inline threads from the PR context you were given (path, line, first comment). They are settled in Step 3, not re-found.

Do not run an eligibility check: the workflow's gate job already decided this run should happen, and a local invocation is an explicit request.

## Step 1 — Finders (parallel Task subagents)

Build the finder scope first:

1. Run `git diff --name-only <range>` and `git diff --numstat <range>`. Source files are everything except `**/__tests__/**`, `*.test.*`, `*.md`, `packages/db/src/migrations/meta/**`, and lockfiles. Test and doc files stay available to F2 and to validators.
2. Group the source files into shards by directory, keeping the files of one feature together: at most 8 files and at most 800 changed lines per shard. A diff with 8 or fewer source files is a single shard.

Launch all applicable finders in parallel. Give each: the range and its file list, the PR title/body, the agent assumptions, the candidate schema below, and the **What NOT to flag** list at the end of this file. Every candidate must name a concrete failure scenario; a candidate without one is discarded before validation. A real bug a finder notices outside its remit is still returned as a candidate with `rule_citation: none`, never as a side remark: validators decide, finders do not self-censor.

Candidate schema (one object per candidate):

```text
file, line, title (≤ 80 chars), tier guess (important | nit | pre-existing),
failure_scenario (input or state → wrong result), rule_citation (rule file + quoted sentence, or "none"),
confidence (0–100: how sure you are this is real and in scope)
```

- **F1 · hunk walk (sonnet, one per shard, at most 10 candidates)** — runs `git diff <range> -- <shard files>` and reads nothing else except the enclosing function of a hunk that is ambiguous on its own. It walks every added or modified line and stops at each: a comparison or boolean condition; `.length`, an index, a slice, `Object.keys` / `entries` / `values`; a regex literal (what else does it match?); a default or fallback (`??`, `||`, default parameter); an early return or guard; string matching or parsing; a unit, currency, or timezone conversion; an async call without `await` or a rejection handler; a changed signature and its callers inside the shard. For each stop it writes the one input or state that makes the line wrong, checks that input against the surrounding hunk, and emits the candidate only when the check holds. Cheap and high-recall by design: precision comes from the validators.
- **F2 · logic and security with context (opus; one finder for up to 20 source files, otherwise one per area: web, api + server, db + mcp; at most 8 candidates each)** — the official plugin's agent 4, plus this repository's recurring hazards: unscoped D1 queries (ownership), more than 100 bound parameters, multi-statement writes outside `db.batch()`, date-only values read with local getters, a migration that can die mid-file, an MCP description that would make a model issue a failing or data-losing call. Opens the enclosing function and the direct callers. Two further angles it must cover, and the orchestrator passes them verbatim rather than narrowing them to the paths it happens to notice: **flow interactions** — before writing candidates, the finder writes an entity table: for every entity this diff creates, deletes, or updates, every code path that creates it (including automatic or background creation), every path that deletes or overwrites it, and every path that reads it, untouched paths included; then for each ordered pair (a path that removes or changes the entity, a path that creates or re-creates it) it states what a user gets who performs the first and then triggers the second, and turns every inconsistency into a candidate; and **fix coverage** — a bug this PR claims to fix must have a test that fails without the fix.
- **F7 · user journeys (sonnet, at most 8 candidates)** — only when the diff touches `apps/web/**` or `packages/mcp/**`. From the PR title/body and the diff, lists the user-visible journeys the change adds or alters (for MCP: the tool calls a model would issue after reading the descriptions), then walks each as a scenario at the code level: the happy path; the same action done twice, on a second device, or with a second account; the undo (delete or cancel) followed by the action that originally created the thing; the journey started from a different entry point (a deep link, a redirect, a background job); the journey with an expired session or a failed request in the middle. A journey step whose outcome the user would not expect is a candidate.
- **F8 · description claims (sonnet, only when `packages/mcp/**` is touched, at most 12 candidates)** — for every tool whose definition this diff adds or edits, splits the description into its factual claims (what the call returns, which fields are required or optional, what a partial update does to fields that are not supplied, what replaces a list versus merges it, what a rename or delete does to rows that reference the entity, what another tool must be called first, and every exclusion reason in `DELIBERATELY_EXCLUDED`), then checks each claim against the router handler, its Zod input schema, and the schema of the table it writes. A claim the handler does not honour is a candidate: `important` when a model following it would issue a failing call or lose data, `nit` otherwise. This is the class of defect that took the old reviewer 36 rounds on one PR.
- **F3…F6 · rule reviewers (sonnet), one per touched area** — web, api/server, db, mcp. Each gets the rule files for its area and only the diff for its paths. Flag only a violation you can quote; the quote goes in `rule_citation`. Skip anything `scripts/check-rules.ts` or Ultracite already enforces.
- **Incremental mode only** — every finder also receives the list of previous-round threads and is told: candidates are limited to (a) a regression introduced by a fix, or (b) an important-tier issue in the new diff.

## Step 2 — Validators (parallel subagents, grouped by file)

Dedupe first: candidates on the same line or the same mechanism become one candidate carrying both descriptions. Then assign a model per candidate: **opus** when the finder's tier guess is `important`; **sonnet** when it is `nit` or `pre-existing`, or when the only claim is a rule citation (the check is that the rule's `paths:` cover the file, the quoted sentence applies, and the code does what the sentence forbids). Group the candidates of the same file and the same model into one validator, at most 3 candidates per validator, and launch at most 12 validators; every candidate a finder returned is validated unless that cap is hit, in which case drop the lowest finder confidence first and count the dropped ones in the summary. A validator returns one verdict block per candidate; low finder confidence is not a reason to skip validation, it is the reason validation exists.

Each validator gets the candidate, the diff, the PR intent and the agent assumptions, and returns:

```text
verdict (CONFIRMED | PLAUSIBLE | REFUTED), tier (important | nit | pre-existing),
evidence, confidence (0–100), settle_command (PLAUSIBLE only)
```

Validation is evidence-based, never a re-reading of the finder's argument:

- Read the code at `file:line`, the enclosing function and the direct callers. CONFIRMED needs a specific input or state that triggers the failure plus a quoted line; REFUTED needs a quoted guard, type, or invariant that makes the scenario impossible, or an observable-effect argument.
- A claim about a library's behaviour must be read from its source under `node_modules/` or exercised; a claim about a test's detection power must be checked by running it. Run the narrowest project: `bunx vitest run --project <web-node|web-dom|api|server|db|mcp|env|scripts> <path>`; `bun run check-types` or `bun run check:rules` when the claim is about them. If you cannot run anything relevant, say so in `evidence` and return PLAUSIBLE, never CONFIRMED.
- PLAUSIBLE means a real mechanism whose activation you could not settle; `settle_command` is the exact command or test the author can run.
- A rule-file violation is CONFIRMED with confidence ≥ 90 when the rule's `paths:` cover the file and the quoted sentence applies; do not refute it by reinterpreting the rule's intent or by pointing at untouched code that violates it too (that is a pre-existing finding, not a refutation), and do not discount its confidence because the consequence is "only" a UX or convention issue. The rule files are the team's decisions.
- For migrations, the semantics in `.claude/rules/db-migrations.md` are authoritative: `wrangler` streams statements and a file can die mid-way, so "the whole file runs in one transaction" is never a valid refutation. A backfill that can abort on legacy rows, or that does not self-heal on retry, is important-tier.
- Tier is decided here, not by the finder: **important** = wrong behaviour a user or an MCP client will hit, data loss or corruption, a security gap, a migration that can stop production, or a missing test for a bug this PR fixes; **nit** = real but cosmetic or edge-case, or a rule violation with no observed failure; **pre-existing** = real but not introduced by this range.

## Step 3 — Filter and rank

1. Drop REFUTED. Drop anything with confidence below **80**. Drop anything on the What NOT to flag list.
2. Dedupe candidates that point at the same line or the same mechanism; keep the better-evidenced one.
3. Cap inline **nit** comments at **5**; the rest are counted in the summary. In `incremental` mode nits are never inline.
4. PLAUSIBLE survivors are posted as `[unverified]`: no tier, never blocking, must carry `settle_command`.
5. `incremental` mode: one **sonnet** subagent settles every previous-round thread as fixed / not addressed / declined (declined = the author replied `Won't fix` or refuted it), by reading the diff since `--since` and the author's replies. Fixed threads go into the trailer's `resolved` list as `path:line` of the original comment.

## Step 4 — Post (only with `--post`)

Post one inline comment per surviving finding with `mcp__github_inline_comment__create_inline_comment` and `confirmed: true`. The first token of the body is the tier tag: `**[important]**`, `**[nit]**`, `**[pre-existing]**`, or `**[unverified]**`. Then one paragraph: the failure scenario and the evidence (file:line, command output). Cite a rule file when one applies. Add a committable suggestion only when applying it fixes the issue entirely. Never post a duplicate of an existing thread. Never run `gh pr comment`: the summary is your final message and the workflow's tracking comment carries it.

## Step 5 — Summary (your final message, in Japanese, under 40 lines, nothing before or after it)

```markdown
### Verdict: approve | changes-requested
One sentence. `changes-requested` only while an important-tier finding is open.

### Findings
| # | tier | location | one line |   ← inline findings first, then counted nits; omit the table when empty

### Previous round        ← incremental mode only
| finding | fixed / not addressed / declined |

### Checked               ← full mode only, one line ≤ 120 chars naming the areas verified
<!-- pr-review: {"verdict":"approve","important":0,"nit":0,"unverified":0,"resolved":[]} -->
```

The last line is machine-readable and mandatory: the workflow parses it to record the round and to resolve fixed threads. When `--round` ≥ `--max` and something is still open, add one line before the trailer: 次の自動レビューはありません。必要なら `re-review` ラベルで要求してください。

Hard limits: no "verified and fine" lists, no list of refuted or dropped candidates, no "could not run tests" section, no restating the PR description, no compliments, no closing remarks. With `--post`, the table row is the whole entry (the inline comment carries the evidence); without `--post`, one evidence line per finding may follow the table.

## What NOT to flag

- Anything Ultracite, `check-types`, or `scripts/check-rules.ts` already enforces (do not run the linter to find them).
- Wording in `docs/design/`, `AGENTS.md`, rule files, code comments, commit messages, or MCP description strings, unless the sentence is factually wrong against the code — then it is a finding about the code contract, with the contradicting line quoted.
- Potential issues that depend on inputs or state you did not demonstrate; "might", "could", "consider" without a scenario.
- Style, naming, structure, refactors, alternative designs, missing test coverage in general (a missing test for a bug this PR fixes is important-tier, see Step 2).
- Pre-existing issues the range did not touch, except as `pre-existing` when they sit on a changed line.
- Something that looks wrong but is correct on reading the callers.
- Anything explicitly silenced in code with a directive comment.
- A nit on code that a previous round already reviewed.
