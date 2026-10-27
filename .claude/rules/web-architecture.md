---
paths:
  - "apps/web/**"
---

# Web App Directory Structure

## `apps/web/src/` layout

```text
features/<feature>/
  components/<component>/  shared component judged likely to be reused across pages: <component>.tsx + use-<component>.ts + index.ts
  pages/<page>/            page component + use-<page>-page.ts + index.ts + __tests__ (route file stays thin)
    <subcomponent>/        single-use child of this page → its own folder + index.ts
  hooks/                   cross-component data hooks (use-update-notes-viewed.ts, ...)
  utils/                   feature-local pure helpers
  __tests__/               feature-local tests
routes/                    TanStack Router tree; route files delegate to features/<feature>/pages/<page>
shared/
  components/ui/           shadcn-named Cryst primitives (Button, Badge, Drawer, Dialog, ToggleGroup, ...)
  components/              cross-feature composites (PageHeader, AuthenticatedShell, FormSheet, ...)
  hooks/                   cross-feature hooks (use-media-query, use-online-status, ...)
  lib/                     cross-feature helpers (webauthn, device-name, ...)
lib/                       compatibility helpers shared by app setup and generated integrations
plugins/                   build-time Vite plugins (not browser runtime modules)
utils/                     truly global helpers (optimistic-update, formatters, ...)
```

## Feature conventions

When adding a feature, create `apps/web/src/features/<name>/` and colocate everything. **Every page follows the `pages/<page>/` pattern**: the route file stays thin (TanStack Router configuration such as `createFileRoute`, loaders/search validation, and `Route` accessors) and delegates rendering and page logic to `features/<feature>/pages/<page>/`, colocated with its `use-<page>-page.ts` hook. Extract a subcomponent into a child folder once the parent component file exceeds 300 lines (or earlier when a part is single-use but self-contained); a list component owns its own loading / empty / data switch and binds its skeleton's shape to the card it mirrors; `FormSheet` is composed at the page level around a bare form component.

**Placement follows consumers**: a component used by exactly one page lives in that page's child folders; a component used by exactly one parent component lives in a child folder of that parent (its hook colocates the same way); only components designed as generic building blocks stay in `components/` / `shared/` while they happen to have a single consumer. Promote a subcomponent from a page folder to `components/` when a second page imports it, or when reuse across multiple pages is clearly anticipated, and to `shared/` only when a second feature imports it.

`features/auth/`, `features/settings/` (`pages/settings-page/` with its colocated child folders), and `shared/components/` (`PageHeader`, `AuthenticatedShell`) are the reference implementations.

## Feature dependency DAG

SA2-205 keeps feature dependencies explicit and acyclic to prevent tangled ownership. `scripts/check-rules.ts` declares every feature and its permitted outgoing edges: currently only `settings → update-notes`. To add a feature, declare it in `FEATURE_DEPENDENCIES`; to add an edge, declare it there only if the graph remains acyclic. Imports within a feature are unrestricted. `shared/`, `utils/`, and `lib/` cannot import features, except the `shared/components/authenticated-shell/` composition root. Routes and `main.tsx` compose features freely. `bun run check:rules` enforces these boundaries for alias and relative imports.
