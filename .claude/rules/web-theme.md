---
paths:
  - "apps/web/**"
---

# Theme Migration (Legacy ↔ v2 coexistence)

The web app is in a **theme migration period**. Two shadcn/ui themes coexist:

- **Legacy theme** (default): the existing tokens in `apps/web/src/index.css` `:root` / `.dark`. Used by all currently-shipping pages and components.
- **Theme v2** (Sapphire 2 Design System): scope-class theme `theme-v2` defined in the same file, derived from the design handoff bundle. Token-only difference — no component code is forked.

## When to use which

| Situation | Theme |
|---|---|
| Default. Touching an existing page / component that has not been opted in. | Legacy |
| The user explicitly says **"新テーマを使う" / "use the new theme" / "use theme-v2"**. | **v2** |
| Newly created routes / features designed against the v2 handoff (`/tmp/design/sapphire-2-design-system/` while extracted, or the bundle's source-of-truth `colors_and_type.css`). | **v2** |

If unsure, **ask** before opting a subtree in. Mixing both inside the same visible region is a bug — the boundary belongs at a route layout or a clearly separated panel.

## How to opt a subtree into v2

Apply `className="theme-v2"` to the **outermost element of the subtree** you want themed (typically the route's layout `<Outlet>` wrapper). Tokens cascade via CSS variables, so every `bg-background` / `bg-primary` / `border-border` etc. utility inside that subtree resolves to v2 values automatically. No component changes required.

```tsx
// apps/web/src/routes/<v2-route>/route.tsx (example)
export const Route = createFileRoute("/<v2-route>")({
  component: () => (
    <div className="theme-v2 min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  ),
});
```

Dark mode keeps working — `next-themes` toggles `.dark` on `<html>`, and the v2 dark block (`.dark .theme-v2`) takes effect automatically.

### Radix portals

Dialog / Popover / Select / Tooltip / DropdownMenu / Sonner render to `document.body` via portal, **outside** the `.theme-v2` subtree. Inside a v2 region, portal content will fall back to the legacy theme unless explicitly themed. Two options:

1. **Pass `container`** to the Radix `Portal` to keep the content inside the v2 subtree.
2. **Add the `theme-v2` class to the portal root** via `className` prop on shadcn components that accept one for their content (most do).

If a portal-heavy screen is hard to scope, escalate the v2 class to `<html>` on routes that are fully migrated — same trick as `.dark`. Document the route in the PR.

## Tokens v2 adds (not present in legacy)

v2 introduces `--success` / `--warning` / `--info` (and their `-foreground` pairs) inside the `.theme-v2` scope only. Outside the scope these are undefined — use them only inside v2 regions, via arbitrary values:

```tsx
<span className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">…</span>
```

If a v2 component needs these as first-class Tailwind utilities (`bg-success` etc.), extend `@theme inline` in `index.css` **and** add fallback values to `:root` + `.dark` so legacy regions don't break.

## Design source-of-truth

The Sapphire 2 Design System handoff bundle drives v2 decisions (colors, radius, typography scale, motion durations, component composition rules — buttons, alerts, cards, sheets, toasts, etc.). When designing a v2 surface:

- Color philosophy: **blue-600 primary in light, blue-500 in dark**. Neutrals = slate only. Semantic colors carry meaning, never decoration.
- **Radius 8px base** (legacy is 7.2px). All other radii derive from `--radius`.
- **Borders, not shadows**, for structural separation in resting cards. Shadows reserved for floating surfaces.
- **Sentence case** UI copy, no trailing periods on labels, no emoji in product UI.
- **Mobile data entry = bottom sheets** (already enforced by [`web-ui.md`](web-ui.md) — `Drawer`, not `Dialog`).
- Hover/press: background opacity shift only. No scale/translate on tool surfaces.
- Focus ring: 2px `--ring` (blue) with 2px transparent offset — non-negotiable accessibility primitive.

For anything ambiguous (component composition, spacing, typography mapping to `t-*` classes), refer back to the bundle README (`sapphire-2-design-system/project/README.md`) or `colors_and_type.css` / `components.css`.

## Don'ts

- **Don't fork `shared/components/ui/`** for v2. Components stay single-source; only tokens differ. If a v2 surface needs different markup, raise it for discussion before duplicating.
- **Don't apply `theme-v2` to `<html>` globally** while migration is in progress — that effectively flips the default and defeats the gradual rollout.
- **Don't introduce a third theme** ad-hoc. If a route needs a one-off accent, scope it to that route with CSS variables, don't create another `theme-*` class.
- **Don't put Japanese into v2 UI copy.** Same rule as [`web-ui.md`](web-ui.md); v2 doubles down on it ("Direct, terse, neutral. Sentence case.").
