import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		name: "testing",
		root: import.meta.dirname,
		environment: "node",
		include: ["__tests__/**/*.test.ts"],
	},
});
