# Web Platform Design

Cross-cutting design decisions for the web client (`apps/web`) and the platform surfaces it couples to: the persisted query cache, routing shell, PWA manifest, env bootstrap, the filter-presets feature (owned by this doc end to end, including its `packages/db` / `packages/api` halves), shared UI primitives, formatters, and the location/maps pipeline. Feature-specific session, statistics, and game-master design lives in [`sessions-and-live-editing.md`](sessions-and-live-editing.md), [`statistics.md`](statistics.md), and [`game-masters.md`](game-masters.md). Imperative rules for day-to-day web work live in [`.claude/rules/web-ui.md`](../../.claude/rules/web-ui.md), [`.claude/rules/web-forms.md`](../../.claude/rules/web-forms.md), [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md), [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md), and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) — this doc adds the deeper why, not a restatement.

## Persisted query cache and the cache buster (SA2-154)

The whole tRPC query cache is persisted to IndexedDB (store key `sapphire2-query-cache`) with `maxAge` of 24 hours, and rehydrates on boot before any network round-trip. Consequence: a client that fetched data under the previous server build rehydrates **up to 24h of old-shaped cache into new code** — if a release changed a procedure's output shape or value semantics, the new code renders stale-shaped objects until each query refetches (shipped as SA2-154).

The mitigation is the persister `buster` string in [`apps/web/src/main.tsx`](../../apps/web/src/main.tsx): bumping it discards the entire persisted cache on the next load. **Invariant: any release whose server changes alter a procedure's output shape or value semantics must bump the buster in the same change.** The bump procedure is kept at the code site as the repo's **only** `NOTE(ops)` comment, because main.tsx is exactly the file a release-time editor sees.

Not every output change needs a bump: a *gained* field whose absence fails safe can ride out the 24h window — e.g. the P&L graph's `evRecorded` flag rehydrates as absent, reads as "no recorded EV", and merely hides the EV toggle until the refetch lands (see [`statistics.md`](statistics.md)). Bump when stale data would render *wrong*, not merely *less*.

### Sign-out data wipe (SA2-159)

The persisted cache is keyed only by procedure name, **not per-user** — on a shared device the next account to sign in would briefly see the previous user's financial data rehydrated from IndexedDB (SA2-159). Two-part wipe in [`apps/web/src/utils/trpc.ts`](../../apps/web/src/utils/trpc.ts): `queryClient.clear()` removes what is currently in memory, and `persister.removeClient()` deletes the persisted store so nothing rehydrates on the next load. Every sign-out entry point routes through the shared [`useSignOut`](../../apps/web/src/shared/hooks/use-sign-out.ts) hook, which runs the wipe after Better Auth's `signOut` — **on `onError` too**, so a failed request never leaves stale data behind. The wipe is deliberately best-effort: a failed IndexedDB delete must not block navigating the user away.

## Routing shell and MCP OAuth login continuation

- **MCP OAuth login continuation**: when better-auth's authorize endpoint sees an unauthenticated user, it redirects to this app's `/login` carrying the original authorize query ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx) parks it, and social sign-in preserves it mid-OAuth) so the authorize flow can resume after sign-in.
- **Open-redirect closure invariant (security)**: after sign-in, [`resolveMcpAuthorizeRedirect`](../../apps/web/src/features/auth/utils/oauth-redirect.ts) sends the browser back to the **server's** MCP authorize endpoint — *never to any URL taken from the query itself*. The destination is fixed and only allowlisted OAuth parameters are forwarded; the helper returns the absolute authorize URL with the OAuth query re-attached, or `null` when the current query is not an OAuth authorize request. Any change that starts deriving the redirect target from query data reopens the open-redirect vector this design closes. The server-side OAuth provider design lives in [`mcp-and-oauth.md`](mcp-and-oauth.md).

## PWA manifest (SA2-163)

`start_url` **must reference a route that actually exists in the generated route tree** (`src/routeTree.gen.ts`) — the previous `"/dashboard"` pointed at a removed route, so a PWA launched from the home screen landed on a blank 404 (SA2-163); `"/"` is the only always-reachable entry point. A regression guard derives the real routes from `routeTree.gen.ts` (see [`testing-and-tooling.md`](testing-and-tooling.md)).

