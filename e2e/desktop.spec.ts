import { API_URL, expect, signIn, test } from "./fixtures";

test("directs desktop users to the supported mobile experience after login", async ({
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
	await expect(
		page.getByText("Use on your phone", { exact: true })
	).toBeVisible();
	await expect(
		page.getByText(
			"This app is optimized for mobile. Open it on a smartphone to continue."
		)
	).toBeVisible();
});
