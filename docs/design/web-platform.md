# Web Platform Design

Cross-cutting design decisions for the web client (`apps/web`) and the platform surfaces it couples to: the persisted query cache, routing shell, PWA manifest, env bootstrap, the filter-presets feature (owned by this doc end to end, including its `packages/db` / `packages/api` halves), shared UI primitives, formatters, and the location/maps pipeline. Feature-specific session, statistics, and game-master design lives in [`sessions-and-live-editing.md`](sessions-and-live-editing.md), [`statistics.md`](statistics.md), and [`game-masters.md`](game-masters.md). Imperative rules for day-to-day web work live in [`.claude/rules/web-ui.md`](../../.claude/rules/web-ui.md), [`.claude/rules/web-forms.md`](../../.claude/rules/web-forms.md), [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md), [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md), and [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md) — this doc adds the deeper why, not a restatement.

## Persisted query cache and the cache buster (SA2-154)

The whole tRPC query cache is persisted to IndexedDB (store key `sapphire2-query-cache`) with `maxAge` of 24 hours, and rehydrates on boot before any network round-trip. Consequence: a client that fetched data under the previous server build rehydrates **up to 24h of old-shaped cache into new code**. If a release changed a procedure's output shape or value semantics, the new code renders stale-shaped objects until each query refetches — which shipped as SA2-154.

The mitigation is the persister `buster` string in [`apps/web/src/main.tsx`](../../apps/web/src/main.tsx): bumping it discards the entire persisted cache on the next load. **Invariant: any release whose server changes alter a procedure's output shape or value semantics must bump the buster in the same change.** This bump procedure is kept at the code site as the repo's **only** `NOTE(ops)` comment, because main.tsx is exactly the file a release-time editor sees. Release history: the current value (`"2026-07-mix-games"`) was set when migration 0039 changed variant value semantics (`'nlh'` → display labels) and several procedure outputs gained fields.

Not every output change needs a bump: a *gained* field whose absence fails safe can ride out the 24h window. Example: the P&L graph's `evRecorded` flag — a persisted entry written before the field existed rehydrates without it, which reads as "no recorded EV" and merely hides the EV toggle until the refetch lands (see [`statistics.md`](statistics.md)). Bump when stale data would render *wrong*, not merely *less*.

### Sign-out data wipe (SA2-159)

The persisted cache is keyed only by procedure name, **not per-user**. On a shared device, the next account to sign in would briefly see the previous user's financial data rehydrated from IndexedDB (SA2-159). Two-part wipe in [`apps/web/src/utils/trpc.ts`](../../apps/web/src/utils/trpc.ts): `queryClient.clear()` removes what is currently rendered in memory, and `persister.removeClient()` deletes the persisted `sapphire2-query-cache` store so nothing can be rehydrated on the next load.

Every sign-out entry point (user menu, settings) routes through the shared [`useSignOut`](../../apps/web/src/shared/hooks/use-sign-out.ts) hook, which runs the wipe after Better Auth's `signOut` — **on `onError` too**, so a failed request never leaves stale data behind. The wipe is deliberately best-effort: a failed IndexedDB delete must not block navigating the user away.

## Routing shell and MCP OAuth login continuation

- The public landing page was removed — the root path (`/`, [`apps/web/src/routes/index.tsx`](../../apps/web/src/routes/index.tsx)) only dispatches: signed-in users land on the statistics page, everyone else on the login page. The session is read from **router context** rather than a second `getSession` call: [`__root.tsx`](../../apps/web/src/routes/__root.tsx)'s `beforeLoad` guard fetches it once and merges it into context for child routes. The guard has already redirected signed-out users to `/login`, so the `/login` branch inside the index dispatch is a typed fallback for that invariant.
- **MCP OAuth login continuation**: when better-auth's authorize endpoint sees an unauthenticated user, it redirects to this app's `/login` carrying the original authorize query ([`apps/web/src/routes/login.tsx`](../../apps/web/src/routes/login.tsx) parks it). Social sign-in returns to `/login` with the query preserved mid-OAuth so the route's `beforeLoad` can resume the authorize flow; the normal (non-OAuth) login goes straight into the app.
- **Open-redirect closure invariant (security)**: after sign-in, [`resolveMcpAuthorizeRedirect`](../../apps/web/src/features/auth/utils/oauth-redirect.ts) sends the browser back to the **server's** MCP authorize endpoint — *never to any URL taken from the query itself*. The destination is fixed and only allowlisted OAuth parameters are forwarded; the helper returns the absolute authorize URL with the OAuth query re-attached, or `null` when the current query is not an OAuth authorize request. Any change that starts deriving the redirect target from query data reopens the open-redirect vector this design closes. The server-side OAuth provider design lives in [`mcp-and-oauth.md`](mcp-and-oauth.md).

