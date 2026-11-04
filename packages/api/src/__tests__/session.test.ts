import { sessionTag } from "@sapphire2/db/schema/session-tag";
import { describe, expect, it } from "vitest";
import { chunkForInsert, selectInChunks } from "../lib/batch";
import {
	validateEntityOwnership,
	validateTagsOwnership,
} from "../lib/ownership";
import {
	computeCashGamePL,
	computeTournamentPL,
	type ProfitLossSeriesRow,
	resolveEvCashOut,
	toProfitLossSeriesPoint,
} from "../services/session-stats";
import { createChainableMockDb } from "./test-utils";

describe("resolveEvCashOut", () => {
	it("returns the recorded EV cash-out when there is one", () => {
		expect(resolveEvCashOut(650, 700)).toBe(650);
	});

	it("falls back to the actual cash-out when no EV cash-out was recorded", () => {
		expect(resolveEvCashOut(null, 700)).toBe(700);
	});

	it("treats an EV cash-out of 0 as recorded, not as missing", () => {
		expect(resolveEvCashOut(0, 700)).toBe(0);
	});

	it("returns null when there is no cash-out to fall back to", () => {
		expect(resolveEvCashOut(null, null)).toBeNull();
	});

	it("still returns a recorded EV cash-out when the session has no cash-out", () => {
		expect(resolveEvCashOut(650, null)).toBe(650);
	});
});

describe("computeCashGamePL", () => {
	it("returns cashOut - buyIn when no chips were removed early", () => {
		expect(computeCashGamePL(500, 700)).toBe(200);
	});

	it("adds a positive chipRemoveTotal back into profit/loss (chip remove bug)", () => {
		expect(computeCashGamePL(500, 600, 100)).toBe(200);
	});

	it("defaults chipRemoveTotal to 0 when the third argument is omitted", () => {
		expect(computeCashGamePL(500, 300)).toBe(computeCashGamePL(500, 300, 0));
	});

	it("handles a zero chipRemoveTotal explicitly the same as omitting it", () => {
		expect(computeCashGamePL(500, 700, 0)).toBe(200);
	});

	it("computes a loss when cashOut + chipRemoveTotal is below buyIn", () => {
		expect(computeCashGamePL(1000, 200, 50)).toBe(-750);
	});
});

describe("chunkForInsert", () => {
	it("keeps each chunk under D1's 100 bound-parameter cap for 9-column rows", () => {
		const rows = Array.from({ length: 14 }, (_, i) => i);
		const chunks = chunkForInsert(rows, 9);
		expect(chunks).toHaveLength(2);
		expect(chunks[0]).toHaveLength(11);
		expect(chunks[1]).toHaveLength(3);
		for (const chunk of chunks) {
			expect(chunk.length * 9).toBeLessThanOrEqual(100);
		}
		expect(chunks.flat()).toEqual(rows);
	});

	it("caps session_blind_level (10 columns) at 10 rows = exactly 100 params (SA2-115 boundary)", () => {
		const rows = Array.from({ length: 21 }, (_, i) => i);
		const chunks = chunkForInsert(rows, 10);
		expect(chunks[0]).toHaveLength(10);
		expect(chunks.map((c) => c.length)).toEqual([10, 10, 1]);
		for (const chunk of chunks) {
			expect(chunk.length * 10).toBeLessThanOrEqual(100);
		}
		expect(chunks.flat()).toEqual(rows);
	});

	it("returns a single chunk when the batch fits under the cap", () => {
		const rows = Array.from({ length: 11 }, (_, i) => i);
		expect(chunkForInsert(rows, 9)).toEqual([rows]);
	});

	it("returns no chunks for an empty batch", () => {
		expect(chunkForInsert([], 9)).toEqual([]);
	});

	it("chunks wide rows more aggressively than narrow rows", () => {
		const rows = Array.from({ length: 60 }, (_, i) => i);
		expect(chunkForInsert(rows, 2)[0]).toHaveLength(50);
		expect(chunkForInsert(rows, 6)[0]).toHaveLength(16);
	});

	it("falls back to one row per chunk when a single row already fills the cap", () => {
		const rows = [1, 2, 3];
		expect(chunkForInsert(rows, 200)).toEqual([[1], [2], [3]]);
	});
});

