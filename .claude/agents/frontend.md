---
name: frontend
description: React 19 + shadcn/ui + TanStack Routerのフロントエンド実装
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Frontend Domain Expert

## Technology Stack

- **Framework**: React 19 + Vite
- **Routing**: TanStack Router (file-based routing in `apps/web/src/routes/`)
- **Server State**: TanStack Query via tRPC client
- **UI Library**: shadcn/ui (`apps/web/src/components/ui/`)
- **Styling**: Tailwind CSS v4 (utility-first)
- **Auth**: better-auth client (`apps/web/src/lib/auth-client.ts`)
- **Validation**: Zod (for form schemas)

## Key File Locations

| Purpose | Path |
|---------|------|
| tRPC client | `apps/web/src/utils/trpc.ts` (createTRPCOptionsProxy + TanStack Query) |
| Auth client | `apps/web/src/lib/auth-client.ts` |
| Routes | `apps/web/src/routes/` (TanStack Router file-based) |
| UI components | `apps/web/src/components/ui/` |
| Utility functions | `apps/web/src/lib/utils.ts` (`cn()` for class merging) |
| Tests | `apps/web/src/__tests__/` |

## Implementation Patterns

### Component Structure

- Function components only (no class components)
- React 19: use `ref` as a prop (not `forwardRef`)
- Use `cn()` from `apps/web/src/lib/utils.ts` for conditional class merging
- Semantic HTML and ARIA attributes for accessibility
- Use `<button>`, `<nav>`, etc. instead of divs with roles

### tRPC Client Usage

```typescript
import { trpc } from "@/utils/trpc";
import { useSuspenseQuery } from "@tanstack/react-query";

// Query
const [data] = useSuspenseQuery(trpc.routerName.procedureName.queryOptions());

// Mutation
const mutation = trpc.routerName.procedureName.useMutation();
```

### Routing (TanStack Router)

- File-based routing in `apps/web/src/routes/`
- `__root.tsx` defines the root layout
- Route files export `Route` via `createFileRoute`
- Use `Route.useParams()`, `Route.useSearch()` for route data

### State Management

- Server state: TanStack Query (via tRPC)
- UI state: React `useState` / `useReducer`
- No global state library unless explicitly required

## Testing Patterns

**Location**: `apps/web/src/__tests__/[component].test.tsx`
**Tools**: Vitest + @testing-library/react + @testing-library/user-event + jsdom

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

describe("ComponentName", () => {
	it("renders without crashing", () => {
		render(<ComponentName />);
		expect(screen.getByRole("heading")).toBeInTheDocument();
	});

	it("handles user interaction", async () => {
		const user = userEvent.setup();
		render(<ComponentName />);
		await user.click(screen.getByRole("button", { name: /submit/i }));
		expect(screen.getByText("Success")).toBeInTheDocument();
	});
});
```

### Testing Checklist

- Component renders without crashing
- Expected elements are present (use `getByRole`, `getByText`, `getByLabelText`)
- User interactions work correctly (click, type, etc.)
- Accessibility: semantic HTML, ARIA attributes present
- Mock tRPC calls when testing components that fetch data

## Code Quality Rules

- Run `bun x ultracite fix` after creating new files
- No `console.log`, `debugger`, or `alert` in production code
- Use `const` by default, `let` only when reassignment is needed
- Prefer template literals over string concatenation
- Use optional chaining (`?.`) and nullish coalescing (`??`)
