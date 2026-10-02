---
name: audit
description: Scheduled code audit for sapphire2. Audits one small unit of code chosen from git churn and age, and files evidenced findings to Linear Triage. Never edits code, pushes, or opens a PR. Use for the daily Orca automation or when asked to run the audit.
---

## Role

A discovery run. The only outputs are Linear Triage issues, a ledger update, and a short report. Do not edit product files, commit, push, or open a PR. No `level` label ever. The `PR Review Loop` rule against self-scheduled reminders does not apply to this skill: the schedule is an Orca automation, not a follow-up on a PR.

Design, scoring, and ledger format: [`docs/design/agent-workflow.md`](../../../docs/design/agent-workflow.md) (Discovery).

## Procedure

The automation prompt names your agent (`claude` or `codex`). Codex has no skill loader: its prompt says to read and follow this file, and every `agent` below is that name.

1. **Sync.** `git fetch origin` and check out `origin/dev` detached. Run from a clean tree.
2. **Backpressure.** Count Linear issues in Triage with label `source/audit`. If there are 10 or more, only High or Urgent findings may be filed this run (step 8); Medium and Low ones are dropped. Do not stop: a serious problem must not wait behind a full queue.
3. **Ledger.** Read the Linear document "Audit ledger" (project エージェント半自動運用) with `get_document` and save its table to `$TMPDIR/ledger.md`.
4. **Select.** `bun scripts/audit-select.ts select --ledger $TMPDIR/ledger.md`. The JSON gives `path`, `files`, `mode`, `sinceSha`, `rules`, `agent`, `reason`. If `agent` is not you, stop: the other agent owns this turn. Do not pick another unit.
5. **Read.** `AGENTS.md`, then every file in `rules`. In `diff` mode read `git diff <sinceSha>...HEAD -- <files>` first, then the surrounding code; in `sweep` mode read all `files`.
6. **Discover and verify** with [`pr-review/references/lean.md`](../pr-review/references/lean.md), with the whole unit as the range instead of a diff: record every candidate, then refute it with callers, guards, and a targeted test run (`bunx vitest run --project <project> <path>`). Skip what lint, types, or `check:rules` already catch.
7. **Deduplicate.** For each surviving candidate search Linear (all states, including Done and Canceled) by file path and by keyword. Skip it if an issue or a documented decision already covers it.
8. **File the survivors, best evidence first.** Medium and Low issues: at most 3 per run, and none while step 2's count is 10 or more. High and Urgent issues (priority by the scale in `AGENTS.md`) are not counted against that cap or the Triage count: at most 10 per run, as a runaway guard. The caps are not quotas: file nothing when nothing survives.
9. **Record the run.** Re-fetch the ledger document, then `bun scripts/audit-select.ts record --ledger <fresh copy> --unit <path> --agent <you> --filed <n>` and save the document with `save_document`, keeping the paragraph above the table and replacing only the table with that output. This replaces only the rows the unit covers. Record a run even when it filed nothing.
10. **Report** in at most 10 lines of Japanese: unit, mode, files read, issues filed (ids), candidates refuted, anything unchecked.

## Issue format

Create with `save_issue` in team Sapphire2, project エージェント半自動運用 or the project the area belongs to, state `Triage`, labels `audit` (group `source`) and one `type` label (`fix` → Bug, `refactor`/`perf`/`style` → Improvement, `chore`/`ci`/`build`/`docs`/`test` → Chore), a priority and an estimate by the scale in `AGENTS.md`. Never set `level`. Title: imperative, specific, English or Japanese as the surrounding issues. Body, so a human can accept it and an agent can start from it:

```markdown
## Problem
<what is wrong and who is hurt; one short paragraph>

## Evidence
- `path/to/file.ts:LINE` — <what the code does>
- Reproduction: `<command or input>` → <observed result>

## Why it is wrong
<the contract, rule file, or invariant it breaks, with a reference>

## Suggested fix
<scope and approach, no code>

Found by audit of `<unit path>` at `<short sha>`.
```

Evidence means a file and line plus a reproduction command or an executed result. A suspicion without it is not filed; mention it in the report instead.
