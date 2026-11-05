import { createDb, type Database } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { playerTag } from "@sapphire2/db/schema/player";
import { and, eq } from "drizzle-orm";
import { Miniflare } from "miniflare";
import { test as baseTest } from "vitest";
import { readWorkerCompatibility } from "../../../../testing/worker-compatibility";
import type { Context } from "../context";
import { appRouter } from "../routers";
import { seedDefaultGameData } from "../services/seed-game-data";
import { applyMigrations, type TestD1Database } from "./test-database";

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

export async function nlhGame(db: Database, userId = "alice") {
	await seedDefaultGameData(db, userId);
	const [nlh] = await db
		.select({ id: gameVariant.id, groupId: gameVariant.groupId })
		.from(gameVariant)
		.where(
			and(eq(gameVariant.userId, userId), eq(gameVariant.builtinKey, "nlh"))
		);
	if (!nlh) {
		throw new Error("missing builtin nlh");
	}
	return {
		game: { variantId: nlh.id },
		stakes: [{ gameGroupId: nlh.groupId, blind1: 1, blind2: 2 }],
	};
}
export async function insertRingGameFixture(
	d1: TestD1Database,
	values: { id: string; userId: string; roomId: string; name: string }
) {
	const lineupId = `${values.id}-fixture-lineup`;
	const ruleId = `${values.id}-fixture-rule`;
	await d1
		.prepare("INSERT INTO game_lineup (id, user_id) VALUES (?, ?)")
		.bind(lineupId, values.userId)
		.run();
	await d1
		.prepare("INSERT INTO cash_rule (id, user_id, lineup_id) VALUES (?, ?, ?)")
		.bind(ruleId, values.userId, lineupId)
		.run();
	await d1
		.prepare(
			"INSERT INTO ring_game (id, user_id, room_id, name, current_rule_id, updated_at) VALUES (?, ?, ?, ?, ?, 0)"
		)
		.bind(values.id, values.userId, values.roomId, values.name, ruleId)
		.run();
	await d1
		.prepare("UPDATE cash_rule SET ring_game_id = ? WHERE id = ?")
		.bind(values.id, ruleId)
		.run();
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
		function caller(userId: "alice" | "bob" | null, callerDb = db) {
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
				db: callerDb,
				openaiApiKey: undefined,
				googleMapsApiKey: undefined,
			});
		}
		function meteredCaller(userId: "alice" | "bob") {
			const meter = { statements: 0 };
			const metered = new Proxy(d1, {
				get(target, property) {
					if (property === "prepare") {
						return (query: string) => {
							meter.statements += 1;
							return target.prepare(query);
						};
					}
					const value = Reflect.get(target, property);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			return {
				meter,
				caller: caller(
					userId,
					createDb(metered as unknown as Parameters<typeof createDb>[0])
				),
			};
		}
		return {
			d1,
			db,
			caller,
			meteredCaller,
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

export type ApiFixture = Awaited<ReturnType<typeof createApiFixture>>;

export const test = baseTest.extend<{
	api: ApiFixture;
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
