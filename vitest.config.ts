import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			"apps/web/vitest.dom.config.ts",
			"apps/web/vitest.node.config.ts",
			"apps/server/vitest.config.ts",
			"packages/api/vitest.config.ts",
			"packages/api/vitest.integration.config.ts",
			"packages/db/vitest.config.ts",
			"packages/mcp/vitest.config.ts",
			"packages/env/vitest.config.ts",
		],
		coverage: {
			provider: "v8",
			include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
			exclude: [
				"**/__tests__/**",
				"**/__integration__/**",
				"**/*.test.{ts,tsx}",
				"**/*.d.ts",
				"**/routeTree.gen.ts",
				"**/migrations/**",
			],
			reporter: ["text-summary", "json-summary", "html", "lcov"],
		},
	},
});
