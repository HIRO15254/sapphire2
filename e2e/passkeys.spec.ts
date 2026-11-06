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
				automaticPresenceSimulation: true,
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				protocol: "ctap2",
				transport: "internal",
			},
		}
	);
	try {
		await page
			.getByRole("button", { exact: true, name: "Add passkey" })
			.click();
		const form = page.getByRole("dialog", {
			exact: true,
			name: "Add passkey",
		});
		const passkeyName = "E2E mobile authenticator";
		await form.getByLabel("Name").fill(passkeyName);
		await form.getByRole("button", { exact: true, name: "Add" }).click();
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
		await page.getByRole("button", { exact: true, name: "Sign out" }).click();
		await expect(page).toHaveURL((url) => url.pathname === "/login");
		const signedOut = await page.request.get(`${API_URL}/api/auth/get-session`);
		expect(signedOut.ok()).toBe(true);
		expect(await signedOut.json()).toBeNull();
		await page
			.getByRole("button", { exact: true, name: "Sign in with a passkey" })
			.click();
		await expect(page).toHaveURL((url) => url.pathname === "/");
		const resumed = await page.request.get(`${API_URL}/api/auth/get-session`);
		expect(resumed.ok()).toBe(true);
		expect((await resumed.json()).user).toMatchObject({
			email: account.email,
			id: originalSession.user.id,
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
