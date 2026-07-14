# sapphire2

> **[日本語版はこちら](README.ja.md)**

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, tRPC, and more.

## Tech Stack

- **React 19** + **TanStack Router** - Type-safe file-based routing
- **TailwindCSS** + **shadcn/ui** - Styling and UI components
- **Hono** - Lightweight server framework on Cloudflare Workers
- **tRPC v11** - End-to-end type-safe APIs
- **Drizzle ORM** + **Cloudflare D1** - Database (SQLite)
- **Better Auth** - Authentication (email/password, Google, Discord OAuth)
- **Bun** - Package manager and runtime
- **Biome** (Ultracite) - Linting and formatting
- **Husky** - Git hooks
- **PWA** - Progressive Web App support

## Project Structure

```
sapphire2/
├── apps/
│   ├── web/            # Frontend (React 19 + Vite + TanStack Router)
│   └── server/         # API (Hono + tRPC on Cloudflare Workers)
├── packages/
│   ├── api/            # tRPC router and context
│   ├── auth/           # Better Auth configuration
│   ├── config/         # Shared TypeScript config
│   ├── db/             # Drizzle ORM schema and migrations
│   └── env/            # Environment variable validation (Zod)
├── AGENTS.md           # Agent guide (source of truth); CLAUDE.md imports it via @AGENTS.md
├── .claude/            # Claude Code config (rules, skills, settings)
├── docs/
│   ├── deploy.md       # Deployment guide (EN)
│   └── deploy.ja.md    # Deployment guide (JA)
└── .github/workflows/
    ├── ci.yml               # PR checks (type check, lint, test)
    ├── claude.yml           # Claude GitHub integration
    ├── pr-target-guard.yml  # Release-only guard for `main`
    ├── pre-merge-review.yml # Pre-merge review automation
    ├── preview-deploy.yml   # Per-PR preview environment
    ├── preview-cleanup.yml  # Cleanup on PR close
    ├── dev-deploy.yml       # Dev environment deploy on push to `dev`
    ├── release.yml          # Release creation and production dispatch
    ├── production-deploy.yml # Production deployment
    └── project-sync.yml     # Optional GitHub Project sync (requires configuration)
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Node.js](https://nodejs.org/) 20.3.0 or later installed (runs the Cloudflare Wrangler CLI; Bun remains the package manager)

### Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the server and web environment variable templates, then fill in your server values:

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.example apps/web/.env
```

`apps/server/.dev.vars` contains the server-side configuration; edit it with your values.

```env
ANTHROPIC_API_KEY=your-anthropic-api-key
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

`apps/web/.env` configures the Vite client. Its default `VITE_SERVER_URL` points to the local API at `http://localhost:8787`.

3. Run database migrations:

```bash
bun run db:migrate:local
```

4. Start development:

```bash
bun run dev
```

- Web: [http://localhost:3001](http://localhost:3001)
- API: [http://localhost:8787](http://localhost:8787)

## Available Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps |
| `bun run dev:web` | Start web app only |
| `bun run dev:server` | Start API server only (Wrangler runs with Node.js) |
| `bun run check-types` | TypeScript type check for Web and Server (the workspaces that currently define this script) |
| `bun run check` | CI lint and format check alias |
| `bun run check:rules` | Run deterministic project-rule checks |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate:local` | Apply migrations to the local D1 database |
| `bun run db:migrate:remote` | Apply migrations to the remote D1 database |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run lint` | Lint & format check (Ultracite) |
| `bun run fix` | Auto-fix linting and formatting |
| `bun run test` | Run tests |
| `bun run test:ci` | Run tests with the verbose CI reporter |
| `bun run test:watch` | Run tests in watch mode |

## Deployment

The project deploys to **Cloudflare Workers** (API) + **Cloudflare Pages** (Web) + **Cloudflare D1** (DB).

- **Preview**: Isolated Worker and D1 per PR, plus a PR branch deployment in the shared Pages project
- **Dev**: Persistent dev environment, deployed on push to `dev`
- **Production**: Deployed automatically when a GitHub Release is published

See [docs/deploy.md](docs/deploy.md) for detailed setup instructions.
