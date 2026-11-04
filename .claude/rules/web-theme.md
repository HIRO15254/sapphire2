---
paths:
  - "apps/web/**"
---

# Theme (Cryst Design System)

The web app ships a **single theme**: the Cryst design system. Its tokens live in `apps/web/src/index.css` under `:root` (light) and `.dark` (dark) — **that file is the source of truth** for the exact variable names and values. There is no scope class and no legacy theme; every `bg-background` / `bg-primary` / `border-border` utility resolves to Cryst tokens everywhere, including Radix portals (Dialog / Drawer / Sonner render to `document.body`, which inherits `:root` like everything else). Do not add a second theme or a scope class (SA2-421 removed the temporary `.cryst` migration scope).

Dark mode is toggled by `next-themes` adding `.dark` on `<html>`.

## Design source-of-truth

**The Claude Design files are the specification — read the relevant one before writing any markup.** Each screen and component has a `.dc.html` board carrying the exact structure, spacing, icon, token and state values. Do not derive a screen's layout from the phase before it, from the old screen, or from what looks consistent — P1 and P1′ each had to be rebuilt after being written that way. If the files are not reachable, ask for them instead of designing a substitute. Record every deliberate departure (a control the schema cannot yet persist, a state the design does not cover) in the Linear issue.

**Anything the Cryst design system does not describe is an exception**, recorded with its reason in [`docs/design/cryst-exceptions.md`](../../docs/design/cryst-exceptions.md) and never reused as precedent. A second use means proposing a design-system component instead.

## Tokens

- **Names are shadcn's.** shadcn names are canonical and Cryst-only roles are extensions of them: `accent` is the hover layer (not the brand — that is `primary`), and `muted` / `secondary` / `accent` are translucent fills. The extensions are registered in `@theme inline`, so use their utilities, never `[var(--…)]` arbitrary values: `primary-hover` / `-text` / `-soft`, `destructive-` / `success-` / `warning-` + `hover` / `text` / `soft`, `accent-pressed`, `border-subtle`, `subtle-foreground`, `overlay`, `switch-thumb`, `positive`, `negative` (e.g. `text-primary-text`, `bg-primary-soft`, `text-success-text`). Colored text on a surface uses the `-text` role, never the fill. There is no `info` role: an info status uses `primary-text` / `primary-soft`.
- **Format.** Color tokens hold complete values (hex / rgba), so reference them as `var(--token)` — **never** `hsl(var(--token))`, which is invalid and silently falls back to the inherited color. For opacity use Tailwind modifiers (`bg-primary/50`) or `color-mix(in oklab, var(--primary) 14%, transparent)`.
- **Tokens without utilities** (`--m-*`, `--control-*`, `--shadow-*`, `--tracking-*`, `--duration-*`) are referenced as `var(--token)` in arbitrary values: `h-[var(--m-control)]`, `text-[length:var(--m-text-title)]`, `tracking-[var(--tracking-caps)]`.
- **Shadows: write `shadow-[var(--shadow-md)]`, never a bare `shadow-*` utility.** Tailwind rewrites shadow values to inject `--tw-shadow-color`, so `shadow-md` compiles to Tailwind's literal default and never reads `var(--shadow-md)`.
- **Type scale.** `--text-xs` … `--text-3xl` hold Cryst's desktop scale (11–32px); phones use the `--m-text-*` roles (`m-text-title` 16px, `m-text-body` 15px, `m-text-secondary` 14px, `m-text-footnote` 12px, …). There are no global typography classes; compose the role from the board (`font-semibold text-[length:var(--m-text-title)] tracking-[var(--tracking-heading)]`).
- **Fonts.** `--font-sans` = Noto Sans JP Variable, `--font-mono` = JetBrains Mono Variable (IDs, versions, timestamps, figures). The sans face is self-hosted with unicode-range subsets and `font-display: swap`; loaded subsets are runtime-cached rather than precached to avoid downloading every Japanese glyph at installation (SA2-237).

## Design rules

- **Mobile only.** The UI builds no desktop layout (user decision recorded in SA2-390): screens add no `md:` / `lg:` layout variants, and from 768px the authenticated shell shows only the "Use on your phone" blocker. Phones use the `xl` size of every control (40px, `--m-control`) and a 14px inset (`px-3.5`).
- **State layers.** Hover and press lay `accent` / `accent-pressed` over the element's own background with `hover:layer-accent active:layer-accent-pressed`; fills (`primary`, `destructive`) switch to their `-hover` instead. No scale/translate, no brightness filters.
- **Focus.** Buttons: 2px `ring` offset by 2px of background. Fields: the border turns `ring` (or `destructive` when invalid) and thickens to 2px.
- **Surfaces** are flat: `background` (page), `card` (fields, groups), `popover` (Drawer, Dialog, Toast). Borders do the structural work; shadows only on things that lift.
- **The primitives are `shared/components/ui/`** with the DS names and props: `Button`, `IconButton` (required `label`), `Input`, `Field` (+ `FieldSeparator`), `Alert`, `Badge`, `Spinner`, `ToggleGroup`, `Item` / `ItemGroup` (`variant="inset"`, `size="xl"`), `Empty`, `Drawer` (+ `DrawerGrab` / `DrawerHeader` / `DrawerBody`), `Dialog` (+ `DialogBody`), `Toast` (in `ui/sonner`). Re-add a DS component from the design system when a screen needs one; do not keep unused ones.
- **Sheets** (mobile containers):
  - **Explicit** (a form saved as a whole): the shared [`FormSheet`](../../apps/web/src/shared/components/form-sheet/form-sheet.tsx) — `dismissible={false}`, no grab, `[× Cancel] Title [✓ confirmLabel]` header; the ✓ submits the external form via `form={formId}`, and while `isLoading` it is disabled, carries `aria-busy`, and shows a spinner.
  - **Dismissible** (menus, pickers, read-only panels): raw `<Drawer>` + `DrawerGrab` + `DrawerHeader` with a visible `DrawerTitle` + `DrawerBody`. Action sheets hold inset `ItemGroup`s stacked 8px apart, destructive actions last in their own group, then a full-width secondary `Cancel` button.
  - **Destructive confirmation**: `<Dialog>` with `[Cancel] [Delete]` in `DialogFooter` — the one centered modal on mobile.
- **Copy**: sentence case, no exclamation marks, no emoji.
