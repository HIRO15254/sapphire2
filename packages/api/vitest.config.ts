import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		exclude: ["src/__integration__/**"],
		include: ["src/**/*.test.ts"],
		name: "api",
	},
});
