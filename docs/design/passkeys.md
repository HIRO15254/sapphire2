# Passkeys (WebAuthn)

Passkey sign-in is provided by better-auth's `passkey()` plugin
([`@better-auth/passkey`](https://www.npmjs.com/package/@better-auth/passkey)), wired in
[`packages/auth/src/index.ts`](../../packages/auth/src/index.ts) and configured from
[`apps/server/src/auth-options.ts`](../../apps/server/src/auth-options.ts). It is an
*additional* login method: email/password and the Google / Discord providers are untouched.

## The relying party is the web app, not the Worker

The WebAuthn ceremony runs in the browser, on the **web** origin (`CORS_ORIGIN`), while
better-auth runs on the Worker (`BETTER_AUTH_URL`). These are different origins, so the
relying-party settings must be pinned explicitly:

- `rpID` — the web app's hostname. The plugin's own default is
  `new URL(baseURL).hostname`, which resolves to the **Worker's** hostname; leaving it
  unset makes every ceremony fail on a mismatched RP ID.
- `origin` — the web app's absolute origin. Left unset, the plugin falls back to the
  request's `Origin` header, which the caller supplies: any origin able to reach the
  Worker could then complete a ceremony.

Both are derived from `CORS_ORIGIN` by `resolvePasskeyRp` in `auth-options.ts`, so no new
environment variable exists to be forgotten. The derivation lives beside `buildAuthOptions`
rather than in `packages/auth` so that mocking `@sapphire2/auth` in a Worker test does not
have to stub it. A passkey is bound to `rpID`, so passkeys registered against a
preview deployment do not work in production, and moving the web app to a new domain
invalidates every stored passkey.

The challenge cookie rides on the existing `advanced.defaultCookieAttributes`
(`sameSite: "none"`, `secure`, `httpOnly`), which is what lets the split-origin flow work
at all.

## `residentKey: "required"`

Sign-in is usernameless — the login page's passkey button has no email field, so
better-auth asks the browser for any *discoverable* credential registered for the site.
The plugin's `"preferred"` default would let an authenticator store a non-discoverable
credential that the login page could never subsequently offer, so registration requires a
resident key.

## The `passkey` table

[`packages/db/src/schema/passkey.ts`](../../packages/db/src/schema/passkey.ts) mirrors the
plugin's schema definition. better-auth reads and writes it through the Drizzle adapter by
**JS property name**, so the property names (`credentialID`, `publicKey`, `backedUp`, …)
are the contract — the snake_case column names are ours to choose.

`credentialID` carries a UNIQUE index on top of the plugin's plain index. Authentication
resolves a credential with a single `findOne({ credentialID })`, so a duplicate would make
*which account you land in* non-deterministic. Two accounts cannot legitimately share one
credential: an authenticator mints a new credential per (relying party, user handle) pair.

Ownership of a passkey row is enforced by the plugin: `deletePasskey` and `updatePasskey`
both run `requireResourceOwnership`, so the client may pass an id freely.

## Automatic registration ("passkey upgrade")

After a successful password sign-in or sign-up,
[`offerAutomaticPasskey`](../../apps/web/src/features/auth/utils/auto-register-passkey.ts)
silently stores a passkey next to the password the user just used.

**Feature detection is mandatory, not an optimization.** The mechanism is
`navigator.credentials.create()` under `mediation: "conditional"`. `mediation` is an
unknown member of `CredentialCreationOptions` on browsers that predate conditional create,
and WebIDL tells them to *ignore* it — so the identical call that is silent on a capable
browser pops the full modal create prompt on an incapable one. Upgrading blind would
interrupt every password login on exactly the browsers that cannot do it quietly. The
guard is `PublicKeyCredential.getClientCapabilities()` reporting `conditionalCreate`
(`supportsAutomaticPasskeyRegistration` in
[`shared/lib/webauthn.ts`](../../apps/web/src/shared/lib/webauthn.ts)).

What makes the upgrade *per-device* rather than per-account is the server sending the
account's existing credentials as `excludeCredentials`: a device that already holds a
passkey for this account is declined by the browser, a new device gets one. No client-side
"does this device have one" check exists, or could be trusted.

Every failure is swallowed — no password-manager entry, credential already present, user
policy, cancelled ceremony. The user did not ask for this and has already signed in, so a
failure has no honest error to report. Only a stored passkey is announced. The call is
fire-and-forget (both call sites navigate client-side, so the promise outlives the login
page) which is why `autoRegisterPasskey` guards its whole body and can never reject.

### Removing a passkey opts this browser out

`excludeCredentials` is what keeps the upgrade per-device, but it also means that the
moment a user deletes a passkey, the row is gone and the exclusion goes with it — the very
next password sign-in would silently recreate it, and the only trace would be a
"Passkey saved for this device" toast. Deleting a credential and having it come back
unexplained is not an acceptable outcome for a login method, so a successful delete writes
an opt-out flag to `localStorage`
([`shared/lib/passkey-opt-out.ts`](../../apps/web/src/shared/lib/passkey-opt-out.ts)) which
`autoRegisterPasskey` checks first. Adding a passkey manually from settings clears it: that
is the user opting back in.

The flag is scoped to the browser that performed the delete, and to nothing finer. It is
deliberately blunt, and the two consequences are known:

- Deleting **another** device's entry from this browser also opts this browser out. The
  list shows every device, so the deleted credential need not be the local one — but
  nothing client-side can tell which row corresponds to the credential in this browser's
  password manager (names are user-editable, and the server never reveals the mapping).
  Erring toward "do not silently re-create" is the safer side for a credential; the user
  can opt back in from the same screen.
- The flag is per-browser, not per-account, so on a shared browser profile one user's
  delete also stops the other's silent upgrade. Manual add still works for both.

Every access is wrapped in try/catch: `localStorage` throws outright in some privacy modes,
and the fallback is simply that the upgrade stays enabled.

A dismissed browser prompt is not an error either. better-auth returns cancellation as
`{ error: { code } }` rather than throwing — `AUTH_CANCELLED` for sign-in,
`ERROR_CEREMONY_ABORTED` for registration — so without `isCancelledCeremony` the user gets
an error toast for simply pressing Escape, which is not how the social providers behave.
That helper matches on `name` as well as `code`, because a raw `DOMException`
(`NotAllowedError`, `AbortError`) carries its identity in `name`; `DOMException.code` is a
legacy *number* and never matches a string.

The registration path needs one more code. A dismissed prompt raises `NotAllowedError`,
which `@simplewebauthn/browser` deliberately passes through as
`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY` — its stated reason is that platforms overload this
error well beyond what the spec defines, so it keeps the original message rather than
overwriting something potentially useful. (That matters for the limitation below: the
detail is *there*, in `cause`, and would be usable if better-auth stopped discarding it.)
better-auth forwards that code verbatim. `ERROR_CEREMONY_ABORTED` is reserved for an `AbortSignal` abort and does
*not* cover the user closing the sheet. Following `error.cause` down to the original
`DOMException` does not help: better-auth rebuilds the error as a plain
`{ code, message, status, statusText }` object and drops `cause` entirely.

Sign-in needs no such care, for a blunter reason: better-auth funnels **every**
`startAuthentication` throw into `AUTH_CANCELLED`. The flip side is that the sign-in button
is silent on real breakage too — a wrong `rpID`, a non-secure context, a timeout. That is
precisely the failure this document opens by warning about, and it presents to the user as
a button that does nothing at all. The one breadcrumb is that better-auth `console.error`s
the underlying error ("[Better Auth] Error verifying passkey") before collapsing it, so the
real cause is visible in devtools even though the UI stays quiet.

That code is broader than "the user closed the prompt", and the cost is accepted rather
than solved: SimpleWebAuthn stamps it on **every** `NotAllowedError`, so a timeout (easy to
hit on mobile), a `publickey-credentials-create` permissions-policy denial, and the
already-registered case on authenticators that report `NotAllowedError` instead of
`InvalidStateError` all land here and are swallowed silently — leaving the add sheet open
with no feedback. The alternative is a toast every time someone presses Escape, which is
worse and is what the social providers already avoid. Consequently the
"This device already has a passkey" message below only appears on platforms that raise
`InvalidStateError` (Chrome's platform authenticator does; a security key may not).

`ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED` is the one failure worth rewording rather than
silencing: on a device that already holds a passkey, `excludeCredentials` makes "Add
passkey" fail by design, and the plugin's own "Previously registered" says nothing about
what to do. The screen is still the way to register a *different* device over
cross-device QR, so the button stays.

Ceremonies are also guarded against a second press: WebAuthn aborts an in-flight request
when a new one starts, so a double-click would cancel the user's own prompt and surface a
`NotAllowedError`. The sign-in button, the add form and the rename/delete handlers each
refuse re-entry while one is in flight.

The upgrade is **skipped on the MCP OAuth branch**, where `location.assign` tears the
document down and would abort the ceremony mid-flight. See
[`mcp-and-oauth.md`](mcp-and-oauth.md#web-login-continuation).

## Naming

Nobody is present to name an automatically created passkey, so both the automatic path and
the "Add passkey" form default to a device label from
[`shared/lib/device-name.ts`](../../apps/web/src/shared/lib/device-name.ts) ("Chrome on
macOS"). In the form this is a `defaultValue`, not a placeholder — accepted or overwritten,
the passkey ends up with a real name either way (placeholders are banned by
[`web-forms.md`](../../.claude/rules/web-forms.md)).

The detection tables are ordered most-specific-first because browsers impersonate each
other: Edge, Opera and Samsung Internet all carry `Chrome/`, Chrome carries `Safari/`,
Android carries `Linux`, and ChromeOS carries `X11`. iPadOS 13+ Safari requests desktop
sites by default and reports itself as `Macintosh`, so a `macOS` match with
`navigator.maxTouchPoints > 1` is resolved to `iPad` — otherwise every iPad, a primary
passkey device, would be labelled "Safari on macOS". `navigator.userAgentData.platform` is
consulted only when the user-agent string yields no platform — it is absent outside
Chromium and coarser where it exists (`iOS` rather than `iPhone`). User-agent sniffing has
no correct answer, so an unrecognized agent falls back to the vague-but-true
`"This device"` rather than a confidently wrong label. Settings offers a rename for
whenever the guess reads wrong.

## Settings

[`features/settings/pages/settings-page/passkeys/`](../../apps/web/src/features/settings/pages/settings-page/passkeys/)
lists, adds, renames and removes passkeys. The rename sheet reuses the shared
[`TagNameForm`](../../apps/web/src/shared/components/management/tag-name-form/tag-name-form.tsx),
which is why the add form's name bound is 50 characters too — two name fields that
disagreed about what is accepted would be a bug waiting to happen. The sheet is keyed on
the passkey id so opening it for a different entry remounts the form: `defaultName` seeds
only the initial render, so a reused instance would keep showing the previous name.

Removal goes through a confirmation `Dialog` (`[Cancel] [Remove]`), per the
destructive-confirmation rule in [`web-theme.md`](../../.claude/rules/web-theme.md). It is
not merely convention here: deleting a passkey cannot be undone, and the credential is left
behind on the authenticator, where the user has to clear it themselves.

Affordances are hidden, not shown-and-broken, where `PublicKeyCredential` is absent
(`isPasskeySupported`).

The list is populated from `listUserPasskeys`, whose failures do **not** throw: better-auth
resolves with `{ data: null, error }` unless `throw: true` is passed. Reading only `data`
would render a 401 or a 500 as "No passkeys yet", telling a user who has passkeys that they
have none — so the error branch is keyed off `result.error`, not off a thrown exception
(the `catch` only ever sees a network-level rejection).

Because that branch is now genuinely reachable, the failure state has to be recoverable:
the error replaces the *list* only, keeping "Add passkey" available and offering `Retry`
(`refreshPasskeys`). Replacing the whole section instead would strand a user on an expired
session with no way out short of reloading the page.

`refreshPasskeys` is sequence-guarded rather than re-entry-guarded. Two refreshes can
legitimately overlap (a `Retry` press while the refresh that follows a delete is still in
flight), and only the newest **issued** one may write state — otherwise a slow failure
landing after a fast success repaints the error over a good list. A plain "ignore while
busy" guard would instead drop the refresh that `onDeletePasskey` / `onRenamePasskey`
await, leaving the list stale after a successful write.

## Version coupling

`@better-auth/passkey` is pinned to the exact `better-auth` version in the workspace
catalog, not a caret range. Its peer dependencies name exact versions of `better-auth`,
`better-call`, `@better-auth/utils` and `@better-fetch/fetch`, so a floating range resolves
to a newer patch whose peers no longer match the pinned `better-auth`. Bump both together.
