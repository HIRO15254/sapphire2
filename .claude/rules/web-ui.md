---
paths:
  - "apps/web/**"
---

# Web UI Conventions

## Page scaffolding

Every top-level page composes its header with [`PageHeader`](../../apps/web/src/shared/components/page-header/page-header.tsx) (`heading`, optional `back`, `meta` and `actions`). Do not hand-roll page titles or action rows.

## Use the Cryst primitives

Reach for the components in `shared/components/ui/` before building a custom wrapper; when a screen needs one that is missing, re-add it from the design system (see [`web-theme.md`](web-theme.md)):

- Status pills, counts → `Badge`.
- Two to four one-word choices that set a saved value (theme, enum pickers) → `ToggleGroup` (`type="single"`; ignore the empty value Radix emits when the selected item is pressed again). Longer labeled lists → a `RadioGroup` re-added from the design system.

## Language

UI copy is **English-only**. Do not put Japanese into user-facing strings (labels, empty states, toasts, errors). Japanese is fine in commit messages and PR descriptions; code comments are near-zero and English-only — see [`comments.md`](comments.md).

## Platform

Mobile data entry happens in bottom sheets — `Drawer` / `FormSheet`, not `Dialog`; `Dialog` is only for destructive confirmation. The sheet patterns are in [`web-theme.md`](web-theme.md).

## Icons

- **Fixed UI icons** (buttons, navigation, empty states, anything chosen in code) use `@tabler/icons-react` components. Do not add `lucide-react` imports in new code.
- **User-chosen icons** (a category's icon, stored as a Tabler name string) render with [`TablerIcon`](../../apps/web/src/shared/components/tabler-icon/tabler-icon.tsx) and are picked with [`IconPicker`](../../apps/web/src/shared/components/icon-picker/icon-picker.tsx). Both draw from `@tabler/icons-webfont`, whose data, font and picker sheet load lazily so the first load does not grow (SA2-452). Never use the webfont for a fixed icon, and never import every `@tabler/icons-react` component to draw a stored name.
- `@tabler/icons-react`, `@tabler/icons-webfont` and `@tabler/icons` (tag data) stay pinned to the same exact version so a name draws the same glyph everywhere.
- A form that names something with an icon fills the icon from the name with [`useIconSuggestion`](../../apps/web/src/shared/hooks/use-icon-suggestion.ts): it fills only an unset icon the user has not picked (None counts as picked) and never replaces the stored icon of an edited item.

## Accessibility

Each of these gaps shipped and was flagged by review (SA2-121, 140, 153, 155):

- **Current-page indication**: nav items (the tab bar) set `aria-current="page"` on the active link — color/weight alone is invisible to screen readers.
- **Field errors**: validation messages are tied to their input via `aria-describedby` and announced with `role="alert"` (belongs in the shared `Field` wrapper, not per-form).
- **Clickable non-buttons**: anything with `onClick` that isn't a `<button>`/`<a>` (e.g. a `Badge`) must be keyboard-operable — prefer rendering a real `<button>`; otherwise add `role="button"`, `tabIndex={0}`, and a key handler.
- **Charts**: provide a text alternative (visually-hidden summary or accompanying table) — a bare `ResponsiveContainer` conveys nothing to screen readers.
