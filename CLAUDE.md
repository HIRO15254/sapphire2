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
- Reference implementations: `apps/web/src/shared/hooks/use-sign-in.ts`, `apps/web/src/features/players/components/player-form.tsx`, `apps/web/src/features/live-sessions/components/event-editors/update-stack-editor.tsx`.

## UI/Logic Separation (STRICT MANDATORY)

**All state management and hook usage in `apps/web` components/routes is FORBIDDEN. Components may ONLY call project-defined custom hooks (`useXxx` from `apps/web/src/**/hooks/use-*.ts`).**

### Forbidden in components (including route page components)
React builtin hooks: `useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`, `useReducer`, `useDeferredValue`, `useTransition`, `useLayoutEffect`, `useContext`.
Third-party hooks: `useForm` (`@tanstack/react-form`), `useQuery` / `useMutation` / `useQueryClient` / `useIsMutating` (`@tanstack/react-query`), `useRouter` / `useNavigate` (when used for side-effectful navigation logic — prefer routing via props or hooks).

### Allowed in components
- Calls to custom hooks: `const { ... } = useXxx(args)`.
- `Route.useParams()` / `Route.useSearch()` inside route page components for reading params (these are param accessors, not state).
- Pure JSX rendering from destructured values.

### File layout
- **Custom hook**: `apps/web/src/features/<feature>/hooks/use-<name>.ts` (or `.tsx` when returning JSX).
- **Pure helpers, constants, types**: `apps/web/src/features/<feature>/utils/*.ts`.
- **UI primitive hooks**: `apps/web/src/shared/components/ui/hooks/use-*.ts`.
- **Route page hooks**: `apps/web/src/features/<feature>/hooks/use-<page>-page.ts`.

### Hook return shape
`{ data系, is*Pending, on*Handler, state, setState, ... }`. See references below.

### Optimistic updates / invalidation
Use shared helpers in [apps/web/src/utils/optimistic-update.ts](apps/web/src/utils/optimistic-update.ts) (`snapshotQuery`, `snapshotQueries`, `restoreSnapshots`, `cancelTargets`, `invalidateTargets`). Do not hand-roll `queryClient.invalidateQueries(...)` chains, even inside hooks.

### Forms
The `useForm` call from `@tanstack/react-form` lives in a hook. The component receives `form` and renders `<form.Field>` / `<form.Subscribe>` only.

### Acceptable colocation
Purely presentational subcomponents (`DetailRow`, `XxxCard`, etc.) that take **only props** and call **no hooks** may stay in the same file. Pure helper functions already at module level need not be moved to `utils/` unless they grow or become shared.

### Reference implementations
- Pair: [use-players-page.ts](apps/web/src/features/players/hooks/use-players-page.ts) + [routes/players/index.tsx](apps/web/src/routes/players/index.tsx)
- Form: [use-player-form.ts](apps/web/src/features/players/hooks/use-player-form.ts) + [player-form.tsx](apps/web/src/features/players/components/player-form.tsx)
- tRPC: [use-currencies.ts](apps/web/src/features/currencies/hooks/use-currencies.ts), [use-cash-game-session.ts](apps/web/src/features/live-sessions/hooks/use-cash-game-session.ts)
- Auth: [use-sign-in.ts](apps/web/src/shared/hooks/use-sign-in.ts) + [sign-in-form.tsx](apps/web/src/shared/components/sign-in-form.tsx)

### Verification
Run this check — it MUST return 0 hits (excluding `__tests__/`):
```sh
rg '\b(useState|useEffect|useMemo|useRef|useCallback|useForm|useQuery|useMutation|useQueryClient|useReducer|useDeferredValue|useTransition|useLayoutEffect|useIsMutating)\b' apps/web/src/**/components/**/*.tsx apps/web/src/routes/**/*.tsx -g '!**/__tests__/**'
```

### Reference refactor series (2026-04-21 → 2026-04-22)
- PRs [#207](https://github.com/HIRO15254/sapphire2/pull/207) session-form, [#208](https://github.com/HIRO15254/sapphire2/pull/208) seat-from-screenshot, [#209](https://github.com/HIRO15254/sapphire2/pull/209) active-session-game-scene, [#210](https://github.com/HIRO15254/sapphire2/pull/210) misc (sign-in / add-player / assign-tournament / session-events), [#212](https://github.com/HIRO15254/sapphire2/pull/212) shared formatters, [#213](https://github.com/HIRO15254/sapphire2/pull/213) widgets / ring-game-form / tournament-form / tournament-tab / update-notes-sheet
- Full enforcement: `refactor/strict-hooks-extraction` (this PR) — extracted hooks for every remaining violating component + route, covering live-sessions (26), stores (8), players + sessions (6), currencies + dashboard (7), shared + ui primitives (11), routes (8) — ~66 files total.

<!-- MANUAL ADDITIONS END -->
