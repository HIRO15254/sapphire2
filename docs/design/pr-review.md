# Automated PR Review

The automated reviewer uses a single context with `claude-fable-5-2`, high effort and a limit of 150 turns (a replayed 8,000-line PR took 83 tool calls). Subagents and Fast mode are disabled. The reviewer compares the changes against the linked Linear issue, including later decisions in its comments; missing or contradicted requirements go through the same verification as other findings.

The base-branch [`scripts/review-issue-context.ts`](../../scripts/review-issue-context.ts) obtains the issue from `feature/sa2-<n>` and passes it to the reviewer. Only that job holds `LINEAR_API_KEY`; it does not check out or install PR code. Lookup failure does not stop the review and is reported in the summary.

The author-side rules are in [`AGENTS.md`](../../AGENTS.md); historical review-loop measurements, the lean evaluation and the replay that led to the risk questions are in the [review history](../archive/pr-review-history.md), the [lean evaluation](../archive/pr-review-lean-evaluation.md) and the [risk-question replay](../archive/pr-review-risk-questions-evaluation.md).

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

**State comment** — one PR comment starting with `<!-- pre-merge-review:state {"rounds":N,"lastSha":"…"} -->` is updated after every successful round. Deleting it or corrupting its payload resets the PR to round 1. A round counts only when the execution log contains the summary trailer and the tracking comment has a published summary. A run without a trailer receives a `<!-- pre-merge-review:truncated -->` notice identifying its result subtype; the notice is removed once a round completes. A workflow-file change can prevent the action from producing an execution log; this is reported in the step summary without consuming a round.

**CI wait** — the review job polls the `ci` check run on the head for up to 30 minutes and runs Claude only on `success`. A red head is skipped and reported in the step summary. A new push cancels a waiting run through the concurrency group.

**Thread resolution permissions** — GitHub's `resolveReviewThread` mutation requires `contents: write` in addition to `pull-requests: write`. Resolution runs in a separate job with these permissions, without checkout, dependency installation, or reviewer execution; the job executing PR code retains `contents: read`. Only a successful review with a published summary on a same-repository PR can start resolution. The trailer is passed through an environment variable and matched against unresolved Claude threads by path and original line. Fetch and mutation failures have distinct diagnostics and remain non-blocking. The outcome job waits for resolution before counting unresolved threads.

**Reviewer** — [`.claude/skills/pr-review/SKILL.md`](../../.claude/skills/pr-review/SKILL.md) routes every PR to one reviewer context ([`references/lean.md`](../../.claude/skills/pr-review/references/lean.md)). It reads every changed source file in full, answers a fixed list of risk questions for each changed procedure, handler, migration and hook (write after read, multi-statement writes, deletes and what still refers to the deleted thing, input bounds, ownership, sessions and state-changing endpoints, paid upstream calls, failure and repeat, assumptions that expire), and settles each candidate by reading or by a scoped test run. It then checks the change against [`references/patterns.md`](../../.claude/skills/pr-review/references/patterns.md), the 190 recurring mistakes of the 2026-11 full review of `dev` (one line per pattern, grouped by the paths they apply to, each naming its Linear issue): a new instance is a finding, an instance the range does not touch is not. A line is deleted in the PR that lands the pattern's mechanical guard, so the list shrinks as the fix plan proceeds. The workflow passes `full` or `incremental`, the diff range, the round number, `--post`, and the linked Linear issue. A local `/pr-review full` does not post and reads the issue through the Linear MCP. The diff is also checked against the issue's requirement ledger. Only confirmed `important` findings are posted inline; nits, pre-existing and unverified findings go to the summary. A risk question the reviewer could not close on a changed write, delete, migration, authentication or money path is an `unverified` row and is counted in the trailer, so an `approve` never hides an unchecked area in the coverage sentence; `approve` with `unverified` above zero still moves the issue to Ready to Merge and only blocks auto-merge. The trailing JSON trailer and resolution of fixed threads are kept.

The reviewer runs with an explicit tool allowlist and without `gh api`; untrusted diff content cannot use that command to write to the PR. Thread resolution is performed separately from the machine-readable trailer.

**Hooks** — the review session runs with `disableAllHooks` so the repo's Stop hook (`bun x ultracite fix && bun run test:unit --changed HEAD && bun x ultracite check && bun scripts/check-rules.ts`) does not fire at the end of a review; it exists for authoring sessions.

## Outcome job: Linear status and auto-merge

The `outcome` job of `pre-merge-review.yml` runs after `review`, from the base branch's copy of [`scripts/review-outcome.ts`](../../scripts/review-outcome.ts) (a PR cannot rewrite the code that decides its own merge; a PR that edits the workflow file itself is a human merge anyway). It needs `LINEAR_API_KEY`; without it the job only warns.

**Status** (moves only from AI Review or In Progress, so a human's Needs Input / Human Review is never overwritten): red `ci` → In Progress; approve with no important finding → Ready to Merge; anything else → In Progress, or Needs Input (plus a Linear comment) once the round reached `MAX_AUTO_ROUNDS`. A timed-out CI wait or a review that never published changes nothing.

**Auto-merge** happens only when every condition holds, and merges with `merge_method: merge` guarded by the reviewed head sha, then dispatches `dev-deploy.yml` (a `GITHUB_TOKEN` merge does not trigger the `push` event) and sets Done:

- the issue is found from the branch name (`feature/sa2-NNN`; a title naming another `SA2-` id rejects it) and, read from the Linear API, carries exactly one `level` label, `auto-merge`, and is not closed. The PR's own labels are never read.
- same-repo PR, not draft, base `dev`; the approve came from an automatic round (not the `re-review` label, round ≤ 2) with zero `unverified` findings; the reviewed sha is still the PR head; no unresolved review thread (any author, so a nit the reviewer posted inline also sends the PR to a human).
- no changed file (or rename source) matches `packages/db/src/migrations/**`, `packages/auth/**`, `apps/server/wrangler.toml`, `.github/**`, `.claude/**`, `AGENTS.md`, `CLAUDE.md`, `.gemini/**`, `.husky/**` or `scripts/review-*.ts`, which hold migrations, auth, deploy config, agent instructions or the gate itself.

A blocked auto-merge still moves the issue to Ready to Merge and leaves a Linear comment with the reasons. The residual risk is that the issue lookup trusts the branch name: an agent could name its branch after another issue that has `auto-merge`, which the title check and the closed-state check only narrow. This guards against mistakes, not against an agent with push access that edits workflows.
