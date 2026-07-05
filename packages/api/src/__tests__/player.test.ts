import {
	player,
	playerTag,
	playerToPlayerTag,
} from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

type Rows = Record<string, unknown>[];

/**
 * Mock db keyed by schema-table reference: `select().from(t)...` resolves to
 * the rows registered for `t`; `insert(t).values()` records the payload so a
 * rejected tag-ownership guard can be shown to skip the `player_to_player_tag`
 * write (SA2-178).
 */
function createMockDb(rowsByTable: Map<unknown, Rows>) {
	const inserted: { table: unknown; values: unknown }[] = [];
	const makeChain = (rows: Rows) => {
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = (table: unknown) => makeChain(rowsByTable.get(table) ?? []);
		chain.where = () => chain;
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
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
	};
	return { db, inserted };
}

function makeCaller(userId: string, rowsByTable: Map<unknown, Rows>) {
	const { db, inserted } = createMockDb(rowsByTable);
	const caller = appRouter.createCaller({
		session: { user: { id: userId } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0]).player;
	return { caller, inserted };
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

describe("player router structure", () => {
	it("appRouter has player namespace", () => {
		expect(appRouter.player).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.player).sort()).toEqual(
			["create", "delete", "getById", "list", "update"].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.player.list);
		expectType(appRouter.player.list, "query");
		expectProtected(appRouter.player.getById);
		expectType(appRouter.player.getById, "query");
	});

	it("create / update / delete are protected mutations", () => {
		for (const proc of [
			appRouter.player.create,
			appRouter.player.update,
			appRouter.player.delete,
		]) {
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("player.list input validation", () => {
	it("accepts an undefined payload (no filters)", () => {
		expectAccepts(appRouter.player.list, undefined);
	});

	it("accepts an empty object", () => {
		expectAccepts(appRouter.player.list, {});
	});

	it("accepts search string", () => {
		expectAccepts(appRouter.player.list, { search: "alice" });
	});

	it("accepts tagIds array", () => {
		expectAccepts(appRouter.player.list, { tagIds: ["t1", "t2"] });
	});

	it("accepts both search and tagIds together", () => {
		expectAccepts(appRouter.player.list, {
			search: "bob",
			tagIds: ["t1"],
		});
	});

	it("rejects non-string search", () => {
		expectRejects(appRouter.player.list, { search: 42 });
	});

	it("rejects non-array tagIds", () => {
		expectRejects(appRouter.player.list, { tagIds: "t1" });
	});
});

describe("player.getById input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.player.getById, { id: "p1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.getById, {});
	});

	it("rejects non-string id", () => {
		expectRejects(appRouter.player.getById, { id: 1 });
	});
});

describe("player.create input validation", () => {
	it("accepts minimal valid payload (name only)", () => {
		expectAccepts(appRouter.player.create, { name: "Alice" });
	});

	it("accepts full payload with memo and tagIds", () => {
		expectAccepts(appRouter.player.create, {
			name: "Alice",
			memo: "notes",
			tagIds: ["t1", "t2"],
		});
	});

	it("rejects empty name", () => {
		expectRejects(appRouter.player.create, { name: "" });
	});

	it("rejects name exceeding max length (100)", () => {
		expectRejects(appRouter.player.create, { name: "a".repeat(101) });
	});

	it("accepts name at exactly 100 characters (boundary)", () => {
		expectAccepts(appRouter.player.create, { name: "a".repeat(100) });
	});

	it("rejects memo exceeding 50_000 characters", () => {
		expectRejects(appRouter.player.create, {
			name: "Alice",
			memo: "a".repeat(50_001),
		});
	});

	it("accepts memo at exactly 50_000 characters (boundary)", () => {
		expectAccepts(appRouter.player.create, {
			name: "Alice",
			memo: "a".repeat(50_000),
		});
	});

	it("rejects missing name", () => {
		expectRejects(appRouter.player.create, { memo: "x" });
	});
});

describe("player.update input validation", () => {
	it("accepts id-only payload (no-op)", () => {
		expectAccepts(appRouter.player.update, { id: "p1" });
	});

	it("accepts name update", () => {
		expectAccepts(appRouter.player.update, { id: "p1", name: "Bob" });
	});

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

	it("rejects empty name", () => {
		expectRejects(appRouter.player.update, { id: "p1", name: "" });
	});

	it("rejects name exceeding max length (100)", () => {
		expectRejects(appRouter.player.update, {
			id: "p1",
			name: "a".repeat(101),
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.update, { name: "Bob" });
	});
});

describe("player.delete input validation", () => {
	it("accepts a valid id", () => {
		expectAccepts(appRouter.player.delete, { id: "p1" });
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.player.delete, {});
	});
});

describe("player.create tag ownership (SA2-178)", () => {
	it("accepts tags owned by the caller and links them", async () => {
		const rows = new Map<unknown, Rows>([
			[playerTag, [{ id: "t1" }, { id: "t2" }]],
			[player, [{ id: "p-new", userId: OWNER }]],
			[playerToPlayerTag, []],
		]);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(
			caller.create({ name: "Alice", tagIds: ["t1", "t2"] })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
	});

	it("rejects a tag owned by another user and skips the join insert", async () => {
		const rows = new Map<unknown, Rows>([
			// Only one of the two requested tags is owned by the caller.
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
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expect(
			caller.update({ id: "p1", tagIds: ["t1", "t2"] })
		).resolves.toBeDefined();
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(true);
	});

	it("rejects a tag owned by another user and skips the join insert", async () => {
		const rows = ownedPlayerRows(
			new Map<unknown, Rows>([[playerTag, [{ id: "t1" }]]])
		);
		const { caller, inserted } = makeCaller(OWNER, rows);
		await expectTrpcCode(
			caller.update({ id: "p1", tagIds: ["t1", "t2"] }),
			"FORBIDDEN"
		);
		expect(inserted.some((i) => i.table === playerToPlayerTag)).toBe(false);
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
