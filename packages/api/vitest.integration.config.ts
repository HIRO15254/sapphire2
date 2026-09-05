import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "api-integration",
		environment: "node",
		include: ["src/__integration__/**/*.test.ts"],
		testTimeout: 30_000,
		hookTimeout: 60_000,
		maxWorkers: 2,
		sequence: { groupOrder: 1 },
	},
});
