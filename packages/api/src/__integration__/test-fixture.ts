import { createDb } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { playerTag } from "@sapphire2/db/schema/player";
import { Miniflare } from "miniflare";
import { test as baseTest } from "vitest";
import { readWorkerCompatibility } from "../../../../testing/worker-compatibility";
import type { Context } from "../context";
import { appRouter } from "../routers";
import { applyMigrations } from "./test-database";

const workerCompatibility = readWorkerCompatibility();

export function requireCreatedRow<T extends { id?: string }>(
	row: T | undefined
): T & { id: string } {
	if (!row?.id) {
		throw new Error(
			"Expected the API fixture create to return a persisted row with an id"
		);
	}
	return row as T & { id: string };
}

async function createApiFixture() {
	const miniflare = new Miniflare({
		cf: false,
		modules: true,
		script:
			"export default { fetch() { return new Response('Test database'); } };",
		...workerCompatibility,
		d1Databases: ["DB"],
	});
	try {
		const d1 = await miniflare.getD1Database("DB");
		await applyMigrations(d1);
		const db = createDb(d1 as unknown as Parameters<typeof createDb>[0]);
		const now = new Date("2026-09-05T00:00:00.000Z");
		const users = await db
			.insert(user)
			.values([
				{
					id: "alice",
					name: "Alice",
					email: "alice@example.test",
					createdAt: now,
					updatedAt: now,
				},
				{
					id: "bob",
					name: "Bob",
					email: "bob@example.test",
					createdAt: now,
					updatedAt: now,
				},
			])
			.returning();
		function caller(userId: "alice" | "bob" | null) {
			const account = users.find((row) => row.id === userId);
			const session: Context["session"] = account
				? {
						user: account,
						session: {
							id: `session-${account.id}`,
							userId: account.id,
							token: `test-token-${account.id}`,
							createdAt: now,
							updatedAt: now,
							expiresAt: new Date("2099-01-01T00:00:00.000Z"),
							ipAddress: null,
							userAgent: null,
						},
					}
				: null;
			return appRouter.createCaller({
				session,
				db,
				anthropicApiKey: undefined,
				googleMapsApiKey: undefined,
			});
		}
		return {
			d1,
			db,
			caller,
			alice: caller("alice"),
			bob: caller("bob"),
			dispose: () => miniflare.dispose(),
			async createPlayerTags(userId: "alice" | "bob", count: number) {
				const rows = Array.from({ length: count }, (_, position) => ({
					id: `${userId}-tag-${position}`,
					userId,
					name: `Tag ${position}`,
					updatedAt: now,
				}));

				for (const row of rows) {
					await db.insert(playerTag).values(row);
				}
				return rows.map(({ id }) => id);
			},
		};
	} catch (error) {
		await miniflare.dispose();
		throw error;
	}
}

export const test = baseTest.extend<{
	api: Awaited<ReturnType<typeof createApiFixture>>;
}>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest requires destructured fixture dependencies, and this fixture has none.
	api: async ({}, use) => {
		const api = await createApiFixture();
		try {
			await use(api);
		} finally {
			await api.dispose();
		}
	},
});