## Environment access (lazy `env` proxy)

[`packages/env/src/web.ts`](../../packages/env/src/web.ts) exports a lazy `env` proxy — `createEnv` validation runs on **first access**, not at import time. Moving validation back to module scope breaks every consumer (tests, static type tooling) that imports the module outside Vite, where `import.meta.env` is absent.

## Filter presets

Saved filter presets store the filter state of one screen (sessions list, statistics) for later reapply. This section is the authoritative home for the feature's design across all layers.

### Storage and payload schemas

- One JSON `payload` per preset row on `filter_preset.payload` ([`packages/db/src/schema/filter-preset.ts`](../../packages/db/src/schema/filter-preset.ts)). The **shared write=read Zod schemas** live in [`packages/db/src/schemas/filter-preset.ts`](../../packages/db/src/schemas/filter-preset.ts): db, api, and web must all validate through these exact objects, never a looser inline copy (see [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md)).
- **Per-screen discriminated union.** The payload schema is discriminated on `screenKey` (`"sessions"` | `"statistics"`), and validation must route per screen — never accept a merged/loose shape: `norm` exists only on the statistics payload, `roomId`/`currencyId` only on the sessions payload. The `update` procedure re-validates a provided payload against the **stored row's** `screenKey`, not the caller's claim — a `"norm"` payload written to a stored `"sessions"` row is rejected even though it passes the input-schema layer.
- **`display` vs `norm`** are the same control on two screens and must not diverge in behavior — but they are deliberately **separate schema fields** so the two payload shapes never silently merge.
- **Layering: `period` is only a bounded string here.** `packages/db` must not import from `apps/web`, so the fuller period vocabulary (`apps/web/src/shared/lib/period-filter.ts`) is out of reach and the shared schema validates `period` only as a bounded non-empty string. Screens must type-assert when applying a preset and **degrade gracefully** (keep current filters, never throw) when a stored payload carries a period the current build no longer understands — the screen-side halves of that contract are documented in [`statistics.md`](statistics.md) and [`sessions-and-live-editing.md`](sessions-and-live-editing.md).

### Default-preset scoping

