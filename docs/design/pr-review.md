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

## Measured accuracy (2026-09-04, skill as of this commit)

Method: the skill was run non-interactively (`claude -p "/pr-review full --range <base>...<head>"`, orchestrator on Opus, dependencies installed, no `--post`) against the exact commit each PR had when its first review ran, in a detached worktree. Ground truth = the threads from the original reviews that the author fixed with a behaviour-changing commit and that the thread classification above rated a real defect. Three PRs whose reviews found no real defect serve as clean controls.

| Case | PR state | Files | Known real | Found | Important posted | Nits | Cost | Minutes |
|---|---|---|---|---|---|---|---|---|
| #590 passkeys | first review head | 38 | 3 | 1 → 2 | 2 → 3 | 2 → 1 | $18.50 / $20.26 | 15 / 14 |
| #574 mix normalization | first commit | 24 | 1 | 0 → 0 | 0 | 1 | $15.51 / $18.11 | 17 / 23 |
| #572 model ids | before the round-4 fix | 11 | 1 | 1 | 1 | 1 | $9.72 | 11 |
| #588 EV null gate | first commit | 3 | 3 | 3 | 3 (+1 pre-existing) | 0 | $11.21 | 19 |
| #568 filter presets | first review head | 36 | 4 | 1 | 1 | 6 | $19.92 | 17 |
| #594 DCR client_name (clean) | first commit | 7 | 0 | – | 0 | 1 | $7.96 | 11 |
| #570 chip remove (clean) | first commit | 11 | 0 | – | 0 | 1 | $9.09 | 11 |
| #584 trigger stash (clean) | only commit | 4 | 0 | – | 0 | 3 | $8.77 | 15 |

Arrows show the first run → the re-run of the two cases after the validator rules below were tightened.

