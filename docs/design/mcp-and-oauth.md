# MCP Server & OAuth Consent Gate

Design record for the MCP server at `/mcp` and the OAuth 2.1 provider that guards it: the consent-gate threat model, the consent page, token-to-session translation, transport and discovery, and the Workers-specific implementation constraints. The day-to-day imperatives for the tool layer live in [`.claude/rules/mcp-tools.md`](../../.claude/rules/mcp-tools.md) and the authorization rules in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md); the user-facing connection guide is [`docs/mcp.md`](../mcp.md). This document holds the threat model and the mechanics behind those rules.

## Threat model: an open-registration OAuth provider

The `/mcp` endpoint is an OAuth-protected resource backed by better-auth's `mcp()` plugin, enabled through the optional `mcp` option of `createAuth` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) (dynamic client registration at `/api/auth/mcp/register`, authorize/token endpoints, `.well-known` metadata; the option is optional so callers without an MCP surface — tests — can omit it). Dynamic client registration (DCR) is open to anyone, which is standard MCP posture: clients cannot pre-share secrets. That posture makes every registered client untrusted by default, and two better-auth behaviors combine into the central hole:

1. **better-auth's `mcp()` authorize endpoint only routes through a consent step when the _client_ sends `prompt=consent`.** Otherwise an authenticated browser hitting an authorize URL is silently issued a code, and the token endpoint never re-checks consent. Since DCR is open to anyone, that would let any registered client obtain user data with zero interaction.
2. **Forcing the prompt is not sufficient on its own.** If `oidcConfig.consentPage` is not configured, the plugin's authorize redirects straight back to the client with a code — even under `prompt=consent` — and no user consent ever happens. The consent page URL is therefore a required field of the `mcp` option, and [`buildAuthOptions`](../../apps/server/src/auth-options.ts) always sets it.

The Worker's answer to (1) is the consent gate below; the answer to (2) is that consent-page wiring is part of the single provisioning path (see [Provisioning](#provisioning-and-persistence)).

## The consent gate

[`apps/server/src/oauth-consent.ts`](../../apps/server/src/oauth-consent.ts) plus a middleware in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) rewrite **every** authorize request to `prompt=consent` before better-auth sees it (`forceConsentPrompt` overwrites any client-supplied value).

The matching is deliberately **default-deny**:

- `isAuthorizePath` matches by **path suffix** (`…/authorize`, trailing slashes stripped) rather than by exact route, and the middleware is registered with `app.use` (not `app.on([...])`), so it applies to **every method**. Today only `GET /api/auth/mcp/authorize` exists (POST and `/api/auth/oauth2/authorize` both 404), but a better-auth upgrade must not be able to add a route that bypasses the gate — a second authorize route, or POST support on the existing one, cannot silently open a path around it. Adding a method to the better-auth catch-all route below the gate can never leave the gate behind, because the gate is method-independent by construction.

The regression tests for this wiring assert the URL actually handed to better-auth (not status codes) and pin the better-auth 1.6.0 authorize route surface — see [`testing-and-tooling.md`](testing-and-tooling.md).

## The consent page

better-auth redirects mid-authorize to `GET /oauth/consent`, rendered by the Worker via [`packages/mcp/src/auth/consent-html.ts`](../../packages/mcp/src/auth/consent-html.ts).

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
| `Cache-Control: no-store` | The page embeds a `consent_code` that can be exchanged for an authorization code — keep it out of the browser's history/bfcache. |
| `X-Frame-Options: DENY` | Approving issues that code, so no other origin may frame this page: with DCR open to anyone, a framed consent screen is a one-click account grant (the destination warning is unreadable through an iframe). |
| `Content-Security-Policy: frame-ancestors 'none'` | Same invariant, for CSP-aware browsers. |

## CSRF, PKCE, and the resource identifier

> **Do not remove the server-origin `trustedOrigins` push.** The consent page lives on the **server** origin (the Worker renders it), so its POST to `/api/auth/oauth2/consent` carries that origin — `createAuth` pushes `new URL(options.baseURL).origin` into `trustedOrigins` alongside `corsOrigin` ([`packages/auth/src/index.ts`](../../packages/auth/src/index.ts)). Without it, better-auth's CSRF check answers **403 `MISSING_OR_NULL_ORIGIN`** on every consent approval. `packages/auth` has no test suite and the failure appears only in a live OAuth round-trip, so removing the push is invisible to CI — this paragraph is the guard.

