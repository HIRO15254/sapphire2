---
paths:
  - "apps/web/**"
---

# UI / Logic Separation (STRICT)

Components and route pages under `apps/web/src` **must not call React builtin or third-party hooks directly**. They may only invoke project-defined custom hooks (colocated `use-<component>.ts`, `features/**/hooks/use-*.ts`, `shared/**/hooks/use-*.ts`, or route-local `-use-<page>-page.ts`).

## Forbidden in `*.tsx` under `components/` or `routes/`

- **React**: `useState`, `useEffect`, `useMemo`, `useRef`, `useCallback`, `useReducer`, `useContext`, `useDeferredValue`, `useTransition`, `useLayoutEffect`.
- **`@tanstack/react-form`**: `useForm`.
- **`@tanstack/react-query`**: `useQuery`, `useMutation`, `useQueryClient`, `useIsMutating`.

## Allowed

- Calls to custom hooks: `const { ... } = useXxx(args)`. The custom hook internally uses whatever it needs.
- `Route.useParams()` / `Route.useSearch()` inside route page components — these are param accessors, not state.
- Purely presentational child components defined in the same file that take only props and call no hooks.

## File layout

- **Component-specific hook**: colocated next to the component — `apps/web/src/features/<feature>/components/<component>/use-<component>.ts`.
- **Route page hook**: colocated next to the route file with a leading dash to exclude it from routing — `apps/web/src/routes/<path>/-use-<page>-page.ts`.
- **Cross-component data hook**: `apps/web/src/features/<feature>/hooks/use-*.ts`.
- **Cross-feature / app-wide hook**: `apps/web/src/shared/hooks/use-*.ts`.
- **Pure helpers / constants / types**: `apps/web/src/features/<feature>/utils/*.ts` or `apps/web/src/shared/lib/*.ts`.

## Hook return shape

`{ data…, is*Pending, on*Handler, state, setState, … }`.

## Verification

This check must return 0 hits:

```sh
rg '\b(useState|useEffect|useMemo|useRef|useCallback|useForm|useQuery|useMutation|useQueryClient|useReducer|useDeferredValue|useTransition|useLayoutEffect|useIsMutating)\b' 'apps/web/src/**/components/**/*.tsx' 'apps/web/src/routes/**/*.tsx' -g '!**/__tests__/**' -g '!**/*.test.tsx'
```

## Reference implementations

- Route page pair: [`routes/players/-use-players-page.ts`](apps/web/src/routes/players/-use-players-page.ts) + [`routes/players/index.tsx`](apps/web/src/routes/players/index.tsx).
- Component + hook (colocated): [`use-player-form.ts`](apps/web/src/features/players/components/player-form/use-player-form.ts) + [`player-form.tsx`](apps/web/src/features/players/components/player-form/player-form.tsx).
- Cross-component data hook: [`use-currencies.ts`](apps/web/src/features/currencies/hooks/use-currencies.ts), [`use-cash-game-session.ts`](apps/web/src/features/live-sessions/hooks/use-cash-game-session.ts).
- Auth (shared composite): [`use-sign-in.ts`](apps/web/src/shared/components/sign-in-form/use-sign-in.ts) + [`sign-in-form.tsx`](apps/web/src/shared/components/sign-in-form/sign-in-form.tsx).
