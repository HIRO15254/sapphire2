import path from "node:path";
import { defineConfig } from "vitest/config";

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
			"src/features/**/pages/**/__tests__/*.test.ts",
			"src/features/**/hooks/__tests__/*.test.ts",
			"src/features/sessions/utils/__tests__/share-session.test.ts",
			"src/routes/**/__tests__/*.test.ts",
		],
		globals: true,
	},
});
