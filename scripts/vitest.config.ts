import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "scripts",
		environment: "node",
		include: ["releases/**/*.test.ts"],
		globals: true,
	},
});