- `requirePKCE: true` — OAuth 2.1 posture for public MCP clients (no client secrets exist under DCR).
- `resource` — the RFC 8707 resource identifier, the absolute `/mcp` endpoint URL.

## Token to session

`app.all("/mcp")` in [`apps/server/src/worker.ts`](../../apps/server/src/worker.ts) is the authentication gate. It calls the mcp plugin's `getMcpSession` (bearer-token lookup) directly, loads the user row (the one DB lookup, kept in `apps/server` so `packages/mcp` stays db-free — [`mcp-tools.md`](../../.claude/rules/mcp-tools.md) rule 2), and hands both to `buildMcpSession`.

- **Single translation point.** [`buildMcpSession`](../../packages/mcp/src/auth/mcp-session.ts) is the **only** place an MCP identity becomes a tRPC session — procedures then run their `protectedProcedure`/ownership checks against `session.user.id` exactly as they do for cookie-authenticated requests. It returns `null` (the caller must answer 401) when the token is userless, the user row is gone, or the two disagree.
- **Token expiry is enforced here, not by better-auth.** better-auth's `getMcpSession` looks tokens up **by value only and never checks expiry** — `buildMcpSession` rejects tokens with `accessTokenExpiresAt <= now` so a leaked old token stays dead. Guarded by `mcp-session.test.ts` ("rejects an expired access token"); if that check ever moves, the guard must move with it.
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
- **One reach into tRPC internals.** `procedureMap()` in [`packages/mcp/src/tools/resolve.ts`](../../packages/mcp/src/tools/resolve.ts) is the single place the MCP layer touches tRPC internals: tRPC v11 routers expose a flat `_def.procedures` record keyed by dot-path (`"session.list"`), which the api package's test-utils also rely on. A tRPC upgrade that changes this shape breaks both packages — check here first.

## Provisioning and persistence

