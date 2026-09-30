---
paths:
  - "apps/web/**"
---

# Theme (Cryst Design System)

The web app ships a **single theme**: the Cryst design system (Linear-style, shadcn variable names, Tabler icons, dark-first). Its tokens live in `apps/web/src/index.css` under `:root` (light) and `.dark` (dark) — **that file is the source of truth** for the exact variable names and values. There is no scope class and no legacy theme; every `bg-background` / `bg-primary` / `border-border` utility resolves to Cryst tokens everywhere, including Radix portals (Dialog / Popover / Select / Drawer / Sonner render to `document.body`, which inherits `:root` tokens like everything else).

Dark mode is toggled by `next-themes` adding `.dark` on `<html>`.

The tokens went app-wide in SA2-230 (decision (b) of that issue). Screens other than the live session cockpit still carry their pre-Cryst markup and are rebuilt to the Cryst specs screen by screen — see [Cryst migration](#cryst-migration-screen-by-screen) below.

## Token format

**Color tokens are complete color values** (`--primary: #1961d2`, `--selection: rgba(59, 130, 246, 0.18)`), so reference them as `var(--token)` directly — **never** `hsl(var(--token))`, which expands to an invalid `hsl(#…)` and silently falls back to the inherited color (the bug that left the session-list live icon rendering white). For opacity, use Tailwind modifiers (`bg-primary/50`) or `color-mix(in oklab, var(--primary) 14%, transparent)` in arbitrary values.

## Semantic colors

`--success` / `--warning` / `--info` / `--destructive` (and their `-foreground` pairs) are all registered in `@theme inline`, so the first-class utilities work everywhere: `text-success`, `bg-warning`, `border-info`, `text-destructive-foreground`, etc. Semantic colors carry meaning, never decoration. Profit / loss tone comes from `profitLossColorClass` in [`format-profit-loss.ts`](../../apps/web/src/utils/format-profit-loss.ts) (`text-success` / `text-destructive`), not from literal palette classes.

## Design-token contract

Beyond colors, `:root` ships the full Cryst contract:

- **Type scale** `--text-xs` … `--text-3xl` (11 / 13 / 15 / 17 / 21 / 26 / 32px) are the Cryst steps. Cryst's scale ends at `--text-3xl: 2rem`; `--text-4xl` / `--text-5xl` / `--text-6xl` (38 / 48 / 60px, used by `.t-h1` / `.t-display` and a few hero numbers) are **not** Cryst tokens — they only continue the scale monotonically above 3xl (a Cryst screen never needs them). Never let a larger step resolve smaller than the one below it; the first global switch shipped `--text-4xl` at 30px under a 32px `--text-3xl`.
- **Tracking** `--tracking-heading` / `--tracking-body` / `--tracking-caps`. `body` applies `--tracking-body`; the `.t-h*` roles apply `--tracking-heading`.
- **Mobile sizes** `--m-*` (`--m-control` = 44px control height, `--m-list-row`, `--m-inset`, `--m-sheet-radius`, `--m-text-*`). `--h-control-md` resolves to `--m-control`.
- **Shadows** `--shadow-sm` / `--shadow-md` / `--shadow-lg` / `--shadow-popover`. **Write `shadow-[var(--shadow-md)]`, never the bare `shadow-*` utility** — Tailwind compiles `shadow-md` to a literal default shadow (it rewrites the value to inject `--tw-shadow-color` and never reads `var(--shadow-md)`), which is far too weak for Cryst's dark surfaces.
- **Selection / tab tokens** `--selection` (focus glow, text selection) and `--tab-active` (the selected pill on a `muted` track).
- Spacing (`--space-*`, 4px grid), motion (`--dur-*`, `--ease-*`, `--default-transition-duration` = 100ms), and the font stack (`--font-sans` = Noto Sans Variable, `--font-mono` = JetBrains Mono Variable). Cryst specifies Noto Sans JP; the app-wide switch is tracked in SA2-237.

Cryst-only tokens without a registered utility (`--m-*`, `--selection`, `--tab-active`, `--shadow-*`, `--tracking-*`) are referenced as `var(--token)` in arbitrary values.

Typography roles are global classes — `t-display / t-h1 … t-h4 / t-body / t-body-sm / t-meta / t-label / t-code / t-kbd`. Use these for headings and text roles instead of hand-rolling font/size/weight combos.

## Design rules

- Color philosophy: **blue primary** (`#1961d2` light / `#4593f8` dark), warm-gray neutrals, near-black dark surfaces. Never introduce a palette literal (`text-green-600`, `bg-slate-100`) for state — use the semantic tokens.
- **Radius 8px base**; all other radii derive from `--radius`. Sheets use `--m-sheet-radius`.
- **Borders, not shadows**, for structural separation in resting cards. Shadows reserved for floating surfaces (popovers, dialogs).
- **Sentence case** UI copy, no trailing periods on labels, no emoji in product UI.
- **Mobile data entry = bottom sheets** (already enforced by [`web-ui.md`](web-ui.md) — `Drawer`, not `Dialog`).
- **Bottom sheets** — pre-Cryst screens compose `Drawer` / `Dialog` directly, no `ResponsiveDialog`:
  - **Form sheet** (data entry): use the shared [`FormSheet`](../../apps/web/src/shared/components/form-sheet/form-sheet.tsx) component. Sizes to its **content height**, capped at `max-h-[calc(100svh-2rem)]` (`h-auto max-h-[calc(100svh-2rem)]`), so a short form does not sit in a mostly empty full-height sheet; the caller can override through `className` when a form genuinely needs a fixed height. It has a header with title, `[X icon] Title [✓ icon]` toolbar (left = cancel, right = submit), `dismissible={false}` — no drag handle, no swipe-down, no overlay-tap close. The Save button submits the external form via the HTML `form={formId}` attribute, so the form component itself never renders a submit; while `isLoading` it is disabled, carries `aria-busy`, and swaps the checkmark for a spinner.
  - **Action / menu sheet** (non-data-entry): raw `<Drawer>` (default dismissible) + 36×4 drag handle (`mx-auto h-1 w-9 rounded-full bg-muted-foreground/35`) + sr-only `DrawerTitle` / `DrawerDescription` for a11y. **No visible header**, height collapses to content. Closes via swipe-down on the handle or overlay tap. Used for action menus, share sheets, etc.
  - **Hybrid / tabbed picker sheet**: raw `<Drawer>` (default dismissible) + drag handle + **visible** `DrawerTitle` (`t-h4`) + sr-only `DrawerDescription`; any submit buttons live **in the body, per tab** — no toolbar. Use it for tabbed pick-or-create flows and read-only content sheets ([`update-notes-sheet`](../../apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.tsx)). Why: `FormSheet`'s toolbar submits exactly one external form via `form={formId}`, which can't serve two tab forms — and content sheets have nothing to submit but still need a visible title.
  - **Destructive confirmation**: `<Dialog>` (centered modal, not a sheet) with `[Cancel] [Delete]` in `DialogFooter`. Bottom sheets are reserved for entry / picking; one-tap-to-confirm prompts stay in a modal so the affordance is unambiguous.
  - **Cryst screens** use the Cryst composites instead (below): `CrystSheet` for closable-any-time sheets, `CrystFormSheet` for explicit decisions, `CrystConfirmDialog` for destructive confirmation.
- Hover/press: background opacity shift only. No scale/translate on tool surfaces.
- Focus ring: 2px `--ring` (blue) with 2px transparent offset — non-negotiable accessibility primitive. Cryst fields use the `--selection` glow (`shadow-[0_0_0_3px_var(--selection)]`) on focus.

## Design source-of-truth

The token contract in `apps/web/src/index.css` (`:root` / `.dark`) is the source of truth for values. **The Claude Design files are the specification for markup** — read the relevant one before writing any Cryst screen or component. Each migrated screen and component has a `.dc.html` file (`Live Session v3 Table.dc.html` plus per-component `SessionHeader` / `TableView` / `BlindLevelBar` / `ActionBar` / `SeatMarker` / …) carrying the exact structure, spacing, icon, token and state values, including how a component differs between cash game and tournament. Do not derive a screen's layout from the phase before it, from the old screen, or from what looks consistent — P1 and P1′ each had to be rebuilt after being written that way. If the files are not reachable from the working directory, ask for them instead of designing a substitute. Record every deliberate departure (a control the schema cannot yet persist, a state the design does not cover) in the PR description. If a design decision is not expressible via the tokens and rules in this file, raise it for discussion rather than guessing.

## Don'ts

- **Don't fork `shared/components/ui/`** for theming. Components stay single-source; tuning happens via tokens. If a surface needs different markup, raise it for discussion before duplicating.
- **Don't introduce a second theme or a scope class.** If a route needs a one-off accent, scope it to that route with CSS variables.

## Cryst migration (screen by screen)

Tokens are global; markup is migrated one screen at a time, each screen rebuilt from its Claude Design files rather than restyled in place.

- **Migrated**: the live session cockpit, [`features/live-sessions/pages/live-session-page/`](../../apps/web/src/features/live-sessions/pages/live-session-page/) (route `/active-session`). Its exceptions to the design system are recorded in [`docs/design/cryst-exceptions.md`](../../docs/design/cryst-exceptions.md).
- **Next**: Sessions — the sessions list and session detail pages under `features/sessions/pages/` (decided in SA2-230). Ask for their `.dc.html` files before starting.
- **Reusable assets** — all currently live under `live-session-page/` because that was the only consumer. Promote them to `shared/components/cryst/` the moment the second screen imports one ([`web-architecture.md`](web-architecture.md): promotion follows the second consumer); do not copy them:
  - `cryst-controls.ts` — class recipes for Button (`crystButton`), field surfaces (`CRYST_FIELD`, `CRYST_INLINE_FIELD`), Badge, Card, Alert, list row, Tag, pill Tabs, focus ring, scrim.
  - `sheets/cryst-sheet.tsx` (`CrystSheet`, `CrystSheetFrame`), `sheets/cryst-form-sheet.tsx` (`CrystFormSheet`), `sheets/cryst-confirm-dialog.tsx` — the BottomSheet / Dialog composites. **Cryst bottom sheets come in two kinds.** Closable-any-time sheets use `CrystSheet` (grab + centered title, no header actions). Sheets that need an explicit decision use `CrystFormSheet` (`dismissible={false}`, × cancel / ✓ confirm icons) and never have a grab.
  - `segmented-control.tsx`, `radio-card.tsx` (Radix radio groups: arrow keys move and select), `cryst-empty-state/`, `search-picker/`, `player-picker/`.
- **Portals need nothing special.** `Drawer` / `Popover` / `Select` / `Dialog` render into `document.body`, which now inherits the Cryst tokens; the former `CRYST_SCOPE_CLASS` plumbing and its `check-rules` portal check were removed with the scope in SA2-230.
- **Anything the Cryst design system does not describe is an exception**, recorded with its reason in [`docs/design/cryst-exceptions.md`](../../docs/design/cryst-exceptions.md) and never reused as precedent. Add a row there (and to the design system README's Exceptions list) whenever a Cryst screen needs one; a second use means proposing a design-system component instead.
- **Pre-Cryst screens render with Cryst tokens but their old markup.** Two things changed under them when the tokens went global and are accepted until each screen is rebuilt: `--h-control-md` grew from 36px to 44px (every md control), and the type scale steps grew by 1–2px. Do not patch individual screens back — rebuild them from their design files when their phase comes.
