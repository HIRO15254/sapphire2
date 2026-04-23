# sapphire2 — Project Guide for Claude

This file is loaded into every Claude Code session for this repo. Keep it concise (≤200 lines): general facts that must be remembered across turns. Historical context (PR numbers, past refactors) belongs in git / PR descriptions, not here.

Companion memory files (auto-loaded):

- [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — Ultracite / Biome code standards.
- [`.claude/rules/`](.claude/rules/) — path-scoped rule files; loaded only when files under the matching paths are touched. See the table near the bottom.

## Stack

- **Runtime / package manager**: Bun 1.3 (workspaces). Always use `bun`, never `npm` / `yarn` / `pnpm`.
- **Web**: React 19, Vite, TanStack Router, TanStack Query, tRPC v11 client, Tailwind v4, shadcn/ui, `@tanstack/react-form`.
- **Server**: Hono on Cloudflare Workers, tRPC v11 server, Better Auth.
- **DB**: Cloudflare D1 (SQLite) via Drizzle ORM. Migrations in `packages/db/src/migrations`.
- **Validation**: Zod (workspace catalog). Import as `import z from "zod"` (default import) — a Vite bundler issue breaks the namespace import.
- **Tests**: Vitest + Testing Library (jsdom).
- **Lint / format**: Ultracite (Biome preset). Details: [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
- **Icons**: `@tabler/icons-react` only. Do not add `lucide-react` imports in new code.

## Commands

Run from repo root:

```sh
bun run dev              # all apps (web on :3001, server)
bun run dev:web          # web only
bun run dev:server       # server only
bun run test             # vitest run (all workspaces)
bun run test:watch       # vitest watch
bun run lint             # ultracite check
bun run fix              # ultracite fix (auto-format & auto-fix)
bun run check-types      # tsc --noEmit (all workspaces)
bun run build            # build all workspaces
bun run db:generate      # drizzle-kit generate
bun run db:migrate:local # apply migrations to local D1
bun run db:studio        # drizzle-kit studio
```

Pre-PR verification: `bun run lint && bun run check-types && bun run test`.

## Repository Layout

```text
apps/
  web/     React SPA (apps/web/src/**)
  server/  Hono + tRPC on Cloudflare Workers
packages/
  api/     tRPC routers — source of truth for client types
  db/      Drizzle schema + migrations (Cloudflare D1)
  auth/    Better Auth setup
  env/     Zod-typed env vars
  config/  Shared TS / Biome configs
```

`apps/web/src/` layout:

```text
features/<feature>/
  components/<component>/  <component>.tsx + use-<component>.ts + index.ts (colocated)
  hooks/                   cross-component data hooks (use-players.ts, use-currencies.ts, ...)
  utils/                   feature-local pure helpers
  __tests__/               feature-local tests
routes/                    TanStack Router tree; page-level hooks live here as `-use-<page>-page.ts`
shared/
  components/ui/           shadcn primitives (Button, Select, Avatar, Badge, Table, ...)
  components/              cross-feature composites (PageHeader, AuthenticatedShell, sign-in-form, ...)
  hooks/                   cross-feature hooks (use-media-query, use-online-status, ...)
  lib/                     cross-feature helpers (form-fields, ...)
utils/                     truly global helpers (optimistic-update, formatters, ...)
```

When adding a feature, create `apps/web/src/features/<name>/` and colocate everything. Promote to `shared/` only when a second feature imports it.

## Web UI Essentials (cross-cutting)

Detailed rules live in [`.claude/rules/`](.claude/rules/); the points below apply everywhere in `apps/web/` and are worth keeping top of mind:

- **UI copy is English-only.** No Japanese in user-facing strings (labels, empty states, toasts, errors). Japanese is fine in comments, commit messages, and PR descriptions.
- **Mobile forms are bottom sheets.** Use shadcn `Drawer`, not `Dialog`.
- **Pages start with [`PageHeader`](apps/web/src/shared/components/page-header/page-header.tsx).** Do not hand-roll titles / action rows.
- **Logic lives in `useXxx` hooks, not in components.** Components render JSX from destructured hook returns. Verification & full forbidden list: [`.claude/rules/web-hooks-separation.md`](.claude/rules/web-hooks-separation.md).

## Testing

- `bun run test` (`vitest run`) is the source of truth.
- Colocate tests as `__tests__/foo.test.ts(x)` next to the code under test, or as `<component>.test.tsx` inside the component's own folder.
- When the logic is the point, prefer testing the hook (`renderHook` from Testing Library) over the component.
- Black-box: assert on returned state and handler side effects, not internal implementation details.

## Path-scoped Rule Files

The following rule files live in `.claude/rules/` and are loaded automatically when files under their `paths:` glob are touched:

| File | Paths | Summary |
|---|---|---|
| `web-hooks-separation.md` | `apps/web/**` | STRICT: components may only call custom `useXxx` hooks; verification script included. |
| `web-forms.md` | `apps/web/**` | `@tanstack/react-form` in hooks, no `type="number"`, no placeholders, `SelectWithClear` for clearable selects. |
| `web-ui.md` | `apps/web/**` | PageHeader, shadcn primitives (Table / Badge / Avatar / RadioGroup), mobile = Drawer, tabler-icons. |
| `web-data-fetching.md` | `apps/web/**` | Optimistic updates must go through `utils/optimistic-update.ts` helpers. |

## Maintaining This File (Self-Evolution)

This file evolves as the codebase evolves. Claude should **propose an update to `CLAUDE.md` or `.claude/rules/*.md` in-session** whenever one of these triggers fires, instead of silently absorbing the correction into one-off responses:

1. **The user corrects the same behavior twice.** The second correction is a signal the rule is missing. Capture it, including the *why* (the incident or preference that motivated it).
2. **A reference here is stale.** A path no longer resolves, a command name changed, a helper moved, or a "reference implementation" was deleted. Fix it in the same task that discovered the staleness.
3. **A merged PR establishes a new cross-cutting convention** — a new shared helper, a new directory pattern, a new mandatory primitive, or a new banned pattern. Document it immediately while the reasoning is fresh.
4. **A verification script in a rule file starts failing.** Decide whether the rule or the code is wrong; update the losing side and the rule's wording if the intent has drifted.
5. **A rule is no longer true.** Delete it (do not comment it out) and note what replaced it in the PR description.

### Procedure for adding a rule

1. **Verify it is not already enforced** by Ultracite, TypeScript, a pre-commit hook, or a route-level constraint. If it is, reference the enforcement instead of duplicating the rule.
2. **Decide scope**: narrow path (e.g., `apps/web/**`, `apps/server/**`, `packages/db/**`) → `.claude/rules/<topic>.md` with a `paths:` frontmatter. Truly cross-cutting → this file.
3. **Write the rule with a one-line "why"** — the incident, PR, or decision that created it — so future edits can judge edge cases instead of blindly following the letter.
4. **Prefer concrete over abstract.** "Use `SelectWithClear` for clearable selects" beats "prefer consistent select behavior". Include explicit file paths and commands.
5. **If you add a new file under `.claude/rules/`**, update the index table above.
6. **For large rewrites or ambiguous scope**, propose the change in chat before writing it — this file is shared across the team.

### Hygiene

- Keep `CLAUDE.md` ≤200 lines. If a new top-level rule would push it over, split the lowest-value existing section into a path-scoped rule file.
- Delete rules that no longer apply. Historical context belongs in git / PR descriptions, not here.
- If two rules overlap, merge them; cross-link rule files that reference each other.