At most one default preset per (user, screen). The `setDefault` procedure in [`packages/api/src/routers/filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts) clears every **other** row for the exact `(userId, screenKey)` pair — scoped by **both**, so it can never clear another user's default nor the same user's default on another screen. The unique-index/TOCTOU backstop belongs to [`data-integrity.md`](data-integrity.md).

## Form sheets and the external-submit `form=` contract

The bottom-sheet design contract and the `form={formId}` external-submit mechanics are owned by [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md) and [`.claude/rules/web-ui.md`](../../.claude/rules/web-ui.md). Two traps beyond the rules:

- **Form-id collision**: submission resolves by document-wide id, so two forms that can coexist (or are both submitted via an external `form=` button) must never share an id — a copy-pasted constant silently submits the wrong form. Mint a distinct id per new `FormSheet` body.
- **`FormSheet` × Radix Tabs (SA2-97)**: Radix unmounts inactive tab panels, so a `<form id={formId}>` inside one needs `forceMount` (re-hidden via `data-[state=inactive]:hidden`) or the external Save button resolves nothing and saving **silently fails**. The tabs are controlled so an invalid submit can pull the user back to the tab showing the validation errors. See [`tournament-modal-content.tsx`](../../apps/web/src/features/rooms/components/tournament-modal-content/tournament-modal-content.tsx).

## Shared UI primitives: traps and contracts

### `Field` — `isValidElement`, never `Children.toArray` (focus-loss trap)

[`field.tsx`](../../apps/web/src/shared/components/ui/field/field.tsx) injects `aria-invalid` onto its single input-like child when `error` is set. It deliberately uses `isValidElement` directly on `children` rather than `Children.toArray`: the latter **auto-assigns synthetic keys**, which makes the wrapped input unmount/remount whenever the error flips — dropping focus and DOM state mid-typing. Do not "simplify" this to `Children.toArray`/`Children.only`.

### `Tabs` — sliding pill enumerated to 5 tabs

In [`tabs.tsx`](../../apps/web/src/shared/components/ui/tabs/tabs.tsx), the default variant's active "pill" slides to the active trigger via `translateX`; `TabsList` sets `--tabs-count` so the pill width works for any N, but the per-child translate offsets are `nth-child` rules **enumerated only up to the 5th tab**. **When adding a `TabsList` with 6+ tabs, the `nth-child` rules in the variant string must be extended, or the pill will not reach the new tabs.**

## List and mutation wiring

Optimistic-update mechanics go through the helpers mandated by [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md). Two cross-cutting traps beyond the rule:

- **`fetchNextPage` needs a zero-arg wrapper** (a raw click handler passes the event as `FetchNextPageOptions`), guarded to no-op when there is no next page — otherwise React Query **re-fetches page 1** — or while a page is in flight. Reference: [`use-currencies.ts`](../../apps/web/src/features/currencies/hooks/use-currencies.ts).
- **Optimistic re-sort must exactly replicate the server's `ORDER BY`.** The favorite toggles in [`use-currencies.ts`](../../apps/web/src/features/currencies/hooks/use-currencies.ts) and [`use-rooms.ts`](../../apps/web/src/features/rooms/hooks/use-rooms.ts) replicate `ORDER BY is_favorite DESC, created_at ASC` so a newly-favorited row interleaves chronologically among existing favorites instead of jumping to the top. If the server ordering ever changes, these client comparators must change in the same task — a deliberate cross-layer copy with no mechanical sync.

## Location and maps

The room location picker accepts a pasted Google Maps link and resolves it to coordinates. Security posture, spread across [`packages/api/src/routers/location.ts`](../../packages/api/src/routers/location.ts) (server) and [`maps-url.ts`](../../apps/web/src/features/rooms/components/room-form/location-picker/maps-url.ts) (client):

- **SSRF bound.** Short-link hosts (`maps.app.goo.gl`, `goo.gl`) are the only URLs the server ever fetches (to follow the redirect), so they form an **exact allowlist** — this bounds the SSRF surface. Full URLs are parsed directly with no outbound fetch. This is the sanctioned, allowlisted exception to the "never fetch user-supplied URLs server-side" rule in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md) (SA2-170).
- **Lookalike-host regex.** Accepted hosts are `google.<tld>` or `*.google.<tld>`, where `google` must be the **registrable label immediately followed by the TLD**: a gTLD (`com`), a 2-letter ccTLD (`google.de`), or a `co`/`com` second-level ccTLD (`google.co.jp`, `google.com.au`). This rejects lookalikes such as `evil-google.com`, `google.com.evil.com`, **and** `google.evil.com` (where `google` would be a subdomain of `evil.com`).
- **Client/server allowlist sync trap.** The client-side allowlist in `maps-url.ts` (used to decide whether a pasted link is worth sending) **mirrors the server-side allowlist in `location.ts`**. There is no mechanical coupling: any change to accepted hosts must be made in both files in the same task, or pasted links will be accepted client-side and rejected server-side (or vice versa).
- **Paired-coordinates contract**: latitude and longitude move as a pair — both omitted, both `null`, or both numbers. The server-side `.refine` in `packages/api/src/routers/room.ts` mirrors the web form's, so a direct tRPC call can't persist a half-set location; a change to either side must update both.
- **API cost bound**: place-name search uses Google Places API (New) Text Search, triggered by an explicit search action — never per keystroke.

## Number and date formatting

Formatter imperatives (locale-fixed formatters, UTC-vs-local getters) are mandated by [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md); [`data-integrity.md`](data-integrity.md) owns the SA2-145 UTC round-trip drift narrative. In [`apps/web/src/utils/format-number.ts`](../../apps/web/src/utils/format-number.ts), `formatYmdSlash` (UTC getters, for date-only values like `sessionDate`) and `formatLocalYmdSlash` (local getters, for real instants like event timestamps) live side by side — picking the wrong one is a one-day-off bug (SA2-145).

## Update-notes auto-open (SA2-185)

The update-notes sheet auto-opens iff the latest release is absent from the **full viewed set** ([`should-auto-open-update-notes.ts`](../../apps/web/src/features/update-notes/utils/should-auto-open-update-notes.ts)) — the previous latest-vs-most-recently-viewed compare skipped every user with no view records at all, i.e. the majority (SA2-185) — and auto-open records the latest release as viewed immediately so the sheet surfaces once per release.
