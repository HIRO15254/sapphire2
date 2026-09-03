# Automated PR Review

Design rationale for [`pre-merge-review.yml`](../../.github/workflows/pre-merge-review.yml) and [`scripts/review-gate.ts`](../../scripts/review-gate.ts): why the reviewer runs at most two automatic rounds, why it waits for CI, why it installs dependencies, and what the author-side rules in [`AGENTS.md`](../../AGENTS.md) (PR Review Loop) are protecting. The imperatives live there; this doc holds the data that justified them so the next change to the loop can be judged against the same baseline.

## The problem the loop had

The reviewer used to run on every non-draft push. An audit of 19 PRs (#532–#594, June–September 2026, 514 workflow runs) measured what that produced:

| Metric | Value |
|---|---|
| Finished reviews across the 19 PRs | 103 |
| Finished reviews after the reviewer had already said nothing blocks merge | 65 (63%) |
| Inline threads | 194 |
| Threads opened in round 2 or later | 69% |
| Runs cancelled mid-review by the author's next push | 37 (96 wasted minutes) |
| Successful reviews on `release/*` PRs (content already reviewed on `dev`) | 17 (73 minutes) |
| PRs where the author refuted a finding and the reviewer retracted it | 6 of 17 |
| Reviews whose summary said tests could not be run | ~100% |

Run count was concentrated: 55 of 91 branches finished in one or two rounds, while a handful of branches produced the bulk of the load — one PR (#581, MCP tool descriptions) went 36 finished rounds and 52 threads, with the reviewer opening each round after round 14 with "converged, nothing blocking" and still filing new findings. The amplifier was symmetric: the reviewer always found something, and the author (a Claude Code session) had committed to "keep responding as long as findings continue", pushing one commit per finding.

## Where the value is

Every thread was classified by round and by whether it described a real defect (wrong behaviour, data loss, security gap, or an MCP tool description that would make a model issue a failing or data-losing call) as opposed to wording, defensive preference, or hypothetical library behaviour:

| Round | Threads | Real defects | Rate | About code a previous fix introduced | Retracted |
|---|---|---|---|---|---|
| 1 | 55 | 17 | 31% | 0 | 0 |
| 2 | 36 | 9 | 25% | 29 (81%) | 1 |
| 3+ excluding #581 | 41 | 3 | 7% | — | 3 |
| 3+ in #581 only | 45 | 22 | 49% | 20 | 0 |

Three conclusions shaped the design:

- **Round 2 is not optional.** Its findings are almost entirely regressions introduced by the round-1 fixes (a dead-end error state, a form that stopped resetting, a backfill that stopped self-healing, a missing clickjacking guard). A "review once" policy would lose them the moment an author forgot to ask for a second look.
- **Round 3 onward is nearly free to cut** outside #581: 3 real defects across 41 threads, 3 retractions, and mostly wording. All three would be recoverable by an explicit re-review request.
- **#581 was not a review-loop problem.** The tool descriptions were being written by iterating against the reviewer as the oracle. The fix is authoring discipline ([`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 7: verify every description claim against the handler before pushing), not more rounds.

The four retracted findings were all built on an assumed library behaviour the reviewer could not check because `node_modules` was absent in the runner. That is why the runner now installs dependencies and the prompt forbids findings that were not read from source or exercised in a test.

## Mechanics

**Gate job** — a pure decision in `scripts/review-gate.ts` (`decideReview`), fed by a shell step that collects the event, draft flag, head/dev tree ids, the state comment, and the files changed since the last reviewed sha. Decisions, in order:

1. `labeled` with the `re-review` label → always run (draft included, cap ignored); any other label → skip. The review job removes the label before waiting for CI so the next push does not re-fire; if a push cancels that run, re-add the label. The label must exist in the repository (create it once from the labels page).
2. draft → skip.
3. `release/*` whose `HEAD^{tree}` equals `origin/dev^{tree}` → skip. A release branch with a hotfix on top has a different tree and is reviewed normally.
4. head sha already reviewed → skip (covers `reopened` / `ready_for_review` after a review).
5. automatic round count ≥ `MAX_AUTO_ROUNDS` (2) → skip; the state comment tells the author to use the label.
6. no state → full round 1.
7. push touching only `*.md` files → skip (docs-only pushes produced only wording rounds).
8. otherwise incremental round N+1 from the last reviewed sha.

**State comment** — one PR comment starting with `<!-- pre-merge-review:state {"rounds":N,"lastSha":"…"} -->`, updated after every successful round (`renderStateComment`). It is the only memory the loop has; deleting it resets the PR to round 1. `parseReviewState` rejects malformed payloads instead of guessing, so a damaged comment also resets rather than misfiring.

**CI wait** — the review job polls the `ci` check run on the head for up to 30 minutes and runs Claude only on `success`. A red head is skipped (step summary only, no PR comment: the author is about to push a fix and CI already reports the failure). Because the wait sits inside the concurrency group, a new push cancels a *waiting* run instead of a *running* one — the 37 cancelled runs above were all mid-review.

**The reviewer is a repository skill** — [`.claude/skills/pr-review/SKILL.md`](../../.claude/skills/pr-review/SKILL.md). The workflow passes only `full` or `incremental`, the diff range, the round and `--post`; the same skill runs locally as `/pr-review full` (report-only) and is what the evaluation below executes. Its shape is a fork of Anthropic's open-source `code-review` plugin ([`plugins/code-review/commands/code-review.md`](https://github.com/anthropics/claude-code/blob/main/plugins/code-review/commands/code-review.md)): parallel finders → one validator per candidate → confidence gate → post. Three things are injected that the plugin does not have:

1. **Rule files reach the finders.** The plugin's two CLAUDE.md-compliance reviewers become one reviewer per touched area (web / api-server / db / mcp), each given the matching `.claude/rules/*.md` and only the diff for its paths, so the rules land at finding time rather than as a post-filter. This is the same lever Anthropic's managed Code Review exposes as `REVIEW.md` ("given to the agents that find and verify findings").
2. **Validators must execute.** A claim about a library is read from `node_modules` source or exercised; a claim about a test's detection power is checked by running it (`bunx vitest run --project …`). A validator that ran nothing can return PLAUSIBLE, never CONFIRMED. No commercial reviewer surveyed in September 2026 executes tests before posting (Cursor Bugbot lists it as future work), and all four retracted findings in the audit were library-behaviour guesses made without `node_modules`.
3. **Incremental mode.** The plugin reviews once per PR. Round 2 here reviews `git diff <since>...HEAD` plus direct callers, settles the previous round's threads first, and may post inline only regressions or important-tier findings; nits go to the summary.

Retained from the plugin: the high-signal bar, the false-positive list (now the "What NOT to flag" section), the 0–100 confidence with an 80 threshold, `confirmed: true` inline posting, one comment per issue. Severity is three tiers — important / nit / pre-existing — matching Anthropic's managed reviewer, plus `[unverified]` for a PLAUSIBLE verdict with a command the author can run. Nits are capped at five inline. The summary is a fixed template ending in a machine-readable trailer (`<!-- pr-review: {"verdict":…,"resolved":[…]} -->`); the workflow parses it to resolve fixed threads through GraphQL from the shell step, so the reviewer itself never holds `gh api`. The template exists because the old summaries repeated a "verified and fine" list and a "could not run tests" section in every round, and the action injects every previous comment into the next run's prompt — at round 4 of #590 that was ~98,000 characters of the reviewer's own prior output, which is also what made rounds 15–36 of #581 open with identical boilerplate.

## What the wider field supports

Surveyed September 2026 (Anthropic and GitHub documentation, 12 commercial reviewers, ~30 papers and engineering write-ups). The points that shaped the design, each with the strongest source:

- **A verification gate before posting is the mechanism that removes false positives.** Refute-or-Promote (arXiv 2604.19049) rejected 79–83% of candidates by execution before disclosure; a validator step cut the false-alarm rate of a multi-role reviewer from 89% to 75% (ICML 2025, arXiv 2505.17928); Anthropic reports under 1% of its managed reviewer's findings marked incorrect (vendor figure).
- **Agreement is not verification.** Ten reviewers agreed on an OpenSSL vulnerability that one execution test refuted (arXiv 2604.19049); reviewer + critic beats five-agent consensus and more agents give diminishing returns (arXiv 2608.18167). Hence one validator per candidate, not majority voting.
- **Fewer, precise comments get acted on; noise lengthens PRs.** Uber uReview: 75% useful, 65% addressed in the same changeset. Copilot leaves 29% of reviews without comments. Cloudflare found a "what not to flag" list cut false positives more than positive instructions. An industrial Qodo deployment lengthened PR close time from 5h52m to 8h20m through inaccurate and verbose comments (ICSE-SEIP 2025, arXiv 2412.18531).
- **Once per PR is the industry default; re-review carries state and narrows.** Greptile `triggerOnUpdates` defaults off, Codacy and Copilot review once, the official claude-code-action recipe skips PRs Claude already commented on, Sourcery caps at five rounds and auto-resolves addressed threads, Cloudflare's incremental review carries the previous findings and the author's replies, and MCR-Bench (ISSTA 2026) measures LLM review quality falling as rounds accumulate.
- **Confidence thresholds are derived from a target precision.** Google set its suggestion threshold at 50% precision; Uber tunes per assistant × language × category; the official plugin posts at ≥80 of 100.
- **The production KPI is the share of findings fixed before merge**, not thumbs (which 2–10% of developers click): Cursor 52%→80%, Atlassian 38.7% (human comments 44.5%), Uber 65% (human 51%). Backtests combine known-bug reinjection, clean PRs for false-positive counting, and incident reverse lookup (Datadog: 22% of past incidents would have been caught).
- **Expectations.** Independent benchmarks put diff-only frontier models at 15–31% of human-flagged issues (SWE-PRBench) and F1 around 20% (SWR-Bench); Claude Code led four tools on c-CRAB at 32%. The reviewer complements human review; the merge decision stays human.

Rejected on this evidence: eight-way majority voting, unlimited push-triggered rounds, `high`-or-above effort in CI (recall-biased by design), and a second commercial reviewer. Anthropic's managed Code Review (Team/Enterprise only, $15–25 per review) is the migration target if the plan changes; `claude ultrareview` is a possible on-demand deep pass for large PRs.

**Hooks** — the review session runs with `disableAllHooks` so the repo's Stop hook (`ultracite fix && vitest --changed && check-rules`) does not fire at the end of a review; it exists for authoring sessions.

## Measuring a change to this loop

Re-run the thread classification (round × outcome × real-defect) on the next ~10 PRs and compare with the table above. The signals that the cap is too tight are a drop in real defects caught per PR or authors reaching for the label on most PRs; the signal that the prompt is too loose is retractions or prose threads coming back. The full review is always one label away, so tightening was chosen over the reverse.
