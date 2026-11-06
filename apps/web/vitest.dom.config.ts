import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		environment: "jsdom",
		include: [
			"src/**/*.test.tsx",
			"src/shared/hooks/__tests__/*.test.ts",
			"src/shared/components/**/__tests__/*.test.ts",
			"src/features/**/pages/**/__tests__/*.test.ts",
			"src/features/**/hooks/__tests__/*.test.ts",
		],
		name: "web-dom",
		setupFiles: ["./src/__tests__/setup.ts"],
	},
});
