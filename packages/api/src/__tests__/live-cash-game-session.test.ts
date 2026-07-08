import { currency } from "@sapphire2/db/schema/currency";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import { encodeSessionCursor } from "../routers/session";
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

describe("liveCashGameSession.create ring game ownership (SA2-181)", () => {
	it("accepts a ring game owned by the caller via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: "room-1",
						userId: OWNER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 1000, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("accepts a null-roomId auto-generated ring game owned via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: null,
						userId: OWNER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ initialBuyIn: 1000, ringGameId: "rg-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a ring game owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: "room-1",
						userId: OTHER,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
			],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ initialBuyIn: 0, ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a legacy ring game with null userId with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[
				ringGame,
				[
					{
						id: "rg-1",
						roomId: null,
						userId: null,
						minBuyIn: null,
						maxBuyIn: null,
					},
				],
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

describe("liveCashGameSession.update ring game ownership (SA2-181)", () => {
	it("accepts a ring game owned by the caller via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", userId: OWNER, currencyId: null }],
			],
			[room, [{ id: "room-1", userId: OWNER }]],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" })
		).resolves.toBeDefined();
	});

	it("accepts a null-roomId auto-generated ring game owned via userId", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: OWNER, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expect(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" })
		).resolves.toBeDefined();
	});

	it("rejects a ring game owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: "room-1", userId: OTHER, currencyId: null }],
			],
			[sessionCashDetail, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", ringGameId: "rg-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a legacy ring game with null userId with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: null, currencyId: null }],
			],
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
			[
				ringGame,
				[{ id: "rg-1", roomId: null, userId: OWNER, currencyId: null }],
			],
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

type ChainableAny = Promise<Rows> &
	Record<string, (...args: unknown[]) => ChainableAny>;

/**
 * Mock db that captures the list query's `.where(...)` (SQL + bound params) and
 * `.orderBy(...)` (SQL), and resolves the `game_session` select to `listRows`
 * while every other read (the per-item enrichment) resolves to `[]`. Lets the
 * composite-keyset cursor (SA2-150) be inspected end-to-end: the boundary must
 * embed the cursor's `(timestamp, id)` directly rather than run a subquery on
 * the raw id (which returned NULL — and dropped the whole page — once the cursor
 * row was discarded), and `nextCursor` must echo the last kept row's composite.
 */
function createListMockDb(listRows: Rows = []) {
	const listWhere: { params: unknown[]; sql: string }[] = [];
	const listOrderBy: string[] = [];
	const makeChain = (rows: Rows, isList: boolean): ChainableAny => {
		const chain = Promise.resolve(rows) as ChainableAny;
		chain.from = (table: unknown) => {
			const list = table === gameSession;
			return makeChain(list ? listRows : [], list);
		};
		chain.where = (cond: unknown) => {
			if (isList) {
				const q = dialect.sqlToQuery(cond as never);
				listWhere.push({ sql: q.sql, params: q.params });
			}
			return chain;
		};
		chain.orderBy = (...cols: unknown[]) => {
			if (isList) {
				listOrderBy.push(
					cols.map((c) => dialect.sqlToQuery(c as never).sql).join(", ")
				);
			}
			return chain;
		};
		chain.limit = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		return chain;
	};
	const db = { select: () => makeChain([], false) };
	return { db, listOrderBy, listWhere };
}

function listCaller(db: unknown) {
	return appRouter.createCaller({
		session: { user: { id: OWNER } },
		db,
	} as unknown as Parameters<typeof appRouter.createCaller>[0])
		.liveCashGameSession;
}

interface CursorRow {
	id: string;
	sessionDate: Date;
	startedAt: Date | null;
}

function makeCashRows(n: number): Rows {
	return Array.from({ length: n }, (_, i) => ({
		id: `s${i}`,
		userId: OWNER,
		status: "active",
		startedAt: new Date((i + 1) * 1_000_000),
		sessionDate: new Date((i + 1) * 1_000_000),
	}));
}

