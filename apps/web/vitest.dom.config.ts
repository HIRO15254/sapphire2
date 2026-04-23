import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * jsdom project — React component rendering, renderHook, DOM APIs (matchMedia,
 * navigator, Tiptap, TanStack Router, authClient side effects). Split from the
 * node project so pure-function tests do not pay the jsdom boot cost.
 *
 * `isolate: true` (default) stays on here because tests rely on per-file
 * module mocks via `vi.mock`. With `isolate: false`, mocks for the same module
 * (e.g. `@/lib/auth-client`) collide between `use-sign-in` and `use-sign-up`
 * test files and the last-write-wins shape breaks earlier tests.
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		name: "web-dom",
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: [
			"src/**/*.test.tsx",
			"src/shared/hooks/__tests__/*.test.ts",
			"src/shared/components/**/__tests__/*.test.ts",
			"src/features/**/components/**/__tests__/*.test.ts",
			"src/features/dashboard/widgets/**/__tests__/*.test.ts",
			"src/features/sessions/utils/__tests__/share-session.test.ts",
		],
		globals: true,
	},
});
