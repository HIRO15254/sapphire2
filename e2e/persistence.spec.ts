import type { Page } from "@playwright/test";
import { API_URL, expect, registerAccount, signIn, test } from "./fixtures";

async function persistedCache(page: Page) {
	return await page.evaluate(async () => {
		if (
			!(await indexedDB.databases()).some(
				(database) => database.name === "keyval-store"
			)
		) {
			return "";
		}
		return await new Promise<string>((resolve, reject) => {
			const request = indexedDB.open("keyval-store");
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const database = request.result;
				if (!database.objectStoreNames.contains("keyval")) {
					database.close();
					resolve("");
					return;
				}
				const transaction = database.transaction("keyval", "readonly");
				const read = transaction
					.objectStore("keyval")
					.get("sapphire2-query-cache");
				read.onsuccess = () => resolve(JSON.stringify(read.result) ?? "");
				read.onerror = () => reject(read.error);
				transaction.oncomplete = () => database.close();
			};
		});
	});
}

async function seedViewedVersion(page: Page) {
	const version = `e2e-${crypto.randomUUID()}`;
	const response = await page.request.post(
		`${API_URL}/trpc/updateNoteView.markViewed`,
		{
			headers: { Origin: "https://localhost:13001" },
			data: { version },
		}
	);
	expect(response.ok(), await response.text()).toBe(true);
	return version;
}

test("clears A's persisted records before reload and B's sign in in the same browser", async ({
	page,
	account,
	request,
}) => {
	const accountB = await registerAccount(request);
	await signIn(page, account);
	const privateRecord = await seedViewedVersion(page);
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
	await expect.poll(() => persistedCache(page)).toContain(privateRecord);

	await page.goto("/settings");
	await page.getByRole("button", { name: "Sign out", exact: true }).click();
	await expect(page).toHaveURL((url) => url.pathname === "/login");
	await expect.poll(() => persistedCache(page)).not.toContain(privateRecord);
	await page.reload();
	await expect.poll(() => persistedCache(page)).not.toContain(privateRecord);
	await signIn(page, accountB);
	await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
	await expect.poll(() => persistedCache(page)).not.toContain(privateRecord);
});

test("serves the installed app shell offline with the persisted account cache", async ({
	page,
	context,
	account,
}) => {
	await signIn(page, account);
	const persistedRecord = await seedViewedVersion(page);
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
	await expect.poll(() => persistedCache(page)).toContain(persistedRecord);
	await page.reload();
	await expect
		.poll(() =>
			page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)
		)
		.toContain("/sw.js");
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
	await expect(
		page.getByText("Offline — changes will sync when back online", {
			exact: true,
		})
	).toBeVisible();
	await expect.poll(() => persistedCache(page)).toContain(persistedRecord);
	await context.setOffline(false);
});