describe("selectInChunks", () => {
	it("splits an id list over D1's cap so every WHERE IN stays <=100 params", async () => {
		const ids = Array.from({ length: 101 }, (_, i) => `s${i}`);
		const chunkSizes: number[] = [];
		const rows = await selectInChunks(ids, (chunk) => {
			chunkSizes.push(chunk.length);
			return Promise.resolve(chunk.map((id) => ({ id })));
		});
		expect(chunkSizes).toEqual([100, 1]);
		for (const size of chunkSizes) {
			expect(size).toBeLessThanOrEqual(100);
		}
		expect(rows).toHaveLength(101);
		expect(rows[0]).toEqual({ id: "s0" });
		expect(rows.at(-1)).toEqual({ id: "s100" });
	});

	it("reserves fixed bind parameters when chunking an IN query", async () => {
		const ids = Array.from({ length: 101 }, (_, index) => `s${index}`);
		const chunkSizes: number[] = [];

		await selectInChunks(
			ids,
			(chunk) => {
				chunkSizes.push(chunk.length);
				return Promise.resolve([]);
			},
			1
		);

		expect(chunkSizes).toEqual([99, 2]);
	});

	it.each([
		-1, 0.5, 100,
	])("rejects an invalid fixed-bind count of %s", async (extraBoundParams) => {
		await expect(
			selectInChunks(["s1"], () => Promise.resolve([]), extraBoundParams)
		).rejects.toThrow(RangeError);
	});
	it("runs a single query when the id list fits under the cap", async () => {
		const ids = Array.from({ length: 100 }, (_, i) => `s${i}`);
		let calls = 0;
		const rows = await selectInChunks(ids, (chunk) => {
			calls += 1;
			return Promise.resolve(chunk.map((id) => ({ id })));
		});
		expect(calls).toBe(1);
		expect(rows).toHaveLength(100);
	});

	it("never issues a query for an empty id list", async () => {
		let calls = 0;
		const rows = await selectInChunks<string, { id: string }>([], (chunk) => {
			calls += 1;
			return Promise.resolve(chunk.map((id) => ({ id })));
		});
		expect(calls).toBe(0);
		expect(rows).toEqual([]);
	});

	it("flattens multi-row results from each chunk in chunk order", async () => {
		const ids = Array.from({ length: 150 }, (_, i) => i);
		const rows = await selectInChunks(ids, (chunk) =>
			Promise.resolve(
				chunk.flatMap((id) => [
					{ id, n: 0 },
					{ id, n: 1 },
				])
			)
		);
		expect(rows).toHaveLength(300);
		expect(rows[0]).toEqual({ id: 0, n: 0 });
		expect(rows[1]).toEqual({ id: 0, n: 1 });
		expect(rows.at(-1)).toEqual({ id: 149, n: 1 });
	});
});
describe("toProfitLossSeriesPoint sortKey (SA2-98)", () => {
	function row(overrides: Partial<ProfitLossSeriesRow>): ProfitLossSeriesRow {
		return {
			bountyPrizes: null,
			breakMinutes: null,
			buyIn: null,
			cashOut: null,
			chipPurchaseCost: 0,
			chipRemoveTotal: null,
			endedAt: null,
			entryFee: null,
			evCashOut: null,
			id: "s1",
			prizeMoney: null,
			ringGameBlind2: null,
			sessionDate: new Date(1_700_000_000_000),
			startedAt: null,
			tournamentBuyIn: null,
			type: "cash_game",
			...overrides,
		};
	}

	it("uses startedAt (in seconds) as sortKey when present", () => {
		const point = toProfitLossSeriesPoint(
			row({
				sessionDate: new Date(1_700_000_000_000),
				startedAt: new Date(1_700_003_600_000),
			})
		);
		expect(point.sortKey).toBe(1_700_003_600);
	});

	it("falls back to sessionDate (in seconds) as sortKey when startedAt is null", () => {
		const point = toProfitLossSeriesPoint(
			row({ sessionDate: new Date(1_700_000_000_000), startedAt: null })
		);
		expect(point.sortKey).toBe(1_700_000_000);
	});

	it("keeps sessionDate (date-only) unchanged even when startedAt differs", () => {
		const point = toProfitLossSeriesPoint(
			row({
				sessionDate: new Date(1_700_000_000_000),
				startedAt: new Date(1_700_003_600_000),
			})
		);
		expect(point.sessionDate).toBe(1_700_000_000);
	});
});

