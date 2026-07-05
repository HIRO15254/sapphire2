import { currency } from "@sapphire2/db/schema/currency";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import { t } from "../index";
import { appRouter } from "../routers";
import { persistSessionBlindLevels } from "../routers/session";
import {
	createChainableMockDb,
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

const BLIND_LEVEL_COLUMNS = 9;
const MAX_ROWS_PER_INSERT = Math.floor(100 / BLIND_LEVEL_COLUMNS); // 11

interface BlindLevelInput {
	ante?: number | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	isBreak: boolean;
	minutes?: number | null;
}

interface InsertedRow {
	level: number;
	sessionId: string;
}

function makeBlindLevels(count: number): BlindLevelInput[] {
	return Array.from({ length: count }, (_, i) => ({
		isBreak: false,
		blind1: (i + 1) * 100,
		blind2: (i + 1) * 200,
		blind3: null,
		ante: null,
		minutes: 15,
	}));
}

function createBlindLevelMockDb() {
	const deleteWhere = vi.fn().mockResolvedValue(undefined);
	const del = vi.fn(() => ({ where: deleteWhere }));
	const values = vi.fn().mockResolvedValue(undefined);
	const insert = vi.fn(() => ({ values }));
	return {
		db: { delete: del, insert } as never,
		del,
		deleteWhere,
		insert,
		values,
	};
}

/** The row array passed to each `.values()` call, in call order. */
function insertedChunks(values: ReturnType<typeof vi.fn>): InsertedRow[][] {
	return values.mock.calls.map((call) => call[0] as InsertedRow[]);
}

const createCaller = t.createCallerFactory(appRouter);

function callerFor(db: unknown, userId: string) {
	return createCaller({
		session: { user: { id: userId } },
		db,
	} as never);
}

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
		.liveTournamentSession;
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
	kind: "tournament",
	status: "active",
	source: "live",
	roomId: null,
	currencyId: null,
};

describe("liveTournamentSession.create ownership validation (SA2-102)", () => {
	it("accepts a room and currency owned by the caller", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OWNER }]],
		]);
		await expect(
			makeCaller(OWNER, rows).create({ roomId: "room-1", currencyId: "cur-1" })
		).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
	});

	it("rejects a room owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ roomId: "room-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ currencyId: "cur-1" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent room with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ roomId: "room-x" }),
			"NOT_FOUND"
		);
	});

	it("rejects a non-existent currency with NOT_FOUND", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ currencyId: "cur-x" }),
			"NOT_FOUND"
		);
	});

	it("does not validate ownership when room/currency are omitted", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, [{ id: "room-1", userId: OTHER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expect(makeCaller(OWNER, rows).create({})).resolves.toEqual(
			expect.objectContaining({ id: expect.any(String) })
		);
	});
});

describe("liveTournamentSession.update ownership validation (SA2-102)", () => {
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

describe("liveTournamentSession router", () => {
	it("appRouter has liveTournamentSession namespace", () => {
		expect(appRouter.liveTournamentSession).toBeDefined();
	});

	it("has list procedure", () => {
		expect(appRouter.liveTournamentSession.list).toBeDefined();
	});

	it("has getById procedure", () => {
		expect(appRouter.liveTournamentSession.getById).toBeDefined();
	});

	it("has create procedure", () => {
		expect(appRouter.liveTournamentSession.create).toBeDefined();
	});

	it("has update procedure", () => {
		expect(appRouter.liveTournamentSession.update).toBeDefined();
	});

	it("has discard procedure", () => {
		expect(appRouter.liveTournamentSession.discard).toBeDefined();
	});

	it("update accepts tournamentId input", () => {
		const inputSchema =
			appRouter.liveTournamentSession.update._def.inputs[0] ??
			appRouter.liveTournamentSession.update._def.inputs;
		const shape =
			(inputSchema as { shape?: Record<string, unknown> })?.shape ??
			(
				inputSchema as {
					_def?: { shape?: () => Record<string, unknown> };
				}
			)?._def?.shape?.();
		expect(shape).toBeDefined();
		expect(shape?.tournamentId).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.liveTournamentSession).sort()).toEqual(
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
		expectProtected(appRouter.liveTournamentSession.list);
		expectType(appRouter.liveTournamentSession.list, "query");
		expectProtected(appRouter.liveTournamentSession.getById);
		expectType(appRouter.liveTournamentSession.getById, "query");
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
			const proc = appRouter.liveTournamentSession[name];
			expectProtected(proc);
			expectType(proc, "mutation");
		}
	});
});

