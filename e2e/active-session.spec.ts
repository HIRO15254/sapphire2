import { API_URL, expect, signIn, test } from "./fixtures";

const OFFLINE_NOTICE = /Offline — changes will sync/;

for (const session of [
	{
		name: "cash",
		procedure: "liveCashGameSession.create",
		input: { initialBuyIn: 10_000 },
	},
	{
		name: "tournament",
		procedure: "liveTournamentSession.create",
		input: { buyIn: 1000, startingStack: 20_000 },
	},
]) {
	test(`${session.name} cockpit keeps navigation and recording accessible after route cutover`, async ({
		page,
		account,
		context,
	}) => {
		await page.setViewportSize({ width: 390, height: 664 });
		await signIn(page, account);
		const created = await page.request.post(
			`${API_URL}/trpc/${session.procedure}`,
			{
				headers: { Origin: "https://localhost:13001" },
				data: session.input,
			}
		);
		expect(created.ok(), await created.text()).toBe(true);
		await page.goto("/sessions");
		await page.getByRole("button", { name: "Live", exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === "/active-session");
		await expect(
			page.getByRole("button", { name: "Session settings" })
		).toBeVisible();
		await expect(
			page.getByRole("textbox", { name: "Current stack" })
		).toHaveCount(1);
		await expect(
			page.getByRole("button", { name: "Register seats from a photo" })
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Stack", exact: true })
		).toHaveCount(0);
		const timeline = page.getByRole("button", {
			name: "Timeline",
			exact: true,
		});
		const sessionsLink = page.getByRole("link", {
			name: "Sessions",
			exact: true,
		});
		const navigation = page
			.getByRole("navigation")
			.filter({ has: sessionsLink });
		const timelineBox = await timeline.boundingBox();
		const navigationBox = await sessionsLink.boundingBox();
		expect(timelineBox).not.toBeNull();
		expect(navigationBox).not.toBeNull();
		expect(
			(timelineBox?.y ?? 0) + (timelineBox?.height ?? 0)
		).toBeLessThanOrEqual(navigationBox?.y ?? 0);
		await page.screenshot({ path: test.info().outputPath("cockpit.png") });
		await sessionsLink.click();
		await expect(page).toHaveURL((url) => url.pathname === "/sessions");
		await page.goto("/active-session");
		await expect(
			page.getByRole("button", { name: "Session settings" })
		).toBeVisible();
		await page.getByRole("button", { name: "Pause / resume" }).click();
		await expect(
			navigation.getByRole("button", { name: "Resume", exact: true })
		).toBeVisible();
		await sessionsLink.click();
		await expect(page).toHaveURL((url) => url.pathname === "/sessions");
		await navigation
			.getByRole("button", { name: "Resume", exact: true })
			.click();
		await expect(page).toHaveURL((url) => url.pathname === "/active-session");
		await expect(
			page.getByRole("button", { name: "Live", exact: true })
		).toBeVisible();
		await context.setOffline(true);
		await expect(page.getByText(OFFLINE_NOTICE)).toBeVisible();
		await expect(timeline).toBeVisible();
		await context.setOffline(false);
	});
}
