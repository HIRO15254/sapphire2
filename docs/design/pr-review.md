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

**Two prompts, one step** — the same action step receives `MODE=full` or `MODE=incremental`. Full mode runs the built-in `/code-review medium` skill (`/review` is its alias, and is what the old workflow invoked): parallel finders, one independent verifier per candidate returning CONFIRMED / PLAUSIBLE / REFUTED, a sweep for gaps, and a cap of 15 findings. That verification step is kept on purpose — it is the mechanism that filters speculative findings, and it only failed before because the runner had no `node_modules` for the verifier to read. The prompt's rules are layered on top of what the skill reports, not a replacement for it. Incremental mode cannot use the skill (it has no diff-range target), so it reviews `git diff <since>...HEAD` plus direct callers, settles the previous round's threads first, sends every new candidate through one verifier subagent, and may only open inline comments for regressions or medium-or-higher findings. Both modes share the severity rubric (medium = a user or MCP client will hit wrong behaviour), the mandatory `**[severity]**` tag on every inline comment, the `[unverified]` escape hatch, the prose ban, and a 40-line summary template with a `Verdict:` line. The template exists because the old summaries repeated a "verified and fine" list and a "could not run tests" section in every round, and the action injects every previous comment into the next run's prompt — at round 4 of #590 that was ~98,000 characters of the reviewer's own prior output, which is also what made rounds 15–36 of #581 open with identical boilerplate.

**Hooks** — the review session runs with `disableAllHooks` so the repo's Stop hook (`ultracite fix && vitest --changed && check-rules`) does not fire at the end of a review; it exists for authoring sessions.

## Measuring a change to this loop

Re-run the thread classification (round × outcome × real-defect) on the next ~10 PRs and compare with the table above. The signals that the cap is too tight are a drop in real defects caught per PR or authors reaching for the label on most PRs; the signal that the prompt is too loose is retractions or prose threads coming back. The full review is always one label away, so tightening was chosen over the reverse.