describe("liveTournamentSession.list input validation", () => {
	it("accepts all valid statuses", () => {
		for (const status of ["active", "paused", "completed"] as const) {
			expectAccepts(appRouter.liveTournamentSession.list, { status });
		}
	});

	it("rejects unknown status", () => {
		expectRejects(appRouter.liveTournamentSession.list, {
			status: "archived",
		});
	});

	it("rejects limit > 100", () => {
		expectRejects(appRouter.liveTournamentSession.list, { limit: 101 });
	});

	it("rejects limit < 1", () => {
		expectRejects(appRouter.liveTournamentSession.list, { limit: 0 });
	});
});

describe("liveTournamentSession.create input validation", () => {
	it("accepts empty object (all fields optional)", () => {
		expectAccepts(appRouter.liveTournamentSession.create, {});
	});

	it("accepts full payload", () => {
		expectAccepts(appRouter.liveTournamentSession.create, {
			roomId: "s1",
			tournamentId: "tn1",
			currencyId: "c1",
			buyIn: 10_000,
			entryFee: 1000,
			memo: "WSOP",
			timerStartedAt: 1_700_000_000,
		});
	});

	it("rejects negative buyIn", () => {
		expectRejects(appRouter.liveTournamentSession.create, { buyIn: -1 });
	});

	it("rejects non-integer entryFee", () => {
		expectRejects(appRouter.liveTournamentSession.create, { entryFee: 10.5 });
	});

	it("rejects non-integer timerStartedAt", () => {
		expectRejects(appRouter.liveTournamentSession.create, {
			timerStartedAt: 1.5,
		});
	});
});

describe("liveTournamentSession.complete input validation (discriminated union)", () => {
	it("accepts full-result branch (beforeDeadline: false) with all required fields", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 1,
			totalEntries: 30,
			prizeMoney: 1000,
			bountyPrizes: 200,
		});
	});

	it("accepts early-quit branch (beforeDeadline: true) without placement", () => {
		expectAccepts(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects beforeDeadline=false without placement", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			totalEntries: 30,
			prizeMoney: 500,
			bountyPrizes: 0,
		});
	});

	it("rejects placement < 1", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 0,
			totalEntries: 10,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects totalEntries < 1", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: false,
			placement: 1,
			totalEntries: 0,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});

	it("rejects negative prizeMoney", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			id: "s1",
			beforeDeadline: true,
			prizeMoney: -1,
			bountyPrizes: 0,
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveTournamentSession.complete, {
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});
	});
});

describe("liveTournamentSession.updateHeroSeat input validation", () => {
	it("accepts seat at boundaries 0 and 8", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 0,
		});
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 8,
		});
	});

	it("accepts heroSeatPosition 9 (last seat of a 10-max table)", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 9,
		});
	});

	it("accepts heroSeatPosition: null", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("rejects seat > 9", () => {
		expectRejects(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 10,
		});
	});
});

describe("liveTournamentSession.{reopen,discard,getById} input validation", () => {
	it("reopen accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.reopen, { id: "s1" });
	});

	it("discard accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.discard, { id: "s1" });
	});

	it("getById accepts {id}", () => {
		expectAccepts(appRouter.liveTournamentSession.getById, { id: "s1" });
	});

	it("reopen / discard / getById reject missing id", () => {
		expectRejects(appRouter.liveTournamentSession.reopen, {});
		expectRejects(appRouter.liveTournamentSession.discard, {});
		expectRejects(appRouter.liveTournamentSession.getById, {});
	});
});

describe("liveTournamentSession.updateSnapshot input validation", () => {
	it("accepts the minimum payload (id only — no-op call)", () => {
		expectAccepts(appRouter.liveTournamentSession.updateSnapshot, {
			id: "s1",
		});
	});

	it("accepts a full snapshot override payload", () => {
		expectAccepts(appRouter.liveTournamentSession.updateSnapshot, {
			id: "s1",
			ruleName: "Main Event (this session)",
			variant: "nlh",
			tournamentBuyIn: 10_000,
			entryFee: 1000,
			startingStack: 20_000,
			bountyAmount: null,
			tableSize: 9,
			blindLevels: [
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					ante: null,
					minutes: 15,
				},
			],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
		});
	});

	it("rejects missing id", () => {
		expectRejects(appRouter.liveTournamentSession.updateSnapshot, {
			ruleName: "x",
		});
	});

	it("rejects an empty ruleName", () => {
		expectRejects(appRouter.liveTournamentSession.updateSnapshot, {
			id: "s1",
			ruleName: "",
		});
	});

	it("rejects a non-integer chip purchase cost", () => {
		expectRejects(appRouter.liveTournamentSession.updateSnapshot, {
			id: "s1",
			chipPurchases: [{ name: "Rebuy", cost: 1.5, chips: 10_000 }],
		});
	});

	it("rejects a blind level missing isBreak", () => {
		expectRejects(appRouter.liveTournamentSession.updateSnapshot, {
			id: "s1",
			blindLevels: [{ blind1: 100 }],
		});
	});
});