## PWA manifest (SA2-163)

`start_url` **must reference a route that actually exists in the generated route tree** (`src/routeTree.gen.ts`). The previous value `"/dashboard"` pointed at a route removed in PR #341 (cleanup #363), so a PWA launched from the home screen landed on TanStack Router's not-found shell — a blank 404 (SA2-163). `"/"` is the only always-reachable entry point (the index route dispatches, see above). The manifest lives in its own module, [`apps/web/src/shared/lib/pwa-manifest.ts`](../../apps/web/src/shared/lib/pwa-manifest.ts), so it can be unit-tested without importing `vite.config.ts` (which would pull in the whole Vite plugin graph); the regression guard derives the set of real routes from `routeTree.gen.ts` so it keeps working as routes come and go (see [`testing-and-tooling.md`](testing-and-tooling.md)).

## Environment access (lazy `env` proxy)

[`packages/env/src/web.ts`](../../packages/env/src/web.ts) exports a lazy `env` proxy: the actual `createEnv` validation happens on **first access**, not at import time. Modules that only need the factory — tests, static type tooling — can import `web.ts` without crashing in environments where `import.meta.env` is absent. Moving validation back to module scope would break every consumer that imports the module outside Vite.

## Filter presets

Saved filter presets let a user store the filter state of one screen (sessions list, statistics) and reapply it later. This section is the authoritative home for the feature's design across all layers.

### Storage and payload schemas

- One JSON `payload` per preset row on `filter_preset.payload` ([`packages/db/src/schema/filter-preset.ts`](../../packages/db/src/schema/filter-preset.ts)). The **shared write=read Zod schemas** live in [`packages/db/src/schemas/filter-preset.ts`](../../packages/db/src/schemas/filter-preset.ts): db, api, and web must all validate through these exact objects, never a looser inline copy (see [`.claude/rules/api-data-integrity.md`](../../.claude/rules/api-data-integrity.md)).
- **Per-screen discriminated union.** The payload schema is discriminated on `screenKey` (`"sessions"` | `"statistics"`), and validation must route per screen — never accept a merged/loose shape. `norm` exists only on the statistics payload, so it is rejected under `screenKey: "sessions"` even though it independently parses as a valid statistics field; symmetrically, `roomId`/`currencyId` exist only on the sessions payload. The `update` procedure re-validates a provided payload against the **stored row's** `screenKey`, not the caller's claim — a `"norm"` payload written to a stored `"sessions"` row is rejected even though it would pass the input-schema layer.
- **`display` vs `norm`.** The sessions list's "Display" chip (raw currency amounts vs BB/BI-normalized) is saved as the sessions payload's `display` field; statistics carries the equivalent state as `norm`. They are the same control on two screens and must not diverge in behavior — but they are deliberately **separate schema fields** so the two payload shapes never silently merge (`display` stays an unknown key to the statistics schema and vice versa).
- **Layering: `period` is only a bounded string here.** `packages/db` must not import from `apps/web`, and the fuller period vocabulary (`"this_month"`, `"last_7_days"`, …) lives in `apps/web/src/shared/lib/period-filter.ts`, out of reach — so the shared schema validates `period` only as a bounded non-empty string. Consequences ripple client-side: screens must type-assert when applying a preset and must **degrade gracefully** (keep current filters, never throw) when a stored payload carries a period the current build no longer understands — the screen-side halves of that contract are documented in [`statistics.md`](statistics.md) and [`sessions-and-live-editing.md`](sessions-and-live-editing.md).

### Default-preset scoping

At most one default preset per (user, screen). The `setDefault` procedure in [`packages/api/src/routers/filter-preset.ts`](../../packages/api/src/routers/filter-preset.ts) clears every **other** row for the exact `(userId, screenKey)` pair — scoped by **both**, so it can never clear another user's default nor the same user's default on another screen. The unique-index/TOCTOU backstop behind this belongs to [`data-integrity.md`](data-integrity.md).

