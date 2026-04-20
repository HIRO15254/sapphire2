# sapphire2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-11

## Active Technologies
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM (008-session-bb-bi-display)
- Cloudflare D1 (SQLite) — 変更なし (008-session-bb-bi-display)
- TypeScript (strict mode) + tRPC v11, Hono, Drizzle ORM, Zod (009-session-recalculation-redesign)
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui (Accordion, ResponsiveDialog, Badge), Tailwind v4, tRPC v11, Hono, Drizzle ORM (009-update-notes-display)
- Cloudflare D1 (SQLite) via Drizzle ORM — `update_note_view` テーブルを追加 (009-update-notes-display)
- TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM, Zod (011-redesign-session-events)
- Cloudflare D1 (SQLite) via Drizzle ORM — セッションイベントデータマイグレーション (011-redesign-session-events)
- TypeScript (strict mode) + React 19, Tailwind v4, Radix UI, Vitest, Testing Library (007-improve-tag-colorpicker)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript (strict mode): Follow standard conventions

## Recent Changes
- 011-redesign-session-events: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM, Zod
- 009-update-notes-display: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui (Accordion, ResponsiveDialog, Badge), Tailwind v4, tRPC v11, Hono, Drizzle ORM
- 009-session-recalculation-redesign: Added TypeScript (strict mode) + tRPC v11, Hono, Drizzle ORM, Zod
- 008-session-bb-bi-display: Added TypeScript (strict mode) + React 19, TanStack Router, TanStack Query, shadcn/ui, Tailwind v4, tRPC v11, Hono, Drizzle ORM

- 007-improve-tag-colorpicker: Added TypeScript (strict mode) + React 19, Tailwind v4, Radix UI, Vitest, Testing Library

<!-- MANUAL ADDITIONS START -->

## Forms (MANDATORY)

**All forms in `apps/web` MUST be built with [`@tanstack/react-form`](https://tanstack.com/form/latest).**

- Do not use raw `<form onSubmit={handleSubmit}>` with `FormData`/`useState` for form state. Use `useForm({ defaultValues, onSubmit, validators })` instead.
- Attach validation via `validators.onSubmit: zodSchema` (and/or `onChange` per-field). Keep the schema close to the form.
- **Number inputs must not use `type="number"`.** Keep inputs as `type="text"` + `inputMode="numeric"`, store the raw string in form state, and validate/convert via Zod. `type="number"` has inconsistent cross-browser behavior (scroll-to-change, locale handling, allowed characters) and hides errors behind silent coercion.
- Use helpers from `@/shared/lib/form-fields` (`requiredNumericString`, `optionalNumericString`, `parseOptionalInt`, etc.) to keep numeric validation uniform.
- Reference implementations: `apps/web/src/shared/components/sign-in-form.tsx`, `apps/web/src/players/components/player-form.tsx`, `apps/web/src/live-sessions/components/event-editors/update-stack-editor.tsx`.

<!-- MANUAL ADDITIONS END -->
