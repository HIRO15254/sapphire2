# Agent Workflow Setup

The semi-automated loop in [`AGENTS.md`](../../AGENTS.md) (Issue Tracking, PR Review Loop, Commits, Release Flow) depends on settings that live outside the repository: Linear, GitHub, and Orca. This doc records them and the reason for each, so the loop can be rebuilt or audited without replaying the setup issue (SA2-253). The imperatives stay in `AGENTS.md`.

## The loop

1. A human accepts a Triage issue: sets the `level` label, type, priority, and estimate, and moves it to Todo.
2. The human creates an Orca workspace from the issue in Orca's Linear task list. The agent sets In Progress, works on a `feature/sa2-xxx` branch, opens a draft PR → Human Review, and keeps [pr-watch](#pr-watch) running so later PR events reach it.
3. The human reads the draft and marks it ready → AI Review. CI and [`pre-merge-review.yml`](../../.github/workflows/pre-merge-review.yml) run.
4. Review outcome → Ready to Merge (approve), In Progress (important findings or red CI), or Needs Input (two automatic rounds without approve). Set by the `outcome` job of `pre-merge-review.yml`; for an `auto-merge` issue an approve is merged by that job and the issue goes to Done.
5. The human merges into `dev` → Done. A release PR into `main` runs [`release.yml`](../../.github/workflows/release.yml), which moves the Done issues of the released PRs to Released.

## Linear (team Sapphire2)

- **Plan**: Plus. The Free plan caps non-archived issues (completed and canceled included) and blocked issue creation on 2026-10-02.
- **Statuses** — the name says whose turn it is:

  | Type | Statuses |
  |---|---|
  | triage | Triage |
  | backlog | Backlog |
  | unstarted | Todo |
  | started | In Progress → Needs Input → Human Review → AI Review → Ready to Merge |
  | completed | Done (merged into `dev`), Released (shipped to `main`) |
  | canceled / duplicate | Canceled, Duplicate |

- **GitHub integration** (PR and commit linking only; GitHub Issues sync is disconnected and Issues are disabled on the repository): draft PR opened → Human Review; PR opened or marked ready → AI Review; review requested / review activity / ready for merge → no change; merged → Done. Review events are left unassigned because the automated verdict is a PR comment, not a GitHub review, so Linear cannot see an approve.
- **Estimates**: T-shirt sizes (XS 1, S 2, M 3, L 5, XL 8 through the API).
- **Labels**: groups `type` (Bug / Feature / Improvement / Chore, single choice) and `level` (`supervised` / `auto-fix` / `auto-merge`, set only by the human at Triage); `source` (`review` / `audit`, set on every issue a discovery run files; `prod-error` and `ui-patrol` are retired until a discovery source for them is built). `UI` and `development` are retired.
- **Branch name format** includes the issue title, so Linear's suggestion contains Japanese; agents rename to `feature/sa2-xxx` before the first push.

## GitHub (`HIRO15254/sapphire2`)

- **Rulesets** are applied from [`.github/rulesets/`](../../.github/rulesets/): `dev-protect` (PR required, required check `ci`) and `main-release-only` (PR required, required checks `pr-target-guard` and `ci`). Both also block deletion and force pushes.
- **Merge settings**: merge commits only (squash and rebase disabled), `delete_branch_on_merge` on, auto-merge off.
- **Secrets** are registered by the user directly. The agent loop uses two: `CLAUDE_CODE_OAUTH_TOKEN` (`claude.yml`, `pre-merge-review.yml`, release notes in `release.yml`) and `LINEAR_API_KEY` (the Released step of `release.yml`, the Triage filing of `pre-merge-review.yml`, and its `outcome` job). Without `LINEAR_API_KEY` the Released step only warns. The deploy and app secrets the other workflows read (Cloudflare, auth and OAuth providers, OpenAI, Google Maps, preview login, production URLs) are outside this doc.

## Orca