- **One options object, no new secrets.** [`buildAuthOptions`](../../apps/server/src/auth-options.ts) is the single source of the `createAuth` options object — every route that instantiates better-auth must use it instead of repeating the literal. The MCP OAuth provider (login page `${CORS_ORIGIN}/login`, consent page `${BETTER_AUTH_URL}/oauth/consent`, RFC 8707 resource `${BETTER_AUTH_URL}/mcp`) is derived entirely from existing env vars, so `/mcp` needs no new secrets.
- **OIDC provider tables mirror the plugin.** [`packages/db/src/schema/oauth.ts`](../../packages/db/src/schema/oauth.ts) (migration 0050) holds the tables consumed by better-auth's `mcp()` plugin: dynamically registered clients (`oauth_application`), issued tokens (`oauth_access_token`) and recorded consents (`oauth_consent`). The field set mirrors the plugin's schema definition **exactly** — better-auth reads/writes these through its drizzle adapter, so the columns are the plugin's contract, not ours to reshape.
- **Constant-time password comparison.** `constantTimeEqual` in [`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) compares password-derived bytes without leaking the first mismatched byte (XOR folds the length mismatch, XOR/OR accumulates every byte mismatch in constant work) — the PBKDF2 verify path must keep using it rather than `===` on hex strings.

## Web login continuation

When the authorize endpoint sees an unauthenticated user, better-auth redirects to the web app's `/login` carrying the original authorize query; after sign-in the client sends the browser back to the **server's** authorize endpoint. The client-side helper that does this (`apps/web/src/features/auth/utils/oauth-redirect.ts`) keeps open-redirect vectors closed by fixing the destination and forwarding only allowlisted OAuth parameters — that invariant is documented in [`web-platform.md`](web-platform.md).

`pendingAuthorizeUrl()` / `socialCallbackUrl()` in [`apps/web/src/features/auth/utils/login-continuation.ts`](../../apps/web/src/features/auth/utils/login-continuation.ts) wrap that helper for everything that reads the **browser's** location. Every client-side entry point that can establish a session must go through them, because whatever lands on `/login` with an authorize query can be any of them and a plain `navigate({ to: "/statistics" })` discards that query silently, with no error shown — the exact failure this section exists to prevent. Today that is:

- `useSignIn` — email sign-in, plus the Google/Discord buttons via `socialCallbackUrl()`.
- `useSignUp` — the same two paths. A MCP client's first connection often reaches an **unregistered** user, who signs up rather than signs in.
- `usePreviewAutoLogin` — only active under `VITE_PREVIEW_AUTO_LOGIN=true`, but that is exactly the preview environment used to verify this flow by hand. Alone among the three it signs in with **no user action**, so its resume is claimed once per authorize URL in `sessionStorage`: the in-component `attempted` ref only spans one page load, and `window.location.assign` starts a new one. Without that claim, an authorize endpoint that bounces back to `/login` — which a browser blocking the cross-site `SameSite=None` session cookie will cause on the preview deployment — would auto-sign-in and re-assign forever.

That list is not a promise anyone has to remember: [`scripts/check-rules.ts`](../../scripts/check-rules.ts) fails when a non-test file under `apps/web/src/features/auth/**` calls `authClient.signIn` / `authClient.signUp` without importing `login-continuation`. The invariant was written as prose first and broken twice before the check existed, which is exactly the case `AGENTS.md` reserves a `check-rules` entry for.

The `/login` route's `beforeLoad` ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx)) is the one deliberate caller of `resolveMcpAuthorizeRedirect` outside those helpers: it covers the already-signed-in visitor and receives the router's parsed `location.search` record rather than reading `window`, so it cannot share the same signature. Adding a fourth client-side entry point means adding it to the list above, not to that route.

### The web app is the ONLY continuation mechanism

> **Do not stop stripping `oidc_login_prompt`.** `withoutLoginPromptCookie` in [`apps/server/src/oauth-consent.ts`](../../apps/server/src/oauth-consent.ts) removes that cookie from **every** request the Worker forwards to `auth.handler`, which disables better-auth's own login continuation. Both the `mcp()` and `oidc-provider` plugins register an after-hook matching *every* route: when the authorize endpoint redirects an unauthenticated user it first stores the whole authorize query in a signed `oidc_login_prompt` cookie, and the hook then re-runs `authorizeMCPOAuth` on the next response that sets a session token — replacing that response with a **302 to the consent page**.

That hook is written for form-post logins. The web app signs in over **XHR** (`authClient.signIn.email`), and a 302-to-HTML is not something the better-auth client can parse: the call lands in `onError`, the user sees a generic sign-in failure, `pendingAuthorizeUrl()` never runs, and the consent code is burned. The user *is* signed in, so a second attempt succeeds — the symptom is "MCP authorization fails the first time, works if you retry".

Whether it fires at all depends on the deployment's domain layout, which is why it is invisible in some environments and fatal in others: the cookie is `SameSite=Lax`, so it is withheld from a **cross-site** sign-in XHR (`*.pages.dev` → `*.workers.dev`) but sent from a **same-site** one (`app.example.com` → `api.example.com`, and `localhost:3001` → `localhost:8787` in local dev, where the flow was reproducibly broken). Stripping the cookie makes the flow identical everywhere and leaves exactly one continuation path — the allowlisted client-side redirect above.

The OAuth provider callbacks (`/api/auth/callback/*`) are top-level navigations where the hook's 302 would have worked, but they are stripped too: `socialCallbackUrl()` already returns the browser to `/login` with the authorize query, so the client-side helper carries them just like an email sign-in.

Two details worth re-checking on a better-auth upgrade:

- **The cookie name is a literal, with no `__Secure-` prefix.** `advanced.useSecureCookies` prefixes the names better-auth derives itself (`ctx.context.authCookies`), but the oidc-provider and `mcp()` plugins call `ctx.setSignedCookie("oidc_login_prompt", …)` / `ctx.getSignedCookie("oidc_login_prompt", …)` with the literal string, and better-call's `setSignedCookie` serializes the key it is given. So exact-matching `oidc_login_prompt` is correct on https + same-site deployments too — the configuration neither local dev (http, so `useSecureCookies` is false) nor the `*.pages.dev` preview (cross-site, so the cookie never rides along) can exercise. Verified against better-auth 1.6.0; re-grep `plugins/oidc-provider` and `plugins/mcp` if that changes.
- **`/api/auth/set-password` is the one route that keeps the cookie.** [`worker.ts`](../../apps/server/src/worker.ts) serves it by calling `auth.api.setPassword({ headers })` directly rather than through `auth.handler`, so it never passes through `withoutLoginPromptCookie`. After-hooks still run on `auth.api.*` calls, but the hook needs a response that sets a **session token** and `setPassword` issues none, so it cannot fire. If a future better-auth relaxes that condition, this route needs the same stripping.
