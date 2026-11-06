import { createDb, type Database } from "@sapphire2/db";
import { user } from "@sapphire2/db/schema/auth";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { playerTag } from "@sapphire2/db/schema/player";
import { and, eq } from "drizzle-orm";
import { Miniflare } from "miniflare";
import { test as baseTest } from "vitest";
import { readWorkerCompatibility } from "../../../../testing/worker-compatibility";
import type { Context } from "../context";
import { chunkForInsert } from "../lib/batch";
import { appRouter } from "../routers";
import { seedDefaultGameData } from "../services/seed-game-data";
import { MAX_RULE_LEVELS } from "../services/tournament-rule";
import { applyMigrations, type TestD1Database } from "./test-database";

const workerCompatibility = readWorkerCompatibility();

export const FOREIGN_KEY_FAILED = "FOREIGN KEY constraint failed";

const WRITE_STATEMENT = /^\s*(?:insert|update|delete|replace)\b/iu;
const STATEMENT_RUNNERS = ["run", "all", "raw", "first"] as const;

export function insert(
	d1: TestD1Database,
	table: string,
	row: Record<string, string | number | null>
) {
	const columns = Object.keys(row);
	return d1
		.prepare(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
		)
		.bind(...Object.values(row))
		.run();
}

export async function ids(d1: TestD1Database, table: string, key = "id") {
	const rows = await d1
		.prepare(`SELECT ${key} AS id FROM ${table} ORDER BY ${key}`)
		.all<{ id: string }>();
	return rows.results.map(({ id }) => id);
}

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

async function builtinNlh(db: Database, userId = "alice") {
	await seedDefaultGameData(db, userId);
	const [nlh] = await db
		.select()
		.from(gameVariant)
		.where(
			and(eq(gameVariant.userId, userId), eq(gameVariant.builtinKey, "nlh"))
		);
	if (!nlh) {
		throw new Error("missing builtin nlh");
	}
	return nlh;
}

export async function nlhGame(db: Database, userId = "alice") {
	const nlh = await builtinNlh(db, userId);
	return {
		game: { variantId: nlh.id },
		stakes: [{ blind1: 1, blind2: 2, gameGroupId: nlh.groupId }],
	};
}

export const D1_QUERIES_PER_INVOCATION = 1000;
export const AUTH_QUERY_RESERVE = 10;

export interface MaxRuleLevel {
	game: { gameMixId: string };
	isBreak: boolean;
	minutes: number;
	stakes: { gameGroupId: string; blind1: number; blind2: number }[];
}

