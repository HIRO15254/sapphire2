import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
	test: {
		name: "web",
		environment: "jsdom",
		setupFiles: ["./src/__tests__/setup.ts"],
		include: ["src/**/*.test.{ts,tsx}"],
		globals: true,
		server: {
			deps: {
				inline: ["zod"],
			},
		},
	},
});
