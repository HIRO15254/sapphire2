import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Node project — pure utility tests (formatters, Zod schemas, helpers that do
 * not touch the DOM). Runs much faster than jsdom because no browser globals
 * are bootstrapped. See vitest.dom.config.ts for the DOM project.
 *
 * `isolate: false` reuses a single worker across files to amortize import
 * cost; safe here because every test mocks via `vi.mock` at module scope and
 * resets state in `beforeEach`.
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		name: "web-node",
		environment: "node",
		include: [
			"src/utils/__tests__/*.test.ts",
			"src/shared/lib/**/__tests__/*.test.ts",
			"src/features/currencies/utils/__tests__/*.test.ts",
			"src/features/live-sessions/utils/__tests__/*.test.ts",
			"src/features/sessions/utils/__tests__/session-filters-helpers.test.ts",
			"src/features/sessions/utils/__tests__/session-form-helpers.test.ts",
			"src/features/stores/utils/__tests__/*.test.ts",
		],
		globals: true,
		isolate: false,
	},
});
