import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	createChainableMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
} from "./test-utils";

type Rows = Record<string, unknown>[];
const dialect = new SQLiteSyncDialect();

function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const batchCalls: unknown[][] = [];
	const inserted: { table: unknown; values: unknown }[] = [];
	const selectWhereParams: unknown[][] = [];
	const updateCalls: unknown[] = [];
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = (cond: unknown) => {
			selectWhereParams.push(dialect.sqlToQuery(cond as never).params);
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.innerJoin = () => chain;
		chain.leftJoin = () => chain;
		return chain;
	};
	const db = {
		select: () => makeChain([]),
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return Promise.resolve(undefined);
			},
		}),
		update: () => ({
			set: (values: unknown) => {
				updateCalls.push(values);
				return { where: () => Promise.resolve(undefined) };
			},
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
		batch: (statements: unknown[]) => {
			batchCalls.push(statements);
			return Promise.all(statements as Promise<unknown>[]);
		},
	};
	return { batchCalls, db, inserted, selectWhereParams, updateCalls };
}

const PLAYER_ID_PATTERN = /^p\d+$/;

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const mock = createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).player;
	return { caller, ...mock };
}

async function expectTrpcCode(
	promise: Promise<unknown>,
	code: TRPCError["code"]
): Promise<void> {
	try {
		await promise;
	} catch (error) {
		expect(error).toBeInstanceOf(TRPCError);
		expect((error as TRPCError).code).toBe(code);
		return;
	}
	throw new Error(`expected the call to throw ${code} but it resolved`);
}

const OWNER = "user-1";
const OTHER = "user-2";
function makeJoinCaller(select: Record<string, Rows>) {
	const mock = createChainableMockDb({ select });
	const caller = appRouter.createCaller({
		session: { user: { id: OWNER } },
		db: mock.db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).player;
	return { caller, ...mock };
}

const writers = [
	["create", appRouter.player.create, {}],
	["update", appRouter.player.update, { id: "p1" }],
] as const;

describe("player router structure", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.player).sort()).toEqual(
			["create", "delete", "getById", "list", "update"].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.player, {
			create: "mutation",
			delete: "mutation",
			getById: "query",
			list: "query",
			update: "mutation",
		});
	});
});

describe("player.list input validation", () => {
	it("accepts an undefined payload (no filters)", () => {
		expectAccepts(appRouter.player.list, undefined);
	});
});

describe("player name validation", () => {
	it.each(writers)("%s rejects an empty name", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "" });
	});

	it.each(
		writers
	)("%s accepts a name at exactly 100 characters", (_name, procedure, base) => {
		expectAccepts(procedure, { ...base, name: "a".repeat(100) });
	});

	it.each(
		writers
	)("%s rejects a name exceeding 100 characters", (_name, procedure, base) => {
		expectRejects(procedure, { ...base, name: "a".repeat(101) });
	});
});

describe("player memo validation", () => {
	it.each(
		writers
	)("%s accepts a memo at exactly 50,000 characters", (_name, procedure, base) => {
		expectAccepts(procedure, {
			...base,
			name: "Alice",
			memo: "a".repeat(50_000),
		});
	});

	it.each(
		writers
	)("%s rejects a memo exceeding 50,000 characters", (_name, procedure, base) => {
		expectRejects(procedure, {
			...base,
			name: "Alice",
			memo: "a".repeat(50_001),
		});
	});
});

describe("player.update input validation", () => {
	it("accepts explicit memo: null", () => {
		expectAccepts(appRouter.player.update, { id: "p1", memo: null });
	});

	it("accepts tagIds replacement including empty array", () => {
		expectAccepts(appRouter.player.update, { id: "p1", tagIds: [] });
		expectAccepts(appRouter.player.update, {
			id: "p1",
			tagIds: ["t1", "t2"],
		});
	});
});