describe("toProfitLossSeriesPoint cash game profitLoss includes chipRemoveTotal", () => {
	function row(overrides: Partial<ProfitLossSeriesRow>): ProfitLossSeriesRow {
		return {
			bountyPrizes: null,
			breakMinutes: null,
			buyIn: null,
			cashOut: null,
			chipPurchaseCost: 0,
			chipRemoveTotal: null,
			endedAt: null,
			entryFee: null,
			evCashOut: null,
			id: "s1",
			prizeMoney: null,
			ringGameBlind2: null,
			sessionDate: new Date(1_700_000_000_000),
			startedAt: null,
			tournamentBuyIn: null,
			type: "cash_game",
			...overrides,
		};
	}

	it("adds chipRemoveTotal on top of cashOut - buyIn", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, chipRemoveTotal: 100 })
		);
		expect(point.profitLoss).toBe(300);
	});

	it("treats a null chipRemoveTotal (no chips_add_remove events, or a manual session) as 0", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, chipRemoveTotal: null })
		);
		expect(point.profitLoss).toBe(200);
	});

	it("adds the same chipRemoveTotal into evProfitLoss so evDiff stays isolated to all-in equity", () => {
		const point = toProfitLossSeriesPoint(
			row({
				buyIn: 500,
				cashOut: 700,
				evCashOut: 750,
				chipRemoveTotal: 100,
			})
		);
		expect(point.profitLoss).toBe(300);
		expect(point.evProfitLoss).toBe(350);
	});
});

describe("toProfitLossSeriesPoint falls back to the actual result when no EV cash-out is recorded", () => {
	function row(overrides: Partial<ProfitLossSeriesRow>): ProfitLossSeriesRow {
		return {
			bountyPrizes: null,
			breakMinutes: null,
			buyIn: null,
			cashOut: null,
			chipPurchaseCost: 0,
			chipRemoveTotal: null,
			endedAt: null,
			entryFee: null,
			evCashOut: null,
			id: "s1",
			prizeMoney: null,
			ringGameBlind2: null,
			sessionDate: new Date(1_700_000_000_000),
			startedAt: null,
			tournamentBuyIn: null,
			type: "cash_game",
			...overrides,
		};
	}

	it("reports evProfitLoss equal to profitLoss when evCashOut is null", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: null })
		);
		expect(point.profitLoss).toBe(200);
		expect(point.evProfitLoss).toBe(200);
	});

	it("keeps chipRemoveTotal in the fallback EV so it matches profitLoss exactly", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: null, chipRemoveTotal: 100 })
		);
		expect(point.profitLoss).toBe(300);
		expect(point.evProfitLoss).toBe(300);
	});

	it("reports a losing session's EV as the same loss", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 0, evCashOut: null })
		);
		expect(point.profitLoss).toBe(-500);
		expect(point.evProfitLoss).toBe(-500);
	});

	it("keeps evProfitLoss null when the cash session has no recorded result", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: null, cashOut: null, evCashOut: null })
		);
		expect(point.evProfitLoss).toBeNull();
	});

	it("keeps evProfitLoss null for a tournament", () => {
		const point = toProfitLossSeriesPoint(
			row({ type: "tournament", tournamentBuyIn: 100, prizeMoney: 500 })
		);
		expect(point.evProfitLoss).toBeNull();
	});

	it("still prefers a recorded evCashOut over the actual cash-out", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: 650 })
		);
		expect(point.profitLoss).toBe(200);
		expect(point.evProfitLoss).toBe(150);
	});

	it("marks the point evRecorded when an evCashOut is stored", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: 650 })
		);
		expect(point.evRecorded).toBe(true);
	});

	it("marks an evCashOut of 0 as evRecorded, not as missing", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: 0 })
		);
		expect(point.evRecorded).toBe(true);
	});

	it("leaves evRecorded false when the EV figures came from the fallback", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: null })
		);
		expect(point.evProfitLoss).toBe(200);
		expect(point.evRecorded).toBe(false);
	});

	it("leaves evRecorded false for a tournament", () => {
		const point = toProfitLossSeriesPoint(
			row({ type: "tournament", tournamentBuyIn: 100, prizeMoney: 500 })
		);
		expect(point.evRecorded).toBe(false);
	});

	it("treats an evCashOut of 0 as recorded, not as missing", () => {
		const point = toProfitLossSeriesPoint(
			row({ buyIn: 500, cashOut: 700, evCashOut: 0 })
		);
		expect(point.evProfitLoss).toBe(-500);
	});
});

