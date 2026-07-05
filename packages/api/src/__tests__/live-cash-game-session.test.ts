import { currency } from "@sapphire2/db/schema/currency";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
	getInputSchema,
} from "./test-utils";

type Rows = Record<string, unknown>[];

/**
 * Minimal drizzle-shaped mock db: `select().from(t).where().limit()` chains
 * resolve to the rows registered for table `t`; `insert`/`update`/`delete`
 * resolve to no-ops. Keyed by the imported schema object reference so the
 * ownership `select().from(room|currency)` reads the seeded owner rows.
 */
type ChainablePromise = Promise<Rows> & Record<string, () => ChainablePromise>;

function createMockDb(tableRows: Map<unknown, Rows>) {
	const makeResult = (table: unknown): ChainablePromise => {
		const promise = Promise.resolve(
			tableRows.get(table) ?? []
		) as ChainablePromise;
		const same = () => promise;
		for (const method of [
			"where",
			"limit",
			"orderBy",
			"groupBy",
			"innerJoin",
			"leftJoin",
		]) {
			promise[method] = same;
		}
		return promise;
	};
	return {
		select: () => ({ from: (table: unknown) => makeResult(table) }),
		insert: () => ({ values: () => Promise.resolve(undefined) }),
		update: () => ({
			set: () => ({ where: () => Promise.resolve(undefined) }),
		}),
		delete: () => ({ where: () => Promise.resolve(undefined) }),
	};
}

function makeCaller(userId: string, tableRows: Map<unknown, Rows>) {
	return appRouter.createCaller({
		session: { user: { id: userId } },
		db: createMockDb(tableRows),
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.liveCashGameSession;
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

const ownedSession = {
	id: "s1",
	userId: OWNER,
	kind: "cash_game",
	status: "active",
	source: "live",
	roomId: null,
	currencyId: null,
};

describe("liveCashGameSession.create ownership validation (SA2-102)", () => {
	it("accepts a room and currency owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OWNER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({
				initialBuyIn: 1000,
				roomId: "room-1",
				currencyId: "cur-1",
			})
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a room owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, roomId: "room-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent room with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, roomId: "room-x" }),
			"NOT_FOUND"
		);
	});

	it("rejects a non-existent currency with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, currencyId: "cur-x" }),
			"NOT_FOUND"
		);
	});

	it("does not validate ownership when room/currency are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0 })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});
});

describe("liveCashGameSession.update ownership validation (SA2-102)", () => {
	it("accepts a room and currency owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OWNER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({
				id: "s1",
				roomId: "room-1",
				currencyId: "cur-1",
			})
		).resolves.toBeDefined();
	});

	it("rejects a room owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", roomId: "room-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent room with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", roomId: "room-x" }),
			"NOT_FOUND"
		);
	});

	it("rejects a non-existent currency with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", currencyId: "cur-x" }),
			"NOT_FOUND"
		);
	});

	it("clears roomId/currencyId with null without an ownership error", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({
				id: "s1",
				roomId: null,
				currencyId: null,
			})
		).resolves.toBeDefined();
	});

	it("does not validate ownership when room/currency are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", memo: "note" })
		).resolves.toBeDefined();
	});
});

describe("liveCashGameSession.create ring game ownership (SA2-174)", () => {
	it("accepts a ring game whose room is owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", minBuyIn: null, maxBuyIn: null }],
			],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 1000, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a ring game whose room belongs to another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", minBuyIn: null, maxBuyIn: null }],
			],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a ring game with a null roomId (auto-generated row) with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, minBuyIn: null, maxBuyIn: null }],
			],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent ring game with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[ringGame, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-x" }),
			"NOT_FOUND"
		);
	});
});

