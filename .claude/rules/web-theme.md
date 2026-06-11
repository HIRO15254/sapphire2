---
paths:
  - "apps/web/**"
---

# Theme (Sapphire 2 Design System)

The web app ships a **single theme**: the Sapphire 2 Design System. Its tokens live in `apps/web/src/index.css` under `:root` (light) and `.dark` (dark) — **that file is the source of truth** for the exact variable names and values. There is no scope class and no legacy theme; every `bg-background` / `bg-primary` / `border-border` utility resolves to Sapphire 2 tokens everywhere, including Radix portals (Dialog / Popover / Select / Drawer / Sonner render to `document.body`, which inherits `:root` tokens like everything else).

Dark mode is toggled by `next-themes` adding `.dark` on `<html>`.

## Token format

**All color tokens include the `hsl()` wrapper** (`--primary: hsl(221.2 83.2% 53.3%)`), so reference them as `var(--token)` directly — **never** `hsl(var(--token))`, which expands to the invalid `hsl(hsl(…))` and silently falls back to the inherited color (the bug that left the session-list live icon rendering white). For opacity, use Tailwind modifiers (`bg-primary/50`) or `color-mix(in oklab, var(--primary) 14%, transparent)` in arbitrary values.

## Semantic colors

`--success` / `--warning` / `--info` / `--destructive` (and their `-foreground` pairs) are all registered in `@theme inline`, so the first-class utilities work everywhere: `text-success`, `bg-warning`, `border-info`, `text-destructive-foreground`, etc. Semantic colors carry meaning, never decoration.

## Design-token contract

Beyond colors, `:root` ships the full Sapphire 2 contract: spacing (`--space-*`, 4px grid), control heights (`--h-control-*`, md = 36px), type scale (`--text-*`, dense tool-UI scale, 14px body), motion (`--dur-*` / `--ease-*`), and the font stack (`--font-sans` = Noto Sans Variable, `--font-mono` = JetBrains Mono Variable).

Typography roles are global classes — `t-display / t-h1 … t-h4 / t-body / t-body-sm / t-meta / t-label / t-code / t-kbd`. Use these for headings and text roles instead of hand-rolling font/size/weight combos.

## Design rules

- Color philosophy: **blue-600 primary in light, blue-500 in dark**. Neutrals = slate only.
- **Radius 8px base**; all other radii derive from `--radius`.
- **Borders, not shadows**, for structural separation in resting cards. Shadows reserved for floating surfaces.
- **Sentence case** UI copy, no trailing periods on labels, no emoji in product UI.
- **Mobile data entry = bottom sheets** (already enforced by [`web-ui.md`](web-ui.md) — `Drawer`, not `Dialog`).
- **Bottom sheets come in three modes — compose `Drawer` / `Dialog` directly, no `ResponsiveDialog`:**
  - **Form sheet** (data entry): use the shared [`FormSheet`](apps/web/src/shared/components/form-sheet/form-sheet.tsx) component. Opens **full height** (`h-[calc(100svh-2rem)]`), has a header with title, `[X icon] Title [✓ icon]` toolbar (left = cancel, right = submit), `dismissible={false}` — no drag handle, no swipe-down, no overlay-tap close. The Save button submits the external form via the HTML `form={formId}` attribute, so the form component itself never renders a submit. New entry forms should reach for `FormSheet` first.
  - **Action / menu sheet** (non-data-entry): raw `<Drawer>` (default dismissible) + 36×4 drag handle (`mx-auto h-1 w-9 rounded-full bg-muted-foreground/35`) + sr-only `DrawerTitle` / `DrawerDescription` for a11y. **No visible header**, height collapses to content. Closes via swipe-down on the handle or overlay tap. Used for action menus, share sheets, etc.
  - **Hybrid / tabbed picker sheet**: raw `<Drawer>` (default dismissible) + drag handle + **visible** `DrawerTitle` (`t-h4`) + sr-only `DrawerDescription`; any submit buttons live **in the body, per tab** — no toolbar. Use it for tabbed pick-or-create flows ([`assign-ring-game-dialog`](apps/web/src/features/live-sessions/components/assign-ring-game-dialog/assign-ring-game-dialog.tsx), [`assign-tournament-dialog`](apps/web/src/features/live-sessions/components/assign-tournament-dialog/assign-tournament-dialog.tsx), [`add-player-sheet`](apps/web/src/features/live-sessions/components/add-player-sheet/add-player-sheet.tsx)) and read-only content sheets ([`update-notes-sheet`](apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.tsx)). Why: `FormSheet`'s toolbar submits exactly one external form via `form={formId}`, which can't serve two tab forms — and content sheets have nothing to submit but still need a visible title.
  - **Destructive confirmation**: `<Dialog>` (centered modal, not a sheet) with `[Cancel] [Delete]` in `DialogFooter`. Bottom sheets are reserved for entry / picking; one-tap-to-confirm prompts stay in a modal so the affordance is unambiguous.
- Hover/press: background opacity shift only. No scale/translate on tool surfaces.
- Focus ring: 2px `--ring` (blue) with 2px transparent offset — non-negotiable accessibility primitive.

## Design source-of-truth

The Sapphire 2 Design System handoff bundle drives design decisions (colors, radius, typography scale, motion durations, component composition rules — buttons, alerts, cards, sheets, toasts, etc.). It lives at `/tmp/design/sapphire-2-design-system/sapphire-2-design-system/` when extracted (HTML/CSS/JS prototypes, not production code — recreate visually, do NOT copy markup). The primary references are:

- `project/README.md` — design philosophy, content rules, component composition.
- `project/colors_and_type.css` — token contract; the `:root` / `.dark` blocks in `apps/web/src/index.css` are a faithful subset.
- `project/components.css` — plain-CSS primitives (`.btn`, `.card`, `.sheet`, `.toast`, …); use as reference for sizing and spacing.

## Don'ts

- **Don't fork `shared/components/ui/`** for theming. Components stay single-source; tuning happens via tokens. If a surface needs different markup, raise it for discussion before duplicating.
- **Don't introduce a second theme** or a `theme-*` scope class. If a route needs a one-off accent, scope it to that route with CSS variables.
- **Don't put Japanese into UI copy.** Same rule as [`web-ui.md`](web-ui.md) ("Direct, terse, neutral. Sentence case.").