export async function seedMaxRuleLevels(api: ApiFixture): Promise<{
	groupCount: number;
	levels: MaxRuleLevel[];
}> {
	const groups = [
		...(await api.alice.gameGroup.list()).map((group) => group.id),
	];
	for (let index = groups.length; index < 12; index += 1) {
		groups.push(
			requireCreatedRow(
				// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential fixture creation and ordering.
				await api.alice.gameGroup.create({
					blind1Label: "Small Bet",
					blind2Label: "Big Bet",
					label: `Group ${index}`,
				})
			).id
		);
	}
	const variants = (await api.alice.gameVariant.list()).map((variant) => ({
		groupId: variant.groupId,
		id: variant.id,
	}));
	for (let index = 0; index < groups.length; index += 1) {
		const groupId = groups[index] ?? "";
		if (variants.some((variant) => variant.groupId === groupId)) {
			continue;
		}
		variants.push({
			groupId,
			id: requireCreatedRow(
				// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential fixture creation and ordering.
				await api.alice.gameVariant.create({
					groupId,
					label: `Variant ${index}`,
				})
			).id,
		});
	}
	const pool = variants.filter((variant) => groups.includes(variant.groupId));
	const byGroup = groups.map((groupId) =>
		pool.filter((variant) => variant.groupId === groupId)
	);
	const spanning = [
		...byGroup.map((members) => members[0]),
		...pool.filter(
			(variant) => !byGroup.some((members) => members[0] === variant)
		),
	]
		.filter((variant) => variant !== undefined)
		.slice(0, 30);
	let seed = 7;
	const levels: MaxRuleLevel[] = [];
	const mixRows: (typeof gameMix.$inferInsert)[] = [];
	const mixVariantRows: (typeof gameMixVariant.$inferInsert)[] = [];
	for (let index = 0; index < MAX_RULE_LEVELS; index += 1) {
		const order = [...spanning];
		for (let swap = order.length - 1; swap > 0; swap -= 1) {
			seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
			const target = seed % (swap + 1);
			[order[swap], order[target]] = [
				order[target] as (typeof order)[number],
				order[swap] as (typeof order)[number],
			];
		}
		const mixId = `max-mix-${index}`;
		mixRows.push({
			id: mixId,
			label: `Mix ${index}`,
			updatedAt: new Date("2026-09-05T00:00:00.000Z"),
			userId: "alice",
		});
		mixVariantRows.push(
			...order.map((variant, position) => ({
				mixId,
				position,
				userId: "alice",
				variantId: variant.id,
			}))
		);
		const groupOrder = [...new Set(order.map((variant) => variant.groupId))];
		levels.push({
			game: { gameMixId: mixId },
			isBreak: false,
			minutes: 20,
			stakes: groupOrder.map((gameGroupId) => ({
				blind1: index + 1,
				blind2: (index + 1) * 2,
				gameGroupId,
			})),
		});
	}
	for (const chunk of chunkForInsert(mixRows, 6)) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database inserts.
		await api.db.insert(gameMix).values(chunk);
	}
	for (const chunk of chunkForInsert(mixVariantRows, 4)) {
		// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database inserts.
		await api.db.insert(gameMixVariant).values(chunk);
	}
	return { groupCount: groups.length, levels };
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
					createdAt: now,
					email: "alice@example.test",
					id: "alice",
					name: "Alice",
					updatedAt: now,
				},
				{
					createdAt: now,
					email: "bob@example.test",
					id: "bob",
					name: "Bob",
					updatedAt: now,
				},
			])
			.returning();
		function caller(userId: "alice" | "bob" | null, callerDb = db) {
			const account = users.find((row) => row.id === userId);
			const session: Context["session"] = account
				? {
						session: {
							createdAt: now,
							expiresAt: new Date("2099-01-01T00:00:00.000Z"),
							id: `session-${account.id}`,
							ipAddress: null,
							token: `test-token-${account.id}`,
							updatedAt: now,
							userAgent: null,
							userId: account.id,
						},
						user: account,
					}
				: null;
			return appRouter.createCaller({
				db: callerDb,
				googleMapsApiKey: undefined,
				openaiApiKey: undefined,
				session,
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
				caller: caller(
					userId,
					createDb(metered as unknown as Parameters<typeof createDb>[0])
				),
				meter,
			};
		}
		function raceCaller(
			userId: "alice" | "bob",
			competingWrite: () => Promise<unknown>,
			{ afterWrites = 0 }: { afterWrites?: number } = {}
		) {
			type Statement = ReturnType<TestD1Database["prepare"]>;
			let writes = 0;
			let race: Promise<unknown> | undefined;
			const wrapped = new WeakMap<object, Statement>();
			function beforeWrite(): Promise<unknown> {
				writes += 1;
				if (race === undefined && writes > afterWrites) {
					race = competingWrite();
					return race;
				}
				return Promise.resolve();
			}
			function wrap(statement: Statement, query: string): Statement {
				if (!WRITE_STATEMENT.test(query)) {
					return statement;
				}
				const wrapper = new Proxy(statement, {
					get(target, property) {
						if (property === "bind") {
							return (...values: unknown[]) =>
								wrap(target.bind(...values), query);
						}
						const value = Reflect.get(target, property);
						if (
							typeof value === "function" &&
							(STATEMENT_RUNNERS as readonly PropertyKey[]).includes(property)
						) {
							return async (...args: unknown[]) => {
								await beforeWrite();
								return value.apply(target, args);
							};
						}
						return typeof value === "function" ? value.bind(target) : value;
					},
				});
				wrapped.set(wrapper, statement);
				return wrapper;
			}
			const raced = new Proxy(d1, {
				get(target, property) {
					if (property === "prepare") {
						return (query: string) => wrap(target.prepare(query), query);
					}
					if (property === "batch") {
						return async (statements: Statement[]) => {
							const originals = statements.map(
								(statement) => wrapped.get(statement) ?? statement
							);
							if (
								originals.some(
									(original, index) => original !== statements[index]
								)
							) {
								await beforeWrite();
							}
							return target.batch(originals);
						};
					}
					const value = Reflect.get(target, property);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			return caller(
				userId,
				createDb(raced as unknown as Parameters<typeof createDb>[0])
			);
		}
		return {
			alice: caller("alice"),
			bob: caller("bob"),
			caller,
			async createPlayerTags(userId: "alice" | "bob", count: number) {
				const rows = Array.from({ length: count }, (_, position) => ({
					id: `${userId}-tag-${position}`,
					name: `Tag ${position}`,
					updatedAt: now,
					userId,
				}));

				for (const row of rows) {
					// biome-ignore lint/performance/noAwaitInLoops: Preserve sequential database inserts.
					await db.insert(playerTag).values(row);
				}
				return rows.map(({ id }) => id);
			},
			d1,
			db,
			dispose: () => miniflare.dispose(),
			meteredCaller,
			raceCaller,
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