### The data hook: `useFilterPresets`

[`apps/web/src/shared/hooks/use-filter-presets.ts`](../../apps/web/src/shared/hooks/use-filter-presets.ts) is screen-agnostic: call `useFilterPresets("sessions")` / `useFilterPresets("statistics")` from any screen — the cache is scoped per `screenKey` via the query key, so two instances with different arguments never share state.

- `screenKey` is only known at hook-instantiation time (not a compile-time literal), so it cannot narrow the discriminated union the procedure expects; the server re-validates the payload against the exact `screenKey` regardless.
- **`update` fields are optional and independent**, mirroring the procedure's `.set()`: pass `name` alone to rename, `payload` alone to overwrite with the current filters. A field left out is not touched — a rename never clobbers the stored payload, an overwrite never clobbers the name. `isDefault` is not part of the `update` surface at all; `setDefault` / `clearDefault` own it.
- The optimistic `setDefault` update mirrors the server exactly: the target row flips to `true`, every other row **in the same (screenKey-scoped) cache entry** flips to `false`.
- The hook exposes `isSuccess` alongside `isLoading` because the two are **not complements**: a query that exhausted its retries is no longer loading yet never answered. Consumers that must act exactly once on the first real answer (`useDefaultFilterPreset`) gate on `isSuccess`, not `!isLoading`.

### Default-preset auto-apply: `useDefaultFilterPreset`

[`apps/web/src/shared/hooks/use-default-filter-preset.ts`](../../apps/web/src/shared/hooks/use-default-filter-preset.ts) auto-applies a screen's default preset on first load. It is side-effect only — it returns nothing and owns no state; the caller keeps its own filter state and just receives the stored payload. Shared by the sessions list and the statistics screen, which previously had identical copies of this effect.

- **Apply-path routing**: the two screens differ only in how they decide the filters are still pristine, so that verdict stays with the caller as the `isUntouched` parameter (sessions: local filter-state emptiness including the Display chip; statistics: a filter-values predicate, because TanStack Router bakes schema defaults into the URL — see [`sessions-and-live-editing.md`](sessions-and-live-editing.md) and [`statistics.md`](statistics.md)). The apply is skipped when `isUntouched` is false, so a deep link or an explicit filter always wins.
- **One-shot *attempt* latch.** A `useRef` guard marks the attempt spent as soon as the presets query answers **successfully**, whether or not a preset was applied. A default preset that appears later (a refetch, another tab, the user marking one while on the page) must never re-fire and clobber filters the user has since set.
- **The latch keys on `isSuccess`, not `!isLoading`.** A query whose retries are exhausted stops loading with no data; latching there would burn the one shot on a failure and permanently suppress the default for the rest of the page's life. With offline mode and a persisted cache in play, opening a screen on a flaky connection hits exactly that — the first fetch fails, a focus/reconnect refetch succeeds, and the default must still apply. An empty *successful* answer, by contrast, is a real answer and does spend the shot.
- `applyDefault` is called at most once with the default preset's stored payload. The payload is stored JSON cast to the caller's shape — **callers must tolerate values their current code no longer understands** (see the `period` layering note above).

### The presets sheet: `useFilterPresetsSheet`

[`apps/web/src/shared/components/filter-presets/use-filter-presets-sheet.ts`](../../apps/web/src/shared/components/filter-presets/use-filter-presets-sheet.ts) owns the interactive state (active tab, pending delete confirmation, pending rename/overwrite) for the Presets bottom sheet, on top of the screen-agnostic `useFilterPresets` data hook. It is generic over the caller's payload shape so `onApply` / `currentPayload` stay typed to the caller's own `screenKey`.

