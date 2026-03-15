# Better-T-App Constitution

## Core Principles

### I. Type Safety First
All code MUST be fully typed with TypeScript strict mode. No usage of `any`. Prefer `unknown` for genuinely unknown types. Use Zod schemas for runtime validation at boundaries (API inputs, env vars, form data). Drizzle ORM schemas serve as the single source of truth for database types. Use const assertions (`as const`) for immutable values and literal types.

### II. Monorepo Package Boundaries
Each package (`api`, `auth`, `config`, `db`, `env`) MUST be self-contained with explicit exports. Cross-package imports MUST go through the package's public API (package.json exports field). No reaching into another package's internal files. Apps (`web`, `server`) consume packages; packages MUST NOT import from apps.

### III. Test Coverage Required
Every implementation task MUST produce corresponding tests. Use Vitest as the test runner across all workspaces. Test types required:
- **Unit tests**: Business logic in services and utilities
- **Component tests**: React components via Testing Library + jsdom
- **Integration tests**: tRPC routers with mocked DB
- **Schema tests**: Drizzle ORM schema structure validation
Tests MUST pass before code is committed (enforced by pre-commit hook).

### IV. Code Quality Automation
Biome (via Ultracite) is the single source of truth for formatting and linting. Tabs for indentation. The PostToolUse hook auto-formats on every write. lint-staged runs on commit. No manual formatting debates. Run `bun x ultracite fix` before committing.

### V. API Contract Discipline
tRPC routers define the contract between frontend and backend. Input validation uses Zod schemas. Protected routes use `protectedProcedure`; public routes use `publicProcedure`. Every router procedure MUST validate its inputs. Error responses use TRPCError with descriptive messages and appropriate error codes.

## Technology Standards

| Category | Technology |
|----------|-----------|
| Runtime | Bun |
| Language | TypeScript (strict mode) |
| Frontend | React 19, Vite, TanStack Router (file-based), TanStack Query, shadcn/ui, Tailwind v4 |
| Backend | Hono, tRPC v11 |
| Database | PostgreSQL, Drizzle ORM |
| Auth | better-auth |
| Testing | Vitest, Testing Library |
| Code Quality | Biome + Ultracite |
| Validation | Zod |
| Env Management | @t3-oss/env-core + dotenv |

## Development Workflow

- Feature branches follow the pattern: `{number}-{short-name}`
- Spec-kit pipeline: specify → clarify → plan → tasks → analyze → implement
- Constitution is checked at the plan stage and during analysis
- All PRs must pass: type checking (`bun run check-types`), tests (`bun run test`), lint (`bun run check`)
- Pre-commit hook enforces: tests + lint-staged (ultracite fix)

## Governance

This constitution supersedes ad-hoc practices. Amendments require:
1. A documented rationale for the change
2. Update to the constitution version
3. Propagation check across spec-kit templates

Complexity MUST be justified. Default to the simplest approach that meets requirements (YAGNI). Prefer editing existing files over creating new ones. Do not add features beyond what was requested.

**Version**: 1.0.0 | **Ratified**: 2026-03-01 | **Last Amended**: 2026-03-01
