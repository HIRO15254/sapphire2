import path from "node:path";
import { defineConfig } from "vitest/config";

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
			"src/features/**/utils/__tests__/*.test.ts",
		],
		exclude: [
			"**/node_modules/**",
			"**/.git/**",
			"src/features/sessions/utils/__tests__/share-session.test.ts",
		],
		globals: true,
		isolate: false,
	},
});
