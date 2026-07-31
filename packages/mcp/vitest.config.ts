import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "mcp",
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Date assertions must not depend on the host timezone — a non-UTC TZ
		// makes any accidental local-getter usage fail loudly.
		env: { TZ: "Asia/Tokyo" },
	},
});
