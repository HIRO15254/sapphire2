import { API_URL, expect, signIn, test } from "./fixtures";

test("registers a passkey in Settings and signs back into the same account", async ({
	page,
	context,
	account,
}) => {
	await signIn(page, account);
	await page.goto("/settings");
	const signedIn = await page.request.get(`${API_URL}/api/auth/get-session`);
	expect(signedIn.ok()).toBe(true);
	const originalSession = await signedIn.json();
	expect(originalSession.user.email).toBe(account.email);

	const cdp = await context.newCDPSession(page);
	await cdp.send("WebAuthn.enable", { enableUI: false });
	const { authenticatorId } = await cdp.send(
		"WebAuthn.addVirtualAuthenticator",
		{
			options: {
				protocol: "ctap2",
				transport: "internal",
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				automaticPresenceSimulation: true,
			},
		}
	);
	try {
		await page
			.getByRole("button", { name: "Add passkey", exact: true })
			.click();
		const form = page.getByRole("dialog", {
			name: "Add passkey",
			exact: true,
		});
		const passkeyName = "E2E mobile authenticator";
		await form.getByLabel("Passkey name").fill(passkeyName);
		await form.getByRole("button", { name: "Save", exact: true }).click();
		await expect(form).toBeHidden();
		await expect(page.getByText(passkeyName, { exact: true })).toBeVisible();
		const registered = await cdp.send("WebAuthn.getCredentials", {
			authenticatorId,
		});
		expect(
			registered.credentials.map(({ isResidentCredential, rpId }) => ({
				isResidentCredential,
				rpId,
			}))
		).toEqual([{ isResidentCredential: true, rpId: "localhost" }]);

		await page.reload();
		await expect(page.getByText(passkeyName, { exact: true })).toBeVisible();
		await page.getByRole("button", { name: "Sign out", exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === "/login");
		const signedOut = await page.request.get(`${API_URL}/api/auth/get-session`);
		expect(signedOut.ok()).toBe(true);
		expect(await signedOut.json()).toBeNull();
		await page
			.getByRole("button", {
				name: "Already have an account? Sign In",
				exact: true,
			})
			.click();
		await page
			.getByRole("button", { name: "Sign in with a passkey", exact: true })
			.click();
		await expect(page).toHaveURL((url) => url.pathname === "/statistics");
		const resumed = await page.request.get(`${API_URL}/api/auth/get-session`);
		expect(resumed.ok()).toBe(true);
		expect((await resumed.json()).user).toMatchObject({
			id: originalSession.user.id,
			email: account.email,
		});
		const authenticated = await cdp.send("WebAuthn.getCredentials", {
			authenticatorId,
		});
		expect(authenticated.credentials.map(({ signCount }) => signCount)).toEqual(
			registered.credentials.map(({ signCount }) => signCount + 1)
		);
		await page.goto("/settings");
		await expect(page.getByText(passkeyName, { exact: true })).toBeVisible();
	} finally {
		if (!page.isClosed()) {
			await cdp.send("WebAuthn.removeVirtualAuthenticator", {
				authenticatorId,
			});
			await cdp.detach();
		}
	}
});