- **Recall on known real defects: 6 of 12 (50%) on the first run, 7 of 12 (58%) after the validator change.** Found: the `{data:null,error}` fetch-error bug and, on the re-run, the silent passkey re-registration (#590), the truncation detection gap (#572), all three EV-gate contract defects (#588), the stored-payload `parse` throw (#568). Still missed: the missing destructive-confirmation dialog (#590), the migration that stops on legacy rows (#574), the `Object.keys` undefined-key count, the over-broad UNIQUE regex, and the never-applied default preset (#568).
- **Two of the first-run misses were refutations, not blind spots.** Both bugs reached the validator and were dropped: the confirmation dialog because the validator reinterpreted `web-theme.md` as describing a dialog's shape rather than requiring one (on the re-run it survived validation but was cut at confidence 72; rule violations now carry ≥ 90 by definition), and the migration because the validator asserted that `wrangler` applies a file in one transaction. On the re-run it refuted the migration again with a citation into `wrangler`'s own source (`wrangler-dist/cli.js:181363-181374`, which strips `BEGIN`/`COMMIT` and states that D1 runs the SQL in a transaction) — a direct contradiction of the mid-file-death premise in `db-migrations.md` and `testing-and-tooling.md`. That disagreement is now a question for a human: if the reviewer is right, the rule file is wrong and the migration tests pin a scenario that cannot occur; if the rule file is right, the validator instruction that names it authoritative has to be obeyed. Until it is settled the miss stands.
- **No important-tier finding was wrong on the three clean PRs, and none of the seven important findings on the bug PRs is known to be wrong.** Four of the seven are the known defects; the other three are new, each with `node_modules` line citations or a measured reproduction (a 24-hour `freshSessionMiddleware` window that makes "Add passkey" fail with 403 after a day, an in-progress live cash session counted by one EV figure and not the other, a default-preset auto-apply that pushes history instead of replacing it). They need the author's confirmation before being counted as catches.
- **Noise is low.** 15 nits across 8 PRs, all with a quoted line or a reproduction (a test comment with inverted numbers, a `.yaml` glob gap in a new `check:rules` guard, a doc sentence naming an endpoint the app does not register). The old reviewer posted 22 threads on #590 alone across nine rounds.
- **Cost and time are the trade-off.** $8–20 per full round (mean $12.60), 11–19 minutes, 4–13 subagents; the old single-agent round cost about $2 in 2–6 minutes. Two capped rounds land at $20–40 per PR, comparable to Anthropic's managed reviewer ($15–25 per review) and below what #590 spent across 14 runs. The runs were made in a sandbox where subagents launch asynchronously; the first attempt polled for results and cost $12.31 for a 7-file PR before the skill was told never to poll.

**Verification run of the final prompt** (rule violations ≥ 90 confidence, migration semantics authoritative, no polling) on #590, #568 and the clean #594:

| Case | Known real | Found | Important | Nits | Cost | Minutes | Change vs. earlier runs |
|---|---|---|---|---|---|---|---|
| #590 | 3 | 1 | 2 | 3 | $17.34 | 14 | the silent re-registration found in the previous run was not found this time; the fetch-error bug is found in every run |
| #568 | 4 | 2 | 2 | 4 | $17.05 | 15 | newly found: the default preset never applies, with the mechanism (`buildAndCommitLocation` adds validated search defaults so `isUrlEmpty` is always false); the Display-mode drop the author fixed after the original review is also reported |
| #594 | 0 | – | 0 | 0 | $6.87 | 12 | approve with nothing posted |

Two conclusions from this run. First, **run-to-run variance is real on large diffs**: the same 38-file PR yields 1 or 2 of 3 known defects depending on which candidates the finders happen to surface within their 8-candidate cap; a candidate cap that scales with diff size is the obvious next experiment. Second, **the destructive-confirmation "miss" is a rule-file ambiguity, not a reviewer failure**: `web-theme.md` says a destructive confirmation *is* a `<Dialog>` with `[Cancel] [Delete]`, which specifies the form of a confirmation without requiring one, and the untouched sibling `linked-accounts.tsx` unlinks without confirming. The validator refuted on exactly those grounds in all three runs. If the team wants confirmation to be mandatory, the sentence has to say so (and `linked-accounts` becomes a pre-existing violation); the reviewer will then flag it. The ground truth for that item was itself the old reviewer's interpretation.

Comparison with the reviewer this replaces: the 12 known defects are, by construction, what the old reviewer found in round 1 on these PRs, so 58% recall against that set is a regression in raw round-1 recall and a large gain in precision and volume. The remaining gap is finder coverage (three #568 defects and one #590 rule violation) plus one contested migration refutation. The claimed advantage — a finding is posted only with evidence the author can check — held on every finding examined, including the refutations.

## Run 5: sharded finders, cheaper models, wider PR set (2026-09-04)

Changes measured in this run: F1 became a per-shard **Sonnet hunk walk** (at most 8 files or 800 changed lines per shard, a fixed checklist of line shapes to stop at), F2 gained the flow-interaction and fix-coverage angles and is split by area above 20 source files, rule-citation candidates are validated by Sonnet, and the validator count was capped at 14. The set grew by five merged PRs whose ground truth was built by Sonnet subagents from the audit data: a thread counts as a known defect only when a later commit in the PR changed the code the thread pointed at, and only when the defect exists at the first-review head.

| Case | Files | Known real | Found | Important | Nits | Cost | Minutes |
|---|---|---|---|---|---|---|---|
| #590 passkeys | 38 | 3 | 2 | 3 | 6 | $19.80 | 17 |
| #574 mix normalization | 24 | 1 | 1 | 1 | 2 | $13.20 | 18 |
| #568 filter presets | 36 | 4 | 3 | 4 | 5 | $26.54 | 26 |
| #594 DCR client_name (clean) | 7 | 0 | – | 0 | 1 | $5.44 | 11 |
| #589 EV toggle | 7 | 1 | 1 | 1 | 1 | $7.88 | 10 |
| #586 EV fallback | 7 | 1 | 1 | 1 | 1 | $7.49 | 13 |
| #592 OAuth login continuation | 5 | 2 | 1 | 1 | 0 | $7.38 | 13 |
| #582 trigger stash | 4 | 1 | 0 | 1 | 0 | $8.61 | 14 |
| #581 MCP master tools | 14 | 12 | 5 | 3 | 4 | $9.89 | 14 |
| #575 remote MCP server | 57 | 8 | 3 | 10 | 5 | $34.65 | 30 |

- **Recall on the three re-run bug PRs rose from 3 of 8 to 6 of 8.** The two misses that motivated the change are now found: the `Object.keys` undefined-key count surfaced from the hunk walk, and the destructive-confirmation rule violation was CONFIRMED by the Sonnet rule validator (the Opus validators had reinterpreted the rule in every earlier run). The #574 migration was confirmed with a streaming reproduction harness that shows the re-run failing at statement 1 after a mid-file death — the earlier "one transaction" refutation did not recur. Across the 33 known defects in the run, 17 were found (52%); without the two MCP PRs, whose ground truth is dominated by description-versus-handler contradictions, 9 of 13 (69%).
- **The remaining misses have identifiable causes.** The #568 UNIQUE-regex breadth was found by the hunk walk at confidence 45 and then cut by the 14-validator cap; the fix is to group validators per file so every candidate is validated. The #590 silent re-registration was not surfaced because the orchestrator narrowed the flow-interaction angle to the paths it had noticed; the finder now has to write the entity × create/delete/read table itself. The #592 preview auto-login hole is an alternate entry point into the same journey, which is what the new F7 journey finder enumerates. The #582 item (a missing mechanical guard for a CI spec list) is a process finding, not a code defect, and is unlikely to be found by any finder here.
- **The two MCP PRs show where one round stops.** #581 (12 known contradictions, 36 old rounds) yields 5 in one round plus a new one (`isBreak` is required, not optional, so a payload that marks only break rows is rejected whole). #575 (57 files) yields 10 important findings, of which 3 are known #575 defects and three more are defects the repository fixed in later PRs: the `normalized` "converts via rates" claim and the missing `rate` field (#581), and the sign-up path dropping the OAuth continuation (#592, two weeks later). The remaining #575 misses are spread across `worker.ts` hardening items (JSON-RPC error envelope, `no-store`, consent-gate method coverage) and two library-shaped bugs (`instanceof TRPCError` across duplicate module instances, empty host for opaque redirect URIs); a description-claims finder (F8) is added for the MCP class, and the large-diff misses are the cost of the 8-candidate cap per finder on a 57-file diff. One #575 important finding is an evaluation artifact: a test fixture with a token expiry of 2026-08-01 fails today, which was true and green when the PR was reviewed.
- **New important findings, none known to be wrong.** #582: a failure between `drop-triggers.sql` and the dump leaves the preview DB without triggers with no recovery path — the author closed exactly this window with an EXIT trap two commits later, so this one is confirmed by history. #589: in normalized mode a user whose only EV rows are mixed games gets an EV line that coincides with the P/L line, verified by running `aggregatePnlPoints`; the server closes the same hole in `stats.ts`. #586: the `stats_summary` MCP description's population claim became false. #590: the device name is sent as the WebAuthn `userName`. #568: the auto-applied preset pushes a history entry, and the `IF NOT EXISTS` idempotency edit has no test. The last two are tier judgement calls; the rest are behaviour a user or a model hits.
- **Cost moved with diff size, not down.** Mean $12.04 per PR, but $20–27 on the two 36–38 file PRs because 16–25 subagents ran. Sonnet finders cost a third of the Opus ones; the Opus validators are now the dominant term. Grouping validators per file (3 candidates each, Sonnet for nit-tier guesses) is the next change and is measured in run 6.
- **Format drift.** Three summaries listed refuted candidates and one explained each finding in a paragraph; the hard limits now forbid the refuted list and, with `--post`, anything beyond the table.

## Run 6: entity-table flow check, journey and description-claim finders, grouped validators (2026-09-04)

Changes measured in this run: F2 writes the entity × create/delete/read table itself before listing flow-interaction candidates, a Sonnet **user-journey finder** (F7) runs when `apps/web/**` or `packages/mcp/**` is touched, a Sonnet **description-claims finder** (F8) checks every MCP tool description against the router handler and schemas, and validators are grouped per file and model (3 candidates each, at most 12 validators, Sonnet for nit-tier guesses). Same ten PRs as run 5, same ground truth.

| Case | Files | Known real | Found | Important | Nits | Cost | Minutes |
|---|---|---|---|---|---|---|---|
| #590 passkeys | 38 | 3 | 3 | 4 | 4 | $17.47 | 26 |
| #574 mix normalization | 24 | 1 | 1 | 1 | 2 | $12.41 | 18 |
| #568 filter presets | 36 | 4 | 2 | 4 | 8 | $26.23 | 19 |
| #594 DCR client_name (clean) | 7 | 0 | – | 0 | 1 | $6.42 | 13 |
| #589 EV toggle | 7 | 1 | 1 | 1 | 2 | $10.41 | 11 |
| #586 EV fallback | 7 | 1 | 1 | 1 | 2 | $10.08 | 14 |
| #592 OAuth login continuation | 5 | 2 | 1 | 1 | 1 | $4.76 | 11 |
| #582 trigger stash | 4 | 1 | 1 | 2 | 1 | $7.29 | 16 |
| #581 MCP master tools | 14 | 12 | 5 | 5 | 5 | $13.09 | 15 |
| #575 remote MCP server | 57 | 8 | 1 | 11 | 5 | $33.18 | 36 |

- **Recall is flat overall and moved per case.** 16 of 33 known defects were found (run 5: 17), 10 of 13 outside the two MCP PRs (run 5: 9). #582's process finding (the hand-listed `bun:sqlite` spec list has no mechanical guard) was found as a nit, and the trigger-loss window recurred for the third run, now joined by a second important finding: the new spec re-implements the workflow's jq pipeline instead of reading the YAML, so reverting the fix leaves the test green. #590 went to 3 of 3: the silent passkey re-registration was found once the finder had to write the entity table itself, and the destructive-confirmation and error-swallowing items recurred. #568 fell from 3 to 2: the `Object.keys` count and the `.parse` crash recurred, but the default-preset miss found in runs 4–5 was not surfaced this time, and the UNIQUE-regex candidate was again cut before validation — 18 candidates were spread over 12 validators instead of 6, so the cap bit anyway; the assignment step now requires every candidate to be placed before any validator launches. #575 fell from 3 to 1 on its known list while producing 11 important findings, which is the variance a 57-file diff has under an 8-candidate cap per finder: the run found different real problems each time (run 5: clickjacking headers, scope display; run 6: the consent form posting `consent_code` in the body so the signed cookie is not consulted, the unvalidated redirect scheme, `get-session` returning the whole token row). These security findings are new and unverified by history and need a human to confirm before they are trusted.
- **F8 works on the MCP class and F7 has not paid for itself yet.** #581 stayed at 5 of 12 with a different mix (two known items dropped, two picked up) and added two new contract errors: `tournament_get_by_id` returns `tags` as `{id,name}[]` while `update_with_levels` takes `string[]`, and the three `*_list` tools marked `readOnlyHint` insert default rows. #589 and #586 each produced an MCP description contradiction (the tournament points in a mixed `stats_profit_loss_series`, the `stats_summary` population) that the earlier runs did not. The journey finder produced the #592 sign-up finding (social `callbackURL` fixed to `/statistics` in the default tab) but not the preview auto-login hole, which is a removed hook no journey starts from; the F2 removed-behaviour angle added after this run targets it.
- **Cost did not move with grouped validators.** $134 for the nine cases that had run 5 costs against $132 then; c568 and c575 launched 22 and 27 subagents. The Opus validator count fell but the finders grew (F7, F8, per-area F2), and the orchestrator turns on the large diffs (46 on #575) are now a visible term.
- **Format drift persists at a lower rate.** #568 listed three nits in prose under the table and #594 wrote a paragraph of refuted candidates; the hard limits now state that a finding exists only as a table row and that refuted or below-threshold candidates do not appear in any form.

## Measuring a change to this loop

Re-run the thread classification (round × outcome × real-defect) on the next ~10 PRs and compare with the table above. The signals that the cap is too tight are a drop in real defects caught per PR or authors reaching for the label on most PRs; the signal that the prompt is too loose is retractions or prose threads coming back. The full review is always one label away, so tightening was chosen over the reverse.
