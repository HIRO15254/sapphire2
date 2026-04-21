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
- Reference implementations: `apps/web/src/shared/hooks/use-sign-in.ts`, `apps/web/src/players/components/player-form.tsx`, `apps/web/src/live-sessions/components/event-editors/update-stack-editor.tsx`.

## UI/Logic Separation (MANDATORY)

**All non-trivial logic in `apps/web` MUST live in a custom hook, so components stay Props-driven presentational views.**

- **File layout:** React hooks go in `apps/web/src/<feature>/hooks/use-*.ts` (or `.tsx` when JSX is returned). Pure helpers, constants, and types go in `apps/web/src/<feature>/utils/*.ts`. Never colocate `useQuery`/`useMutation`/complex `useState`+`useEffect` chains inside a component file.
- **Component responsibility:** Components receive data and handlers from a hook via destructuring and render JSX. Do **not** call `useQueryClient` in a component — keep it inside the hook. Derived values (filters, sorts, aggregates, view-model shaping) belong in the hook, not in JSX.
- **Hook return shape:** Return `{ data系, is*Pending, on*Handler }`. Reference: [use-players.ts](apps/web/src/players/hooks/use-players.ts) + [routes/players/index.tsx](apps/web/src/routes/players/index.tsx), [use-currencies.ts](apps/web/src/currencies/hooks/use-currencies.ts), [use-cash-game-session.ts](apps/web/src/live-sessions/hooks/use-cash-game-session.ts).
- **Optimistic updates / invalidation:** Use the shared helpers in [apps/web/src/utils/optimistic-update.ts](apps/web/src/utils/optimistic-update.ts) (`snapshotQuery`, `snapshotQueries`, `restoreSnapshots`, `cancelTargets`, `invalidateTargets`). Do not hand-roll chains of `queryClient.invalidateQueries(...)` / `setQueryData(...)` inside components.
- **Forms:** The `useForm` call from `@tanstack/react-form` lives in a hook. The component receives `form` and renders `<form.Field>` / `<form.Subscribe>` only. Satisfies the Forms (MANDATORY) rule above.
- **Acceptable colocation:** Purely presentational subcomponents (`DetailRow`, `XxxCard`, etc.) may stay in the same file. Pure helper functions that are already module-level (not inside the component body) need not be moved to `utils/` unless they grow or become shared.
- **Reference refactor series (2026-04-21):** PRs [#207](https://github.com/HIRO15254/sapphire2/pull/207) session-form, [#208](https://github.com/HIRO15254/sapphire2/pull/208) seat-from-screenshot, [#209](https://github.com/HIRO15254/sapphire2/pull/209) active-session-game-scene, [#210](https://github.com/HIRO15254/sapphire2/pull/210) misc (sign-in / add-player / assign-tournament / session-events).

<!-- MANUAL ADDITIONS END -->
