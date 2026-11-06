import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		hookTimeout: 60_000,
		include: ["src/__integration__/**/*.test.ts"],
		maxWorkers: 2,
		name: "api-integration",
		sequence: { groupOrder: 1 },
		testTimeout: 30_000,
	},
});
