# Web Platform Design

Cross-cutting design decisions for the web client (`apps/web`) and the platform surfaces it couples to: the persisted query cache, routing shell, PWA manifest, env bootstrap, the filter-presets feature (owned by this doc end to end, including its `packages/db` / `packages/api` halves), shared UI primitives, formatters, and the location/maps pipeline. Feature-specific session, statistics, and game-master design lives in [`sessions-and-live-editing.md`](sessions-and-live-editing.md), [`statistics.md`](statistics.md), and [`game-masters.md`](game-masters.md). Imperative rules for day-to-day web work live in [`.claude/rules/web-ui.md`](../../.claude/rules/web-ui.md), [`.claude/rules/web-forms.md`](../../.claude/rules/web-forms.md), [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md), [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md), and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) — this doc adds the deeper why, not a restatement.

Historical context for these decisions is retained in the [web platform history](../archive/web-platform-history.md).

## Persisted query cache and the cache buster

Successful tRPC queries are persisted to IndexedDB (store key `sapphire2-query-cache`) with `maxAge` of 24 hours and restored on boot. A client can therefore rehydrate old-shaped cache into new code until each query refetches.

The mitigation is the persister `buster` string in [`apps/web/src/main.tsx`](../../apps/web/src/main.tsx): bumping it discards the entire persisted cache on the next load. **Invariant: any release whose server changes alter a procedure's output shape or value semantics must bump the buster in the same change.** The bump procedure is kept at the code site as the repo's **only** `NOTE(ops)` comment, because main.tsx is exactly the file a release-time editor sees.

The current buster is `2026-11-data-model-v2`. TanStack's restore checks the buster before hydration and calls `removeClient()` on mismatch; the browser persistence spec seeds an old-shaped IndexedDB record and checks it is discarded on signed-in startup.

Not every output change needs a bump: a *gained* field whose absence fails safe can ride out the 24h window — e.g. the P&L graph's `evRecorded` flag rehydrates as absent, reads as "no recorded EV", and merely hides the EV toggle until the refetch lands (see [`statistics.md`](statistics.md)). Bump when stale data would render *wrong*, not merely *less*.

### Sign-out data wipe

The persisted cache is keyed only by procedure name, **not per-user**. Two-part wipe in [`apps/web/src/utils/trpc.ts`](../../apps/web/src/utils/trpc.ts): `queryClient.clear()` removes what is currently in memory, and `persister.removeClient()` deletes the persisted store so nothing rehydrates on the next load. Every sign-out entry point routes through the shared [`useSignOut`](../../apps/web/src/shared/hooks/use-sign-out.ts) hook, which runs the wipe after Better Auth's `signOut` — **on `onError` too**, so a failed request never leaves stale data behind. The wipe is deliberately best-effort: a failed IndexedDB delete must not block navigating the user away.

## Routing shell and MCP OAuth login continuation

- **Authenticated navigation**: Home, Sessions, Stats, Assets and More form the bottom tabs; More is current for its Library (Rooms, Games, Players, Tags) and App (Settings) destinations. The app is mobile only: from `md` (768px) the authenticated shell shows a "Use on your phone" blocker instead of the app. Unimplemented destinations remain links and resolve to the router's not-found fallback.
- **Route table**: `/`, `/more`, `/settings`, and `/login` exist. Unimplemented destinations resolve to the router's not-found fallback, including the Home live action at `/live/new`. Routes are split automatically at build time.
- **Back navigation** returns to the previous router history entry, preserving its search parameters; a cold entry navigates to its supplied fallback.

