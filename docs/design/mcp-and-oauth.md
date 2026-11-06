# MCP Server & OAuth Consent Gate

Design record for the MCP server at `/mcp` and the OAuth 2.1 provider that guards it: the consent-gate threat model, the consent page, token-to-session translation, transport and discovery, and the Workers-specific implementation constraints. The day-to-day imperatives for the tool layer live in [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) and the authorization rules in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md); the user-facing connection guide is [`docs/mcp.md`](../mcp.md). This document holds the threat model and the mechanics behind those rules.

## Threat model: an open-registration OAuth provider

The `/mcp` endpoint is an OAuth-protected resource backed by better-auth's `mcp()` plugin, enabled through the optional `mcp` option of `createAuth` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) (dynamic client registration at `/api/auth/mcp/register`, authorize/token endpoints, `.well-known` metadata; the option is optional so callers without an MCP surface — tests — can omit it). Dynamic client registration (DCR) is open to anyone, which is standard MCP posture: clients cannot pre-share secrets. That posture makes every registered client untrusted by default, and two better-auth behaviors combine into the central hole:

1. The plugin's authorize endpoint does not always require consent unless `prompt=consent` is supplied. Open registration makes relying on the client to supply it unsafe.
2. Forcing the prompt also requires `oidcConfig.consentPage`; the `mcp` option requires this URL and [`buildAuthOptions`](../../apps/server/src/auth-options.ts) supplies it.

