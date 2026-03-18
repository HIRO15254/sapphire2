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
| **Preview** | PR opened | Isolated Worker + Pages + D1 database per PR |
| **Production** | master push | Deploy Worker + Pages after CI passes |

## 2. Prerequisites

- [Cloudflare](https://dash.cloudflare.com/sign-up) account (Free plan OK)
- GitHub repository admin access (required for Secrets configuration)
- [Bun](https://bun.sh/) installed locally

> D1 databases are created automatically by Wrangler — no separate database account is needed.

## 3. Local Development

### 3.1 Configure Environment Variables

Copy `apps/server/.dev.vars.example` to create `.dev.vars`.

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

Edit `.dev.vars`:

```
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

### 3.2 Run Migrations

```bash
bun run db:migrate:local
```

### 3.3 Start Development Server

```bash
bun run dev
```

- API: `http://localhost:8787` (`wrangler dev`)
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
npx wrangler pages project create sapphire2-web
```

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

## 6. GitHub App Setup (for Bot-authored PRs)

The speckit workflow agents (spec-writer, plan-writer, implementer) create PRs via a GitHub App so that the PR author is a bot, allowing the developer to self-review.

### 6.1 Create GitHub App

1. GitHub > **Settings** > **Developer settings** > **GitHub Apps** > **New GitHub App**
2. Configure:
   - **Name**: `sapphire2-bot` (or any name)
   - **Homepage URL**: Your repository URL
   - **Webhook**: Uncheck **Active** (not needed)
   - **Permissions**:
     - Repository > **Contents**: Read & write
     - Repository > **Pull requests**: Read & write
     - Repository > **Issues**: Read & write
   - **Where can this GitHub App be installed?**: Only on this account
3. After creation, note the **App ID**
4. Generate and download a **Private key**

### 6.2 Install the App

GitHub App settings > **Install App** > Select the repository

## 7. GitHub Secrets Configuration

### Repository Variables

Add via **Settings > Secrets and variables > Actions > Variables tab > New repository variable**.

| Variable Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Workers & Pages overview page |
| `BOT_APP_ID` | GitHub App | App ID from the GitHub App settings page |

### Repository Secrets

Add via **Settings > Secrets and variables > Actions > Secrets tab > New repository secret**.

#### Shared

| Secret Name | Source | Description |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare | Token with Workers/Pages/D1 edit permissions |
| `BETTER_AUTH_SECRET` | Self-generated | `openssl rand -base64 32` (32+ characters) |
| `BOT_PRIVATE_KEY` | GitHub App | Private key (PEM format) downloaded from App settings |

#### OAuth (Google/Discord)

| Secret Name | Source | Description |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | OAuth 2.0 Client Secret |
| `DISCORD_CLIENT_ID` | Discord Developer Portal | OAuth2 Application Client ID |
| `DISCORD_CLIENT_SECRET` | Discord Developer Portal | OAuth2 Application Client Secret |

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

## 8. Customization

### Changing the Worker Name

If you change `name` in `apps/server/wrangler.toml`, also update:

- `WORKER_NAME` variable in `.github/workflows/preview-deploy.yml`
- `--name` argument in `.github/workflows/preview-cleanup.yml`

### Changing the Pages Project Name

Update the `PAGES_PROJECT` variable in `preview-deploy.yml`.

### Production Deployment

Automated via `.github/workflows/production-deploy.yml`. On master push: CI → migration → Worker deploy → Pages deploy.

Uses `concurrency` for sequential execution. Deployment is skipped if CI fails.

## 9. Verification

### Preview

1. Create a test branch and open a PR
2. Check "Preview Deploy" in the Actions tab
3. Preview URLs will be posted as a PR comment
4. Auto-cleanup on PR close

### Production

1. Push to master (or merge a PR)
2. Check "Production Deploy" in the Actions tab
3. Access the Worker URL and Pages URL

## 10. Troubleshooting

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

### Worker Deployment Failure

```
Error: compatibility_date is too old
```

Update `compatibility_date` in `apps/server/wrangler.toml`.

### Pages Deployment Failure

```
Error: A project with this name does not exist
```

Create the project first: `npx wrangler pages project create sapphire2-web`

## 11. Architecture

### Preview Deploy (on PR open)

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
  +-> Delete Worker -> Delete D1 database -> Update PR comment
```

### Production Deploy (on master push)

```
push to master
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