describe("liveCashGameSession.list composite keyset cursor (SA2-150)", () => {
	it("orders by the coalesced start key then id descending (stable tiebreak)", async () => {
		const { db, listOrderBy } = createListMockDb();
		await listCaller(db).list({ limit: 10 });
		expect(listOrderBy).toHaveLength(1);
		const order = listOrderBy[0]?.toLowerCase() ?? "";
		expect(order).toContain("coalesce");
		expect(order).toContain('"game_session"."id" desc');
	});

	it("adds no keyset condition when no cursor is supplied", async () => {
		const { db, listWhere } = createListMockDb();
		await listCaller(db).list({ limit: 10 });
		const base = listWhere[0];
		expect(base).toBeDefined();
		// Only the base filter binds the user id (once); no keyset expression.
		expect(base?.params.filter((p) => p === OWNER)).toHaveLength(1);
		expect(base?.sql.toLowerCase()).not.toContain("coalesce");
	});

	it("treats a malformed cursor as no cursor (does not filter every row out)", async () => {
		const { db, listWhere } = createListMockDb();
		// "no-separator" has no `_`, so parseSessionCursor returns null.
		await listCaller(db).list({ cursor: "no-separator", limit: 10 });
		const base = listWhere[0];
		expect(base?.params).not.toContain("no-separator");
		expect(base?.params.filter((p) => p === OWNER)).toHaveLength(1);
		expect(base?.sql.toLowerCase()).not.toContain("coalesce");
	});

	it("embeds the cursor's (timestamp, id) as a keyset, not a subquery on the id", async () => {
		const { db, listWhere } = createListMockDb();
		const cursor = encodeSessionCursor({
			id: "cur-id",
			startedAt: new Date(5_000_000),
			sessionDate: new Date(5_000_000),
		});
		await listCaller(db).list({ cursor, limit: 10 });
		const where = listWhere[0];
		// No correlated subquery — the old `SELECT started_at FROM game_session
		// WHERE id = cursor` is the exact statement that broke on a deleted row.
		expect(where?.sql.toLowerCase()).not.toContain("select");
		// 5_000_000 ms floored to 5000 s is bound twice (the `<` arm and the
		// `=` tiebreak arm); the id is bound once.
		expect(where?.params.filter((p) => p === 5000)).toHaveLength(2);
		expect(where?.params).toContain("cur-id");
		// The raw composite string is never bound as a parameter.
		expect(where?.params).not.toContain(cursor);
	});

	it("keeps paginating from the same keyset even when the cursor row was deleted", async () => {
		// The boundary is derived purely from the cursor value, so a since-deleted
		// cursor row cannot collapse the page (the SA2-150 regression).
		const { db, listWhere } = createListMockDb(makeCashRows(2));
		const cursor = encodeSessionCursor({
			id: "deleted-id",
			startedAt: new Date(9_000_000),
			sessionDate: new Date(9_000_000),
		});
		const result = await listCaller(db).list({ cursor, limit: 10 });
		const where = listWhere[0];
		expect(where?.sql.toLowerCase()).not.toContain("select");
		expect(where?.params.filter((p) => p === 9000)).toHaveLength(2);
		expect(where?.params).toContain("deleted-id");
		expect(result.items).toHaveLength(2);
	});

	it("returns nextCursor as the last kept row's composite value when more rows exist", async () => {
		const rows = makeCashRows(3);
		const { db } = createListMockDb(rows);
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBe(encodeSessionCursor(rows[1] as CursorRow));
	});

	it("returns no nextCursor at exactly the page-size boundary", async () => {
		const { db } = createListMockDb(makeCashRows(2));
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBeUndefined();
	});

	it("returns no nextCursor for a partial single page", async () => {
		const { db } = createListMockDb(makeCashRows(1));
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(1);
		expect(result.nextCursor).toBeUndefined();
	});

	it("returns empty items and no nextCursor when there are no sessions", async () => {
		const { db } = createListMockDb([]);
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeUndefined();
	});
});
