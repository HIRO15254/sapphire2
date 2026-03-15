# Deployment Guide

> **[日本語版はこちら](deploy.ja.md)**

## 1. Overview

This repository is built on Cloudflare Workers + Neon architecture.

- **API Server**: Cloudflare Workers (Hono)
- **Frontend**: Cloudflare Pages (Vite SPA)
- **Database**: Neon PostgreSQL (`@neondatabase/serverless`)

### Deployment Environments

| Environment | Trigger | Description |
|-------------|---------|-------------|
| **Local** | `bun run dev` | `wrangler dev` (local Workers simulation) |
| **Preview** | PR opened | Isolated Worker + Pages + Neon branch per PR |
| **Production** | master push | Deploy Worker + Pages after CI passes |

## 2. Prerequisites

- [Cloudflare](https://dash.cloudflare.com/sign-up) account (Free plan OK)
- [Neon](https://console.neon.tech/signup) account (Free plan OK)
- GitHub repository admin access (required for Secrets configuration)
- [Bun](https://bun.sh/) installed locally

## 3. Local Development

### 3.1 Create Neon Database

Neon is used for local development as well (`@neondatabase/serverless` connects via HTTP, so a local PostgreSQL instance cannot be used).

1. Create a project in the [Neon Console](https://console.neon.tech/)
2. Copy the connection string from "Connection Details"

### 3.2 Configure Environment Variables

Copy `apps/server/.dev.vars.example` to create `.dev.vars`.

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

Edit `.dev.vars`:

```
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
```

### 3.3 Run Migrations

```bash
DATABASE_URL="your-neon-connection-string" bun run db:migrate
```

### 3.4 Start Development Server

```bash
bun run dev
```

- API: `http://localhost:8787` (`wrangler dev`)
- Web: `http://localhost:3001` (Vite)

## 4. Neon Setup (for CI)

### 4.1 Get API Key

1. Neon Console → "Account Settings" (bottom-left) → "API Keys"
2. "Generate new API key" → copy the key

### 4.2 Find Project ID

```
https://console.neon.tech/app/projects/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        This is your Project ID
```

## 5. Cloudflare Setup

### 5.1 Create API Token

1. [API Tokens page](https://dash.cloudflare.com/profile/api-tokens) → "Create Token"
2. Choose "Custom token" with the following permissions:
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Workers Scripts** > **Edit**

### 5.2 Find Account ID

Cloudflare Dashboard → "Workers & Pages" overview page → right sidebar

### 5.3 Create Pages Project

```bash
npx wrangler pages project create sapphire2-web
```

## 6. GitHub Secrets Configuration

### Repository Variables

Add via **Settings > Secrets and variables > Actions > Variables tab > New repository variable**.

| Variable Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages overview page (not a secret — used in preview URLs) |

### Repository Secrets

Add via **Settings > Secrets and variables > Actions > Secrets tab > New repository secret**.

#### Shared

| Secret Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Token with Workers/Pages edit permissions |
| `BETTER_AUTH_SECRET` | Self-generated | `openssl rand -base64 32` (32+ characters) |

### Preview Environment

| Secret Name | Source | Description |
|---|---|---|
| `NEON_PROJECT_ID` | Neon Console | From project dashboard URL |
| `NEON_API_KEY` | Neon Account Settings | Generated on API Keys page |

### Production Environment

| Secret Name | Source | Description |
|---|---|---|
| `PRODUCTION_DATABASE_URL` | Neon Console | Main branch connection string |
| `PRODUCTION_API_URL` | Cloudflare | Production Worker URL (e.g., `https://sapphire2-api.<subdomain>.workers.dev`) |
| `PRODUCTION_WEB_URL` | Cloudflare | Production Pages URL (e.g., `https://sapphire2-web.pages.dev`) |

> Set `PRODUCTION_API_URL` / `PRODUCTION_WEB_URL` after the first deployment using the actual URLs. Use custom domains if available.

## 7. Customization

### Changing the Worker Name

If you change `name` in `apps/server/wrangler.toml`, also update:

- `WORKER_NAME` variable in `.github/workflows/preview-deploy.yml`
- `--name` argument in `.github/workflows/preview-cleanup.yml`

### Changing the Pages Project Name

Update the `PAGES_PROJECT` variable in `preview-deploy.yml`.

### Production Deployment

Automated via `.github/workflows/production-deploy.yml`. On master push: CI → migration → Worker deploy → Pages deploy.

Uses `concurrency` for sequential execution. Deployment is skipped if CI fails.

## 8. Verification

### Preview

1. Create a test branch and open a PR
2. Check "Preview Deploy" in the Actions tab
3. Preview URLs will be posted as a PR comment
4. Auto-cleanup on PR close

### Production

1. Push to master (or merge a PR)
2. Check "Production Deploy" in the Actions tab
3. Access the Worker URL and Pages URL

## 9. Troubleshooting

### `CLOUDFLARE_API_TOKEN` Permission Error

```
Error: Authentication error
```

Verify the API token has Workers Scripts **Edit** + Cloudflare Pages **Edit** permissions.

### Neon Branch Creation Failure

```
Error: Could not find project
```

Check `NEON_API_KEY` validity and `NEON_PROJECT_ID` correctness.

### Worker Deployment Failure

```
Error: compatibility_date is too old
```

Update `compatibility_date` in `apps/server/wrangler.toml`.

### Migration Failure

```
Error: connection refused
```

Verify `DATABASE_URL` format:
```
postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

### Pages Deployment Failure

```
Error: A project with this name does not exist
```

Create the project first: `npx wrangler pages project create sapphire2-web`

## 10. Architecture

### Preview Deploy (on PR open)

```
PR open/synchronize
  |
  +-> Create Neon branch (pr-<number>)
  |     |
  |     +-> Run migrations
  |           |
  |           +-> Deploy Worker (sapphire2-api-pr-<number>)
  |                 |
  |                 +-> Deploy Pages (pr-<number> branch)
  |                       |
  |                       +-> Post preview URLs as PR comment
```

### Cleanup (on PR close)

```
PR close/merge
  |
  +-> Delete Worker → Delete Neon branch → Update PR comment
```

### Production Deploy (on master push)

```
push to master
  |
  +-> CI (type check, lint, test)
        |
        +-> Migration → Worker deploy → Pages deploy
```

### Tech Stack

```
                    ┌─────────────────┐
                    │  Cloudflare CDN │
                    └────────┬────────┘
                ┌────────────┴────────────┐
        ┌───────┴───────┐         ┌───────┴───────┐
        │   Pages       │         │   Workers     │
        │   (React SPA) │ ──API──>│   (Hono)      │
        └───────────────┘         └───────┬───────┘
                                          │
                                  ┌───────┴───────┐
                                  │   Neon        │
                                  │   (PostgreSQL)│
                                  └───────────────┘
```
