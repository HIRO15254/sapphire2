import { defineConfig, mergeConfig } from "vitest/config";

import nodeConfig from "./vitest.node.config";

export default mergeConfig(
	nodeConfig,
	defineConfig({
		test: {
			exclude: ["src/**/__tests__/*-tz.test.ts"],
		},
	})
);
