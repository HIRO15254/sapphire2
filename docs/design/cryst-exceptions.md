# Cryst Exceptions

The Cryst design system is the whole vocabulary for the app's screens. A screen that needs something the system does not describe builds it as an **exception**: local to that screen, recorded here with its reason, and never a precedent for another screen. If a second screen needs the same thing, propose it to the design system as a component instead of copying it. The design system's README lists the same exceptions under "Exceptions" and points here for the reasons.

The Cryst tokens are the app's only theme (`apps/web/src/index.css`, rules in [`.claude/rules/web-theme.md`](../../.claude/rules/web-theme.md)). Screens re-add design-system components when they need them.

| Screen | Exception | Reason |
|---|---|---|
| Login (`features/auth/pages/login-page`) | The content column is capped at 440px and centered. | The login page sits outside the authenticated shell, so it has no "Use on your phone" blocker: MCP OAuth sends desktop browsers here (`/login?client_id=…`). The phone-only board would otherwise stretch its full-width buttons and fields across a desktop window. |
| Authenticated shell (`shared/components/authenticated-shell/online-status-bar`) | A 24px full-width connection bar above the page: offline in `warning-soft`, syncing in `primary-soft`, back online in `success-soft`, each with its `-text` role. | The design system has no connection-status component and the U01 boards show none, but the persisted-cache PWA needs to tell the user that writes are queued while offline. Built from status tokens only. |
| MCP OAuth consent (`packages/mcp/src/auth/consent-html.ts`) | Server-rendered HTML with a copied subset of the Cryst tokens; light/dark follows `prefers-color-scheme`; no web fonts (system faces after Noto Sans JP / JetBrains Mono); the 440px login column. No board exists for it. | The Worker renders the page outside the web app, so it cannot read the user's theme setting (stored by the web app) or load the bundled fonts and CSS. It reuses the login layout so the sign-in → consent hand-off looks like one flow. |

## Removing an exception

When the system gains a component for an exception, or the screen stops needing it, delete the row here and the matching line in the design system's README in the same change.