describe("liveCashGameSession.update ring game ownership (SA2-174)", () => {
	it("accepts a ring game whose room is owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, [{ id: "rg-1", roomId: "room-1", currencyId: null }]],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" })
		).resolves.toBeDefined();
	});

	it("rejects a ring game whose room belongs to another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, [{ id: "rg-1", roomId: "room-1", currencyId: null }]],
			[room, [{ id: "room-1", userId: OTHER }]],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a ring game with a null roomId (auto-generated row) with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, [{ id: "rg-1", roomId: null, currencyId: null }]],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent ring game with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, []],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-x" }),
			"NOT_FOUND"
		);
	});

	it("clears ringGameId with null without an ownership error", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[ringGame, [{ id: "rg-1", roomId: null, currencyId: null }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: null })
		).resolves.toBeDefined();
	});
});

describe("liveCashGameSession router", () => {
	it("appRouter has liveCashGameSession namespace", () => {
		expect(appRouter.liveCashGameSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveCashGameSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveCashGameSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveCashGameSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveCashGameSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveCashGameSession.discard).toBeDefined();
	});

	it("update accepts ringGameId input", () => {
		const inputSchema =
			appRouter.liveCashGameSession.update._def.inputs[0] ??
			appRouter.liveCashGameSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.ringGameId).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveCashGameSession).sort()).toEqual(
			[
				"complete",
				"create",
				"discard",
				"getById",
				"list",
				"reopen",
				"update",
				"updateHeroSeat",
				"updateSnapshot",
			].sort()
		);
	});

	it("list / getById are protected queries", () => {
		expectProtected(appRouter.liveCashGameSession.list);
		expectType(appRouter.liveCashGameSession.list, "query");
		expectProtected(appRouter.liveCashGameSession.getById);
		expectType(appRouter.liveCashGameSession.getById, "query");
	});

	it("all mutations are protected mutations", () => {
		for (const name of [
			"create",
			"update",
			"complete",
			"reopen",
			"discard",
			"updateHeroSeat",
			"updateSnapshot",
		] as const) {
			const proc = appRouter.liveCashGameSession[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("liveCashGameSession.list input validation", () => {
	it("accepts empty object (limit defaults to 20)", () => {
		const schema = getInputSchema(appRouter.liveCashGameSession.list);
		const parsed = schema.safeParse({}) as unknown as {
			success: true;
			data: { limit: number };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.limit).toBe(20);
	});

	it("accepts all valid status values", () => {
		for (const status of ["active", "paused", "completed"] as const) {
			expectAccepts(appRouter.liveCashGameSession.list, { status });
		}
	});

	it("rejects unknown status", () => {
		expectRejects(appRouter.liveCashGameSession.list, { status: "ended" });
	});

	it("accepts limit at boundaries (1 and 100)", () => {
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 1 });
		expectAccepts(appRouter.liveCashGameSession.list, { limit: 100 });
	});

	it("rejects limit above 100", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 101 });
	});

	it("rejects limit below 1", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 0 });
	});

	it("rejects non-integer limit", () => {
		expectRejects(appRouter.liveCashGameSession.list, { limit: 10.5 });
	});
});

describe("liveCashGameSession.create input validation", () => {
	it("accepts minimal payload (initialBuyIn only)", () => {
		expectAccepts(appRouter.liveCashGameSession.create, {
			initialBuyIn: 0,
		});
	});

	it("accepts all optional link fields", () => {
		expectAccepts(appRouter.liveCashGameSession.create, {
			roomId: "s1",
			ringGameId: "rg1",
			currencyId: "c1",
			memo: "session memo",
			initialBuyIn: 1000,
		});
	});

	it("rejects negative initialBuyIn", () => {
		expectRejects(appRouter.liveCashGameSession.create, {
			initialBuyIn: -1,
		});
	});

	it("rejects missing initialBuyIn", () => {
		expectRejects(appRouter.liveCashGameSession.create, { memo: "x" });
	});
});

describe("liveCashGameSession.update input validation", () => {
	it("accepts id-only payload", () => {
		expectAccepts(appRouter.liveCashGameSession.update, { id: "s1" });
	});

	it("accepts explicit null clears for link fields", () => {
		expectAccepts(appRouter.liveCashGameSession.update, {
			id: "s1",
			roomId: null,
			currencyId: null,
			ringGameId: null,
			memo: null,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.update, { memo: "x" });
	});
});

describe("liveCashGameSession.complete input validation", () => {
	it("accepts a valid finalStack of 0 (all-in loss)", () => {
		expectAccepts(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 0,
		});
	});

	it("rejects negative finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: -1,
		});
	});

	it("rejects non-integer finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, {
			id: "s1",
			finalStack: 1.5,
		});
	});

	it("rejects missing finalStack", () => {
		expectRejects(appRouter.liveCashGameSession.complete, { id: "s1" });
	});
});

