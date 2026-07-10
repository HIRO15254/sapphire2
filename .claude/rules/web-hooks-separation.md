---
paths:
  - "apps/web/**"
---

# UI / Logic Separation (STRICT)

Components and route pages under `apps/web/src` **must not call React builtin or third-party hooks directly**. They may only invoke project-defined custom hooks (colocated `use-<component>.ts`, page hooks `features/**/pages/<page>/use-<page>-page.ts`, `features/**/hooks/use-*.ts`, or `shared/**/hooks/use-*.ts`).

## Forbidden in `*.tsx` under `components/` or `routes/`

- **React**: `useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`, `useReducer`, `useContext`, `useDeferredValue`, `useTransition`, `useLayoutEffect`.
- **`@tanstack/react-form`**: `useForm`.
- **`@tanstack/react-query`**: `useQuery`, `useMutation`, `useQueryClient`, `useIsMutating`.

## Allowed

- Calls to custom hooks: `const { ... } = useXxx(args)`. The custom hook internally uses whatever it needs.
- `Route.useParams()` / `Route.useSearch()` inside route page components — these are param accessors, not state.
- Purely presentational child components defined in the same file that take only props and call no hooks.

## File layout

- **Component-specific hook**: colocated next to the component — `apps/web/src/features/<feature>/components/<component>/use-<component>.ts` (same shape inside a page's child folders).
- **Page hook**: colocated inside the page folder — `apps/web/src/features/<feature>/pages/<page>/use-<page>-page.ts`. Route files stay thin (`createFileRoute` wiring + `Route.useParams()` only); the old route-local `-use-<page>-page.ts` pattern is retired.
- **Cross-component data hook**: `apps/web/src/features/<feature>/hooks/use-*.ts`.
- **Cross-feature / app-wide hook**: `apps/web/src/shared/hooks/use-*.ts`.
- **Pure helpers / constants / types**: `apps/web/src/features/<feature>/utils/*.ts` or `apps/web/src/shared/lib/*.ts`.

## Hook return shape

`{ data…, is*Pending, on*Handler, state, setState, … }`.

## Verification

This check must return 0 hits (it also runs in the Stop hook via `scripts/check-rules.ts`). The globs go in `-g` flags — passing `**` paths as positional args makes `rg` error out without scanning anything:

```sh
rg '\b(useState|useEffect|useMemo|useRef|useCallback|useForm|useQuery|useMutation|useQueryClient|useReducer|useDeferredValue|useTransition|useLayoutEffect|useIsMutating)\b' apps/web/src -g '**/components/**/*.tsx' -g '**/pages/**/*.tsx' -g 'routes/**/*.tsx' -g '!**/__tests__/**' -g '!**/*.test.tsx' -g '!**/use-*.tsx'
```

> `**/pages/**` covers page components that have been lifted out of route files
> into a feature `pages/` folder (the route file keeps only `createFileRoute`
> wiring + `Route.useParams()`). Reference: `features/currencies/pages/`.

## Reference implementations

- Feature `pages/` layout (logic lifted out of the route file): [`features/players/pages/players-page/`](apps/web/src/features/players/pages/players-page/) — the route file is just `createFileRoute` wiring, the page component consumes [`use-players-page.ts`](apps/web/src/features/players/pages/players-page/use-players-page.ts).
- Page with subcomponent view hooks: [`features/live-sessions/pages/active-session-page/`](apps/web/src/features/live-sessions/pages/active-session-page/) — the page dispatches to `cash-game-session/` / `tournament-session/` child folders, each driven by a colocated `use-*-view.ts` hook.
- Component + hook (colocated): [`use-player-form.ts`](apps/web/src/features/players/components/player-form/use-player-form.ts) + [`player-form.tsx`](apps/web/src/features/players/components/player-form/player-form.tsx).
- Cross-component data hook: [`use-currencies.ts`](apps/web/src/features/currencies/hooks/use-currencies.ts), [`use-cash-game-session.ts`](apps/web/src/features/live-sessions/hooks/use-cash-game-session.ts).
- Auth (shared composite): [`use-sign-in.ts`](apps/web/src/features/auth/pages/login-page/sign-in-form/use-sign-in.ts) + [`sign-in-form.tsx`](apps/web/src/features/auth/pages/login-page/sign-in-form/sign-in-form.tsx).
