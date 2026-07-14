import { currency } from "@sapphire2/db/schema/currency";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import { t } from "../index";
import { appRouter } from "../routers";
import {
	encodeSessionCursor,
	persistSessionBlindLevels,
} from "../routers/session";
import {
	createChainableMockDb,
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

const BLIND_LEVEL_COLUMNS = 10;
const MAX_ROWS_PER_INSERT = Math.floor(100 / BLIND_LEVEL_COLUMNS); // 10

interface BlindLevelInput {
	ante?: number | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	isBreak: boolean;
	minutes?: number | null;
}

interface InsertedRow {
	games?: unknown;
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
	// persistSessionBlindLevels now commits the DELETE + chunked INSERTs through
	// a single db.batch (SA2-116); each statement is a resolved promise here.
	const batch = vi.fn((statements: unknown[]) =>
		Promise.all(statements as Promise<unknown>[])
	);
	return {
		db: { delete: del, insert, batch } as never,
		del,
		deleteWhere,
		insert,
		values,
		batch,
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
		batch: (statements: Promise<unknown>[]) => Promise.all(statements),
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

	it("rejects a non-existent room with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ roomId: "room-x" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent currency with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, []],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).create({ currencyId: "cur-x" }),
			"FORBIDDEN"
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

	it("rejects a non-existent room with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", roomId: "room-x" }),
			"FORBIDDEN"
		);
	});

	it("rejects a non-existent currency with FORBIDDEN", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[currency, []],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).update({ id: "s1", currencyId: "cur-x" }),
			"FORBIDDEN"
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

	it("has atomic createAndAssignTournament procedure", () => {
		expect(
			appRouter.liveTournamentSession.createAndAssignTournament
		).toBeDefined();
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
				"createAndAssignTournament",
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
			"createAndAssignTournament",
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

describe("liveTournamentSession.createAndAssignTournament input validation", () => {
	it("accepts a full tournament-with-structure payload plus sessionId", () => {
		expectAccepts(appRouter.liveTournamentSession.createAndAssignTournament, {
			sessionId: "s1",
			roomId: "room-1",
			name: "Main",
			variant: "NL Hold'em",
			buyIn: 100,
			entryFee: 10,
			startingStack: 20_000,
			bountyAmount: 25,
			tableSize: 9,
			currencyId: "cur-1",
			memo: "note",
			tags: ["Deep"],
			chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200, minutes: 15 }],
		});
	});

	it("rejects missing sessionId, roomId, or an empty name", () => {
		expectRejects(appRouter.liveTournamentSession.createAndAssignTournament, {
			roomId: "room-1",
			name: "Main",
		});
		expectRejects(appRouter.liveTournamentSession.createAndAssignTournament, {
			sessionId: "s1",
			name: "Main",
		});
		expectRejects(appRouter.liveTournamentSession.createAndAssignTournament, {
			sessionId: "s1",
			roomId: "room-1",
			name: "",
		});
	});
});