- **Error surfacing** is the global `MutationCache.onError` toast in `utils/trpc.ts`; the hook's catch blocks exist purely so rejected promises are handled. A duplicate name is one tap away (CONFLICT), so the unhandled-rejection path was trivially reachable. Handlers return their promises for the same reason — the star has no confirmation step, so a rejected `setDefault`/`clearDefault` was the most reachable unhandled rejection on this surface.
- **State resets**: the sheet stays mounted between openings, so opening resets to the default tab — otherwise a user who left off on "Save new" (or mid-confirmation) is dropped back there next time. The edit form is a **drill-down out of a row inside the "Saved" tab**, not a peer of the tabs, so leaving that tab abandons it (without this, switching to "Save new" and back dropped the user into the rename form with the list hidden). Delete confirmation and the rename form are separate surfaces for the same row, so opening one closes the other — otherwise confirming a delete leaves the edit form mounted for a row that no longer exists.
- **Rename = rename + overwrite, one action by design**: submitting the edit form renames the preset *and* re-points it at the caller's current filters, so "I tweaked my filters and want this preset to match" is a single interaction — the form's body copy must say so before the user taps Save. On failure the form stays open (with the rejected name still in it) so the user can pick another.
- **The default star is one toggle, so it must be disabled while a change is in flight in *either* direction.** Exposing only the set-default pending flag left the clear path unguarded: double-tapping an already-default preset fired two `clearDefault` calls.
- The hook does not expose a `defaultPreset` value: every row already carries its own `isDefault`, and the auto-apply-on-load path lives in `useDefaultFilterPreset`, not in the sheet.
- In the delete confirmation dialog, **Cancel stays live while the delete is pending** so a stuck request is escapable.

### Preset name validation

The shared name form ([`use-tag-name-form.ts`](../../apps/web/src/shared/components/management/tag-name-form/use-tag-name-form.ts), reused by the presets sheet as "Preset name" and by tag management as "Tag name") runs `.trim()` **before** the length checks so it mirrors the server exactly (`presetNameSchema` in `packages/db/src/schemas/filter-preset.ts` is `.trim().min(1).max(50)`). Without the trim, a whitespace-only name passed the client and was rejected server-side, surfacing as a generic toast instead of an inline field error. The validation copy is built from the resolved field label so it always names the field the user is looking at, and the caller re-trims on submit because the validator's trimmed output is not written back into form state — the server must receive what the schema validated.

## Form sheets and the external-submit `form=` contract

The V2 bottom-sheet design contract (full height, iOS-style `[X] Title [✓]` toolbar, non-dismissible by overlay/swipe) lives in [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md). The mechanics worth knowing beyond the rule:

- **External submit via `form=`**: [`FormSheet`](../../apps/web/src/shared/components/form-sheet/form-sheet.tsx)'s Save button lives in the drawer chrome, outside the `<form>` element, and submits it through the HTML `form` attribute pointing at a stable form id. Rendered form bodies must set `id={formId}` on their `<form>` and render **no submit button of their own**.
- **Form-id collision trap**: because submission is resolved by document-wide id, two forms that can coexist must never share an id. Two `TagManager` instances on one page need instance-unique ids. In the presets sheet, the create form and the rename/overwrite form are never *mounted* at the same time, but both are submitted from an external button via `form=`, so they still must not share an id (the edit form owns its own). When adding any new `FormSheet` body, mint a distinct id — a copy-pasted constant silently submits the wrong form.
- **`FormSheet` × Radix Tabs (SA2-97)**: in the tournament modal, the `<form id={formId}>` lives inside a tab panel. Radix unmounts inactive panels, so without `forceMount` the Save button resolves nothing and saving **silently fails** from the Structure tab. `forceMount` keeps the form in the DOM, with `data-[state=inactive]:hidden` re-hiding it (forceMount renders inactive content without the `hidden` attr). The tabs are controlled so an invalid submit from the Structure tab can pull the user back to Details, where the validation errors are shown — otherwise the Save button looks dead (SA2-97 follow-up). See [`tournament-modal-content.tsx`](../../apps/web/src/features/rooms/components/tournament-modal-content/tournament-modal-content.tsx).
- **Key-per-target remount contract** for create/edit sheets (games page group/variant sheets, the shared mix-form sheet): create and edit share one sheet, with mode derived from the presence of an editing target. The parent keys the sheet by create/edit-target identity so a fresh hook instance mounts per target, seeding `defaultValues` once; `onOpenChange` also resets the form on close so a repeated "Add …" against the same persisted create-mode instance never resurfaces a cancelled draft. Reference: [`use-group-form-sheet.ts`](../../apps/web/src/features/games/pages/games-page/group-form-sheet/use-group-form-sheet.ts).

## Shared UI primitives: traps and contracts

### `Field` — `isValidElement`, never `Children.toArray` (focus-loss trap)

