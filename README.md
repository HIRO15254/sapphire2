# sapphire2

> **[日本語版はこちら](README.ja.md)**

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, tRPC, and more.

## Tech Stack

- **React 19** + **TanStack Router** - Type-safe file-based routing
- **TailwindCSS** + **shadcn/ui** - Styling and UI components
- **Hono** - Lightweight server framework on Cloudflare Workers
- **tRPC v11** - End-to-end type-safe APIs
- **Drizzle ORM** + **Neon PostgreSQL** - Database (serverless HTTP driver)
- **Better Auth** - Authentication (email/password with PBKDF2)
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
├── docs/
│   ├── deploy.md       # Deployment guide (EN)
│   └── deploy.ja.md    # Deployment guide (JA)
└── .github/workflows/
    ├── ci.yml              # PR checks (type check, lint, test)
    ├── preview-deploy.yml  # PR preview environment
    ├── preview-cleanup.yml # Cleanup on PR close
    └── production-deploy.yml # Production deploy on push to master
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed
- [Neon](https://neon.tech/) PostgreSQL database

### Setup

1. Install dependencies:

```bash
bun install
```

2. Copy the environment variables template and fill in your values:

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
```

3. Push the schema to your database:

```bash
bun run db:push
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
| `bun run dev:server` | Start API server only (`wrangler dev`) |
| `bun run check-types` | TypeScript type check across all packages |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run database migrations |
| `bun run db:studio` | Open Drizzle Studio |
| `bun run check` | Run linting and formatting check |
| `bun run fix` | Auto-fix linting and formatting |
| `bun run test` | Run tests |
| `bun run test:watch` | Run tests in watch mode |

## Deployment

The project deploys to **Cloudflare Workers** (API) + **Cloudflare Pages** (Web) + **Neon PostgreSQL** (DB).

- **Preview**: Automatically created per PR (Worker + Pages + Neon branch)
- **Production**: Automatically deployed on push to `master`

See [docs/deploy.md](docs/deploy.md) for detailed setup instructions.
