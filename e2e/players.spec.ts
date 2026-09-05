import AxeBuilder from "@axe-core/playwright";
import { expect, signIn, test } from "./fixtures";

test("creates a player through the form and preserves it after reload", async ({
	page,
	account,
}) => {
	await signIn(page, account);
	await page.goto("/players");
	await page.getByRole("button", { name: "New player", exact: true }).click();
	const form = page.getByRole("dialog", { name: "New player" });
	await form.getByLabel("Player name").fill("Alice Riverside");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form).not.toBeVisible();
	await expect(
		page.getByText("Alice Riverside", { exact: true })
	).toBeVisible();
	await page.reload();
	await expect(
		page.getByText("Alice Riverside", { exact: true })
	).toBeVisible();
});

test("keeps an invalid player form open and identifies the required field", async ({
	page,
	account,
}) => {
	await signIn(page, account);
	await page.goto("/players");
	await page.getByRole("button", { name: "New player", exact: true }).click();
	const form = page.getByRole("dialog", { name: "New player" });
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(form.getByRole("alert")).toBeVisible();
	await expect(form).toBeVisible();
	const accessibility = await new AxeBuilder({ page })
		.include('[role="dialog"]')
		.withTags(["wcag2a", "wcag2aa"])
		.analyze();
	expect(accessibility.violations).toEqual([]);
});
