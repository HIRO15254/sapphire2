---
description: Execute the implementation plan using Agent Teams with domain-specialized teammates and automatic test generation
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

This command uses **Agent Teams** to parallelize implementation across domains. Each domain (frontend, backend, database) gets a dedicated teammate that handles all tasks for that domain. Teammates reference `.claude/agents/{domain}.md` for domain-specific expertise. The Lead (you, Opus) coordinates the team, handles cross-domain tasks, and monitors progress.

### Step 1: Load Prerequisites

1. Run `.specify/scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.

2. **Check checklists status** (if FEATURE_DIR/checklists/ exists):
   - Scan all checklist files in the checklists/ directory
   - For each checklist, count total, completed, and incomplete items
   - Display status table
   - If any incomplete: ask user whether to proceed or stop
   - If all complete: automatically proceed

3. Load and analyze implementation context:
   - **REQUIRED**: Read tasks.md for the complete task list
   - **REQUIRED**: Read plan.md for tech stack, architecture, and file structure
   - **REQUIRED**: Read `.specify/memory/constitution.md` for project principles
   - **IF EXISTS**: Read data-model.md, contracts/, research.md, quickstart.md

### Step 2: Parse and Classify Tasks by Domain

Parse tasks.md and extract all tasks. Group them into **phases** and **domains**.

#### Domain Classification Rules

| Domain | Detection Rules | Teammate |
|--------|----------------|----------|
| **FRONTEND** | Path contains `apps/web/`, `.tsx`, `components/`, `routes/` | frontend teammate |
| **BACKEND** | Path contains `apps/server/`, `packages/api/`, `routers/` | backend teammate |
| **DATABASE** | Path contains `packages/db/`, `schema/`, `migration` | database teammate |
| **CROSS-DOMAIN** | Touches multiple domains, config files, or env setup | Lead (you) |

If a task doesn't clearly belong to one domain, the Lead executes it directly.

#### Phase Strategy

- **Phase 1-2 (Setup, Foundational)**: Lead executes directly — these often have cross-domain dependencies
- **Phase 3+ (User Stories)**: Domain teammates execute in parallel (domain-parallel, intra-domain sequential)
- **Final Phase (Polish)**: Lead executes directly — integration and quality checks

### Step 3: Execute Setup Phases (Lead)

For Phase 1 and Phase 2:

1. Execute each task sequentially using the Task tool (`subagent_type: "general-purpose"`)
2. Provide domain context from `.claude/agents/{domain}.md` matching the task
3. After all tasks in the phase: run `bun run test`
4. Mark completed tasks as `[X]` in tasks.md
5. Report phase completion

### Step 4: Create Agent Team for Story Phases

For Phase 3+ (User Story phases), create an Agent Team:

1. **Create the team** using TeamCreate:
   - team_name: use feature short name (e.g., "feature-user-auth")
   - description: brief feature description

2. **Create tasks** using TaskCreate for each implementation task, organized by domain

3. **Group tasks by domain** from the parsed task list:
   - Collect all FRONTEND tasks → assigned to frontend teammate
   - Collect all BACKEND tasks → assigned to backend teammate
   - Collect all DATABASE tasks → assigned to database teammate

4. **Spawn domain teammates** using the Task tool with `team_name` parameter:

   For each domain that has tasks, spawn ONE teammate:

   ```
   name: "{domain}"
   subagent_type: "general-purpose"
   team_name: "{team-name}"
   model: "sonnet"
   ```

   Each teammate's prompt MUST include:

   ```
   あなたは {domain} ドメインの専門家です。

   ## 最初に読むファイル
   `.claude/agents/{domain}.md` を読んで、このドメインの実装パターンとテストパターンを理解してください。

   ## あなたの担当タスク
   以下のタスクを順番に実装してください。各タスク完了後にテストも書いてください。

   {タスクリスト（ID、説明、ファイルパス）}

   ## プロジェクト標準（Constitution より）
   - TypeScript strict mode、`any` 禁止、`unknown` を使用
   - Zod でランタイムバリデーション
   - Biome/Ultracite が自動フォーマット（タブ）
   - パッケージ境界: public API exports 経由のインポート
   - tRPC: publicProcedure/protectedProcedure、入力は必ず Zod で検証

   ## 実装ルール
   - 既存ファイルを修正前に必ず読む
   - 既存コードのパターンに従う
   - タスク記述以上の機能を追加しない
   - 新ファイル作成より既存ファイル編集を優先
   - 各タスク実装後に対応するテストファイルを作成
   - TaskUpdate でタスク完了を報告

   ## タスク管理
   - TaskList でタスクを確認
   - 作業開始時に TaskUpdate で status を in_progress に
   - 完了時に TaskUpdate で status を completed に
   - 問題発生時は Lead にメッセージ送信
   ```

5. **Assign tasks** to each teammate using TaskUpdate with `owner` parameter

6. **Monitor progress**:
   - Teammates will send messages on task completion or when blocked
   - Messages are delivered automatically — no need to poll
   - If a teammate is blocked, help resolve the issue or reassign

7. **Handle cross-domain tasks**: Execute directly as Lead using the Task tool

### Step 5: Lead Monitoring During Team Execution

While teammates work:

1. **React to messages** from teammates (completion reports, blockers, questions)
2. **Track progress** via TaskList
3. **Resolve inter-domain dependencies** if teammates need output from other domains
4. **Execute cross-domain tasks** that don't fit any single domain

### Step 6: Final Phase (Lead)

After all story phase tasks are complete:

1. **Shut down teammates** using SendMessage with `type: "shutdown_request"`
2. **Clean up team** using TeamDelete
3. **Execute final phase tasks** (Polish) directly as Lead
4. **Run final validation**:
   - `bun run test` — all tests must pass
   - `bun run check-types` — no type errors
5. **Report completion** with summary

### Step 7: Completion Report

```
## Implementation Complete