The Worker forces the prompt, and provisioning supplies the consent page (see [Provisioning](#provisioning-and-persistence)).

## The consent gate

[`apps/server/src/oauth-consent.ts`](../../apps/server/src/oauth-consent.ts) plus a middleware in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) rewrite **every** authorize request to `prompt=consent` before better-auth sees it (`forceConsentPrompt` overwrites any client-supplied value).

The matching is deliberately **default-deny**:

- `isAuthorizePath` matches by **path suffix** (`…/authorize`, trailing slashes stripped) rather than by exact route, and the middleware is registered with `app.use` (not `app.on([...])`), so it applies to **every method**. Today only `GET /api/auth/mcp/authorize` exists (POST and `/api/auth/oauth2/authorize` both 404), but a better-auth upgrade must not be able to add a route that bypasses the gate — a second authorize route, or POST support on the existing one, cannot silently open a path around it. Adding a method to the better-auth catch-all route below the gate can never leave the gate behind, because the gate is method-independent by construction.

The regression tests for this wiring assert the URL actually handed to better-auth (not status codes) and pin the better-auth 1.6.0 authorize route surface — see [`testing-and-tooling.md`](testing-and-tooling.md).

## Dynamic client registration

The plugin stores `client_name` in the non-null `oauth_application.name` column, although RFC 7591 permits clients to omit it. [`withClientName`](../../apps/server/src/oauth-register.ts) fills an absent or null name with the empty string before forwarding registration. The consent page displays a blank name as "Unknown application"; inventing a label would imply trust in an unverified client.

- **Suffix match (`…/register`), POST only** — like the authorize gate, so `/api/auth/oauth2/register` carries the same NOT NULL hazard and is covered by the same rewrite.
- **Only a missing value is filled in.** A `client_name` of the wrong type is forwarded untouched so better-auth's own validation still answers `400`, and a body that is not a JSON object is forwarded unchanged.
- **The rewritten request drops `content-length`** — the new body is longer than the one the client sent, and a stale length truncates it.

The column stays `NOT NULL`: the OIDC tables mirror the plugin's schema definition (see [Provisioning](#provisioning-and-persistence)), so the fix belongs in the Worker, not in a migration that diverges from the plugin's contract.

## The consent page

better-auth redirects mid-authorize to `GET /oauth/consent`, rendered by the Worker via [`packages/mcp/src/auth/consent-html.ts`](../../packages/mcp/src/auth/consent-html.ts).

### Look

The page follows the Cryst login layout (440px column, brand, title, inset list, xl buttons, destructive Alert for a failed decision). The Worker cannot load the web bundle's CSS, so `STYLES` carries a **copy of the Cryst token values** from [`apps/web/src/index.css`](../../apps/web/src/index.css): a change to a token used there must update `STYLES` in the same change. The deviations are recorded in [`cryst-exceptions.md`](cryst-exceptions.md).

### What it shows, and why

- **Real capability, not scopes.** `buildMcpSession` ignores the token's OAuth scopes, so every issued token grants the whole tool surface; the page renders `toolPermissionSummary()` derived from `TOOL_DEFINITIONS` instead of listing scopes ([`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 8). Two details beyond the rule:
  - `parseConsentPageQuery` deliberately does **not read the `scope` query parameter** better-auth appends when redirecting. Scopes are not used for authorization, so parsing them at all would only invite showing them again.
  - Destructive tools are tracked **separately** from plain writes in `toolPermissionSummary` ([`packages/mcp/src/tools/registry.ts`](../../packages/mcp/src/tools/registry.ts)): overwriting or removing existing data is a materially bigger ask than appending to it, and the two sets drift apart as tools are added — an understated summary under-represents the grant.
- **Redirect hosts are the only trustworthy signal.** A DCR-registered client can name itself anything, so the page shows where the authorization code will be delivered. `redirectHostsFrom` parses the DCR row's comma-joined `redirect_urls`; unparseable entries are **dropped rather than shown** — the value is attacker-controlled, and the consent page must not render free text supplied by a registered client. Opaque URIs (`urn:`, `mailto:`) parse but have no host, so they are treated as unknown: the page shows its "no recognizable destination" warning instead of an empty destination.
- **Cosmetic vs. authorizing values.** The client name and redirect hosts come from the DCR row; a DB lookup failure falls back to placeholders. Both are cosmetic — the signed `consent_code` embedded in the page is what authorizes.

### Hostile-input posture

Because DCR is open, every client-supplied value is hostile input: the name and redirect hosts are HTML-escaped, and **nothing else the client registered** (icon, metadata) is rendered at all. The consent code is embedded as JSON with `<` escaped (`scriptSafeJson`) so a crafted code can never terminate the script element.

### Response hardening

`GET /oauth/consent` sets three headers, all load-bearing:

| Header | Why |
|---|---|
| `Cache-Control: no-store` | The page embeds a `consent_code` that can be exchanged for an authorization code; prevent caches from storing it. |
| `X-Frame-Options: DENY` | Approving issues that code, so no other origin may frame this page: with DCR open to anyone, a framed consent screen is a one-click account grant (the destination warning is unreadable through an iframe). |
| `Content-Security-Policy: frame-ancestors 'none'; script-src 'nonce-…'` | Prevent framing and permit the executable consent script only with the response's random nonce. |

The consent script parses the returned redirect URI before navigating and rejects `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` and `about:` URLs. It also rejects HTTP destinations other than `localhost`, `127.0.0.1` and `::1`. The registration gate independently rejects those schemes, non-loopback HTTP, unparseable strings and raw commas; HTTPS, loopback HTTP and private custom schemes are allowed by this gate.

## CSRF, PKCE, and the resource identifier

The consent page is rendered on the server origin and posts to `/api/auth/oauth2/consent`. When MCP and `baseURL` are configured, `createAuth` adds the server origin to `trustedOrigins` alongside `corsOrigin`, allowing better-auth's origin check to accept that POST.

- `requirePKCE: true` and `allowPlainCodeChallengeMethod: false` require PKCE with S256 rather than a plain challenge.
- `resource` — the RFC 8707 resource identifier, the absolute `/mcp` endpoint URL.

## Token to session

`app.all("/mcp")` in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) is the authentication gate. It calls the mcp plugin's `getMcpSession` (bearer-token lookup) directly, loads the user row (the one DB lookup, kept in `apps/server` so `packages/mcp` stays db-free — [`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2), and hands both to `buildMcpSession`.

- **Single translation point.** [`buildMcpSession`](../../packages/mcp/src/auth/mcp-session.ts) is the **only** place an MCP identity becomes a tRPC session — procedures then run their `protectedProcedure`/ownership checks against `session.user.id` exactly as they do for cookie-authenticated requests. It returns `null` (the caller must answer 401) when the token is userless, the user row is gone, or the two disagree.
- **Token expiry is enforced here, not by better-auth.** better-auth's `getMcpSession` looks tokens up by value and does not check expiry. `buildMcpSession` accepts only a valid expiry strictly after the current time; expired and invalid dates both fail closed.
- **Synthetic session record.** MCP requests have no better-auth session row, so the session is synthesized (`id: "mcp-<userId>"`, `token: ""`). The empty token cannot collide with — or be replayed as — a real session token.
- **The identity travels in a closure, not through the SDK's authInfo channel.** `createSapphireMcpHandler` ([`packages/mcp/src/worker.ts`](../../packages/mcp/src/worker.ts)) exposes authentication as something that happens entirely **outside** the handler: `apps/server` builds the authenticated tRPC caller itself, passes `buildCaller: () => caller`, and calls `handler.fetch(request)` **without** an `authInfo` argument. `buildCaller`'s `authInfo` parameter is therefore effectively unused in this deployment — the verified identity is captured in the per-request factory closure, and nothing downstream should assume `ctx.authInfo` is populated.

