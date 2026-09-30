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
	test(`${session.name} cockpit hides legacy navigation until the session is completed`, async ({
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
		await expect(
			page.getByRole("link", { name: "Sessions", exact: true })
		).toHaveCount(0);
		await page.screenshot({ path: test.info().outputPath("cockpit.png") });
		await page.reload();
		await expect(
			page.getByRole("button", { name: "Session settings" })
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Sessions", exact: true })
		).toHaveCount(0);
		await page.getByRole("button", { name: "Pause / resume" }).click();
		await expect(
			page.getByText("Session paused", { exact: true })
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Sessions", exact: true })
		).toHaveCount(0);
		await page.getByRole("button", { name: "Resume", exact: true }).click();
		await expect(page.getByText("Session paused", { exact: true })).toHaveCount(
			0
		);
		await context.setOffline(true);
		await expect(page.getByText(OFFLINE_NOTICE)).toBeVisible();
		await expect(timeline).toBeVisible();
		await context.setOffline(false);
		await page
			.getByRole("button", { name: "End session", exact: true })
			.click();
		const endSheet = page.getByRole("dialog", { name: "End session" });
		if (session.name === "cash") {
			await endSheet
				.getByRole("textbox", { name: "Cash-out amount" })
				.fill("10000");
		} else {
			await endSheet.getByRole("textbox", { name: "Place" }).fill("1");
			await endSheet.getByRole("textbox", { name: "Total entries" }).fill("1");
			await endSheet.getByRole("textbox", { name: "Prize" }).fill("0");
		}
		await endSheet.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page).toHaveURL((url) => url.pathname === "/sessions");
		await expect(
			page.getByRole("link", { name: "Sessions", exact: true })
		).toBeVisible();
		await page.goto("/active-session");
		await expect(
			page.getByText("No active session", { exact: true })
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: "Sessions", exact: true })
		).toBeVisible();
	});
}
