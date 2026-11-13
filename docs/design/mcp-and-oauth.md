# MCP Server & OAuth Consent Gate

Design record for the MCP server at `/mcp` and the OAuth 2.1 provider that guards it: the consent-gate threat model, the consent page, token-to-session translation, transport and discovery, and the Workers-specific implementation constraints. The day-to-day imperatives for the tool layer live in [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) and the authorization rules in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md); the user-facing connection guide is [`docs/mcp.md`](../mcp.md). This document holds the threat model and the mechanics behind those rules.

## Threat model: an open-registration OAuth provider

The `/mcp` endpoint is an OAuth-protected resource backed by the `mcp()` plugin of `@better-auth/mcp` (the OAuth 2.1 provider of `@better-auth/oauth-provider` configured for MCP), enabled through the optional `mcp` option of `createAuth` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts). Its endpoints live under `/api/auth/oauth2/*` (`register`, `authorize`, `consent`, `token`, `revoke`, `introspect`, `userinfo`); the option is optional so callers without an MCP surface — tests — can omit it. Dynamic client registration (DCR) is open to anyone (`allowDynamicClientRegistration` plus `allowUnauthenticatedClientRegistration`), which is standard MCP posture: clients cannot pre-share secrets. That posture makes every registered client untrusted by default, and two provider behaviors combine into the central hole:

1. The authorize endpoint skips the consent page once a consent row covers the requested scopes, unless `prompt=consent` is supplied. Open registration makes relying on the client to supply it unsafe.
2. Forcing the prompt also requires a `consentPage`; the `mcp` option requires this URL and [`buildAuthOptions`](../../apps/server/src/auth-options.ts) supplies it.