describe("liveTournamentSession.createAndAssignTournament authorization", () => {
	const payload = {
		sessionId: "s1",
		roomId: "room-1",
		name: "Main",
	};

	it("rejects a live tournament session owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [{ ...ownedSession, userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignTournament(payload),
			"NOT_FOUND"
		);
	});

	it("rejects non-tournament and non-live sessions before writing", async () => {
		for (const session of [
			{ ...ownedSession, kind: "cash_game" },
			{ ...ownedSession, source: "manual" },
		]) {
			const rows = new Map<unknown, Rows>([[gameSession, [session]]]);
			await expectTrpcCode(
				makeCaller(OWNER, rows).createAndAssignTournament(payload),
				"NOT_FOUND"
			);
		}
	});

	it("rejects a room owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignTournament(payload),
			"FORBIDDEN"
		);
	});

	it("rejects a currency owned by another user before writing", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [ownedSession]],
			[room, [{ id: "room-1", userId: OWNER }]],
			[currency, [{ id: "cur-1", userId: OTHER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignTournament({
				...payload,
				currencyId: "cur-1",
			}),
			"FORBIDDEN"
		);
	});

	it("rejects assigning a new master from a different room than the session", async () => {
		const rows = new Map<unknown, Rows>([
			[gameSession, [{ ...ownedSession, roomId: "room-existing" }]],
			[room, [{ id: "room-1", userId: OWNER }]],
		]);
		await expectTrpcCode(
			makeCaller(OWNER, rows).createAndAssignTournament(payload),
			"BAD_REQUEST"
		);
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
// rejects any statement binding >100 params, so a 10-column blind row must be
// chunked at 10 rows/INSERT. A single unchunked INSERT of >=11 levels (>=110
// params) would throw at runtime AFTER the DELETE already committed, wiping the
// session's blind structure permanently.
describe("persistSessionBlindLevels chunking (SA2-115)", () => {
	it("splits >10 blind levels into multiple INSERTs each within D1's 100-param cap", async () => {
		const { db, del, deleteWhere, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(12));

		// DELETE runs exactly once before any INSERT.
		expect(del).toHaveBeenCalledTimes(1);
		expect(deleteWhere).toHaveBeenCalledTimes(1);
		// 12 rows -> 10 + 2 => two INSERT statements.
		expect(insert).toHaveBeenCalledTimes(2);
		const deleteOrder = del.mock.invocationCallOrder[0];
		const insertOrder = insert.mock.invocationCallOrder[0];
		if (deleteOrder === undefined || insertOrder === undefined) {
			throw new Error("expected delete and insert invocations");
		}
		expect(deleteOrder).toBeLessThan(insertOrder);
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

	it("keeps a single INSERT for exactly 10 levels (chunk boundary)", async () => {
		const { db, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(10));

		expect(insert).toHaveBeenCalledTimes(1);
		expect(values).toHaveBeenCalledTimes(1);
		expect(insertedChunks(values).flat()).toHaveLength(10);
	});

	it("splits into two INSERTs for 11 levels (one over the boundary)", async () => {
		const { db, insert, values } = createBlindLevelMockDb();

		await persistSessionBlindLevels(db, "sess-1", makeBlindLevels(11));

		expect(insert).toHaveBeenCalledTimes(2);
		expect(values).toHaveBeenCalledTimes(2);
	});

	it("writes per-level game groups through the re-seed", async () => {
		const { db, values } = createBlindLevelMockDb();
		const games = [
			{ name: "Limit", variants: ["lhe", "o8"], blind1: 400, blind2: 800 },
		];

		await persistSessionBlindLevels(db, "sess-1", [
			{ isBreak: false, blind1: 100, blind2: 200, games },
			{ isBreak: false, blind1: 200, blind2: 400 },
		]);

		const allRows = insertedChunks(values).flat();
		expect(allRows[0]?.games).toEqual(games);
		expect(allRows[1]?.games).toBeNull();
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

	it("throws FORBIDDEN and writes nothing when the tournament does not exist", async () => {
		const { db, inserted } = mockDb({ tournament: [] });

		await expect(
			callerFor(db, CALLER).liveTournamentSession.create({
				tournamentId: "missing",
			})
		).rejects.toMatchObject({
			code: "FORBIDDEN",
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
				const q = listCursorDialect.sqlToQuery(cond as never);
				listWhere.push({ sql: q.sql, params: q.params });
			}
			return chain;
		};
		chain.orderBy = (...cols: unknown[]) => {
			if (isList) {
				listOrderBy.push(
					cols
						.map((c) => listCursorDialect.sqlToQuery(c as never).sql)
						.join(", ")
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
	return callerFor(db, OWNER).liveTournamentSession;
}

interface CursorRow {
	id: string;
	sessionDate: Date;
	startedAt: Date | null;
}

function makeTournamentRows(n: number): Rows {
	return Array.from({ length: n }, (_, i) => ({
		id: `s${i}`,
		userId: OWNER,
		status: "active",
		startedAt: new Date((i + 1) * 1_000_000),
		sessionDate: new Date((i + 1) * 1_000_000),
		startingStack: null,
	}));
}

describe("liveTournamentSession.list composite keyset cursor (SA2-150)", () => {
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
		expect(base?.params.filter((p) => p === OWNER)).toHaveLength(1);
		expect(base?.sql.toLowerCase()).not.toContain("coalesce");
	});

	it("treats a malformed cursor as no cursor (does not filter every row out)", async () => {
		const { db, listWhere } = createListMockDb();
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
		expect(where?.sql.toLowerCase()).not.toContain("select");
		expect(where?.params.filter((p) => p === 5000)).toHaveLength(2);
		expect(where?.params).toContain("cur-id");
		expect(where?.params).not.toContain(cursor);
	});

	it("keeps paginating from the same keyset even when the cursor row was deleted", async () => {
		const { db, listWhere } = createListMockDb(makeTournamentRows(2));
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
		const rows = makeTournamentRows(3);
		const { db } = createListMockDb(rows);
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBe(
			encodeSessionCursor(rows[1] as unknown as CursorRow)
		);
	});

	it("returns no nextCursor at exactly the page-size boundary", async () => {
		const { db } = createListMockDb(makeTournamentRows(2));
		const result = await listCaller(db).list({ limit: 2 });
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBeUndefined();
	});

	it("returns no nextCursor for a partial single page", async () => {
		const { db } = createListMockDb(makeTournamentRows(1));
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

// SA2-151: the list endpoint fetched session_event with one query per page item
// (an N+1 that D1's per-query latency made expensive at page size). It now
// collects the page's session ids and fetches every event in ONE inArray batch,
// then buckets rows by session id. These tests pin the single-query shape, the
// per-session bucketing (eventCount + the computeStackStats-derived fields), and
// the (occurredAt, sortOrder) ordering the current-stack derivation depends on.
const listEventBatchDialect = new SQLiteSyncDialect();

function sessionEventRow(
	sessionId: string,
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt: number,
	sortOrder: number
): Record<string, unknown> {
	return {
		sessionId,
		eventType,
		payload: JSON.stringify(payload),
		occurredAt: new Date(occurredAt),
		sortOrder,
	};
}

/**
 * Mock db for the list-enrichment path: `select().from(gameSession)` resolves
 * to the page rows, `select().from(sessionEvent)` resolves to every event row
 * (the mock ignores the `inArray` filter, so bucketing must be done in app
 * code). It records which table each `.from(...)` targeted and the conditions
 * bound to the sessionEvent `.where(...)` so a single batched IN can be proven.
 */
function createEventBatchMockDb(sessions: Rows, events: Rows) {
	const fromCalls: unknown[] = [];
	const eventWhere: unknown[] = [];
	const makeChain = (table: unknown) => {
		const rows = table === sessionEvent ? events : sessions;
		const chain = Promise.resolve(rows) as Promise<Rows> &
			Record<string, (...args: unknown[]) => unknown>;
		chain.where = (cond: unknown) => {
			if (table === sessionEvent) {
				eventWhere.push(cond);
			}
			return chain;
		};
		chain.orderBy = () => chain;
		chain.limit = () => chain;
		chain.leftJoin = () => chain;
		chain.innerJoin = () => chain;
		chain.groupBy = () => chain;
		return chain;
	};
	const db = {
		select: () => ({
			from: (table: unknown) => {
				fromCalls.push(table);
				return makeChain(table);
			},
		}),
	};
	return { db, fromCalls, eventWhere };
}

function sessionEventFromCount(fromCalls: unknown[]): number {
	return fromCalls.filter((t) => t === sessionEvent).length;
}

describe("liveTournamentSession.list event batching (SA2-151)", () => {
	it("fetches the whole page's events in a single inArray query, not one per session", async () => {
		const sessions: Rows = [
			{ id: "s1", startingStack: 20_000 },
			{ id: "s2", startingStack: 20_000 },
			{ id: "s3", startingStack: null },
		];
		const events: Rows = [
			sessionEventRow("s1", "session_start", {}, 1000, 0),
			sessionEventRow("s2", "session_start", {}, 1000, 0),
		];
		const { db, fromCalls, eventWhere } = createEventBatchMockDb(
			sessions,
			events
		);

		const result = await listCaller(db).list({ limit: 20 });

		expect(sessionEventFromCount(fromCalls)).toBe(1);
		const query = listEventBatchDialect.sqlToQuery(eventWhere[0] as never);
		expect(query.sql).toContain("in (");
		expect(query.params).toEqual(["s1", "s2", "s3"]);
		expect(result.items).toHaveLength(3);
	});

	it("buckets events by session id so each item derives from only its own events", async () => {
		const sessions: Rows = [
			{ id: "s1", startingStack: 20_000 },
			{ id: "s2", startingStack: 20_000 },
		];
		const events: Rows = [
			sessionEventRow("s1", "session_start", {}, 1000, 0),
			sessionEventRow(
				"s1",
				"update_stack",
				{ stackAmount: 25_000, remainingPlayers: 100, totalEntries: 100 },
				2000,
				1
			),
			sessionEventRow(
				"s1",
				"update_stack",
				{ stackAmount: 30_000, remainingPlayers: 50 },
				3000,
				2
			),
			// s2 has no events.
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });
		const byId = Object.fromEntries(result.items.map((i) => [i.id, i]));

		expect(byId.s1?.eventCount).toBe(3);
		expect(byId.s1?.latestStackAmount).toBe(30_000);
		expect(byId.s1?.remainingPlayers).toBe(50);
		// (startingStack * totalEntries + chipTotal) / remainingPlayers
		// = (20000 * 100 + 0) / 50 = 40000.
		expect(byId.s1?.averageStack).toBe(40_000);
		expect(byId.s2?.eventCount).toBe(0);
		expect(byId.s2?.latestStackAmount).toBeNull();
		expect(byId.s2?.remainingPlayers).toBeNull();
		expect(byId.s2?.averageStack).toBeNull();
	});

	it("derives the current stack from (occurredAt, sortOrder) order, not array order", async () => {
		const sessions: Rows = [{ id: "s1", startingStack: null }];
		const events: Rows = [
			sessionEventRow("s1", "update_stack", { stackAmount: 3000 }, 3000, 1),
			sessionEventRow("s1", "update_stack", { stackAmount: 1000 }, 1000, 1),
			sessionEventRow("s1", "update_stack", { stackAmount: 2000 }, 2000, 1),
		];
		const { db } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items[0]?.latestStackAmount).toBe(3000);
	});

	it("batches once for a single-session page", async () => {
		const sessions: Rows = [{ id: "only", startingStack: 15_000 }];
		const events: Rows = [
			sessionEventRow("only", "session_start", {}, 1000, 0),
			sessionEventRow("only", "update_stack", { stackAmount: 18_000 }, 2000, 1),
		];
		const { db, fromCalls } = createEventBatchMockDb(sessions, events);

		const result = await listCaller(db).list({ limit: 20 });

		expect(sessionEventFromCount(fromCalls)).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.eventCount).toBe(2);
		expect(result.items[0]?.latestStackAmount).toBe(18_000);
	});

	it("issues no event query and returns no items for an empty page", async () => {
		const { db, fromCalls } = createEventBatchMockDb([], []);

		const result = await listCaller(db).list({ limit: 20 });

		expect(result.items).toEqual([]);
		expect(result.nextCursor).toBeUndefined();
		expect(sessionEventFromCount(fromCalls)).toBe(0);
	});
});

describe("liveTournamentSession.updateSnapshot per-level games", () => {
	it("accepts blind levels carrying game groups", () => {
		expectAccepts(appRouter.liveTournamentSession.updateSnapshot, {
			id: "session-1",
			blindLevels: [
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					minutes: 20,
					games: [
						{ name: "Limit", variants: ["lhe"], blind1: 400, blind2: 800 },
						{ variants: ["nlh"], blind1: 100, blind2: 200 },
					],
				},
			],
		});
	});

	it("rejects duplicate variants across a level's groups", () => {
		expectRejects(appRouter.liveTournamentSession.updateSnapshot, {
			id: "session-1",
			blindLevels: [
				{
					isBreak: false,
					games: [{ variants: ["lhe"] }, { variants: ["lhe"] }],
				},
			],
		});
	});
});
