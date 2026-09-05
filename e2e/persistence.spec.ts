import type { Page } from "@playwright/test";
import { expect, registerAccount, signIn, test } from "./fixtures";

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

test("clears A's persisted records before reload and B's sign in in the same browser", async ({
	page,
	account,
	request,
}) => {
	const accountB = await registerAccount(request);
	await signIn(page, account);
	await page.goto("/players");
	await page
		.getByRole("button", { name: "New player", exact: true })
		.first()
		.click();
	const form = page.getByRole("dialog", { name: "New player" });
	await form.getByLabel("Player name").fill("Private record for account A");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		page.getByRole("link", {
			name: "Private record for account A",
			exact: true,
		})
	).toBeVisible();
	await expect
		.poll(() => persistedCache(page))
		.toContain("Private record for account A");

	await page.goto("/settings");
	await page.getByRole("button", { name: "Sign out", exact: true }).click();
	await expect(page).toHaveURL((url) => url.pathname === "/login");
	await expect
		.poll(() => persistedCache(page))
		.not.toContain("Private record for account A");
	await page.reload();
	await expect
		.poll(() => persistedCache(page))
		.not.toContain("Private record for account A");
	await signIn(page, accountB);
	await page.goto("/players");
	await expect(page.getByText("No players yet", { exact: true })).toBeVisible();
	await expect(
		page.getByText("Private record for account A", { exact: true })
	).toHaveCount(0);
	await expect
		.poll(() => persistedCache(page))
		.not.toContain("Private record for account A");
});

test("serves the installed app shell offline and reconnects to persisted account data", async ({
	page,
	context,
	account,
}) => {
	await signIn(page, account);
	await page.goto("/players");
	await expect(page.getByText("No players yet", { exact: true })).toBeVisible();
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page
		.getByRole("button", { name: "New player", exact: true })
		.first()
		.click();
	const form = page.getByRole("dialog", { name: "New player" });
	await form.getByLabel("Player name").fill("Available offline");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "Available offline", exact: true })
	).toBeVisible();
	await expect.poll(() => persistedCache(page)).toContain("Available offline");
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
	});
	await page.reload();
	await expect
		.poll(() =>
			page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)
		)
		.toContain("/sw.js");
	await context.setOffline(true);
	await page.reload();
	await expect(
		page.getByRole("heading", { name: "Players", exact: true })
	).toBeVisible();
	await expect(
		page.getByText("Offline — changes will sync when back online", {
			exact: true,
		})
	).toBeVisible();
	await expect(
		page.getByRole("link", { name: "Available offline", exact: true })
	).toBeVisible();
	await context.setOffline(false);
	await page.goto("/players");
	await expect(
		page.getByRole("link", { name: "Available offline", exact: true })
	).toBeVisible();
});
