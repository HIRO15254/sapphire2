---
paths:
  - "apps/web/**"
---

# Theme (Sapphire 2 → Cryst migration)

## Migration state

The app is migrating from the **Sapphire 2 Design System** (default) to the **Cryst Design System** (Linear-inspired, dark-first, same shadcn token names). During the migration two themes coexist, replaying the proven `.theme-v2` playbook (add scope `f90b960b` → per-page migration → flip `d7ed81bd`):

- **Sapphire 2 is the default**: `:root` (light) / `.dark` (dark) in `apps/web/src/index.css`. Un-migrated screens must stay pixel-identical.
- **Cryst applies only inside the `.theme-cryst` scope class** — always referenced via `CRYST_SCOPE` from [`apps/web/src/shared/lib/theme.ts`](../../apps/web/src/shared/lib/theme.ts), never as a raw string literal (enforced by `scripts/check-rules.ts`). Apply it at the **page root**, never on the shell/nav.
- **Token placement rule**: a token name that already exists in `:root` (colors, `--text-*`, `--font-sans`, `--ease-*`) gets its Cryst value inside the `.theme-cryst` block; a brand-new non-colliding name (`--m-*`, `--tracking-*`, `--control-*`, `--tap-target`, `--duration-*`, `--shadow-soft-*`, `--shadow-popover`, `--border-hairline`) lives in `:root` and is inert for old screens. Cryst's `--shadow-sm/md/lg` are renamed `--shadow-soft-sm/md/lg` here because Tailwind's `shadow-*` utilities inline their own values — reference them as `shadow-(--shadow-soft-md)` arbitrary values or `var(--shadow-soft-md)`.
- **Portals**: Drawer/Dialog/Popover content renders into `document.body`, outside any page-level scope. Migrated screens' sheets must go through the shared [`BottomSheet`](../../apps/web/src/shared/components/bottom-sheet/bottom-sheet.tsx) (which bakes `CRYST_SCOPE` into its `DrawerContent`), and any `DialogContent`/`PopoverContent` opened from a migrated screen must receive `className={CRYST_SCOPE}` at the call site. When reviewing a migrated screen, open every sheet/dialog and check it is Cryst-styled.
- **Cryst sheet pattern**: `BottomSheet` = drag handle, centered title, cancel text button top-left / confirm text button top-right (44px tap targets), 12px top corners (`--m-sheet-radius`), confirm submits via `form={formId}` or `onConfirm`. Legacy `FormSheet` stays for un-migrated screens; do not use it on Cryst screens.
- **Accepted drift until the flip**: the global Sonner toaster and `pwa-manifest.ts` `theme_color` stay Sapphire-styled. Do not scope them mid-migration.
- The final flip (backlog): collapse `.theme-cryst` into `:root`/`.dark`, delete `CRYST_SCOPE`, restyle shell/nav/sonner, update `theme_color` to `#08090a`, restore the single-theme wording here.

Dark mode is toggled by `next-themes` adding `.dark` on `<html>`; the Cryst dark values live under `.dark .theme-cryst, .theme-cryst.dark`.

The Cryst source of truth is the Claude Design project "cryst-design-system" (tokens: `colors/typography/spacing/mobile/effects/motion`); its values are mirrored into `index.css`.

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
  - **Form sheet** (data entry): use the shared [`FormSheet`](../../apps/web/src/shared/components/form-sheet/form-sheet.tsx) component. Opens **full height** (`h-[calc(100svh-2rem)]`), has a header with title, `[X icon] Title [✓ icon]` toolbar (left = cancel, right = submit), `dismissible={false}` — no drag handle, no swipe-down, no overlay-tap close. The Save button submits the external form via the HTML `form={formId}` attribute, so the form component itself never renders a submit. New entry forms should reach for `FormSheet` first.
  - **Action / menu sheet** (non-data-entry): raw `<Drawer>` (default dismissible) + 36×4 drag handle (`mx-auto h-1 w-9 rounded-full bg-muted-foreground/35`) + sr-only `DrawerTitle` / `DrawerDescription` for a11y. **No visible header**, height collapses to content. Closes via swipe-down on the handle or overlay tap. Used for action menus, share sheets, etc.
  - **Hybrid / tabbed picker sheet**: raw `<Drawer>` (default dismissible) + drag handle + **visible** `DrawerTitle` (`t-h4`) + sr-only `DrawerDescription`; any submit buttons live **in the body, per tab** — no toolbar. Use it for tabbed pick-or-create flows ([`assign-ring-game-dialog`](../../apps/web/src/features/live-sessions/components/assign-ring-game-dialog/assign-ring-game-dialog.tsx), [`assign-tournament-dialog`](../../apps/web/src/features/live-sessions/components/assign-tournament-dialog/assign-tournament-dialog.tsx)) and read-only content sheets ([`update-notes-sheet`](../../apps/web/src/features/update-notes/components/update-notes-sheet/update-notes-sheet.tsx)). Why: `FormSheet`'s toolbar submits exactly one external form via `form={formId}`, which can't serve two tab forms — and content sheets have nothing to submit but still need a visible title.
  - **Destructive confirmation**: `<Dialog>` (centered modal, not a sheet) with `[Cancel] [Delete]` in `DialogFooter`. Bottom sheets are reserved for entry / picking; one-tap-to-confirm prompts stay in a modal so the affordance is unambiguous.
- Hover/press: background opacity shift only. No scale/translate on tool surfaces.
- Focus ring: 2px `--ring` (blue) with 2px transparent offset — non-negotiable accessibility primitive.

## Design source-of-truth

The token contract in `apps/web/src/index.css` (`:root` / `.dark`) is the source of truth. The original Sapphire 2 Design System handoff bundle lives outside this repository; if a design decision is not expressible via the tokens and rules in this file, raise it for discussion rather than guessing from memory of the bundle.

## Don'ts

- **Don't fork `shared/components/ui/`** for theming. Components stay single-source; tuning happens via tokens. If a surface needs different markup, raise it for discussion before duplicating.
- **Don't introduce a third theme** or any scope class beyond `.theme-cryst`. The Cryst scope is temporary migration scaffolding tracked for the final flip; a route needing a one-off accent scopes CSS variables to that route instead.
