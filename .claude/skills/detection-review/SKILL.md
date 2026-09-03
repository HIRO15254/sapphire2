---
name: detection-review
description: Check that the tests in the current change would actually catch a regression. Runs Stryker on the changed api / db / web-node implementation files (bun run mutate), performs the manual three-flip check on changed web-dom / server / mcp / env files, classifies every survivor as domain logic or decorative, and proposes the missing it() for each domain survivor. Use after implementing and before opening a PR, or when the user invokes `/detection-review`.
---

## User Input

```text
$ARGUMENTS
```

Optional: a base ref (default `origin/dev`) and/or explicit implementation file paths. When empty, the scope is every implementation file changed since the merge-base with `origin/dev`, plus uncommitted and untracked changes.

## Goal

For every changed implementation file, answer: which test goes red when this file's logic is wrong? Produce a table of survivors, classified, and a concrete proposal for each missing test. This skill reports and proposes; it writes tests only when the user says so, and it never edits an existing test to make a mutant "die".

## Execution Flow

### 1. Scope

```bash
git fetch --quiet origin dev
BASE=$(git merge-base HEAD origin/dev)
{ git diff --name-only "$BASE" HEAD; git diff --name-only; git ls-files --others --exclude-standard; } | sort -u
```

Keep only `apps/**/*.{ts,tsx}` and `packages/**/*.{ts,tsx}`; drop `__tests__/`, `*.test.*`, `*.gen.ts`, `*.d.ts`, `packages/db/src/migrations/**`, `scripts/**`. Map each file to its vitest project by the include globs:

- `packages/api/src/**` → api (Stryker)
- `packages/db/src/constants/**`, `packages/db/src/constants.ts`, `packages/db/src/schemas/**` → db (Stryker); `packages/db/src/schema/**` is declarative and has no mutation run
- `apps/web/src/utils/**`, `apps/web/src/shared/lib/**`, `apps/web/src/features/**/utils/**` → web-node (Stryker), except `features/auth/utils/login-continuation.ts` and `features/sessions/utils/share-session.ts` → web-dom
- every other `apps/web/src/**` file → web-dom (manual)
- `apps/server/src/**` → server, `packages/mcp/src/**` → mcp, `packages/env/src/**` → env (manual)

If nothing is in scope, say so and stop.

### 2. Stryker for api / db / web-node

```bash
bun run mutate -- --changed --base "$BASE"
```

(Or per file: `bun run mutate -- --mutate packages/api/src/routers/room.ts`.) Read `reports/mutation/<project>/report.json`: for each file in `files`, list mutants with `status` in {Survived, NoCoverage} as `path:line:column mutatorName → replacement`. Record the per-file score printed by the clear-text reporter. A Stryker run is minutes long (api: ~10 min for a 3,200-line router); run it once, never per iteration. If the runner is not found, do not symlink anything into `node_modules/.bun` — `bun install --frozen-lockfile` and the resolution in `scripts/mutate.ts` are the only supported paths (see `docs/design/testing-and-tooling.md`, "Mutation testing").

### 3. Manual three-flip for web-dom / server / mcp / env files

For each file in scope:

1. Require a clean file: `git diff --quiet -- <file>` must exit 0 (stage the file first with `git add -- <file>` if the change is uncommitted). Copy it to the scratchpad directory as the restore source.
2. Pick the three most consequential conditions in the diff hunks: a guard (`if` / early return / ternary), a comparison (`<` ↔ `<=`), a boolean or `&&` / `||`. Never flip decorative literals.
3. For each condition, one at a time: edit it, run `bunx vitest related --run --project <project> <file>` (use `--project web-dom` for web files), and record the first failing test name. A run that stays green is a SURVIVED flip.
4. Restore with `git checkout -- <file>` and confirm `git diff --quiet -- <file>` exits 0 before the next flip. If the restore fails, copy the scratchpad copy back.

Never leave a flipped file behind: at the end, `git status --porcelain` must match what it showed before step 3 (apart from the staging done in 3.1).

### 4. Classify every survivor

- **Domain** (missing test): mutants inside validation, ownership WHERE composition, arithmetic, state transitions, date / time-zone handling, sorting or filtering, error-code selection, batch statement composition, optimistic-cache derivation. Typical mutators: ConditionalExpression, EqualityOperator, LogicalOperator, ArithmeticOperator, BlockStatement, OptionalChaining, MethodExpression.
- **Decorative** (directive): UI copy, toast / log / error `message` text when the `code` is what the spec fixes, aria labels, icon or className maps, key order. Typical mutators: StringLiteral, ObjectLiteral, ArrayDeclaration on label tables.
- **Equivalent**: the mutant cannot change observable behavior (e.g. `<` vs `<=` where equality is unreachable). Say why in one line.

### 5. Propose the missing tests

For each domain survivor: the it() name (scenario wording), the file it belongs in (per the patterns table in `.claude/rules/testing.md`), the arrange step, the act, and the single outcome assertion that kills the mutant. Kill with an outcome (`toEqual`, `rejects.toMatchObject({ code })`, `toHaveTextContent`), never with a spy on internals. For decorative survivors propose the exact directive line: `// Stryker disable next-line <Mutator>: <why>`.

### 6. Report

One Markdown table: file | project | mutants killed / survived / no-coverage (or flips detected / 3) | domain survivors | decorative | proposed tests. Then the proposals from step 5. End with a "for the PR body" block: per project, mutation score before (from the baseline table in `docs/design/testing-and-tooling.md` or the last report) and after, and — for a PR that deletes tests — the it() count and suite time before/after. Ask whether to write the proposed tests; if yes, each one goes red first, then green.

## Notes

- Never delete, skip, or loosen a failing test discovered along the way; report it.
- Do not run `bun run test` (full suite) — scoped projects only.
- Do not commit or push; staging in step 3 is only the restore anchor.
- Coverage percentages are not collected and not reported.
