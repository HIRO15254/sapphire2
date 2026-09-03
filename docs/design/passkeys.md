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
Android carries `Linux`, and ChromeOS carries `X11`. `navigator.userAgentData.platform` is
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

Affordances are hidden, not shown-and-broken, where `PublicKeyCredential` is absent
(`isPasskeySupported`).

## Version coupling

`@better-auth/passkey` is pinned to the exact `better-auth` version in the workspace
catalog, not a caret range. Its peer dependencies name exact versions of `better-auth`,
`better-call`, `@better-auth/utils` and `@better-fetch/fetch`, so a floating range resolves
to a newer patch whose peers no longer match the pinned `better-auth`. Bump both together.
