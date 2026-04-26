---
paths:
  - "apps/web/**"
---

# Forms (MANDATORY)

All forms in `apps/web` are built with [`@tanstack/react-form`](https://tanstack.com/form/latest), driven from a custom `use-*-form` hook colocated next to the component. The component renders only — it never calls `useForm` directly.

## Rules

1. **`useForm({ defaultValues, onSubmit, validators })` lives in the hook.** The component consumes `form` and renders `<form.Field>` / `<form.Subscribe>` + shadcn primitives only.
2. **Validate with `validators.onSubmit: zodSchema`** (and per-field `onChange` when useful). Keep the schema next to the hook.
3. **Never use `<input type="number">`.** Use `type="text" inputMode="numeric"` and validate / convert via Zod. Helpers: `requiredNumericString`, `optionalNumericString`, `parseOptionalInt` from [`apps/web/src/shared/lib/form-fields.ts`](apps/web/src/shared/lib/form-fields.ts).
4. **No placeholder UI copy.** `placeholder="e.g. …"` is banned, and example text must not be moved into `Field.description` either — drop it entirely.
5. **Required / optional visibility**: required fields are marked with `<Field required>` (renders a red `*`). Unmarked fields are implicitly optional.
6. **Clearable selects use [`SelectWithClear`](apps/web/src/shared/components/ui/select/select-with-clear.tsx)**, not raw shadcn `Select`. The native `<SelectValue placeholder>` prop is permitted only where the Radix primitive's own rendering requires it.
7. **Mobile form dialogs are bottom sheets.** Use shadcn `Drawer` for mobile-first forms, not `Dialog`.
8. **Zod imports**: `import z from "zod"` (default import). A Vite bundler issue breaks the namespace import.

## Reference implementations

- [`use-player-form.ts`](apps/web/src/features/players/components/player-form/use-player-form.ts) + [`player-form.tsx`](apps/web/src/features/players/components/player-form/player-form.tsx).
- [`use-session-form-state.ts`](apps/web/src/features/sessions/components/session-form/use-session-form-state.ts) + [`session-form.tsx`](apps/web/src/features/sessions/components/session-form/session-form.tsx).
- [`use-sign-in.ts`](apps/web/src/shared/components/sign-in-form/use-sign-in.ts) + [`sign-in-form.tsx`](apps/web/src/shared/components/sign-in-form/sign-in-form.tsx).
