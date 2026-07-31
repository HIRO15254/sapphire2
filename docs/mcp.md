# MCP Server

> **[日本語版はこちら](mcp.ja.md)**

sapphire2 exposes a remote [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server so AI agents — claude.ai connectors, Claude Desktop, Claude Code, or any MCP-capable client — can read and record your poker session data.

- **Endpoint**: `https://<your-api-host>/mcp` (Streamable HTTP)
- **Auth**: OAuth 2.1 with dynamic client registration (RFC 7591), PKCE required
- **Implementation**: `packages/mcp`, mounted by the Worker in `apps/server`

## Connecting

### claude.ai / Claude Desktop

Add a custom connector and paste the endpoint URL:

```
https://<your-api-host>/mcp
```

The client discovers the OAuth endpoints via `/.well-known/oauth-protected-resource`, registers itself, and opens the login/consent flow in your browser. Sign in with your sapphire2 account, press **Approve**, and the connector is live.

### Claude Code

```sh
claude mcp add --transport http sapphire2 https://<your-api-host>/mcp
```

Claude Code runs the same OAuth flow on first use (`/mcp` → authenticate).

## OAuth flow

1. Client `POST /api/auth/mcp/register` (dynamic client registration — no pre-shared secrets).
2. Client opens `GET /api/auth/mcp/authorize?...` in the browser.
3. Not signed in? better-auth stores the request and redirects to the web app's `/login`; after sign-in the app returns the browser to the authorize endpoint.
4. The Worker renders the consent page (app name + scopes). **Approve** posts to `/api/auth/oauth2/consent` and redirects back to the client with an authorization code.
5. Client exchanges the code at `POST /api/auth/mcp/token` (PKCE-verified) and calls `/mcp` with `Authorization: Bearer <access_token>`.

Discovery documents are served at the root, per RFC 8414 / RFC 9728:

- `GET /.well-known/oauth-authorization-server`
- `GET /.well-known/oauth-protected-resource` (also at `/.well-known/oauth-protected-resource/mcp`)

Unauthenticated `/mcp` requests receive `401` with `WWW-Authenticate: Bearer resource_metadata="…"` so clients can bootstrap discovery.

## Tools

The tool surface is a **projection of the tRPC `appRouter`**: each tool's input schema is the exact Zod schema the API validates with, and each response is the same JSON the HTTP API returns. Conventions follow the backend: **dates are unix seconds** (date-only values are UTC midnight), **amounts are plain integers** in the currency's display unit.

| Tool | tRPC procedure | Kind |
|---|---|---|
| `session_list` | `session.list` | read |
| `session_get_by_id` | `session.getById` | read |
| `session_create_cash_game` | `session.create` (cash branch) | write |
| `session_create_tournament` | `session.create` (tournament branch) | write |
| `session_update` | `session.update` | write |
| `stats_summary` | `stats.summary` | read |
| `stats_breakdown` | `stats.breakdown` | read |
| `stats_profit_loss_series` | `stats.profitLossSeries` | read |
| `room_list` | `room.list` | read |
| `currency_list` | `currency.list` | read |
| `player_list` | `player.list` | read |
| `session_tag_list` | `sessionTag.list` | read |
| `session_tag_create` | `sessionTag.create` | write |
| `ring_game_list_by_room` | `ringGame.listByRoom` | read |
| `tournament_list_by_room` | `tournament.listByRoom` | read |

Procedures not listed are deliberately excluded (live-session state machinery, destructive deletes, master-data CRUD, AI extraction, …) — the reasons live in `packages/mcp/src/tools/registry.ts` and are enforced by the coupling test.

Authorization is the API's own: every call goes through `appRouter.createCaller` with your user session, so `protectedProcedure` and all ownership checks apply exactly as they do for the web app.

## Operational notes

- **Consent is always enforced.** The Worker rewrites every authorize request to `prompt=consent` before better-auth sees it — without this, better-auth's mcp plugin issues codes to any dynamically-registered client with zero user interaction.
- `/mcp` requires **no new environment variables or Worker secrets** — the OAuth provider derives its URLs from `BETTER_AUTH_URL` and `CORS_ORIGIN`.
- The OIDC tables (`oauth_application`, `oauth_access_token`, `oauth_consent`) ship in migration `0049`.
- Access tokens expire after 1 hour; refresh tokens after 7 days (better-auth defaults). Clients refresh automatically.