- **MCP OAuth login continuation**: when better-auth's authorize endpoint sees an unauthenticated user, it redirects to this app's `/login` carrying the original authorize query ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx) parks it, and social sign-in preserves it mid-OAuth) so the authorize flow can resume after sign-in.
- **Open-redirect closure invariant (security)**: after sign-in, [`resolveMcpAuthorizeRedirect`](../../apps/web/src/features/auth/utils/oauth-redirect.ts) sends the browser back to the **server's** MCP authorize endpoint — *never to any URL taken from the query itself*. The destination is fixed and only allowlisted OAuth parameters are forwarded; the helper returns the absolute authorize URL with the OAuth query re-attached, or `null` when the current query is not an OAuth authorize request. Any change that starts deriving the redirect target from query data reopens the open-redirect vector this design closes. The server-side OAuth provider design lives in [`mcp-and-oauth.md`](mcp-and-oauth.md).

## PWA manifest

`start_url` **must reference a route that actually exists in the generated route tree** (`src/routeTree.gen.ts`); `"/"` is the always-reachable entry point. A regression guard derives the real routes from `routeTree.gen.ts` (see [`testing-and-tooling.md`](testing-and-tooling.md)).

## Environment access (lazy `env` proxy)

[`packages/env/src/web.ts`](../../packages/env/src/web.ts) exports a lazy `env` proxy — `createEnv` validation runs on **first access**, not at import time. Moving validation back to module scope breaks every consumer (tests, static type tooling) that imports the module outside Vite, where `import.meta.env` is absent.

## Filter presets

Saved filter presets store the filter state of one screen (sessions list, statistics) for later reapply. This section is the authoritative home for the feature's design across all layers.

### Storage and payload schemas

- One JSON `payload` per preset row on `filter_preset.payload` ([`packages/db/src/schema/filter-preset.ts`](../../packages/db/src/schema/filter-preset.ts)). The **shared write=read Zod schemas** live in [`packages/db/src/schemas/filter-preset.ts`](../../packages/db/src/schemas/filter-preset.ts): db, api, and web must all validate through these exact objects, never a looser inline copy (see [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md)).
- **Per-screen validation.** Both payloads use the shared statistics filter fields: `kind`, `roomId`, `dateFrom`/`dateTo`, entry and tournament tag IDs, `assetId`, `valuation`, `baseAssetId`, and `normalized`, plus optional `period`. Unknown keys are rejected. Statistics requires exactly one mode (`assetId`, `valuation`, or `normalized: true`); sessions permits no mode, but rejects conflicting modes. `baseAssetId` requires `valuation`. The `update` procedure re-validates a provided payload against the **stored row's** `screenKey`.
- **Layering:** `packages/db` cannot import the screen-owned period vocabulary from `apps/web`, so the shared schema accepts any non-empty period string up to 30 characters. Future screens applying presets must handle unrecognized periods gracefully.

### Default-preset scoping

