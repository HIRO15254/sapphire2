import { defineProject } from "vitest/config";

export default defineProject({
	test: {
		environment: "node",
		include: ["__tests__/**/*.test.ts"],
		name: "testing",
		root: import.meta.dirname,
	},
});