[`field.tsx`](../../apps/web/src/shared/components/ui/field/field.tsx) injects `aria-invalid` onto its single input-like child when `error` is set; the shared Input / Textarea / Select trigger classes already include `aria-invalid:border-destructive aria-invalid:ring-3 …`, so the red border/ring kicks in automatically. It falls back to the untouched children when the child isn't a single React element (multi-input fields handle their own invalid state). The implementation deliberately uses `isValidElement` directly on `children` rather than `Children.toArray`: the latter **auto-assigns synthetic keys**, which makes the wrapped input unmount/remount whenever the error flips — dropping focus and DOM state mid-typing. Do not "simplify" this to `Children.toArray`/`Children.only`.

### `Tabs` — sliding pill enumerated to 5 tabs

In [`tabs.tsx`](../../apps/web/src/shared/components/ui/tabs/tabs.tsx), the active state of the default variant is a single `::after` "pill" that slides to the active trigger via `translateX`, rather than cross-fading per trigger. `TabsList` sets `--tabs-count` from its child count so the pill width is `1 / N` for any number of tabs — but the per-child translate offsets are `nth-child` rules **enumerated only up to the 5th tab** (enough for every current `TabsList`). **When adding a `TabsList` with 6+ tabs, the `nth-child` rules in the variant string must be extended, or the pill will not reach the new tabs.** The pill is hidden in the vertical orientation; triggers use `z-10` to keep labels above the pill (`::after`, `z-0`); the line variant uses a per-trigger underline indicator instead.

### `SelectWithClear` — Radix reset-by-remount

Radix Select does not reset its internal state when `value` switches from a defined string to `undefined` while controlled. [`select-with-clear.tsx`](../../apps/web/src/shared/components/ui/select/select-with-clear.tsx) remounts the Select via `key` to force it back to the empty (placeholder) state. (Usage rules: [`.claude/rules/web-forms.md`](../../.claude/rules/web-forms.md).)

### `InputGroup`

[`input-group.tsx`](../../apps/web/src/shared/components/ui/input-group/input-group.tsx) is a labeled section that groups related form controls under a heading. Unlike `Field` (one label per single input), `InputGroup` frames a cluster of fields — used to break a long single-screen form into scannable sections **without** a stepper or tabs, so every control stays mounted for a single submit.

### Rich text editor and renderer

- Toolbar ([`rich-text-editor.tsx`](../../apps/web/src/shared/components/ui/rich-text-editor/rich-text-editor.tsx)): borderless ghost icon buttons packed together (not individually boxed), with a high-contrast active state legible in dark mode (blue tint + blue icon via `--primary`).
- The toolbar formatting keys double as the `ToggleGroupItem` `value`s, so the group's controlled `value` derives straight from the editor's active marks/nodes. The `ToggleGroup` reports the *desired* next selection; the hook diffs it against the current state and runs the single command for whichever item the user toggled — headings convert rather than stack, so the symmetric difference is always exactly one key ([`use-rich-text-editor.ts`](../../apps/web/src/shared/components/ui/rich-text-editor/use-rich-text-editor.ts)).
- [`RichTextContent`](../../apps/web/src/shared/components/ui/rich-text-content/rich-text-content.tsx) is the read-only renderer: it mirrors the editor's `.tiptap` prose styling so saved content looks identical to what was authored (callers tweak size/spacing via `className`). Its sanitizer allowlists exactly the tags the editor (`StarterKit` + `Link`) can emit; anything else is **unwrapped**, so stored HTML renders without `dangerouslySetInnerHTML` exposing untrusted markup. The stored-content sanitization decision (SA2-25) is documented in [`data-integrity.md`](data-integrity.md).

### `FilterAllOption` — RadioGroup empty-value limitation

A `RadioGroup` cannot carry an empty-string item cleanly, so the "clear this filter" state for optional dimensions (`All rooms` / `All currencies`) lives in a sibling button rendered above the `FilterOptionList`, tinted primary with a trailing check when active ([`filter-all-option.tsx`](../../apps/web/src/shared/components/filter-chip-bar/filter-all-option.tsx)).

### Inset focus ring inside scroll containers (SA2-70)

The shared `Table` wraps its `<table>` in an `overflow-x-auto` div, and the CSS spec coerces that to `overflow-y: auto` as well — so an **outset** focus ring on an input in the bottom-most row overflows the wrapper and gets clipped (SA2-70). Inputs rendered inside such containers use `ring-inset` so the ring paints inside the input box and survives the clip regardless of row position. Reference: [`blind-level-input.tsx`](../../apps/web/src/features/rooms/components/blind-level-editor/blind-level-input/blind-level-input.tsx).

