import { API_URL, expect, signIn, test } from "./fixtures";

test("opens the desktop shell with a secure session after login", async ({
	page,
	account,
	context,
}) => {
	await signIn(page, account);
	const cookie = (await context.cookies(API_URL)).find((entry) =>
		entry.name.endsWith("better-auth.session_token")
	);
	expect(cookie).toMatchObject({
		secure: true,
		httpOnly: true,
		sameSite: "None",
	});
	const sidebar = page.getByRole("navigation", { name: "Main" });
	await expect(sidebar).toBeVisible();
	await expect(sidebar.getByRole("link", { name: "Home" })).toHaveAttribute(
		"aria-current",
		"page"
	);
	await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
});