At most one default preset per (user, screen). The `setDefault` procedure in [`packages/api/src/routers/filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts) clears every **other** row for the exact `(userId, screenKey)` pair — scoped by **both**, so it can never clear another user's default nor the same user's default on another screen. The unique-index/TOCTOU backstop belongs to [`data-integrity.md`](data-integrity.md).

Default changes are guarded atomically against a target deleted after authorization. `setDefault` rolls back the clearing of other presets if the target no longer exists; `clearDefault` likewise rejects a stale target. Both report `CONFLICT` for that race, while an initially missing or foreign target remains `FORBIDDEN`. Idempotent requests also check that the observed default state still holds before returning.

## Mutation feedback, Undo and load failures

The shared `useUndoableMutation` hook preserves the caller's optimistic callbacks and uses one toast for the write and its outcome. A successful reversible write offers Undo for six seconds; Undo sends the caller's compensating request using the original variables, result and optimistic rollback context. It never offers redo. Hard deletes and an entry update that removes a Day use destructive feedback without Undo. The inverse table and conflict semantics are in [the API contract](api.md#undo); last-writer-wins is not optimistic concurrency control.

Forms should await mutations before closing or resetting so a rejected write retains input for retry. Query failures should render inline rather than by a global cache toast: `FORBIDDEN` and `NOT_FOUND` map to the not-found state, and other failures to the retryable state. A loading query must not show an empty or not-found state.

## Form sheets and the external-submit `form=` contract

The bottom-sheet design contract and the `form={formId}` external-submit mechanics are owned by [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md) and [`.claude/rules/web-ui.md`](../../.claude/rules/web-ui.md). Two traps beyond the rules:

- **Form-id collision**: submission resolves by document-wide id, so two forms that can coexist (or are both submitted via an external `form=` button) must never share an id — a copy-pasted constant silently submits the wrong form. Mint a distinct id per new `FormSheet` body.
- **`FormSheet` × Radix Tabs**: Radix unmounts inactive tab panels, so a `<form id={formId}>` inside one needs `forceMount` (re-hidden via `data-[state=inactive]:hidden`) or the external Save button resolves nothing and saving **silently fails**. The tabs are controlled so an invalid submit can pull the user back to the tab showing the validation errors.

## Shared UI primitives: traps and contracts

### `Field` — `isValidElement`, never `Children.toArray` (focus-loss trap)

[`field.tsx`](../../apps/web/src/shared/components/ui/field/field.tsx) injects `aria-invalid` onto its single input-like child when `error` is set. It deliberately uses `isValidElement` directly on `children` rather than `Children.toArray`: the latter **auto-assigns synthetic keys**, which makes the wrapped input unmount/remount whenever the error flips — dropping focus and DOM state mid-typing. Do not "simplify" this to `Children.toArray`/`Children.only`.

## List and mutation wiring

Optimistic-update mechanics go through the helpers mandated by [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md). Two cross-cutting traps beyond the rule:

- **`fetchNextPage` needs a zero-arg wrapper** (a raw click handler passes the event as `FetchNextPageOptions`), guarded to no-op when there is no next page or while a page is in flight.
- **Optimistic re-sort must exactly replicate the server's `ORDER BY`.** Favorite toggles must replicate `ORDER BY is_favorite DESC, created_at ASC` so a newly-favorited row interleaves chronologically among existing favorites instead of jumping to the top. If the server ordering changes, client comparators must change in the same task.

## Location and maps

The server's [`location` router](../../packages/api/src/routers/location.ts) resolves Google Maps links and searches places. A room location picker is not yet implemented in `apps/web`.

- **SSRF bound.** Links require HTTPS, no URL credentials and no nondefault port. Only the exact short-link hosts `maps.app.goo.gl` and `goo.gl` are fetched. Redirects are followed manually, with each destination checked against the allowlist, a five-hop limit and a ten-second fetch timeout; full Google URLs are parsed without fetching them. This is the sanctioned exception to the server-side user-supplied URL rule in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md).
- **Host matching.** The server accepts `google.com`, `google.<two-letter ccTLD>`, and `google.co.<ccTLD>` or `google.com.<ccTLD>`, including subdomains, as well as the two short-link hosts. It rejects lookalikes such as `evil-google.com` and `google.evil.com`. A future client-side precheck must match the server.
- **Paired coordinates:** latitude and longitude must be supplied or cleared together; the room router validates the pair. Future web forms must preserve the same contract.
- **API cost and response bounds:** place-name search uses Google Places API (New) Text Search; its request omits credentials, uses manual redirects and a ten-second timeout, and limits the response body to 1,000,000 bytes. Future web controls should trigger it with an explicit search action, not per keystroke.

## Number and date formatting

Formatter imperatives are mandated by [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md). Date-only values such as `playedOn` and `localDate` are calendar text, never UTC or local instants. For actual instants, [`apps/web/src/utils/format-number.ts`](../../apps/web/src/utils/format-number.ts) provides UTC and local date formatters; select the appropriate time basis.

## Update-notes auto-open

The update-notes sheet auto-opens when a latest release exists and the loaded full viewed set does not contain it ([`should-auto-open-update-notes.ts`](../../apps/web/src/features/update-notes/utils/should-auto-open-update-notes.ts)); an unresolved viewed set does not trigger it. Auto-open records the latest release as viewed so the sheet surfaces once per release.