describe("computeTournamentPL", () => {
	it("subtracts buy-in, entry fee, and chip purchase cost from prize income", () => {
		expect(computeTournamentPL(500, 50, 300, 1000, 200)).toBe(350);
	});

	it("treats null buy-in / entry fee / prizes as zero", () => {
		expect(computeTournamentPL(null, null, 0, null, null)).toBe(0);
	});

	it("returns a loss when chip purchases exceed income", () => {
		expect(computeTournamentPL(100, null, 250, null, null)).toBe(-350);
	});

	it("adds bounty prizes to income", () => {
		expect(computeTournamentPL(100, 0, 0, 0, 400)).toBe(300);
	});
});

describe("validateEntityOwnership (tournament branch)", () => {
	const CALLER = "user-1";
	const OTHER = "user-2";
	const TOURNAMENT_ID = "tn-1";
	const ROOM_ID = "room-1";

	function mockDbFor(opts: {
		tournament?: Record<string, unknown>[];
		room?: Record<string, unknown>[];
	}) {
		return createChainableMockDb({
			select: {
				tournament: opts.tournament ?? [],
				room: opts.room ?? [],
			},
		});
	}

	it("resolves when the tournament's room is owned by the caller", async () => {
		const { db, selectedTables } = mockDbFor({
			tournament: [{ id: TOURNAMENT_ID, roomId: ROOM_ID }],
			room: [{ id: ROOM_ID, userId: CALLER }],
		});
		await expect(
			validateEntityOwnership(db, "tournament", TOURNAMENT_ID, CALLER)
		).resolves.toMatchObject({ id: TOURNAMENT_ID, roomId: ROOM_ID });
		expect(selectedTables).toEqual(["tournament", "room"]);
	});

	it("throws FORBIDDEN when the tournament's room belongs to another user", async () => {
		const { db } = mockDbFor({
			tournament: [{ id: TOURNAMENT_ID, roomId: ROOM_ID }],
			room: [{ id: ROOM_ID, userId: OTHER }],
		});
		await expect(
			validateEntityOwnership(db, "tournament", TOURNAMENT_ID, CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	});

	it("throws FORBIDDEN when the tournament does not exist", async () => {
		const { db, selectedTables } = mockDbFor({ tournament: [] });
		await expect(
			validateEntityOwnership(db, "tournament", "missing", CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
		expect(selectedTables).toEqual(["tournament"]);
	});

	it("throws FORBIDDEN when the tournament's room row is missing", async () => {
		const { db } = mockDbFor({
			tournament: [{ id: TOURNAMENT_ID, roomId: ROOM_ID }],
			room: [],
		});
		await expect(
			validateEntityOwnership(db, "tournament", TOURNAMENT_ID, CALLER)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("validateEntityOwnership (ringGame branch) (SA2-181)", () => {
	const CALLER = "user-1";
	const OTHER = "user-2";
	const RING_GAME_ID = "rg-1";
	const ROOM_ID = "room-1";

	function mockDbFor(opts: {
		ringGame?: Record<string, unknown>[];
		room?: Record<string, unknown>[];
	}) {
		return createChainableMockDb({
			select: {
				ring_game: opts.ringGame ?? [],
				room: opts.room ?? [],
			},
		});
	}

	it("resolves when the ring game's userId matches the caller", async () => {
		const { db, selectedTables } = mockDbFor({
			ringGame: [{ id: RING_GAME_ID, roomId: ROOM_ID, userId: CALLER }],
		});
		await expect(
			validateEntityOwnership(db, "ringGame", RING_GAME_ID, CALLER)
		).resolves.toMatchObject({
			id: RING_GAME_ID,
			roomId: ROOM_ID,
			userId: CALLER,
		});
		expect(selectedTables).toEqual(["ring_game"]);
	});

	it("resolves for a null-roomId auto-generated row owned via userId", async () => {
		const { db, selectedTables } = mockDbFor({
			ringGame: [{ id: RING_GAME_ID, roomId: null, userId: CALLER }],
		});
		await expect(
			validateEntityOwnership(db, "ringGame", RING_GAME_ID, CALLER)
		).resolves.toMatchObject({
			id: RING_GAME_ID,
			roomId: null,
			userId: CALLER,
		});
		expect(selectedTables).toEqual(["ring_game"]);
	});

	it("throws FORBIDDEN when the ring game belongs to another user", async () => {
		const { db, selectedTables } = mockDbFor({
			ringGame: [{ id: RING_GAME_ID, roomId: ROOM_ID, userId: OTHER }],
		});
		await expect(
			validateEntityOwnership(db, "ringGame", RING_GAME_ID, CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
		expect(selectedTables).toEqual(["ring_game"]);
	});

	it("throws FORBIDDEN when the ring game does not exist", async () => {
		const { db, selectedTables } = mockDbFor({ ringGame: [] });
		await expect(
			validateEntityOwnership(db, "ringGame", "missing", CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
		expect(selectedTables).toEqual(["ring_game"]);
	});
});

describe("validateTagsOwnership (SA2-177)", () => {
	const CALLER = "user-1";

	it("resolves without reading when ids is undefined", async () => {
		const { db, selectedTables } = createChainableMockDb();
		await expect(
			validateTagsOwnership(db, sessionTag, undefined, CALLER)
		).resolves.toBeUndefined();
		expect(selectedTables).toEqual([]);
	});

	it("resolves without reading when ids is empty", async () => {
		const { db, selectedTables } = createChainableMockDb();
		await expect(
			validateTagsOwnership(db, sessionTag, [], CALLER)
		).resolves.toBeUndefined();
		expect(selectedTables).toEqual([]);
	});

	it("resolves when every tag is owned by the caller", async () => {
		const { db, selectedTables } = createChainableMockDb({
			select: { session_tag: [{ id: "t1" }, { id: "t2" }] },
		});
		await expect(
			validateTagsOwnership(db, sessionTag, ["t1", "t2"], CALLER)
		).resolves.toBeUndefined();
		expect(selectedTables).toEqual(["session_tag"]);
	});

	it("deduplicates ids before comparing the owned count", async () => {
		const { db } = createChainableMockDb({
			select: { session_tag: [{ id: "t1" }] },
		});
		await expect(
			validateTagsOwnership(db, sessionTag, ["t1", "t1"], CALLER)
		).resolves.toBeUndefined();
	});

	it.each([
		{ count: 100, boundCounts: [100, 2] },
		{ count: 101, boundCounts: [100, 3] },
	])("keeps every ownership query under the bind cap for $count unique tags", async ({
		count,
		boundCounts,
	}) => {
		const ids = Array.from({ length: count }, (_, index) => `t${index}`);
		const { db, selectWhereParams } = createChainableMockDb({
			select: { session_tag: [] },
		});

		await expect(
			validateTagsOwnership(db, sessionTag, ids, CALLER)
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(selectWhereParams.map((params) => params.length)).toEqual(
			boundCounts
		);
		expect(selectWhereParams.every((params) => params.length <= 100)).toBe(
			true
		);
	});
	it("throws FORBIDDEN when a tag is owned by another user (fewer rows returned)", async () => {
		const { db } = createChainableMockDb({
			select: { session_tag: [{ id: "t1" }] },
		});
		await expect(
			validateTagsOwnership(db, sessionTag, ["t1", "t2"], CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own one or more of these tags",
		});
	});

	it("throws FORBIDDEN when none of the tags are owned", async () => {
		const { db } = createChainableMockDb({ select: { session_tag: [] } });
		await expect(
			validateTagsOwnership(db, sessionTag, ["t1"], CALLER)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
