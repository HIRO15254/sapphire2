import { defineConfig, devices } from "@playwright/test";

const DESKTOP_SPECS = ["**/desktop.spec.ts", "**/oauth-mcp.spec.ts"];

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: 2,
	timeout: 30_000,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: "https://localhost:13001",
		ignoreHTTPSErrors: true,
		// Service workers also fetch the local Miniflare self-signed certificate.
		launchOptions: { args: ["--ignore-certificate-errors"] },
		locale: "en-US",
		timezoneId: "Asia/Tokyo",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
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
	webServer: {
		command: "node --experimental-strip-types testing/serve-e2e.ts",
		url: "https://localhost:13001/login",
		ignoreHTTPSErrors: true,
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