## List and mutation wiring

Optimistic-update mechanics go through the helpers mandated by [`.claude/rules/web-data-fetching.md`](../../.claude/rules/web-data-fetching.md). Two cross-cutting traps beyond the rule:

- **`fetchNextPage` needs a wrapper.** Wiring a load-more button straight to `fetchNextPage` passes the click event as `FetchNextPageOptions`. Use a zero-arg wrapper, and guard it to no-op when there is no next page (otherwise React Query **re-fetches page 1**) or while a page is already in flight. Reference: [`use-currencies.ts`](../../apps/web/src/features/currencies/hooks/use-currencies.ts).
- **Optimistic re-sort must exactly replicate the server's `ORDER BY`.** The favorite toggles in [`use-currencies.ts`](../../apps/web/src/features/currencies/hooks/use-currencies.ts) and [`use-rooms.ts`](../../apps/web/src/features/rooms/hooks/use-rooms.ts) re-sort the optimistic list with an exact replica of the server's `ORDER BY is_favorite DESC, created_at ASC`. A naive move-to-front (or a bare stable sort) misorders the list until the refetch lands: a newly-favorited row must **interleave chronologically** among the existing favorites, not jump to the top. If the server ordering ever changes, these client comparators must change in the same task — they are a deliberate cross-layer copy with no mechanical sync.

## Location and maps

The room location picker accepts a pasted Google Maps link and resolves it to coordinates. Security posture, spread across [`packages/api/src/routers/location.ts`](../../packages/api/src/routers/location.ts) (server) and [`maps-url.ts`](../../apps/web/src/features/rooms/components/room-form/location-picker/maps-url.ts) (client):

- **SSRF bound.** Short-link hosts (`maps.app.goo.gl`, `goo.gl`) are the only URLs the server ever fetches (to follow the redirect), so they form an **exact allowlist** — this bounds the SSRF surface. Full URLs are parsed directly with no outbound fetch. This is the sanctioned, allowlisted exception to the "never fetch user-supplied URLs server-side" rule in [`.claude/rules/api-security.md`](../../.claude/rules/api-security.md) (SA2-170).
- **Lookalike-host regex.** Accepted hosts are `google.<tld>` or `*.google.<tld>`, where `google` must be the **registrable label immediately followed by the TLD**: a gTLD (`com`), a 2-letter ccTLD (`google.de`), or a `co`/`com` second-level ccTLD (`google.co.jp`, `google.com.au`). This rejects lookalikes such as `evil-google.com`, `google.com.evil.com`, **and** `google.evil.com` (where `google` would be a subdomain of `evil.com`).
- **Client/server allowlist sync trap.** The client-side allowlist in `maps-url.ts` (used to decide whether a pasted link is worth sending) **mirrors the server-side allowlist in `location.ts`**. There is no mechanical coupling: any change to accepted hosts must be made in both files in the same task, or pasted links will be accepted client-side and rejected server-side (or vice versa).
- **Coordinate extraction precedence**, ordered by specificity: `!3d!4d` is the place's actual location, `@lat,lng` is only the map viewport center, and `q=` / `ll=` / friends cover share/query links.
- **API cost bound**: place-name search uses Google Places API (New) Text Search, triggered by an explicit search action — never per keystroke.
- **Paired-coordinates contract**: latitude and longitude move as a pair — both omitted (leave unchanged), both `null` (cleared), or both numbers (set). The server-side `.refine` in `packages/api/src/routers/room.ts` mirrors the web form's, so a direct tRPC call can't persist a half-set location.
- The room detail page's "View on Google Maps" outbound link uses the **key-free** Maps search URL, so no API key is needed ([`room-location-link.tsx`](../../apps/web/src/features/rooms/pages/room-detail-page/room-location-link/room-location-link.tsx)).

## Geolocation: `useGeolocation`

[`use-geolocation.ts`](../../apps/web/src/shared/hooks/use-geolocation.ts) wraps `navigator.geolocation.getCurrentPosition` as a **one-shot** request with two entry points: pass `enabled` to auto-request when (for example) a dialog opens, or call `request()` on demand (a "use current location" button).