describe("liveCashGameSession.updateHeroSeat input validation", () => {
	it("accepts seat position at boundary 0 and 8", () => {
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 0,
		});
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 8,
		});
	});

	it("accepts heroSeatPosition 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 9,
		});
	});

	it("accepts heroSeatPosition: null (hero stands up)", () => {
		expectAccepts(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("rejects seat position outside [0, 9]", () => {
		expectRejects(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 10,
		});
		expectRejects(appRouter.liveCashGameSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: -1,
		});
	});
});

describe("liveCashGameSession.{reopen,discard,getById} input validation", () => {
	it("reopen accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.reopen, { id: "s1" });
	});

	it("reopen rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.reopen, {});
	});

	it("discard accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.discard, { id: "s1" });
	});

	it("discard rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.discard, {});
	});

	it("getById accepts {id}", () => {
		expectAccepts(appRouter.liveCashGameSession.getById, { id: "s1" });
	});

	it("getById rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.getById, {});
	});
});

describe("liveCashGameSession.updateSnapshot input validation", () => {
	it("accepts the minimum payload (id only — no-op call)", () => {
		expectAccepts(appRouter.liveCashGameSession.updateSnapshot, { id: "s1" });
	});

	it("accepts a full snapshot override payload", () => {
		expectAccepts(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			ruleName: "1/2 NLH (this session)",
			variant: "nlh",
			blind1: 1,
			blind2: 2,
			blind3: null,
			ante: 5,
			anteType: "all",
			minBuyIn: 100,
			maxBuyIn: 400,
			tableSize: 9,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			ruleName: "x",
		});
	});

	it("rejects an empty ruleName", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			ruleName: "",
		});
	});

	it("rejects an unknown anteType value", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			anteType: "weird",
		});
	});

	it("rejects a non-integer blind1", () => {
		expectRejects(appRouter.liveCashGameSession.updateSnapshot, {
			id: "s1",
			blind1: 1.5,
		});
	});
});

const dialect = new SQLiteSyncDialect();

/**
 * Mock db that records the SQL params bound to the list query's `.where(...)`
 * so the cursor-boundary subquery can be shown to be scoped to the caller
 * (SA2-182). `select().from()` resolves to no rows; the enrichment loop is
 * skipped because there are no items.
 */
function createListWhereMockDb() {
	const selectWhereParams: unknown[][] = [];
	const makeChain = () => {
		const chain = Promise.resolve([] as Rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = () => chain;
		chain.where = (cond: unknown) => {
			selectWhereParams.push(dialect.sqlToQuery(cond as never).params);
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		return chain;
	};
	const db = { select: () => makeChain() };
	return { db, selectWhereParams };
}

describe("liveCashGameSession.list cursor scoping (SA2-182)", () => {
	it("scopes the cursor boundary subquery to the caller's user id", async () => {
		const { db, selectWhereParams } = createListWhereMockDb();
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);
		await caller.liveCashGameSession.list({ cursor: "s-cursor", limit: 10 });
		const listWhere = selectWhereParams.find((p) => p.includes("s-cursor"));
		expect(listWhere).toBeDefined();
		// userId appears twice: the base filter + the cursor subquery scope.
		expect((listWhere as unknown[]).filter((p) => p === OWNER)).toHaveLength(2);
	});

	it("does not add a cursor subquery when no cursor is supplied", async () => {
		const { db, selectWhereParams } = createListWhereMockDb();
		const caller = appRouter.createCaller({
			session: { user: { id: OWNER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);
		await caller.liveCashGameSession.list({ limit: 10 });
		const base = selectWhereParams[0] as unknown[];
		expect(base.filter((p) => p === OWNER)).toHaveLength(1);
	});
});
