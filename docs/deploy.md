# Deployment Guide

> **[日本語版はこちら](deploy.ja.md)**

## 1. Overview

This repository is built on Cloudflare Workers + D1 architecture.

- **API Server**: Cloudflare Workers (Hono)
- **Frontend**: Cloudflare Pages (Vite SPA)
- **Database**: Cloudflare D1 (SQLite via Drizzle ORM)

The Worker also serves the MCP endpoint (`/mcp`) and its OAuth discovery routes (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`). These need **no additional env vars or secrets** — the OAuth provider derives its URLs from `BETTER_AUTH_URL` and `CORS_ORIGIN`. See [mcp.md](mcp.md).

### Deployment Environments

| Environment | Trigger | Description |
|-------------|---------|-------------|
| **Local** | `bun run dev` | `wrangler dev` (local Workers simulation) |
| **Preview** | PR opened, synchronized, or reopened | Isolated Worker and D1 per PR; PR branch deployment in the shared Pages project |
| **Dev** | Push to `dev` or workflow dispatch | Stable Worker and Pages URLs; D1 is recreated and seeded on each deploy |
| **Production** | GitHub Release published or workflow dispatch | Deploy Worker + Pages after CI passes |

## 2. Prerequisites

- [Cloudflare](https://dash.cloudflare.com/sign-up) account with Workers Paid. D1's input limit is derived from the 1,000 queries per Worker invocation available on Paid.
- GitHub repository admin access (required for Secrets configuration)
- [Bun](https://bun.sh/) installed locally
- [Node.js](https://nodejs.org/) 22.22.2 or later on the 22 line, or 24.15.0 or later, installed locally (required to run the Cloudflare Wrangler CLI, Vitest and Ultracite; Bun remains the package manager)

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
OPENAI_API_KEY=your-openai-api-key
BETTER_AUTH_SECRET=your-secret-at-least-32-characters-long
BETTER_AUTH_URL=http://localhost:8787
CORS_ORIGIN=http://localhost:3001
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
```

`OPENAI_API_KEY` and `GOOGLE_MAPS_API_KEY` are optional unless AI extraction or Google Places search is used.

`apps/web/.env` configures the Vite client. Its default `VITE_SERVER_URL` points to the local API at `http://localhost:8787`.

`BETTER_AUTH_URL` and `CORS_ORIGIN` must be HTTP(S) origins without credentials, a path, query, or fragment. A trailing slash is accepted and normalized.

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
| `OPENAI_API_KEY` | OpenAI | Enables AI-assisted extraction |
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

### Release Automation (optional)

| Secret Name | Source | Description |
|---|---|---|
| `LINEAR_API_KEY` | Linear personal API key | Lets `release.yml` move the release's issues from Done to Released. Needs write access to the Sapphire2 team's issues. Without it the release still ships and the issues stay in Done |

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

`release.yml` publishes the tag and GitHub Release, then explicitly dispatches `production-deploy.yml` at that tag because releases created by the default `GITHUB_TOKEN` do not recursively start another workflow. `production-deploy.yml` also supports external `release: published` events and manual `workflow_dispatch` redeploys. The pipeline is CI → migration → [data audit](design/data-audits.md) → Worker deploy → Pages deploy. The audit runs `bun scripts/audit-data-model.ts --remote --database sapphire2-db` and can be rerun manually; its failure blocks both deployments.

`release.yml` then moves the release's Linear issues from Done to Released with [`scripts/release-linear-issues.ts`](../scripts/release-linear-issues.ts). The release's PRs are the merged PRs whose merge commit lies between the previous tag and the release merge, and the issues are the ones Linear linked to those PRs. Only issues in Done move. The step may fail without holding back the release.

Uses `concurrency` for sequential execution. The CI job calls the same reusable [`checks.yml`](../.github/workflows/checks.yml) as pull-request CI, so dev and production deploys pass the identical gate; deployment is skipped if it fails.

### Preview and dev database seeding

Dev recreates its D1 database on every deployment; preview reuses its database after the first deployment. A new database is migrated to the production database's latest applied migration, seeded from a data-only production export, then migrated through the remaining files. The dump omits `d1_migrations` rows. Existing preview databases receive migrations without being reseeded. Dev then runs `bun scripts/audit-data-model.ts --remote --database sapphire2-db-dev --config apps/server/wrangler.toml`; a failed query or violation fails the job and blocks Worker deployment. The audit reports statuses and row counts without patching data; see the [catalogue](design/data-audits.md) for local and remote usage.

During import, triggers read from `sqlite_master` are dropped so the dump's derived rows are not duplicated. An exit trap re-arms them even after a failed import; re-arm failure also fails the job. The re-arm file prefixes CREATE statements with DROP statements because SQLite does not retain `IF NOT EXISTS` in stored trigger definitions. Foreign keys are disabled for the dump, then enabled through a separate import and checked before remaining migrations run.

Preview resolves database names exactly; duplicate-name error 7502 is treated as an existing database, while another creation response without an ID is re-resolved and treated as new. The web build passes `GITHUB_TOKEN` to the releases plugin to avoid unauthenticated API rate limits.

Release notes use the Claude action's structured output and reject an empty or invalid `release_notes` field before publishing. The dispatch uses `actions: write` and the release tag, so production checks out the released tree.

Before a release that requires restore-based migration recovery, freeze data entry, retain the previous deployable tag, and record a D1 Time Travel bookmark immediately before migration: `bunx wrangler d1 time-travel info sapphire2-db -c apps/server/wrangler.toml`. Do not allow writes during migration and deployment. If migration or the audit fails, do not patch forward or retry the partial chain: restore with `bunx wrangler d1 time-travel restore sapphire2-db --bookmark=<bookmark> -c apps/server/wrangler.toml`; if the Worker was replaced, redeploy the previous tag with `gh workflow run production-deploy.yml --ref <previous tag>`. Fix on `dev` and rehearse before retrying. Restoration loses writes after the bookmark. Verify the release before resuming data entry. Follow the [migration rules](../.claude/rules/db-migrations.md) for the applicable recovery policy.

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
  +-> CI -> Recreate D1 -> Base migrations -> Seed -> Remaining migrations -> Audit -> Worker deploy (sapphire2-api-dev) -> Pages deploy (dev)
```

### Production Deploy (on release PR merge or manual dispatch)

```
release PR merged into main
  |
  +-> release.yml: create tag + GitHub Release
        |
        +-> Dispatch production-deploy.yml at the tag
        |     |
        |     +-> CI (type check, lint, test)
        |           |
        |           +-> Migration -> Audit -> Worker deploy -> Pages deploy
        |
        +-> Move the release's Linear issues from Done to Released
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