The Worker forces the prompt, and provisioning supplies the consent page (see [Provisioning](#provisioning-and-persistence)).

## The consent gate

[`apps/server/src/oauth-consent.ts`](../../apps/server/src/oauth-consent.ts) plus a middleware in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) rewrite **every** authorize request to `prompt=consent` before better-auth sees it (`forceConsentPrompt` overwrites any client-supplied value).

The matching is deliberately **default-deny**:

- `isAuthorizePath` matches by **path suffix** (`…/authorize`, trailing slashes stripped) rather than by exact route, and the middleware is registered with `app.use` (not `app.on([...])`), so it applies to **every method**. Today the provider serves `GET` and `POST /api/auth/oauth2/authorize`, and a better-auth upgrade must not be able to add a route that bypasses the gate — a second authorize route cannot silently open a path around it. Adding a method to the better-auth catch-all route below the gate can never leave the gate behind, because the gate is method-independent by construction.

The regression tests for this wiring assert the URL actually handed to better-auth (not status codes) — see [`testing-and-tooling.md`](testing-and-tooling.md).

## Dynamic client registration

The provider validates the registered metadata itself; the Worker only enforces size limits in front of it. `clientRegistrationDefaultApplicationType: "infer"` classifies a registration that omits `application_type` as `native` when any redirect URI is loopback HTTP or a custom scheme, and as `web` otherwise; each URI is then checked against that type's rules. The result: HTTPS on non-loopback hosts, HTTP only on the exact hosts `localhost`, `127.0.0.1` and `[::1]`, and host-bearing or reverse-domain private-use schemes (`cursor://…`). `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `about:`, unparseable strings and fragments are rejected with `400 invalid_redirect_uri`, and redirect URIs are stored as a JSON array, so a comma inside a URI cannot split it. `client_name` is optional; the consent page displays a missing name as "Unknown application" — inventing a label would imply trust in an unverified client. The [MCP OAuth integration tests](../../packages/api/src/__integration__/mcp-oauth.test.ts) pin the rejected shapes against the real provider.

### Registration limits

Registration is unauthenticated, so every row it writes is attacker-paced. Three limits bound it (SA2-440):

- **Body: 16 KB.** Hono's `bodyLimit` in front of `POST …/oauth2/register` answers `413 invalid_client_metadata` above 16384 bytes — by `Content-Length` when present, otherwise while streaming the body — before the provider parses anything. The path matches by suffix with trailing slashes stripped (`isRegistrationRequest` in [`apps/server/src/oauth-registration.ts`](../../apps/server/src/oauth-registration.ts)), like the authorize gate.
- **`redirect_uris`: 10.** The same Worker middleware reads the bounded body and answers `400 invalid_redirect_uri` when `redirect_uris` is an array of more than 10 entries; any other shape (malformed JSON included) is forwarded so the provider rejects it with its own error. The middleware then hands better-auth a rebuilt request carrying the already-read body.
- **Rate: 20 per connecting IP per hour.** The provider's own `rateLimit.register` rule (default five per minute) is set to `{ window: 3600, max: 20 }` in `createAuth`. It shares better-auth's limiter: keyed by `CF-Connecting-IP` (see [Browser sessions](#browser-sessions-rate-limiting-and-trpc-origin)), counted in isolate memory, enabled by the Worker's `NODE_ENV` binding, answering `429`. better-auth restarts the window from the last allowed request, so a client registering steadily stays capped at 20 until it pauses for an hour. Requests rejected by the two Worker limits never reach the limiter and are not counted.

The [registration-limit integration tests](../../packages/api/src/__integration__/mcp-registration-limits.test.ts) send each limit and one past it through the Worker.

## The consent page

The provider redirects mid-authorize to `GET /oauth/consent` with the authorize query plus `exp`, an issued-at parameter and an HMAC `sig`, rendered by the Worker via [`packages/mcp/src/auth/consent-html.ts`](../../packages/mcp/src/auth/consent-html.ts). The page posts `{ accept, oauth_query }` to `/api/auth/oauth2/consent`, where `oauth_query` is that signed query string; the provider verifies the signature and answers `{ redirect: true, url }`. A denial answers with the client's `redirect_uri` carrying `error=access_denied`, the client's `state` and `iss`, with its existing query kept.

### Look

The page follows the Cryst login layout (440px column, brand, title, inset list, xl buttons, destructive Alert for a failed decision). The Worker cannot load the web bundle's CSS, so `STYLES` carries a **copy of the Cryst token values** from [`apps/web/src/index.css`](../../apps/web/src/index.css): a change to a token used there must update `STYLES` in the same change. The deviations are recorded in [`cryst-exceptions.md`](cryst-exceptions.md).

### What it shows, and why

- **Real capability, not scopes.** `buildMcpSession` ignores the token's OAuth scopes, so every issued token grants the whole tool surface; the page renders `toolPermissionSummary()` derived from `TOOL_DEFINITIONS` instead of listing scopes ([`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 8). Two details beyond the rule:
  - `parseConsentPageQuery` deliberately does **not interpret the `scope` query parameter**: it reads `client_id` for the cosmetic lookup and passes the signed query through whole. Scopes are not used for authorization, so parsing them at all would only invite showing them again.
  - Destructive tools are tracked **separately** from plain writes in `toolPermissionSummary` ([`packages/mcp/src/tools/registry.ts`](../../packages/mcp/src/tools/registry.ts)): overwriting or removing existing data is a materially bigger ask than appending to it, and the two sets drift apart as tools are added — an understated summary under-represents the grant.
- **Redirect hosts are the only trustworthy signal.** A DCR-registered client can name itself anything, so the page shows where the authorization code will be delivered. `redirectHostsFrom` parses the DCR row's `redirect_uris` array; non-string or unparseable entries are **dropped rather than shown** — the value is attacker-controlled, and the consent page must not render free text supplied by a registered client. Opaque URIs (`urn:`, `mailto:`) parse but have no host, so they are treated as unknown: the page shows its "no recognizable destination" warning instead of an empty destination.
- **Cosmetic vs. authorizing values.** The client name and redirect hosts come from the DCR row; a DB lookup failure falls back to placeholders. Both are cosmetic — the signed query embedded in the page, together with the browser session, is what authorizes.

### Hostile-input posture

Because DCR is open, every client-supplied value is hostile input: the name and redirect hosts are HTML-escaped, and **nothing else the client registered** (icon, metadata) is rendered at all. The signed query is embedded as JSON with `<` escaped (`scriptSafeJson`) so a crafted value can never terminate the script element.

### Response hardening

`GET /oauth/consent` sets three headers, all load-bearing:

| Header | Why |
|---|---|
| `Cache-Control: no-store` | The page embeds the signed authorize query that, with the session, is exchanged for an authorization code; prevent caches from storing it. |
| `X-Frame-Options: DENY` | Approving issues that code, so no other origin may frame this page: with DCR open to anyone, a framed consent screen is a one-click account grant (the destination warning is unreadable through an iframe). |
| `Content-Security-Policy: frame-ancestors 'none'; script-src 'nonce-…'` | Prevent framing and permit the executable consent script only with the response's random nonce. |

The consent script parses the returned absolute redirect URL before navigating and rejects `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` and `about:` URLs. It also rejects HTTP destinations other than `localhost`, `127.0.0.1` and `::1`. Registration independently rejects those shapes (see [Dynamic client registration](#dynamic-client-registration)).

## CSRF, PKCE, and the resource identifier

The consent page is rendered on the server origin and posts to `/api/auth/oauth2/consent`. When MCP and `baseURL` are configured, `createAuth` adds the server origin to `trustedOrigins` alongside `corsOrigin`, allowing better-auth's origin check to accept that POST.

- PKCE is mandatory for public clients and the provider accepts only `S256`; a `plain` challenge is refused at authorize.
- Authorization codes are stored hashed in `verification` and consumed atomically: a second exchange of the same code fails with `invalid_grant` and revokes the tokens the first exchange issued. A wrong verifier also answers `400 invalid_grant`.
- `resource` — the RFC 8707 resource identifier, the absolute `/mcp` endpoint URL. `mcp()` registers it as an `oauth_resource` row on first use and links every dynamically registered client to it.

## Tokens

- **Opaque, hashed tokens; no JWT plugin.** `disableJwtPlugin: true` issues opaque access and refresh tokens stored SHA-256-hashed (`storeTokens: "hashed"`) instead of JWTs, so there is no signing key to provision or rotate on Workers, deleting a row revokes a token immediately, and a database read never yields a usable token. Public clients therefore receive no `id_token`; MCP clients do not use one.
- **Lifetimes.** Access tokens live one hour (provider default). Refresh tokens are issued only when the grant includes `offline_access` and live seven days (`refreshTokenExpiresIn`), the lifetime the earlier better-auth `mcp` plugin used, instead of the provider's 30-day default.
- **Strict rotation.** Every refresh rotates the refresh token. `refreshTokenReuseInterval: 0` overrides `mcp()`'s 30-second replay window: presenting an already-rotated refresh token fails with `invalid_grant` and invalidates that client's whole refresh family for the user, so a stolen token that races the legitimate client cuts both off.
- **Clients reconnect after the provider migration.** Migration 0083 replaced the earlier plugin's tables, whose tokens were stored in plaintext, instead of converting them: every MCP client had to authorize again once.

## Disconnecting a client

Settings lists the user's MCP clients and disconnects one on request, so a leaked token can be cut off without touching the database by hand. The procedures are `mcpConnection.list` and `mcpConnection.revoke` in [`packages/api/src/routers/mcp-connection.ts`](../../packages/api/src/routers/mcp-connection.ts); the screen is [`mcp-connections/`](../../apps/web/src/features/settings/pages/settings-page/mcp-connections/).

- **Our own procedures, not the provider's consent API.** `@better-auth/oauth-provider` serves `/oauth2/get-consents` and `/oauth2/delete-consent`, but deleting a consent leaves the client's access and refresh tokens working, and a consent row carries no client name. `revoke` deletes the user's `oauth_access_token`, `oauth_refresh_token` and `oauth_consent` rows for one `client_id` in a single `db.batch()`. Deleted rows fail immediately: the `/mcp` gate finds no token and the token endpoint answers `invalid_grant` to the refresh token. The `oauth_client` row stays, because DCR clients are shared registrations without an owner.
- **Who is connected.** A client is listed when the user has a consent row for it, an unrevoked unexpired access token, or an unrevoked unexpired refresh token. The consent alone counts because the consent page records it before any token exists; a live token without a consent (one deleted through the provider's own endpoint) still counts because it still works.
- **What it shows.** The client name from DCR (cosmetic and attacker-controlled; React escapes it), "Approved" — the latest consent time, `updated_at` falling back to `created_at` — and "Last active" — the newest access token's `created_at`. The provider records no per-request use, so "Last active" is when the client last obtained a token: an access token lives one hour, so a client in use refreshes at least hourly.
- **Scoped by user.** Every query and delete binds `user_id` to the session user; a `clientId` the user holds nothing for answers `FORBIDDEN`, the same as another user's.
- **Not an MCP tool.** Both procedures are in `DELIBERATELY_EXCLUDED`: one connected client must not enumerate or disconnect the user's other clients.
- **Limit.** An authorization code issued before the disconnect and not yet exchanged (codes live ten minutes and need the PKCE verifier) can still be exchanged afterwards; the client then reappears in the list.

## Token to session

`app.all("/mcp")` in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) is the authentication gate. It hashes the bearer token with the provider's own hasher ([`hashMcpAccessToken`](../../packages/auth/src/index.ts)), selects the `oauth_access_token` row that is unrevoked and whose `oauth_client` is not disabled, loads the user row (the DB lookups stay in `apps/server` so `packages/mcp` stays db-free — [`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2), and hands both to `buildMcpSession`.

- **MCP access outlives the browser session that approved it.** The provider binds each token to the approving browser session (`session_id`) and its own validator (`validateAccessToken`, `requireMcpAuth`) reports a token inactive once that session row has expired. Browser sessions last one day (see [Browser sessions](#browser-sessions-rate-limiting-and-trpc-origin)) and an expired row is only deleted when that browser presents it again, so going through the provider's validator would disconnect MCP clients a day after the user last opened the web app, even with a valid refresh token. The gate therefore checks the token's own expiry and revocation, not the session, and a refresh keeps working after the session expires; disconnecting a client is a token revocation, not a sign-out.
- **Single translation point.** [`buildMcpSession`](../../packages/mcp/src/auth/mcp-session.ts) is the **only** place an MCP identity becomes a tRPC session — procedures then run their `protectedProcedure`/ownership checks against `session.user.id` exactly as they do for cookie-authenticated requests. It returns `null` (the caller must answer 401) when the token is userless, the user row is gone, or the two disagree.
- **Token expiry is enforced here.** The gate's query matches by token hash only; `buildMcpSession` accepts only a valid expiry strictly after the current time, so expired, missing and invalid dates all fail closed.
- **Synthetic session record.** MCP requests have no better-auth session row, so the session is synthesized (`id: "mcp-<userId>"`, `token: ""`). The empty token cannot collide with — or be replayed as — a real session token.
- **The identity travels in a closure, not through the SDK's authInfo channel.** `createSapphireMcpHandler` ([`packages/mcp/src/worker.ts`](../../packages/mcp/src/worker.ts)) exposes authentication as something that happens entirely **outside** the handler: `apps/server` builds the authenticated tRPC caller itself, passes `buildCaller: () => caller`, and calls `handler.fetch(request)` **without** an `authInfo` argument. `buildCaller`'s `authInfo` parameter is therefore effectively unused in this deployment — the verified identity is captured in the per-request factory closure, and nothing downstream should assume `ctx.authInfo` is populated.

## Transport and discovery

- **Two CORS surfaces.** `isMcpClientPath` splits the Worker's routes: `/mcp`, `/.well-known/*`, `/api/auth/.well-known/*` and `/api/auth/oauth2/*` are served to arbitrary MCP clients (any origin, bearer auth, `credentials: false`, MCP session/protocol headers exposed) — as opposed to the credentialed, `CORS_ORIGIN`-pinned web-app surface everything else uses.
- **RFC 9728 challenge.** Missing/invalid bearer tokens on `/mcp` get a 401 with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"` so clients can bootstrap discovery from the failure itself.
- **`/mcp` never answers with a non-JSON-RPC body.** Both the 401 challenge and the 500 path are JSON-RPC error envelopes; the route-level catch exists because a token lookup failure, user-load failure, or malformed token shape must still answer in the envelope the client is parsing, not Hono's plain 500.
- **Discovery.** The issuer is `${BETTER_AUTH_URL}/api/auth`, so RFC 8414 places its metadata at `/.well-known/oauth-authorization-server/api/auth`; the protected-resource metadata (RFC 9728) names that issuer in `authorization_servers`. The Worker forwards every root `/.well-known/*` request to `auth.handler`, whose provider and `mcp()` request hooks serve the issuer-path authorization-server metadata and `/.well-known/oauth-protected-resource` with its path-suffixed variant `/.well-known/oauth-protected-resource/mcp` (RFC 9728 §3.1); `/api/auth/.well-known/*` is served by better-auth directly. The root `/.well-known/oauth-authorization-server` is served from the server-only `getOAuthServerConfig` endpoint for clients that look only at the origin.

## Workers runtime constraints

> **Keep the explicit `jsonSchemaValidator: new CfWorkerJsonSchemaValidator()` argument** in [`packages/mcp/src/server.ts`](../../packages/mcp/src/server.ts). The runtime-selected default would pull in Ajv — `new Function` codegen, which is **illegal on Cloudflare Workers** — whenever the bundler resolves the Node shim. Vitest runs the `mcp` project in Node, where Ajv's codegen works, so **no test can catch removal**; only production Workers break.

> **The bare `preloadSchemas()` call at module scope of [`packages/mcp/src/worker.ts`](../../packages/mcp/src/worker.ts) is not dead code.** Isolate runtimes (Workers) must pay the MCP protocol-schema build cost once at module scope, not per request. The workerd shim already does this; the explicit call keeps the guarantee when the bundler resolves the Node shim. The regression from deleting it is per-request latency on Workers — invisible to tests.

- `responseMode: "json"`: no mid-call notifications are emitted, so plain JSON responses beat an SSE stream (and its keep-alive timer) inside a Worker.

## Error mapping

[`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 4 owns the imperative (every thrown error goes through `mapToolError`; `FORBIDDEN`/`NOT_FOUND` map to fixed, id-free texts so the MCP layer cannot rebuild the existence oracle that [`api-security.md`](../../.claude/rules/api-security.md) closed). The design behind it, in [`packages/mcp/src/lib/errors.ts`](../../packages/mcp/src/lib/errors.ts):

- **In-band recovery.** Domain errors stay in-band (`isError` tool results) so the calling model can read and recover from them; anything unexpected is logged and reduced to a generic text that leaks no D1/SQL strings, stack traces, ids or keys.
- **Duck typing instead of `instanceof` — deliberately.** `instanceof TRPCError` silently returns `false` if `packages/mcp` and `packages/api` ever resolve separate `@trpc/server` instances, which would collapse every domain error (`FORBIDDEN`, `BAD_REQUEST`, …) into the generic internal text and hide Zod feedback from the model. Requiring `name === "TRPCError"` plus a string `code` keeps unrelated errors that merely carry a `code` (D1, runtime) out of the branch. The same reasoning applies to ZodError detection: tRPC stores the Zod failure on `cause`, and `instanceof ZodError` would break across duplicated `zod` module instances.

## Type-level seams

- **Plugin type erasure, single cast point.** The `mcp()` plugin's inferred type references better-auth internals that cannot be named in the package's emitted declarations (TS4058), so `createAuth` widens `plugins` to the base `BetterAuthPlugin[]`. The endpoints exist at runtime regardless; the root authorization-server route in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) is the **single** cast point (`getOAuthServerConfig`) — do not scatter further casts.
- **One reach into tRPC internals.** `procedureMap()` in [`packages/mcp/src/tools/resolve.ts`](../../packages/mcp/src/tools/resolve.ts) is the single place the MCP layer touches tRPC internals: tRPC v11 routers expose a flat `_def.procedures` record keyed by dot-path (`"room.list"`), which the api package's test-utils also rely on. A tRPC upgrade that changes this shape breaks both packages — check here first.

## Provisioning and persistence

- **One options object, no new secrets.** [`buildAuthOptions`](../../apps/server/src/auth-options.ts) is the single source of the `createAuth` options object — every route that instantiates better-auth must use it instead of repeating the literal. The MCP OAuth provider (login page `${CORS_ORIGIN}/login`, consent page `${BETTER_AUTH_URL}/oauth/consent`, RFC 8707 resource `${BETTER_AUTH_URL}/mcp`) is derived entirely from existing env vars, so `/mcp` needs no new secrets.
- [`serverEnvSchema`](../../packages/env/src/server.ts) requires `CORS_ORIGIN` and `BETTER_AUTH_URL` to be HTTP(S) origins without credentials, non-root paths, queries or fragments. A trailing slash is accepted; auth options, web CORS and the MCP challenge use the normalized URL origin.
- **OAuth provider tables mirror the plugin.** [`packages/db/src/schema/oauth.ts`](../../packages/db/src/schema/oauth.ts) (migration 0083) holds the tables consumed by `@better-auth/oauth-provider`: registered clients (`oauth_client`), protected resources and their client links (`oauth_resource`, `oauth_client_resource`), issued tokens (`oauth_access_token`, `oauth_refresh_token`), recorded consents (`oauth_consent`) and replay records for client assertions (`oauth_client_assertion`). The field set, JSON-array columns and millisecond timestamps mirror the schema better-auth's drizzle generator emits for this configuration **exactly** — better-auth reads/writes these through its drizzle adapter, so the columns are the plugin's contract, not ours to reshape.
- **Constant-time password comparison.** `constantTimeEqual` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) compares password-derived bytes without leaking the first mismatched byte (XOR folds the length mismatch, XOR/OR accumulates every byte mismatch in constant work) — the PBKDF2 verify path must keep using it rather than `===` on hex strings.
- **Account linking is explicit only.** `disableImplicitLinking: true`: a social sign-in never joins an existing user that has the same email, even when the provider reports the email verified, because anyone could have registered that email first with a password (pre-account hijacking, SA2-431). The callback then redirects to the `errorCallbackURL` the web passed with `error=account_not_linked`, and the sign-in form shows "This email is already registered. Sign in the way you did before, then link {Provider} in Settings." Linking from Settings still requires a signed-in user and the same email; `trustedProviders: ["google", "discord"]` lets it accept a provider email the provider has not verified. Emails registered before this change that only ever signed in through a provider are resolved by hand.

## Browser sessions, rate limiting and tRPC origin

- **Browser sessions last one day, sliding.** `session.expiresIn` is 86400 seconds and `updateAge` 3600: a request carrying a session older than an hour pushes its expiry a day ahead, so an active user stays signed in while a stolen session cookie stops working a day after its last use. MCP tokens are independent of this lifetime (see [Token to session](#token-to-session)).
- **The client IP is Cloudflare's `CF-Connecting-IP`.** better-auth keys its rate limits (`/sign-in*`, `/sign-up*`, `/change-password*`, `/change-email*`: three requests per ten seconds in production) and records session IPs from `advanced.ipAddress.ipAddressHeaders`. The default `X-Forwarded-For` is client-controlled in front of a Worker, so rotating it would reset the limit on every request; Cloudflare sets `CF-Connecting-IP` itself.
- **Rate limiting is switched on by the `NODE_ENV` binding.** `buildAuthOptions` sets `rateLimitEnabled` when `env.NODE_ENV` is `production` — `apps/server/wrangler.toml` `[vars]` and the deploy workflows' `--var NODE_ENV:production` — and `createAuth` passes it as `rateLimit.enabled`. better-auth's own default reads `process.env.NODE_ENV`, which a Worker on this compatibility date never populates from `[vars]`, so leaving it implicit disabled every limit in deployed Workers while Node tests that assigned `process.env` still passed (SA2-456). The [rate-limit E2E spec](../../e2e/auth-rate-limit.spec.ts) proves it against the Wrangler-built Worker served with the production `[vars]`. The counters stay in isolate memory: a new isolate starts with fresh counters.
- **tRPC mutations require the web origin.** The session cookie is `SameSite=None` because the web app and the Worker run on different sites, so the browser attaches it to cross-site requests too. The `/trpc/*` middleware answers `403` to every `POST` whose `Origin` header is not exactly the `CORS_ORIGIN` origin, a missing header included; tRPC sends mutations and batched calls as `POST`, while queries stay `GET` and are read-only. CORS alone does not stop such a request — it hides the response, after the mutation already ran.
- **Unexpected tRPC failures are logged.** The tRPC handler's `onError` logs `[trpc] <type> <path> failed` with the error for `INTERNAL_SERVER_ERROR` only; expected domain errors (`FORBIDDEN`, `BAD_REQUEST`, …) stay out of the log.

## Web login continuation

When the authorize endpoint sees an unauthenticated user, better-auth redirects to the web app's `/login` carrying the original authorize query; after sign-in the client sends the browser back to the **server's** authorize endpoint. The client-side helper that does this (`apps/web/src/features/auth/utils/oauth-redirect.ts`) keeps open-redirect vectors closed by fixing the destination and forwarding only allowlisted OAuth parameters — that invariant is documented in [`web-platform.md`](web-platform.md).

[`pendingAuthorizeUrl()` and `socialCallbackUrl()`](../../apps/web/src/features/auth/utils/login-continuation.ts) wrap that helper for code reading the browser location. Email and passkey sign-in resume authorization through `pendingAuthorizeUrl`; sign-up does likewise, and social sign-in and sign-up use `socialCallbackUrl` to return to login with the query. Preview auto-login also resumes authorization and claims each authorize URL once in `sessionStorage` to bound redirect loops; storage failures cannot provide that bound.

The `/login` route's `beforeLoad` ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx)) handles an already-signed-in visitor using the router's parsed search record. [`scripts/check-rules.ts`](../../scripts/check-rules.ts) checks that non-test web files using `authClient.signIn` or `authClient.signUp` import `login-continuation`; reviewers must still check each branch actually resumes correctly.
