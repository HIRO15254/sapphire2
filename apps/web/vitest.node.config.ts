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
			// All feature-local pure-helper tests. Per-feature enumeration kept
			// silently dropping new features (rooms utils were never running).
			"src/features/**/utils/__tests__/*.test.ts",
		],
		exclude: [
			"**/node_modules/**",
			"**/.git/**",
			// Touches navigator/clipboard — runs in the web-dom project instead.
			"src/features/sessions/utils/__tests__/share-session.test.ts",
		],
		globals: true,
		isolate: false,
	},
});