### Summary
- Total tasks: XX completed, XX failed, XX skipped
- Tests: XX passed, XX failed
- Type check: PASS/FAIL

### Team Execution
- Frontend teammate: X tasks completed
- Backend teammate: X tasks completed
- Database teammate: X tasks completed
- Lead (cross-domain): X tasks completed

### Files Created/Modified
[List of all files touched]

### Test Coverage
[List of test files created]

### Next Steps
- Review the implementation
- Run `bun run test` to verify
- Run `bun run check-types` for type safety
- Consider running `bun run dev` to test manually
```

---

## Progress Tracking

After each phase or significant milestone, update the progress display:

```
## Implementation Progress
- [x] Phase 1: Setup (3/3 tasks) — Lead
- [x] Phase 2: Foundational (5/5 tasks) — Lead
- [ ] Phase 3: User Story 1 (0/7 tasks) — Team
  - Frontend: 0/4 tasks
  - Backend: 0/2 tasks
  - Database: 0/1 tasks
- [ ] Phase 4: User Story 2 (0/5 tasks) — Team
- [ ] Final: Polish (0/3 tasks) — Lead

Tests: 24 passed, 0 failed
```

## Error Handling

- **Teammate failure**: If a teammate reports an error, assess severity:
  - Minor: provide guidance via SendMessage, let teammate retry
  - Major: take over the task as Lead
- **Test failure** (TaskCompleted hook): The hook runs `bun run test` automatically. If tests fail, the teammate must fix before proceeding.
- **Cross-domain blocker**: If a teammate is blocked on another domain's output, coordinate directly
- **Teammate unresponsive**: Check TaskList for status, send message, or take over if needed

## Notes

- **1 teammate = 1 domain's all tasks**: Each teammate handles ALL tasks for their domain, not one task per teammate
- **Domain expertise via `.claude/agents/`**: Teammates read their domain's agent file for implementation patterns
- **TaskCompleted hook**: `bun run test` runs automatically on every task completion — tests must pass
- **Lead stays in control**: Opus manages the team, handles cross-domain work, and makes architectural decisions
- **Testing is mandatory**: Every implementation task must produce corresponding tests
- **Shutdown gracefully**: Always shut down teammates and delete team when done
