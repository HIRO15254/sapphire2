import { defineConfig, devices } from "@playwright/test";

const DESKTOP_SPECS = ["**/desktop.spec.ts", "**/oauth-mcp.spec.ts"];

export default defineConfig({
	forbidOnly: Boolean(process.env.CI),
	fullyParallel: true,
	projects: [
		{
			name: "desktop",
			testMatch: DESKTOP_SPECS,
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "mobile",
			testIgnore: DESKTOP_SPECS,
			use: { ...devices["Pixel 7"] },
		},
	],
	reporter: [["list"], ["html", { open: "never" }]],
	retries: 0,
	testDir: "./e2e",
	timeout: 30_000,
	use: {
		baseURL: "https://localhost:13001",
		ignoreHTTPSErrors: true,
		launchOptions: { args: ["--ignore-certificate-errors"] },
		locale: "en-US",
		screenshot: "only-on-failure",
		timezoneId: "Asia/Tokyo",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "node --experimental-strip-types testing/serve-e2e.ts",
		ignoreHTTPSErrors: true,
		reuseExistingServer: false,
		stderr: "pipe",
		stdout: "pipe",
		timeout: 120_000,
		url: "https://localhost:13001/login",
	},
	workers: 2,
});
