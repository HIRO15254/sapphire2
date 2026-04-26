---
paths:
  - "apps/web/**"
---

# Web UI Conventions

## Page scaffolding

Every top-level page composes its header with [`PageHeader`](apps/web/src/shared/components/page-header/page-header.tsx). It supports an inline actions slot and an optional badge slot. Do not hand-roll page titles or action rows.

## Use shadcn primitives

Reach for existing shadcn components before building a custom wrapper:

- Data tables → [shadcn `Table`](apps/web/src/shared/components/ui/table/table.tsx). Native `<table>` is banned for tabular data.
- Status pills, counts → shadcn `Badge`. Do not reintroduce the old `ColorBadge` wrapper.
- User avatars → shadcn `Avatar`. Do not reintroduce the old `PlayerAvatar` wrapper.
- Single-choice selection (swatches, enum pickers) → shadcn `RadioGroup`.
- Clearable `Select` → [`SelectWithClear`](apps/web/src/shared/components/ui/select/select-with-clear.tsx). See [`.claude/rules/web-forms.md`](web-forms.md).

## Language

UI copy is **English-only**. Do not put Japanese into user-facing strings (labels, empty states, toasts, errors). Japanese is fine in code comments, commit messages, and PR descriptions.

## Platform

Mobile-first dialogs are bottom sheets — use shadcn `Drawer`, not `Dialog`.

## Icons

Use `@tabler/icons-react` exclusively for new icons. Do not add `lucide-react` imports in new code.
