import { defineConfig } from "vitest/config";

process.env.TZ = "Asia/Tokyo";

export default defineConfig({
	test: {
		coverage: {
			exclude: [
				"**/__tests__/**",
				"**/__integration__/**",
				"**/*.test.{ts,tsx}",
				"**/*.d.ts",
				"**/routeTree.gen.ts",
				"**/migrations/**",
			],
			include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
			provider: "v8",
			reporter: ["text-summary", "html"],
		},
		projects: [
			"apps/web/vitest.dom.config.ts",
			"apps/web/vitest.node.config.ts",
			"apps/server/vitest.config.ts",
			"packages/api/vitest.config.ts",
			"packages/api/vitest.integration.config.ts",
			"packages/db/vitest.config.ts",
			"packages/mcp/vitest.config.ts",
			"packages/env/vitest.config.ts",
			"scripts/vitest.config.ts",
			"testing/vitest.config.ts",
		],
	},
});