describe("player.list ownership and D1 bounds", () => {
	it("rejects a filter containing a tag not owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "t1", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { caller } = makeCaller(OWNER, rows);

		await expectTrpcCode(
			caller.list({ tagIds: ["t1", "foreign-tag"] }),
			"FORBIDDEN"
		);
	});

	it("chunks tag hydration below 100 binds and scopes every chunk to the caller", async () => {
		const players = Array.from({ length: 101 }, (_, index) => ({
			id: `p${index}`,
			userId: OWNER,
			isTemporary: false,
			name: `Player ${index}`,
		}));
		const rows = new Map<unknown, Rows>([
			[player, players],
			[playerToPlayerTag, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.list({});

		const hydrationParams = selectWhereParams.filter((params) =>
			params.some(
				(param) => typeof param === "string" && PLAYER_ID_PATTERN.test(param)
			)
		);
		expect(hydrationParams.map((params) => params.length)).toEqual([100, 3]);
		expect(hydrationParams.every((params) => params.includes(OWNER))).toBe(
			true
		);
	});
});
describe("player.list excludes temporary players", () => {
	it("list excludes players with isTemporary: true", async () => {
		const rows = new Map<unknown, Rows>([
			[player, []],
			[playerToPlayerTag, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.list({});

		expect(selectWhereParams[0]).toEqual([OWNER, 0]);
	});
});

describe("tag-filter D1 bounds", () => {
	it("chunks the player-id filter when a tag matches more than 100 players", async () => {
		const tags = [{ id: "t0", userId: OWNER }];
		const links = Array.from({ length: 101 }, (_, index) => ({
			playerId: `p${index}`,
			playerTagId: "t0",
			position: 0,
		}));
		const players = links.map((link) => ({
			id: link.playerId,
			userId: OWNER,
			isTemporary: false,
			name: `Player ${link.playerId}`,
		}));
		const rows = new Map<unknown, Rows>([
			[playerTag, tags],
			[playerToPlayerTag, links],
			[player, players],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		const result = await caller.list({ tagIds: ["t0"] });

		expect(result).toHaveLength(101);
		const playerFilterSizes = selectWhereParams
			.map(
				(params) =>
					params.filter(
						(param) =>
							typeof param === "string" && PLAYER_ID_PATTERN.test(param)
					).length
			)
			.filter((size) => size > 0);
		expect(Math.max(...playerFilterSizes)).toBeLessThanOrEqual(100);
	});
});

describe("player.create tag ownership (SA2-178)", () => {
	it("accepts tags owned by the caller and links them", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "t1" }, { id: "t2" }]],
			[player, [{ id: "p-new", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { batchCalls, caller, inserted } = makeCaller(OWNER, rows);
		await expect(
			caller.create({ name: "Alice", tagIds: ["t1", "t2"] })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0]).toHaveLength(2);
	});

	it("rejects a tag owned by another user and skips the join insert", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "t1" }]],
			[player, [{ id: "p-new", userId: OWNER }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.create({ name: "Alice", tagIds: ["t1", "t2"] }),
			"FORBIDDEN"
		);
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
	});

	it("chunks 34 tag links and commits them with the player in one batch", async () => {
		const tagIds = Array.from({ length: 34 }, (_, index) => `t${index}`);
		const rows = new Map<unknown, Rows>([
			[playerTag, tagIds.map((id) => ({ id, userId: OWNER }))],
			[player, [{ id: "p-new", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { batchCalls, caller, inserted } = makeCaller(OWNER, rows);

		await caller.create({ name: "Alice", tagIds });

		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0]).toHaveLength(3);
		const linkInserts = inserted.filter(
			(entry) => entry.table === playerToPlayerTag
		);
		expect(
			linkInserts.map((entry) => (entry.values as unknown[]).length)
		).toEqual([33, 1]);
	});
	it("does not validate tags when tagIds is omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[player, [{ id: "p-new", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(caller.create({ name: "Alice" })).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
	});
});

describe("player.update tag ownership (SA2-178)", () => {
	function ownedPlayerRows(extra: Map<unknown, Rows>) {
		const map = new Map<unknown, Rows>([
			[player, [{ id: "p1", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		for (const [k, v] of extra) {
			map.set(k, v);
		}
		return map;
	}

	it("accepts tags owned by the caller and links them", async () => {
		const rows = ownedPlayerRows(
			new Map<unknown, Rows>([[playerTag, [{ id: "t1" }, { id: "t2" }]]])
		);
		const { batchCalls, caller, inserted } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "p1", tagIds: ["t1", "t2"] })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0]).toHaveLength(3);
	});

	it("rejects a tag owned by another user and skips the join insert", async () => {
		const rows = ownedPlayerRows(
			new Map<unknown, Rows>([[playerTag, [{ id: "t1" }]]])
		);
		const { batchCalls, caller, inserted, updateCalls } = makeCaller(
			OWNER,
			rows
		);
		await expectTrpcCode(
			caller.update({ id: "p1", tagIds: ["t1", "t2"] }),
			"FORBIDDEN"
		);
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
		expect(updateCalls).toHaveLength(0);
		expect(batchCalls).toHaveLength(0);
	});

	it("chunks 34 replacement links in the same batch as the player update and delete", async () => {
		const tagIds = Array.from({ length: 34 }, (_, index) => `t${index}`);
		const rows = ownedPlayerRows(
			new Map<unknown, Rows>([
				[playerTag, tagIds.map((id) => ({ id, userId: OWNER }))],
			])
		);
		const { batchCalls, caller, inserted } = makeCaller(OWNER, rows);

		await caller.update({ id: "p1", tagIds });

		expect(batchCalls).toHaveLength(1);
		expect(batchCalls[0]).toHaveLength(4);
		const linkInserts = inserted.filter(
			(entry) => entry.table === playerToPlayerTag
		);
		expect(
			linkInserts.map((entry) => (entry.values as unknown[]).length)
		).toEqual([33, 1]);
	});
	it("does not validate tags when tagIds is omitted", async () => {
		const rows = ownedPlayerRows(new Map());
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "p1", name: "Bob" })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
	});

	it("rejects updating a player owned by another user before touching tags", async () => {
		const rows = new Map<unknown, Rows>([
			[player, [{ id: "p1", userId: OTHER }]],
			[playerTag, [{ id: "t1" }]],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "p1", tagIds: ["t1"] }),
			"FORBIDDEN"
		);
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
	});
});

describe("player tag hydration ownership joins", () => {
	const select = {
		player: [{ id: "p1", userId: OWNER, name: "Alice" }],
		player_tag: [{ id: "t1", userId: OWNER, name: "Tag", color: "blue" }],
		player_to_player_tag: [],
	};

	it("getById scopes the tag join to the caller", async () => {
		const { caller, selectJoinParams } = makeJoinCaller(select);

		await caller.getById({ id: "p1" });

		expect(selectJoinParams).toHaveLength(1);
		expect(selectJoinParams[0]).toContain(OWNER);
	});

	it("create scopes the tag join to the caller", async () => {
		const { caller, selectJoinParams } = makeJoinCaller(select);

		await caller.create({ name: "Alice", tagIds: ["t1"] });

		expect(selectJoinParams).toHaveLength(1);
		expect(selectJoinParams[0]).toContain(OWNER);
	});

	it("update scopes the tag join to the caller", async () => {
		const { caller, selectJoinParams } = makeJoinCaller(select);

		await caller.update({ id: "p1", tagIds: ["t1"] });

		expect(selectJoinParams).toHaveLength(1);
		expect(selectJoinParams[0]).toContain(OWNER);
	});
});

describe("player.list tag filter and search", () => {
	it("returns an empty array when an owned tag filter matches no player links", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "t1", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { caller } = makeCaller(OWNER, rows);

		const result = await caller.list({ tagIds: ["t1"] });

		expect(result).toEqual([]);
	});

	it("scopes a name search with a wildcard-wrapped LIKE parameter", async () => {
		const rows = new Map<unknown, Rows>([
			[player, []],
			[playerToPlayerTag, []],
		]);
		const { caller, selectWhereParams } = makeCaller(OWNER, rows);

		await caller.list({ search: "Ali" });

		expect(selectWhereParams[0]).toContain("%Ali%");
	});
});

describe("player tag hydration result shape", () => {
	const select = {
		player: [{ id: "p1", userId: OWNER, name: "Alice" }],
		player_tag: [{ id: "t1", userId: OWNER, name: "Tag", color: "blue" }],
		player_to_player_tag: [
			{ playerId: "p1", tagId: "t1", tagName: "Tag", tagColor: "blue" },
		],
	};

	it("getById returns the player's tags", async () => {
		const { caller } = makeJoinCaller(select);

		const result = await caller.getById({ id: "p1" });

		expect(result.tags).toEqual([{ id: "t1", name: "Tag", color: "blue" }]);
	});

	it("create returns the newly linked player's tags", async () => {
		const { caller } = makeJoinCaller(select);

		const result = await caller.create({ name: "Alice" });

		expect(result.tags).toEqual([{ id: "t1", name: "Tag", color: "blue" }]);
	});

	it("update returns the player's tags", async () => {
		const { caller } = makeJoinCaller(select);

		const result = await caller.update({ id: "p1", name: "Alice" });

		expect(result.tags).toEqual([{ id: "t1", name: "Tag", color: "blue" }]);
	});

	it("writes both name and memo on update", async () => {
		const { caller, updated } = makeJoinCaller(select);

		await caller.update({ id: "p1", name: "Alice", memo: "note" });

		expect(updated.player[0]).toMatchObject({ name: "Alice", memo: "note" });
	});
});

describe("player.delete", () => {
	it("removes an owned player", async () => {
		const rows = new Map<unknown, Rows>([
			[player, [{ id: "p1", userId: OWNER }]],
		]);
		const { caller } = makeCaller(OWNER, rows);

		const result = await caller.delete({ id: "p1" });

		expect(result).toEqual({ success: true });
	});
});
