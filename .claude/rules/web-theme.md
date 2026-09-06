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

- Color philosophy: **blue-600 primary in light, blue-500 in dark**. Neutrals = Tailwind **gray** scale only (no slate — neutrals must not read as bluish; SA2-71).
- **Radius 8px base**; all other radii derive from `--radius`.
- **Borders, not shadows**, for structural separation in resting cards. Shadows reserved for floating surfaces.
- **Sentence case** UI copy, no trailing periods on labels, no emoji in product UI.
- **Mobile data entry = bottom sheets** (already enforced by [`web-ui.md`](web-ui.md) — `Drawer`, not `Dialog`).
- **Bottom sheets come in three modes — compose `Drawer` / `Dialog` directly, no `ResponsiveDialog`:**
  - **Form sheet** (data entry): use the shared [`FormSheet`](../../apps/web/src/shared/components/form-sheet/form-sheet.tsx) component. Opens **full height** (`h-[calc(100svh-2rem)]`) unless the caller overrides it through `className` — pass `h-auto max-h-[calc(100svh-2rem)]` for a short form that would otherwise sit in a mostly empty sheet. It has a header with title, `[X icon] Title [✓ icon]` toolbar (left = cancel, right = submit), `dismissible={false}` — no drag handle, no swipe-down, no overlay-tap close. The Save button submits the external form via the HTML `form={formId}` attribute, so the form component itself never renders a submit; while `isLoading` it is disabled, carries `aria-busy`, and swaps the checkmark for a spinner. New entry forms should reach for `FormSheet` first.
  - **Action / menu sheet** (non-data-entry): raw `<Drawer>` (default dismissible) + 36×4 drag handle (`mx-auto h-1 w-9 rounded-full bg-muted-foreground/35`) + sr-only `DrawerTitle` / `DrawerDescription` for a11y. **No visible header**, height collapses to content. Closes via swipe-down on the handle or overlay tap. Used for action menus, share sheets, etc.
  - **Hybrid / tabbed picker sheet**: raw `<Drawer>` (default dismissible) + drag handle + **visible** `DrawerTitle` (`t-h4`) + sr-only `DrawerDescription`; any submit buttons live **in the body, per tab** — no toolbar. Use it for tabbed pick-or-create flows ([`assign-ring-game-dialog`](../../apps/web/src/features/live-sessions/components/assign-ring-game-dialog/assign-ring-game-dialog.tsx), [`assign-tournament-dialog`](../../apps/web/src/features/live-sessions/components/assign-tournament-dialog/assign-tournament-dialog.tsx)) and read-only content sheets ([`update-notes-sheet`](../../apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.tsx)). Why: `FormSheet`'s toolbar submits exactly one external form via `form={formId}`, which can't serve two tab forms — and content sheets have nothing to submit but still need a visible title.
  - **Destructive confirmation**: `<Dialog>` (centered modal, not a sheet) with `[Cancel] [Delete]` in `DialogFooter`. Bottom sheets are reserved for entry / picking; one-tap-to-confirm prompts stay in a modal so the affordance is unambiguous.
- Hover/press: background opacity shift only. No scale/translate on tool surfaces.
- Focus ring: 2px `--ring` (blue) with 2px transparent offset — non-negotiable accessibility primitive.

## Design source-of-truth

The token contract in `apps/web/src/index.css` (`:root` / `.dark`) is the source of truth. The original Sapphire 2 Design System handoff bundle lives outside this repository; if a design decision is not expressible via the tokens and rules in this file, raise it for discussion rather than guessing from memory of the bundle.

## Don'ts

- **Don't fork `shared/components/ui/`** for theming. Components stay single-source; tuning happens via tokens. If a surface needs different markup, raise it for discussion before duplicating.
- **Don't introduce a second theme** or a scope class beyond the `.cryst` migration scope below. If a route needs a one-off accent, scope it to that route with CSS variables.

## Cryst migration scope (TEMPORARY)

The app is migrating to the Cryst design system one screen at a time. During the migration a **single** extra scope is allowed:

- The class is `cryst`, exported as `CRYST_SCOPE_CLASS` from [`live-session-page/cryst-scope.ts`](../../apps/web/src/features/live-sessions/pages/live-session-page/cryst-scope.ts). Its values live in [`apps/web/src/cryst-tokens.css`](../../apps/web/src/cryst-tokens.css) (`.cryst` = light, `.dark .cryst` = dark), imported from `index.css`.
- **What the scope reaches.** `@theme inline` emits utilities with the declared value inlined, so `bg-background` compiles to `background-color: var(--background)` and resolves per element. Colors, `--radius`, and the `--text-*` scale are therefore scopable. Two families are **not**:
  - **Fonts** — `--font-sans` / `--font-mono` are declared as literal stacks, so `font-sans` inlines the literal. Harmless only because Sapphire 2 and Cryst use the same faces.
  - **Shadows** — `shadow-md` compiles to `--tw-shadow: 0 4px 6px -1px var(--tw-shadow-color,#0000001a), …`, a literal, because Tailwind rewrites the value to inject `--tw-shadow-color`. It never reads `var(--shadow-md)`. **In the Cryst tree write `shadow-[var(--shadow-md)]`, never the bare `shadow-*` utility** — the bare one silently renders Tailwind's default shadow, which is far too weak for Cryst's dark surfaces.
- **Portals escape the scope.** `Drawer` / `Popover` / `Select` / `Dialog` render into `document.body`, outside the wrapper. Every such surface opened by a Cryst screen must carry `CRYST_SCOPE_CLASS` on its content element; `cn()` merges it, so never fork `shared/components/ui/`. The Cryst tree does this in one place: [`live-session-page/sheets/`](../../apps/web/src/features/live-sessions/pages/live-session-page/sheets/) wraps each portal primitive (`CrystFormSheet`, …) and is the only file group there allowed to import one directly — `scripts/check-rules.ts` enforces it, so a forgotten scope class fails the Stop hook rather than shipping an unthemed sheet.
- **Three typography classes are unusable in the Cryst tree.** The scope overrides `--text-xs` … `--text-3xl` only, because Cryst's type scale ends at `--text-3xl: 2rem`. `.t-display` (`--text-5xl`), `.t-h1` (`--text-4xl`) and `.t-kbd` (`--text-2xs`) therefore fall back to Sapphire 2 sizes inside `.cryst`. Do not use them there, and do not invent Cryst values for those steps.
- Cryst-only tokens (`--m-*`, `--selection`, `--shadow-popover`, `--tracking-*`) have no utilities — reference them as `var(--token)` in arbitrary values. `--shadow-popover` composes `var(--border)`, which *is* scoped, so it resolves correctly inside `.cryst`.
- `profitLossColorClass` in `apps/web/src/utils/format-profit-loss.ts` returns literal palette classes that do not respond to this scope. Cryst screens use their own token-based mapping; this duplication is deliberate and ends with the scope.

**Deletion condition.** When `routes/active-session.tsx` renders the Cryst page and `features/live-sessions/components/active-session-scene/` no longer exists, move the Cryst values into `:root` / `.dark`, delete `cryst-tokens.css` and `cryst-scope.ts`, and delete this section (AGENTS.md maintenance rule 5: delete a rule that is no longer true, do not comment it out).