// Regression guard for SA2-115: updateSnapshot re-seeds blind levels via the
// shared persistSessionBlindLevels helper, which DELETEs then re-INSERTs. D1
// rejects any statement binding >100 params, so a 9-column blind row must be
// chunked at 11 rows/INSERT. A single unchunked INSERT of >=12 levels (>=108
// params) would throw at runtime AFTER the DELETE already committed, wiping the
// session's blind structure permanently.
describe("persistSessionBlindLevels chunking (SA2-115)", () => {
	it("splits >11 blind levels into multiple INSERTs each within D1's 100-param cap", async () => {
		const { db, del, deleteWhere, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(12));

		// DELETE runs exactly once before any INSERT.
		expect(del).toHaveBeenCalledTimes(1);
		expect(deleteWhere).toHaveBeenCalledTimes(1);
		// 12 rows -> 11 + 1 => two INSERT statements.
		expect(insert).toHaveBeenCalledTimes(2);
		expect(del.mock.invocationCallOrder[0]).toBeLessThan(
			insert.mock.invocationCallOrder[0]
		);
		expect(values).toHaveBeenCalledTimes(2);
		const [firstChunk, secondChunk] = insertedChunks(values);
		expect(firstChunk).toHaveLength(MAX_ROWS_PER_INSERT);
		expect(secondChunk).toHaveLength(12 - MAX_ROWS_PER_INSERT);
		// Every INSERT stays under the 100 bound-parameter cap.
		for (const chunk of insertedChunks(values)) {
			expect(chunk.length * BLIND_LEVEL_COLUMNS).toBeLessThanOrEqual(100);
		}
	});

	it("inserts every level exactly once, in ascending level order across chunks", async () => {
		const { db, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(23));

		const allRows = insertedChunks(values).flat();
		expect(allRows).toHaveLength(23);
		expect(allRows.map((r) => r.level)).toEqual(
			Array.from({ length: 23 }, (_, i) => i + 1)
		);
		for (const row of allRows) {
			expect(row.sessionId).toBe("sess-1");
		}
	});

	it("keeps a single INSERT for exactly 11 levels (chunk boundary)", async () => {
		const { db, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(11));

		expect(insert).toHaveBeenCalledTimes(1);
		expect(values).toHaveBeenCalledTimes(1);
		expect(insertedChunks(values).flat()).toHaveLength(11);
	});

	it("splits into two INSERTs for 12 levels (one over the boundary)", async () => {
		const { db, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(12));

		expect(insert).toHaveBeenCalledTimes(2);
		expect(values).toHaveBeenCalledTimes(2);
	});

	it("keeps a single INSERT for the small-N case (behavior unchanged)", async () => {
		const { db, del, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(5));

		expect(del).toHaveBeenCalledTimes(1);
		expect(insert).toHaveBeenCalledTimes(1);
		expect(values).toHaveBeenCalledTimes(1);
		expect(insertedChunks(values).flat()).toHaveLength(5);
	});

	it("DELETEs only and issues no INSERT for an empty blind-level list", async () => {
		const { db, del, deleteWhere, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", []);

		expect(del).toHaveBeenCalledTimes(1);
		expect(deleteWhere).toHaveBeenCalledTimes(1);
		expect(insert).not.toHaveBeenCalled();
		expect(values).not.toHaveBeenCalled();
	});
});

describe("liveTournamentSession.create tournament ownership (IDOR guard)", () => {
	const CALLER = "user-1";
	const OTHER = "user-2";
	const TOURNAMENT_ID = "tn-1";
	const ROOM_ID = "room-1";

	function mockDb(opts: {
		tournament?: Record<string, unknown>[];
		room?: Record<string, unknown>[];
		blindLevels?: Record<string, unknown>[];
		chipPurchases?: Record<string, unknown>[];
	}) {
		return createChainableMockDb({
			select: {
				// no session is currently active
				game_session: [],
				tournament: opts.tournament ?? [],
				room: opts.room ?? [],
				blind_level: opts.blindLevels ?? [],
				tournament_chip_purchase: opts.chipPurchases ?? [],
			},
		});
	}

	it("creates the session and snapshots the structure when the caller owns the tournament", async () => {
		const { db, inserted, selectedTables } = mockDb({
			tournament: [
				{
					id: TOURNAMENT_ID,
					roomId: ROOM_ID,
					name: "Main Event",
					variant: "nlh",
					buyIn: 10_000,
					entryFee: 1000,
					startingStack: 20_000,
					bountyAmount: null,
					tableSize: 9,
					currencyId: null,
				},
			],
			room: [{ id: ROOM_ID, userId: CALLER }],
			blindLevels: [
				{ level: 1, isBreak: false, blind1: 100, blind2: 200, minutes: 15 },
			],
		});

		const result = await callerFor(db, CALLER).liveTournamentSession.create({
			tournamentId: TOURNAMENT_ID,
		});

		expect(typeof result.id).toBe("string");
		// The room must be read to confirm tournament ownership.
		expect(selectedTables).toContain("room");
		// The session and its structure snapshot were persisted.
		expect(inserted.game_session).toHaveLength(1);
		expect(inserted.session_tournament_detail).toHaveLength(1);
		expect(inserted.session_blind_level).toHaveLength(1);
	});

	it("throws FORBIDDEN and writes nothing when the tournament belongs to another user", async () => {
		const { db, inserted } = mockDb({
			tournament: [{ id: TOURNAMENT_ID, roomId: ROOM_ID }],
			room: [{ id: ROOM_ID, userId: OTHER }],
		});

		await expect(
			callerFor(db, CALLER).liveTournamentSession.create({
				tournamentId: TOURNAMENT_ID,
			})
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
		// The guard runs before any write, so nothing is persisted.
		expect(inserted.game_session).toBeUndefined();
		expect(inserted.session_blind_level).toBeUndefined();
	});

	it("throws NOT_FOUND and writes nothing when the tournament does not exist", async () => {
		const { db, inserted } = mockDb({ tournament: [] });

		await expect(
			callerFor(db, CALLER).liveTournamentSession.create({
				tournamentId: "missing",
			})
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Tournament not found",
		});
		expect(inserted.game_session).toBeUndefined();
	});

	it("skips tournament ownership validation when tournamentId is omitted", async () => {
		const { db, inserted, selectedTables } = mockDb({});

		const result = await callerFor(db, CALLER).liveTournamentSession.create({});

		expect(typeof result.id).toBe("string");
		// No tournament / room lookups happen without a tournamentId.
		expect(selectedTables).not.toContain("tournament");
		expect(selectedTables).not.toContain("room");
		expect(inserted.game_session).toHaveLength(1);
		expect(inserted.session_blind_level).toBeUndefined();
	});
});

const listCursorDialect = new SQLiteSyncDialect();

/**
 * Mock db recording the SQL params bound to the list query's `.where(...)` so
 * the cursor-boundary subquery can be shown to be scoped to the caller
 * (SA2-182). `select().from()` resolves to no rows; enrichment is skipped.
 */
function createListWhereMockDb() {
	const selectWhereParams: unknown[][] = [];
	const makeChain = () => {
		const chain = Promise.resolve([] as Rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.from = () => chain;
		chain.where = (cond: unknown) => {
			selectWhereParams.push(
				listCursorDialect.sqlToQuery(cond as never).params
			);
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

describe("liveTournamentSession.list cursor scoping (SA2-182)", () => {
	it("scopes the cursor boundary subquery to the caller's user id", async () => {
		const { db, selectWhereParams } = createListWhereMockDb();
		await callerFor(db, OWNER).liveTournamentSession.list({
			cursor: "s-cursor",
			limit: 10,
		});
		const listWhere = selectWhereParams.find((p) => p.includes("s-cursor"));
		expect(listWhere).toBeDefined();
		// userId appears twice: the base filter + the cursor subquery scope.
		expect((listWhere as unknown[]).filter((p) => p === OWNER)).toHaveLength(2);
	});

	it("does not add a cursor subquery when no cursor is supplied", async () => {
		const { db, selectWhereParams } = createListWhereMockDb();
		await callerFor(db, OWNER).liveTournamentSession.list({ limit: 10 });
		const base = selectWhereParams[0] as unknown[];
		expect(base.filter((p) => p === OWNER)).toHaveLength(1);
	});
});