- **`enabled` false→true semantics**: a fresh false→true transition fires one automatic position request — never twice for the same transition. Closing resets the latch so the next open re-requests a fresh fix.
- A recent fix (≤ 1 min old) is reused so reopening the dialog is instant.
- Errors are classified against the permission-denied code: the hook's local `PERMISSION_DENIED = 1` constant pins the spec value `GeolocationPositionError.PERMISSION_DENIED === 1` — a denied permission maps to the `"denied"` state, every other error to `"unavailable"`.

## Number and date formatting

Formatter imperatives (locale-fixed formatters, UTC-vs-local getters) are mandated by [`.claude/rules/datetime-and-numbers.md`](../../.claude/rules/datetime-and-numbers.md); [`data-integrity.md`](data-integrity.md) owns the SA2-145 UTC round-trip drift narrative. The per-function contracts in [`apps/web/src/utils/format-number.ts`](../../apps/web/src/utils/format-number.ts):

- `formatCompactNumber` — single number with compact notation (k, M, B); compaction kicks in at **10,000+**.
- `createGroupFormatter` — a formatter applying a **consistent unit tier across a group of numbers**, determined by the maximum absolute value in the group: `const fmt = createGroupFormatter([100, 200, 10000]); fmt(100) // "0.01k"` (because the max is 10000, k tier), `fmt(200) // "0.02k"`, `fmt(10000) // "10k"`. If the max is < 10,000, all values are shown as plain numbers.
- `formatYmdSlash` — for **date-only values** (`sessionDate` and friends), which are stored/returned as UTC midnight: it reads UTC calendar fields so it renders the day the user actually saved. Local getters would shift the day back one for users west of UTC (SA2-145).
- `formatLocalYmdSlash` — the local-time counterpart, for values that are **real instants** (session event timestamps), where the calendar day has to match the clock time rendered next to it. Never use it for `sessionDate`. The two live side by side and picking the wrong one is a one-day-off bug — the tests pin the difference in both directions.
- **Negative zero**: `-0 >= 0` is `true`, so the sign resolves to `'+'`, and `(-0).toLocaleString() === "-0"` in V8 — concatenation yields `"+-0"`. This is pinned as current behavior; callers that dislike it must pre-normalize `-0` to `0`.

## Update-notes auto-open (SA2-185)

The update-notes sheet auto-opens **iff there is a latest release the user has not yet viewed**, decided by membership in the full viewed set ([`should-auto-open-update-notes.ts`](../../apps/web/src/features/update-notes/utils/should-auto-open-update-notes.ts)). The previous implementation compared the user's *most recently viewed* version against the latest and, critically, skipped every user with **no view records at all** — the common case (all existing users right after the feature shipped, plus anyone who never expanded a note), so the sheet never auto-opened for the majority of users (SA2-185). Membership-checking also covers the edge case of the latest note being viewed before an older one. The decision returns `false` while the viewed list is still loading (`undefined`) so the sheet never flashes open before the data arrives.

Two follow-on decisions in [`use-update-notes-sheet.tsx`](../../apps/web/src/features/update-notes/components/update-notes-sheet/use-update-notes-sheet.tsx):

- A **single viewed-state instance** is held by the provider and shared with the sheet via context (rather than each calling `useUpdateNotesViewed`), keeping the auto-open optimistic mark in sync with the sheet's NEW badges — no cross-instance flicker (SA2-185).
- Auto-open **records the latest release as viewed immediately**, so the sheet surfaces once per release instead of every session until the user happens to expand its accordion (SA2-185 review follow-up).

## Cross-feature display decisions

- **Balance vs transaction-amount color semantics** (currencies surface): a *balance* is a holding, not a P/L, so positives stay neutral — only a negative balance (a deficit) is flagged with the destructive token (avoids greening every account). A *transaction amount* is a P/L delta, so a credit (`>= 0`) reads as `success` and a debit as `destructive`. References: [`balance-format.ts`](../../apps/web/src/features/currencies/utils/balance-format.ts), [`transaction-list-helpers.ts`](../../apps/web/src/features/currencies/utils/transaction-list-helpers.ts). Semantic-token usage rules: [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md).
- **Player search is client-side**: the players list is fully loaded client-side, so search filters the fetched players rather than re-querying — no server `tagIds` filter is needed ([`use-players-page.ts`](../../apps/web/src/features/players/pages/players-page/use-players-page.ts)).
