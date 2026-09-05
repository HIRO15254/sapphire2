---
name: pr-review
description: Evidence-based PR review for sapphire2. Use one reviewer with focused contract and entry-point checks for every PR. Reviews committed changes, verifies candidates and reports without posting unless --post is supplied.
---

## Input

```text
$ARGUMENTS
```

- `full` | `incremental`: review the whole range or changes since the last reviewed head.
- `--range <base>...<head>`: defaults to `origin/dev...HEAD` locally.
- `--since <sha>`: required for incremental mode.
- `--round <n> --max <n>`: review round and automatic cap for the closing line.
- `--pr <number>`: author intent from `gh pr view`; required with `--post`.
- `--post`: enable inline comments. Otherwise report only.
- `--profile lean`: optional; all reviews use `lean`. Do not switch profiles or relaunch after a limit.

## Scope and procedure

Review committed changes only. Do not edit product files, install dependencies, run background services or use unrelated external data. Temporary reproduction files may live under `$TMPDIR`. The workflow already performs eligibility and CI checks; do not repeat them.

Resolve the range and read its file list/stat. In incremental mode use `git diff <since>...HEAD` for discovery and retain the full range only for context. Obtain author intent once from `gh pr view <n> --json title,body`, or from `git log --format='%s%n%b' <range>` locally. Read `AGENTS.md` and only the applicable `.claude/rules/` files it lists.

For every PR, including data migrations and ownership changes, read [references/lean.md](references/lean.md) and follow it in this context. Do not launch finders, validators or settlement subagents or add a thorough review. The measured profile uses Opus with medium effort. If coverage cannot be completed, disclose the unchecked areas rather than claiming the review is complete.

In incremental mode, first read the previous round's supplied thread context and author replies. For every prior location, record fixed / not addressed / declined. A fix at one entry point does not settle another entry point sharing the same cause. Only proven fixes enter `resolved`; declined or unverified findings do not. Limit new findings to regressions introduced by fixes or important issues in the new diff.

## Posting and summary

The lean reference defines discovery and validation; these transport rules apply when `--post` is present:

- Post only established important findings inline with `mcp__github_inline_comment__create_inline_comment` and `confirmed: true`. Include every affected location, a concrete scenario, the harmful result and actual evidence. Use `**[important]**` first; distinguish incomplete fixes from new regressions in the body.
- Put nits, pre-existing issues and unverified questions in the summary only. Never pass an unverified claim to a tool as `confirmed: true`. Do not duplicate an existing thread.
- Do not post a summary comment yourself. The workflow's tracking comment carries the final answer.
- Return Japanese in at most 40 lines: verdict, one findings table, previous-round status when applicable, and one coverage line with executed tests. Empty findings is valid. Do not list harmless leftovers or refuted candidates.
- An interrupted or unfinished review must be visibly marked incomplete. Absence of a finding is not evidence of completion.

End with the existing machine-readable trailer; keep `resolved` as original `path:line` strings for workflow compatibility:

```text
<!-- pr-review: {"verdict":"approve","important":0,"nit":0,"unverified":0,"resolved":[]} -->
```

Use `changes-requested` only for established important findings. When `--round` is at least `--max` and findings remain, add before the trailer: 次の自動レビューはありません。必要なら `re-review` ラベルで要求してください。

The workflow's two-round limit is unchanged. A local invocation is report-only unless explicitly given `--post`.
