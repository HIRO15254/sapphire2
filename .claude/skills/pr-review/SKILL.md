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

## Step 1 — Finders (parallel Task subagents, at most 8 candidates each)

Launch all applicable finders in parallel. Give each: the diff for its scope, the PR title/body, the agent assumptions, the candidate schema below, and the **What NOT to flag** list at the end of this file. Every candidate must name a concrete failure scenario; a candidate without one is discarded before validation.

Candidate schema (one object per candidate):

```text
file, line, title (≤ 80 chars), tier guess (important | nit | pre-existing),
failure_scenario (input or state → wrong result), rule_citation (rule file + quoted sentence, or "none"),
confidence (0–100: how sure you are this is real and in scope)
```

- **F1 · diff-only bugs (opus)** — the official plugin's agent 3: scan the hunks themselves for bugs that are visible without extra context: wrong or inverted conditions, off-by-one, null/undefined dereference, missing `await`, dropped error handling, removed guards, broken callers of a changed signature. Flag only significant bugs.
- **F2 · logic and security with context (opus)** — the official plugin's agent 4, plus this repository's recurring hazards: unscoped D1 queries (ownership), more than 100 bound parameters, multi-statement writes outside `db.batch()`, date-only values read with local getters, a migration that can die mid-file, an MCP description that would make a model issue a failing or data-losing call. Open the enclosing function and the direct callers.
- **F3…F6 · rule reviewers (sonnet), one per touched area** — web, api/server, db, mcp. Each gets the rule files for its area and only the diff for its paths. Flag only a violation you can quote; the quote goes in `rule_citation`. Skip anything `scripts/check-rules.ts` or Ultracite already enforces.
- **Incremental mode only** — every finder also receives the list of previous-round threads and is told: candidates are limited to (a) a regression introduced by a fix, or (b) an important-tier issue in the new diff.

## Step 2 — Validators (one opus subagent per candidate, in parallel)

Each validator gets the candidate, the diff, the PR intent and the agent assumptions, and returns:

```text
verdict (CONFIRMED | PLAUSIBLE | REFUTED), tier (important | nit | pre-existing),
evidence, confidence (0–100), settle_command (PLAUSIBLE only)
```

Validation is evidence-based, never a re-reading of the finder's argument:

- Read the code at `file:line`, the enclosing function and the direct callers. CONFIRMED needs a specific input or state that triggers the failure plus a quoted line; REFUTED needs a quoted guard, type, or invariant that makes the scenario impossible, or an observable-effect argument.
- A claim about a library's behaviour must be read from its source under `node_modules/` or exercised; a claim about a test's detection power must be checked by running it. Run the narrowest project: `bunx vitest run --project <web-node|web-dom|api|server|db|mcp|env|scripts> <path>`; `bun run check-types` or `bun run check:rules` when the claim is about them. If you cannot run anything relevant, say so in `evidence` and return PLAUSIBLE, never CONFIRMED.
- PLAUSIBLE means a real mechanism whose activation you could not settle; `settle_command` is the exact command or test the author can run.
- Tier is decided here, not by the finder: **important** = wrong behaviour a user or an MCP client will hit, data loss or corruption, a security gap, a migration that can stop production, or a missing test for a bug this PR fixes; **nit** = real but cosmetic or edge-case, or a rule violation with no observed failure; **pre-existing** = real but not introduced by this range.

## Step 3 — Filter and rank

1. Drop REFUTED. Drop anything with confidence below **80**. Drop anything on the What NOT to flag list.
2. Dedupe candidates that point at the same line or the same mechanism; keep the better-evidenced one.
3. Cap inline **nit** comments at **5**; the rest are counted in the summary. In `incremental` mode nits are never inline.
4. PLAUSIBLE survivors are posted as `[unverified]`: no tier, never blocking, must carry `settle_command`.
5. `incremental` mode: settle every previous-round thread as fixed / not addressed / declined (declined = the author replied `Won't fix` or refuted it), by reading the diff since `--since` and the author's replies. Fixed threads go into the trailer's `resolved` list as `path:line` of the original comment.

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

Hard limits: no "verified and fine" lists, no "could not run tests" section, no restating the PR description, no compliments, no closing remarks.

## What NOT to flag

- Anything Ultracite, `check-types`, or `scripts/check-rules.ts` already enforces (do not run the linter to find them).
- Wording in `docs/design/`, `AGENTS.md`, rule files, code comments, commit messages, or MCP description strings, unless the sentence is factually wrong against the code — then it is a finding about the code contract, with the contradicting line quoted.
- Potential issues that depend on inputs or state you did not demonstrate; "might", "could", "consider" without a scenario.
- Style, naming, structure, refactors, alternative designs, missing test coverage in general (a missing test for a bug this PR fixes is important-tier, see Step 2).
- Pre-existing issues the range did not touch, except as `pre-existing` when they sit on a changed line.
- Something that looks wrong but is correct on reading the callers.
- Anything explicitly silenced in code with a directive comment.
- A nit on code that a previous round already reviewed.