- **Base ref**: the repository default (`origin/HEAD` = `origin/dev`), with Settings → Git → "Keep Local Main Up to Date" on. Do not set a repository-specific base ref of `dev`: Orca then neither fetches nor updates it, and new worktrees start from a stale tree that lacks the current rules and hooks. That happened on 2026-10-02 — PR #668 was pushed with a Japanese branch name and opened ready from a tree 23 commits behind.
- **Setup**: `bun install`, and agents start only after setup finishes. [`.worktreeinclude`](../../.worktreeinclude) copies `apps/server/.dev.vars` and `apps/web/.env` so `bun run dev` works in a new worktree.
- **Status sync**: the workspace board's "Sync board and issue status" changes the Linear status only when a card is dragged. Creating a workspace from a Linear task does not, so the agent sets In Progress itself.
- **Branch naming** for workspaces not created from Linear: prefix Git Username and "Auto-rename branch & worktree" give names like `HIRO15254/<slug>`; agents still use `feature/sa2-xxx`.

## PR watch

[`scripts/pr-watch.ts`](../../scripts/pr-watch.ts) (SA2-333) lets the agent that opened a PR learn what the owner and the reviewer do on it, so a review is answered by the agent that holds the implementation context. It needs only `gh` and a harness that re-invokes the agent when a background command exits — the same requirement as the `gh pr checks --watch` rule — and no terminal host, daemon, or webhook.

- **Flow.** The agent runs `bun run pr-watch` in the background right after opening its PR and again after each batch until it reports the PR merged or closed. The script finds the PR from the current branch (`--pr <n>` overrides), polls it every 30 s with one GraphQL query (cost 1 of the 5,000 hourly points), and exits with one batch 60 s after the last new item, at most 4 minutes after the first. What it has reported is kept per worktree in `<git dir>/pr-watch/<pr>.json`, so items that arrive while no watch runs are reported by the next one; the first run records what is already on the PR as seen. A merge or close ends the watch with a final batch and deletes the file.
- **An idle PR costs nothing.** The script has no time limit; only events end it. The harness must let a background command wait that long. Claude Code stops one at the requested `timeout` (default 10 or 30 minutes depending on the mode), capped at `max(7,200,000 ms, BASH_MAX_TIMEOUT_MS)` and never above 2,147,483,647 ms (597 hours) in 2.1.293, so [`.claude/settings.json`](../../.claude/settings.json) sets `BASH_MAX_TIMEOUT_MS` to that ceiling and the agent passes it as the timeout; a `claude -p` run with only that project setting reported `max 2147483647ms / 597 hours`. It only raises the maximum: the 2-minute default for other commands is unchanged. omp waits with `timeout: 0`. Whether Codex and Gemini CLI re-invoke an agent when a background command ends is unverified. A first fix (2026-10-09) instead stopped the script every 110 minutes to stay under the 2-hour cap; it was dropped the same day because an idle PR then woke the agent every two hours, which is the timer-based check-in the PR Review Loop forbids.
- **What wakes the agent.** Comments, reviews other than the empty `commented` review GitHub creates for a thread reply, inline comments, and any of these whose text changes. A bot comment counts only when it is the reviewer's round summary (`hasPublishedSummary` in [`scripts/review-gate.ts`](../../scripts/review-gate.ts)) or its truncation notice; progress edits, the review state comment, preview and Linear link comments stay silent. The posted summary does not reliably carry the `<!-- pr-review:` trailer (none on #690 or #696), so pr-watch reuses the gate's check, which also matches the `レビュー結果` heading.
- **What rides along.** Draft/ready, label, and reopen changes do not wake the agent: without a comment it has nothing to do, and after ready the review result arrives on its own. They are listed as context in the next batch (decision 2026-10-09).
- **CI is not watched here.** The agent's own push is covered by `gh pr checks --watch`; a second watcher would wake it twice for one failure. Marking ready does not rerun `ci.yml` (`pull_request` with the default types), and a review run that stops without a summary posts the truncation notice, which does wake the agent.
- **Loop guard.** Agents post as the owner's account, so the author cannot tell an agent's reply from the human's. Agents end every post with `<!-- pr-watch-agent -->` and pr-watch skips posts whose last line is the marker; a post that only quotes it, like a review of this tooling, still arrives. An agent that forgets the marker wakes itself with its own post. State changes have no body to mark, and agents do not toggle draft/ready (`gh pr ready` is denied).
- **Untrusted text.** Text reaches the agent only from `HIRO15254`, `claude[bot]`, and `github-actions[bot]`, wrapped in `<untrusted-github-text>`. A post by anyone else is listed as context with its URL and without its text. GraphQL reports a bot login without the `[bot]` suffix; pr-watch adds it for `__typename: Bot`.
- **One watch per PR.** Starting `pr-watch` again for the same PR takes over: the older process sees a new token in `<git dir>/pr-watch/<pr>.lock` and exits, so a doubled start costs one short turn instead of duplicate batches.
- **Limits.** Nothing is delivered while the agent's session is closed; the PR, GitHub notifications, and the Linear status still show the state, and the next watch reports what it missed. Only a top-level session is re-invoked when its background command exits, so an agent that will own a PR runs as its own session, not as an in-session subagent.
- **Replaced design.** The first version (2026-10-09) received webhooks through `gh webhook forward` and typed a notice into the agent's Orca terminal from a daemon in Orca's default terminal tab. It was replaced the same day to drop the Orca and gh-webhook dependencies, the always-on daemon, and the one-forwarder-per-repository limit (GitHub refuses a second hook with `Hook already exists`).

