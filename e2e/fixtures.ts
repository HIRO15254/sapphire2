import {
	type APIRequestContext,
	test as base,
	expect,
	type Page,
} from "@playwright/test";

export const API_URL = "https://localhost:18787";
const TEST_PASSWORD = "Sapphire-test-password-42";

export interface TestAccount {
	email: string;
	password: string;
}

export async function registerAccount(
	request: APIRequestContext
): Promise<TestAccount> {
	const email = `test-${crypto.randomUUID()}@example.test`;
	const response = await request.post(`${API_URL}/api/auth/sign-up/email`, {
		headers: { Origin: "https://localhost:13001" },
		data: { email, password: TEST_PASSWORD, name: "Test player" },
	});
	expect(response.ok(), await response.text()).toBe(true);
	return { email, password: TEST_PASSWORD };
}

export const test = base.extend<{ account: TestAccount }>({
	page: async ({ page }, use, testInfo) => {
		const errors: string[] = [];
		const diagnostics: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		page.on("console", (message) =>
			diagnostics.push(`[${message.type()}] ${message.text()}`)
		);
		page.on("requestfailed", (request) =>
			diagnostics.push(
				`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`
			)
		);
		await use(page);
		if (testInfo.status !== testInfo.expectedStatus || errors.length > 0) {
			await testInfo.attach("browser-diagnostics", {
				body: JSON.stringify({ errors, diagnostics }, null, 2),
				contentType: "application/json",
			});
		}
		expect(errors, "Unexpected uncaught browser errors").toEqual([]);
	},
	account: async ({ request }, use) => {
		await use(await registerAccount(request));
	},
});

export { expect } from "@playwright/test";

export async function signIn(page: Page, account: TestAccount) {
	await page.goto("/login");
	await submitSignIn(page, account);
	await expect(page).toHaveURL((url) => url.pathname === "/statistics");
}

export async function submitSignIn(page: Page, account: TestAccount) {
	await page
		.getByRole("button", {
			name: "Already have an account? Sign In",
			exact: true,
		})
		.click();
	await page.getByLabel("Email", { exact: true }).fill(account.email);
	await page.getByLabel("Password", { exact: true }).fill(account.password);
	await page.getByRole("button", { name: "Sign In", exact: true }).click();
}
