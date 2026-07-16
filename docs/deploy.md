# Deployment Guide

> **[日本語版はこちら](deploy.ja.md)**

## 1. Overview

This repository is built on Cloudflare Workers + D1 architecture.

- **API Server**: Cloudflare Workers (Hono)
- **Frontend**: Cloudflare Pages (Vite SPA)
- **Database**: Cloudflare D1 (SQLite via Drizzle ORM)

### Deployment Environments

| Environment | Trigger | Description |
|-------------|---------|-------------|
| **Local** | `bun run dev` | `wrangler dev` (local Workers simulation) |
| **Preview** | PR opened, synchronized, or reopened | Isolated Worker and D1 per PR; PR branch deployment in the shared Pages project |
| **Dev** | Push to `dev` | Persistent dev environment (`sapphire2-api-dev`) |
| **Production** | GitHub Release published | Deploy Worker + Pages after CI passes |

## 2. Prerequisites

- [Cloudflare](https://dash.cloudflare.com/sign-up) account (Free plan OK)
- GitHub repository admin access (required for Secrets configuration)
- [Bun](https://bun.sh/) installed locally
- [Node.js](https://nodejs.org/) 20.3.0 or later installed locally (required to run the Cloudflare Wrangler CLI; Bun remains the package manager)

> Wrangler creates local D1 state for local development. Preview and dev databases are created by the workflows through the Cloudflare API; production uses the existing database configured in `apps/server/wrangler.toml`.

## 3. Local Development

### 3.1 Configure Environment Variables

Copy the server and web environment variable templates.

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
cp apps/web/.env.example apps/web/.env
```

Edit `apps/server/.dev.vars` with your server-side configuration:

```
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

`ANTHROPIC_API_KEY` and `GOOGLE_MAPS_API_KEY` are optional unless AI extraction or Google Places search is used.

`apps/web/.env` configures the Vite client. Its default `VITE_SERVER_URL` points to the local API at `http://localhost:8787`.

### 3.2 Run Migrations

```bash
bun run db:migrate:local
```

### 3.3 Start Development Server

```bash
bun run dev
```

- API: `http://localhost:8787` (Wrangler runs with Node.js)
- Web: `http://localhost:3001` (Vite)

## 4. Cloudflare Setup

### 4.1 Create API Token

1. [API Tokens page](https://dash.cloudflare.com/profile/api-tokens) → "Create Token"
2. Choose "Custom token" with the following permissions:
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Workers Scripts** > **Edit**
   - **Account** > **D1** > **Edit**

### 4.2 Find Account ID

Cloudflare Dashboard → "Workers & Pages" overview page → right sidebar

### 4.3 Create Pages Project

```bash
bunx wrangler pages project create sapphire2-web --production-branch main
```

See the [Cloudflare Pages Wrangler commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/).

### 4.4 Create the Production D1 Database

Remote D1 databases are not created by `db:migrate:remote`. Create the production database once:

```bash
bunx wrangler d1 create sapphire2-db
```

Copy the returned `database_id` into `apps/server/wrangler.toml` and keep `binding = "DB"` and `database_name = "sapphire2-db"` aligned with the Worker configuration.

The preview and dev workflows create their environment-specific databases through the Cloudflare API; do not reuse the production ID for those environments.

See the [Cloudflare D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/).

## 5. OAuth Provider Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to "APIs & Services" > "Credentials"
4. Create "OAuth 2.0 Client ID" (Web application type)
5. Add authorized redirect URIs:
   - Local: `http://localhost:8787/api/auth/callback/google`
   - Production: `https://<your-worker>.workers.dev/api/auth/callback/google`

### Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "OAuth2" settings
4. Add redirects:
   - Local: `http://localhost:8787/api/auth/callback/discord`
   - Production: `https://<your-worker>.workers.dev/api/auth/callback/discord`

## 6. GitHub Secrets Configuration

### Repository Variables

Add via **Settings > Secrets and variables > Actions > Variables tab > New repository variable**.

| Variable Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages overview page |

### Repository Secrets

Add via **Settings > Secrets and variables > Actions > Secrets tab > New repository secret**.

#### Shared

| Secret Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Token with Workers/Pages/D1 edit permissions |
| `BETTER_AUTH_SECRET` | Self-generated | `openssl rand -base64 32` (32+ characters) |

#### OAuth (Google/Discord)

| Secret Name | Source | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 Client Secret |
| `DISCORD_CLIENT_ID` | Discord Developer Portal | OAuth2 Application Client ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal | OAuth2 Application Client Secret |

#### Feature APIs (optional)

| Secret Name | Source | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic | Enables AI-assisted extraction |
| `GOOGLE_MAPS_API_KEY` | Google Cloud | Enables Google Places search |

#### Preview Auto-Login

| Secret Name | Source | Description |
|---|---|---|
| `PREVIEW_LOGIN_EMAIL` | Self-created | Test account email for auto-login in preview |
| `PREVIEW_LOGIN_PASSWORD` | Self-created | Test account password for auto-login in preview |

### Production Environment

| Secret Name | Source | Description |
|---|---|---|
| `PRODUCTION_API_URL` | Cloudflare | Production Worker URL (e.g., `https://sapphire2-api.<subdomain>.workers.dev`) |
| `PRODUCTION_WEB_URL` | Cloudflare | Production Pages URL (e.g., `https://sapphire2-web.pages.dev`) |

> Set `PRODUCTION_API_URL` / `PRODUCTION_WEB_URL` after the first deployment using the actual URLs. Use custom domains if available.

## 7. Customization

### Changing the Worker Name

Worker names are configured independently for production, dev, and per-PR previews. Keep these locations aligned when renaming them:

- production `name` in `apps/server/wrangler.toml`
- `WORKER_NAME` in `.github/workflows/dev-deploy.yml`
- the `WORKER_NAME` prefix in `.github/workflows/preview-deploy.yml`
- `WORKER_PREFIX` in `.github/workflows/preview-cleanup.yml`

### Changing the Pages Project Name

Update every workflow that deploys or cleans up Pages:

- `PAGES_PROJECT` in `.github/workflows/preview-deploy.yml`
- `PROJECT_NAME` in `.github/workflows/preview-cleanup.yml`
- `PAGES_PROJECT` in `.github/workflows/dev-deploy.yml`
- the `--project-name` argument in `.github/workflows/production-deploy.yml`

### Production Deployment

`release.yml` publishes the tag and GitHub Release, then explicitly dispatches `production-deploy.yml` at that tag because releases created by the default `GITHUB_TOKEN` do not recursively start another workflow. `production-deploy.yml` also supports external `release: published` events and manual `workflow_dispatch` redeploys. The pipeline is CI → migration → Worker deploy → Pages deploy.

Uses `concurrency` for sequential execution. Deployment is skipped if CI fails.

## 8. Verification

### Preview

1. Create a test branch and open a PR (new commits and reopened PRs redeploy the same preview environment)
2. Check "Preview Deploy" in the Actions tab
3. Preview URLs will be posted as a PR comment
4. Auto-cleanup on PR close

### Production

1. Publish a GitHub Release (merge a `release/vX.Y.Z` PR into `main`)
2. Check "Production Deploy" in the Actions tab
3. Access the Worker URL and Pages URL

## 9. Troubleshooting

### `CLOUDFLARE_API_TOKEN` Permission Error

```
Error: Authentication error
```

Verify the API token has Workers Scripts **Edit** + Cloudflare Pages **Edit** + D1 **Edit** permissions.

### D1 Migration Failure

```
Error: D1_ERROR
```

Check the `d1_databases` configuration in `apps/server/wrangler.toml`.

#### Migration 0044 preflight: duplicate unfinished live sessions

Before deploying migration `0044_oval_captain_flint.sql` to a persistent D1 database, run:

```sql
SELECT
  user_id,
  COUNT(*) AS unfinished_count,
  GROUP_CONCAT(id) AS session_ids
FROM game_session
WHERE source = 'live' AND status != 'completed'
GROUP BY user_id
HAVING COUNT(*) > 1;
```

If the query returns rows:

1. Back up the target D1 database.
2. For each user, decide which live session should remain unfinished.
3. Complete or discard every extra session through the normal application flow.
4. Re-run the query and deploy only after it returns zero rows.

Do not update only `game_session.status` or delete rows directly: session events, cash/tournament results, and currency ledger entries must remain consistent. The migration intentionally fails on remaining duplicates instead of rewriting user data.

### Worker Deployment Failure

```
Error: compatibility_date is too old
```

Update `compatibility_date` in `apps/server/wrangler.toml`.

### Pages Deployment Failure

```
Error: A project with this name does not exist
```

Create the project first: `bunx wrangler pages project create sapphire2-web --production-branch main`

## 10. Architecture

### Preview Deploy (on PR open, synchronize, or reopen)

```
PR open/synchronize
  |
  +-> Create D1 database (pr-<number>)
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
  +-> Delete Worker -> Delete orphan preview Workers -> Delete Pages branch deployments -> Delete D1 database -> Update PR comment
```

### Dev Deploy (on push to `dev`)

```
push to dev
  |
  +-> CI -> Migration -> Worker deploy (sapphire2-api-dev) -> Pages deploy (dev)
```

### Production Deploy (on release PR merge or manual dispatch)

```
release PR merged into main
  |
  +-> release.yml: create tag + GitHub Release
        |
        +-> Dispatch production-deploy.yml at the tag
              |
              +-> CI (type check, lint, test)
                    |
                    +-> Migration -> Worker deploy -> Pages deploy
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
                                  │   D1          │
                                  │   (SQLite)    │
                                  └───────────────┘
```