## Agents and hooks

| Agent | Reads `AGENTS.md` via | Commit trailer detected by `.husky/commit-msg` from |
|---|---|---|
| Claude Code | `CLAUDE.md` (`@AGENTS.md`), plus `.claude/rules/` auto-loaded by path | `CLAUDECODE` |
| Codex | native | `CODEX_MANAGED_*` |
| Gemini CLI | [`.gemini/settings.json`](../../.gemini/settings.json) `context.fileName` | `GEMINI_CLI` |

- [`.claude/settings.json`](../../.claude/settings.json) denies `gh pr merge` and `gh pr ready` for Claude Code, raises `BASH_MAX_TIMEOUT_MS` so [pr-watch](#pr-watch) can wait for days, and its Stop hook runs format, changed tests, lint, and `check:rules`; `.husky/pre-commit` is skipped under Claude Code for that reason. Codex and Gemini have no equivalent deny and follow the `AGENTS.md` text.
- `.husky/pre-push` and the `branch-name` job in `ci.yml` reject non-ASCII branch names ([`scripts/check-branch-name.ts`](../../scripts/check-branch-name.ts)); `claude-code-action` refuses them, so the automated review would never run.
- Linear MCP is configured for all three agents (Gemini: `/mcp auth linear`).

## Discovery (SA2-254)

Agents find problems and file them, with evidence, to Linear Triage; a human only decides whether to accept. Discovery runs never write code, push, or open PRs.

- **Review findings.** The reviewer lists established `[pre-existing]` problems in its trailer (`preExisting`, at most three). [`scripts/file-preexisting-issues.ts`](../../scripts/file-preexisting-issues.ts) files them after a published round with label `source/review`, deduplicating on a fingerprint of file and title that is stored in the issue description, so round 2 or a re-review does not file them again. Without `LINEAR_API_KEY` (or on a fork PR) it only warns.
- **Code audit.** The [`audit` skill](../../.claude/skills/audit/SKILL.md) audits one unit per run. Granularity is the point: one run reading a whole domain (`live-sessions` alone is about 20k lines) only skims, so a unit is at most about 4k non-test lines and the cycle is short.
- **Unit selection** is computed from git by [`scripts/audit-select.ts`](../../scripts/audit-select.ts), not from a manifest, so moving or adding files needs no re-slicing. Directories are split recursively until they fit the budget, loose files of an oversized directory are chunked by file name, and small neighbours are merged into one unit (a ledger row path joins parts with `+`), which gives about 26 units today — a full cycle of under a month at one unit a day. A unit's score is `(lines changed since its last audit + average age in days × √size) × risk weight` (api, db, auth, server 1.5; mcp 1.2; web 1.0); a unit unaudited for 30+ days is chosen first, so quiet code is not starved by busy code. A unit with at least 25% of its lines changed since one common audit is reviewed as a diff, otherwise swept. Roots are every `apps/*/src` and `packages/*/src`, found from git, so a new package is audited without a change; `record` also drops ledger rows that no longer cover any file. The risk weights and the path → rule-file map are the one hand-kept part, `RISK_WEIGHTS` and `RULES` in `audit-select.ts`: when adding a rule file under `.claude/rules/`, update `RULES` too.
- **Ledger.** The Linear document "Audit ledger" (project エージェント半自動運用) holds one row per audited path: SHA, UTC timestamp, agent, issues filed. The timestamp is to the second because two agents run on the same UTC day and the next agent is decided by the latest row; a bare date made the Codex run skip every other day. It is state, not history, so it is a document the run overwrites rather than an issue that collects comments. The audit writes it with `audit-select.ts record`, which replaces only the rows the unit covers.
- **Limits.** Medium and Low issues: at most 3 per run, and none while 10 or more `source/audit` issues sit in Triage, so filing follows how fast the human can accept. High and Urgent issues are exempt from both: at most 10 per run, filed even when the queue is full, because a serious problem should not wait behind unaccepted minor ones. The caps are runaway guards, not quotas.
- **Run wrapper.** Orca has no model or effort setting, so an automation would run on whatever the agent's global config says at that moment, and the owner changes that config in interactive sessions. Each automation prompt is therefore just `bun scripts/audit-run.ts <agent>` plus "report its output"; [`scripts/audit-run.ts`](../../scripts/audit-run.ts) starts the real session with the model and effort written in the repo (Claude `opus` / `xhigh`, Codex `gpt-5.6-sol` / `xhigh`) and full permissions, feeding the instruction on stdin. Changing a model is a reviewed diff. The wrapper runs for as long as the audit does, so the prompt asks the outer agent to run it with the longest allowed tool timeout (or in the background and wait); a timeout shorter than the audit would cut the inner session off before it saves the ledger. The Codex MCP login for Linear must be done once (`codex mcp login linear`).
- **Schedule.** Two Orca automations, started disabled and enabled after a manual run was checked: `Code audit (claude)` daily at 03:00 JST and `Code audit (codex)` daily at 15:00 JST. Orca ignored `INTERVAL=2` and `DTSTART`, so alternate days were not possible; instead each run stops unless it is its agent's turn (the selector alternates by the last run's agent), which makes two units a day and a cycle of about two weeks, bounded by the Triage backpressure. Each prompt runs the wrapper above and reports its output. Codex needs the Linear MCP login, `bun`, and `gh` in its Orca environment. Orca's run status `completed` only means the prompt was handed over, not that the audit finished (a run takes about 25 minutes): judge a run by the ledger row and the filed issues. Orca and the PC must be running. Rule and doc staleness is not a scheduled discovery source: stale references are caught by `check:rules` and by the maintenance triggers in `AGENTS.md`. The scheduled run is not the timer-based check-in that `AGENTS.md` forbids after opening a PR.

## Released step

[`scripts/release-linear-issues.ts`](../../scripts/release-linear-issues.ts) takes the merged PRs whose merge commit lies between the previous tag and the release merge, asks Linear for the issues attached to each PR (`attachmentsForURL`), and moves the Sapphire2 issues in Done to Released. It does not use `(SA2-xxx)` in titles or branch names, which no check guarantees. The first run (v3.5.2) moved SA2-187, SA2-190, and SA2-237. An issue that is not Done at release time (a phase issue still open for non-code work) is moved to Released by hand when it closes.
