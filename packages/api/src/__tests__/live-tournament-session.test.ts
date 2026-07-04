import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { persistSessionBlindLevels } from "../routers/session";
import {
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

	it("accepts heroSeatPosition: null", () => {
		expectAccepts(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: null,
		});
	});

	it("rejects seat > 8", () => {
		expectRejects(appRouter.liveTournamentSession.updateHeroSeat, {
			id: "s1",
			heroSeatPosition: 9,
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