## Transport and discovery

- **Two CORS surfaces.** `isMcpClientPath` splits the Worker's routes: `/mcp`, `/.well-known/*`, and `/api/auth/mcp/*` are served to arbitrary MCP clients (any origin, bearer auth, `credentials: false`, MCP session/protocol headers exposed) — as opposed to the credentialed, `CORS_ORIGIN`-pinned web-app surface everything else uses.
- **RFC 9728 challenge.** Missing/invalid bearer tokens on `/mcp` get a 401 with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"` so clients can bootstrap discovery from the failure itself.
- **`/mcp` never answers with a non-JSON-RPC body.** Both the 401 challenge and the 500 path are JSON-RPC error envelopes; the route-level catch exists because a token lookup failure, user-load failure, or malformed token shape must still answer in the envelope the client is parsing, not Hono's plain 500.
- **Discovery lives at the ROOT `.well-known` paths** (RFC 8414 / RFC 9728) — the better-auth copies under `/api/auth/.well-known/*` are not where clients look, so the Worker serves `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` itself (delegating to the plugin's config builders). The path-suffixed variant `/.well-known/oauth-protected-resource/mcp` covers clients that append the resource path per RFC 9728 §3.1.

## Workers runtime constraints

> **Keep the explicit `jsonSchemaValidator: new CfWorkerJsonSchemaValidator()` argument** in [`packages/mcp/src/server.ts`](../../packages/mcp/src/server.ts). The runtime-selected default would pull in Ajv — `new Function` codegen, which is **illegal on Cloudflare Workers** — whenever the bundler resolves the Node shim. Vitest runs the `mcp` project in Node, where Ajv's codegen works, so **no test can catch removal**; only production Workers break.

> **The bare `preloadSchemas()` call at module scope of [`packages/mcp/src/worker.ts`](../../packages/mcp/src/worker.ts) is not dead code.** Isolate runtimes (Workers) must pay the MCP protocol-schema build cost once at module scope, not per request. The workerd shim already does this; the explicit call keeps the guarantee when the bundler resolves the Node shim. The regression from deleting it is per-request latency on Workers — invisible to tests.

- `responseMode: "json"`: no mid-call notifications are emitted, so plain JSON responses beat an SSE stream (and its keep-alive timer) inside a Worker.

## Error mapping

[`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 4 owns the imperative (every thrown error goes through `mapToolError`; `FORBIDDEN`/`NOT_FOUND` map to fixed, id-free texts so the MCP layer cannot rebuild the existence oracle that [`api-security.md`](../../.claude/rules/api-security.md) closed). The design behind it, in [`packages/mcp/src/lib/errors.ts`](../../packages/mcp/src/lib/errors.ts):

- **In-band recovery.** Domain errors stay in-band (`isError` tool results) so the calling model can read and recover from them; anything unexpected is logged and reduced to a generic text that leaks no D1/SQL strings, stack traces, ids or keys.
- **Duck typing instead of `instanceof` — deliberately.** `instanceof TRPCError` silently returns `false` if `packages/mcp` and `packages/api` ever resolve separate `@trpc/server` instances, which would collapse every domain error (`FORBIDDEN`, `BAD_REQUEST`, …) into the generic internal text and hide Zod feedback from the model. Requiring `name === "TRPCError"` plus a string `code` keeps unrelated errors that merely carry a `code` (D1, runtime) out of the branch. The same reasoning applies to ZodError detection: tRPC stores the Zod failure on `cause`, and `instanceof ZodError` would break across duplicated `zod` module instances.

## Type-level seams

- **Plugin type erasure, single cast point.** The `mcp()` plugin's inferred type references better-auth internals that cannot be named in the package's emitted declarations (TS4058), so `createAuth` widens `plugins` to the base `BetterAuthPlugin[]`. The endpoints exist at runtime regardless; `McpPluginApi` in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) is the **single** cast point for the ones the Worker needs (`getMCPProtectedResource`, `getMcpOAuthConfig`, `getMcpSession`) — do not scatter further casts.
- **One reach into tRPC internals.** `procedureMap()` in [`packages/mcp/src/tools/resolve.ts`](../../packages/mcp/src/tools/resolve.ts) is the single place the MCP layer touches tRPC internals: tRPC v11 routers expose a flat `_def.procedures` record keyed by dot-path (`"room.list"`), which the api package's test-utils also rely on. A tRPC upgrade that changes this shape breaks both packages — check here first.

## Provisioning and persistence

- **One options object, no new secrets.** [`buildAuthOptions`](../../apps/server/src/auth-options.ts) is the single source of the `createAuth` options object — every route that instantiates better-auth must use it instead of repeating the literal. The MCP OAuth provider (login page `${CORS_ORIGIN}/login`, consent page `${BETTER_AUTH_URL}/oauth/consent`, RFC 8707 resource `${BETTER_AUTH_URL}/mcp`) is derived entirely from existing env vars, so `/mcp` needs no new secrets.
- [`serverEnvSchema`](../../packages/env/src/server.ts) requires `CORS_ORIGIN` and `BETTER_AUTH_URL` to be HTTP(S) origins without credentials, non-root paths, queries or fragments. A trailing slash is accepted; auth options, web CORS and the MCP challenge use the normalized URL origin.
- **OIDC provider tables mirror the plugin.** [`packages/db/src/schema/oauth.ts`](../../packages/db/src/schema/oauth.ts) (migration 0050) holds the tables consumed by better-auth's `mcp()` plugin: dynamically registered clients (`oauth_application`), issued tokens (`oauth_access_token`) and recorded consents (`oauth_consent`). The field set mirrors the plugin's schema definition **exactly** — better-auth reads/writes these through its drizzle adapter, so the columns are the plugin's contract, not ours to reshape.
- **Constant-time password comparison.** `constantTimeEqual` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) compares password-derived bytes without leaking the first mismatched byte (XOR folds the length mismatch, XOR/OR accumulates every byte mismatch in constant work) — the PBKDF2 verify path must keep using it rather than `===` on hex strings.
- **Account linking.** Linking is enabled without trusted providers or disabled implicit linking. Social sign-in joins an existing same-email user only when the provider reports the email verified (Google `email_verified`, Discord `verified`); otherwise sign-in returns `account not linked`. Explicit linking from Settings also requires the same email and refuses an unverified provider email with `unable_to_link_account`; the web shows "Verify the email address on your {Provider} account, then try again." Verified-email implicit linking remains exposed to pre-account hijacking, tracked in Linear SA2-431.

## Web login continuation

When the authorize endpoint sees an unauthenticated user, better-auth redirects to the web app's `/login` carrying the original authorize query; after sign-in the client sends the browser back to the **server's** authorize endpoint. The client-side helper that does this (`apps/web/src/features/auth/utils/oauth-redirect.ts`) keeps open-redirect vectors closed by fixing the destination and forwarding only allowlisted OAuth parameters — that invariant is documented in [`web-platform.md`](web-platform.md).

[`pendingAuthorizeUrl()` and `socialCallbackUrl()`](../../apps/web/src/features/auth/utils/login-continuation.ts) wrap that helper for code reading the browser location. Email and passkey sign-in resume authorization through `pendingAuthorizeUrl`; sign-up does likewise, and social sign-in and sign-up use `socialCallbackUrl` to return to login with the query. Preview auto-login also resumes authorization and claims each authorize URL once in `sessionStorage` to bound redirect loops; storage failures cannot provide that bound.

The `/login` route's `beforeLoad` ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx)) handles an already-signed-in visitor using the router's parsed search record. [`scripts/check-rules.ts`](../../scripts/check-rules.ts) checks that non-test web files using `authClient.signIn` or `authClient.signUp` import `login-continuation`; reviewers must still check each branch actually resumes correctly.

### One continuation mechanism

[`withoutLoginPromptCookie`](../../apps/server/src/oauth-consent.ts) strips the literal `oidc_login_prompt` cookie from requests forwarded to `auth.handler`. This prevents the provider's login after-hook from replacing an XHR sign-in response with a redirect to HTML; the allowlisted web redirect handles continuation for both password and social sign-in. Cookie behavior differs across same-site and cross-site deployments, so the stripping applies regardless of deployment layout.

The direct `auth.api.setPassword` route does not pass through this wrapper. It requires an `Origin` matching the web origin and an `application/json` content type before invoking the API. It does not issue a session token, which the provider's continuation hook requires.

On a better-auth upgrade, re-check both continuation assumptions:

- The plugins use the literal cookie name `oidc_login_prompt`, without a `__Secure-` prefix, including on HTTPS. Neither local HTTP development nor the cross-site preview exercises HTTPS same-site cookie behavior.
- `/api/auth/set-password` calls `auth.api.setPassword` directly and bypasses `withoutLoginPromptCookie`. The continuation after-hook requires a response setting a session token, which set-password does not issue; if that changes, this route needs equivalent stripping.
