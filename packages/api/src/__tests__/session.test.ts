import { sessionTag } from "@sapphire2/db/schema/session-tag";
import { TRPCError } from "@trpc/server";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	assertNoLiveLinkedRestrictedEdits,
	chunkForInsert,
	computeCashGamePL,
	computeTournamentPL,
	encodeSessionCursor,
	type ProfitLossSeriesRow,
	parseSessionCursor,
	resolveCashRuleSnapshot,
	resolveEvCashOut,
	selectInChunks,
	sessionKeysetCondition,
	toProfitLossSeriesPoint,
	validateEntityOwnership,
	validateTagsOwnership,
} from "../routers/session";
import { createCaller } from "./caller";
import {
	createChainableMockDb,
	expectAccepts,
	expectProcedureSurface,
	expectRejects,
	getInputSchema,
	withGameMixVariantFixtures,
} from "./test-utils";

const DERIVED_FIELDS_RE = /Cannot edit fields derived from live session events/;
const RING_CONFIG_RE = /variant|blind1|blind2/;
const SESSION_DATE_RE = /sessionDate/;
const PLACEMENT_RE = /placement/;
const PRIZE_MONEY_RE = /prizeMoney/;
const TOURNAMENT_ID_RE = /tournamentId/;

const CALLER = "user-1";
const OTHER = "user-2";

function makeCaller(select: Record<string, Record<string, unknown>[]> = {}) {
	return createCaller({ select, userId: CALLER });
}

function listCallerRows(rows: Record<string, unknown>[]) {
	return makeCaller({
		game_session: rows.map((row, index) => ({
			id: `session-${index + 1}`,
			type: "cash_game",
			source: "manual",
			buyIn: null,
			cashOut: null,
			evCashOut: null,
			chipRemoveTotal: null,
			...row,
		})),
		session_chip_purchase: [],
		session_blind_level: [],
		session_to_session_tag: [],
	}).caller;
}

function listCaller(row: Record<string, unknown>) {
	return listCallerRows([row]);
}

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

describe("session router", () => {
	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.session).sort()).toEqual(
			[
				"create",
				"delete",
				"getById",
				"list",
				"profitLossSeries",
				"update",
			].sort()
		);
	});

	it("every procedure is a protected query or mutation", () => {
		expectProcedureSurface(appRouter.session, {
			create: "mutation",
			delete: "mutation",
			getById: "query",
			list: "query",
			profitLossSeries: "query",
			update: "mutation",
		});
	});
});

describe("session router input validation", () => {
	const CASH_BASE = {
		type: "cash_game",
		sessionDate: 1_700_000_000,
		buyIn: 1000,
		cashOut: 2000,
	} as const;

	const TOURNAMENT_BASE = {
		type: "tournament",
		sessionDate: 1_700_000_000,
		tournamentBuyIn: 10_000,
	} as const;

	const UPDATE_BASE = { id: "s1" } as const;

	const CHIP_PURCHASE_BASE = {
		name: "Rebuy",
		cost: 100,
		chips: 10_000,
	} as const;

	function parseCreate(input: unknown) {
		return getInputSchema(appRouter.session.create).safeParse(input) as {
			data?: Record<string, unknown>;
			success: boolean;
		};
	}

	const CASH_CREATE_MONEY_FIELDS = [
		"buyIn",
		"cashOut",
		"evCashOut",
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
		"breakMinutes",
	] as const;
	const TOURNAMENT_CREATE_MONEY_FIELDS = [
		"tournamentBuyIn",
		"entryFee",
		"prizeMoney",
		"bountyPrizes",
		"startingStack",
		"bountyAmount",
		"breakMinutes",
	] as const;
	const UPDATE_MONEY_FIELDS = [
		"buyIn",
		"cashOut",
		"tournamentBuyIn",
		"entryFee",
	] as const;
	const UPDATE_NULLABLE_MONEY_FIELDS = [
		"evCashOut",
		"prizeMoney",
		"bountyPrizes",
		"startingStack",
		"bountyAmount",
		"breakMinutes",
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const;
	const BLIND_LEVEL_MONEY_FIELDS = [
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minutes",
	] as const;
	const CHIP_PURCHASE_MONEY_FIELDS = ["cost", "chips", "count"] as const;

	const TABLE_SIZE_SCHEMAS = [
		{
			label: "create (cash_game)",
			procedure: appRouter.session.create,
			base: CASH_BASE,
			nullable: false,
		},
		{
			label: "create (tournament)",
			procedure: appRouter.session.create,
			base: TOURNAMENT_BASE,
			nullable: false,
		},
		{
			label: "update",
			procedure: appRouter.session.update,
			base: UPDATE_BASE,
			nullable: true,
		},
	];
	const PLACEMENT_SCHEMAS = [
		{
			label: "create",
			procedure: appRouter.session.create,
			base: TOURNAMENT_BASE,
		},
		{ label: "update", procedure: appRouter.session.update, base: UPDATE_BASE },
	];
	const ANTE_TYPE_SCHEMAS = [
		{
			label: "create (cash_game)",
			procedure: appRouter.session.create,
			base: CASH_BASE,
		},
		{ label: "update", procedure: appRouter.session.update, base: UPDATE_BASE },
	];
	const RULE_NAME_SCHEMAS = [
		{ label: "cash_game", base: CASH_BASE },
		{ label: "tournament", base: TOURNAMENT_BASE },
	];
	const TYPE_FILTER_PROCEDURES = [
		{ label: "list", procedure: appRouter.session.list },
		{
			label: "profitLossSeries",
			procedure: appRouter.session.profitLossSeries,
		},
	];

	it("create leaves cash_game variant undefined when omitted (c10: no schema default that would defeat ring-game inheritance)", () => {
		const parsed = parseCreate(CASH_BASE);
		expect(parsed.success).toBe(true);
		expect(parsed.data?.variant).toBeUndefined();
	});

	it("create defaults a tournament entryFee to 0", () => {
		const parsed = parseCreate(TOURNAMENT_BASE);
		expect(parsed.success).toBe(true);
		expect(parsed.data?.entryFee).toBe(0);
	});

	it("create defaults a chip purchase count to 0 when omitted", () => {
		const parsed = parseCreate({
			...TOURNAMENT_BASE,
			chipPurchases: [CHIP_PURCHASE_BASE],
		});
		expect(parsed.success).toBe(true);
		expect(parsed.data?.chipPurchases).toEqual([
			{ ...CHIP_PURCHASE_BASE, count: 0 },
		]);
	});

	it("create strips the legacy rebuyCount field instead of persisting it", () => {
		const parsed = parseCreate({ ...TOURNAMENT_BASE, rebuyCount: 5 });
		expect(parsed.success).toBe(true);
		expect(parsed.data?.rebuyCount).toBeUndefined();
	});

	it("create rejects an unknown discriminator type", () => {
		expectRejects(appRouter.session.create, {
			type: "other",
			sessionDate: 1,
			buyIn: 0,
			cashOut: 0,
		});
	});

	it.each(TYPE_FILTER_PROCEDURES)("$label rejects an unknown type filter", ({
		procedure,
	}) => {
		expectRejects(procedure, { type: "spin_and_go" });
	});

	it.each(ANTE_TYPE_SCHEMAS)("$label rejects an unknown anteType", ({
		procedure,
		base,
	}) => {
		expectRejects(procedure, { ...base, anteType: "sb" });
	});

	it.each(
		RULE_NAME_SCHEMAS
	)("create rejects an empty ruleName on a $label session", ({ base }) => {
		expectRejects(appRouter.session.create, { ...base, ruleName: "" });
	});

	it("create rejects a chip purchase with an empty name", () => {
		expectRejects(appRouter.session.create, {
			...TOURNAMENT_BASE,
			chipPurchases: [{ ...CHIP_PURCHASE_BASE, name: "" }],
		});
	});

	it.each(
		CASH_CREATE_MONEY_FIELDS
	)("create (cash_game) accepts 0 and rejects a negative or fractional %s", (field) => {
		expectAccepts(appRouter.session.create, { ...CASH_BASE, [field]: 0 });
		expectRejects(appRouter.session.create, { ...CASH_BASE, [field]: -1 });
		expectRejects(appRouter.session.create, { ...CASH_BASE, [field]: 0.5 });
	});

	it.each(
		TOURNAMENT_CREATE_MONEY_FIELDS
	)("create (tournament) accepts 0 and rejects a negative or fractional %s", (field) => {
		expectAccepts(appRouter.session.create, {
			...TOURNAMENT_BASE,
			[field]: 0,
		});
		expectRejects(appRouter.session.create, {
			...TOURNAMENT_BASE,
			[field]: -1,
		});
		expectRejects(appRouter.session.create, {
			...TOURNAMENT_BASE,
			[field]: 0.5,
		});
	});

	it.each(
		UPDATE_MONEY_FIELDS
	)("update accepts 0 and rejects a negative, fractional, or null %s", (field) => {
		expectAccepts(appRouter.session.update, { ...UPDATE_BASE, [field]: 0 });
		expectRejects(appRouter.session.update, { ...UPDATE_BASE, [field]: -1 });
		expectRejects(appRouter.session.update, {
			...UPDATE_BASE,
			[field]: 0.5,
		});
		expectRejects(appRouter.session.update, {
			...UPDATE_BASE,
			[field]: null,
		});
	});

	it.each(
		UPDATE_NULLABLE_MONEY_FIELDS
	)("update accepts 0 or null and rejects a negative or fractional %s", (field) => {
		expectAccepts(appRouter.session.update, { ...UPDATE_BASE, [field]: 0 });
		expectAccepts(appRouter.session.update, {
			...UPDATE_BASE,
			[field]: null,
		});
		expectRejects(appRouter.session.update, { ...UPDATE_BASE, [field]: -1 });
		expectRejects(appRouter.session.update, {
			...UPDATE_BASE,
			[field]: 0.5,
		});
	});

	it.each(
		BLIND_LEVEL_MONEY_FIELDS
	)("blind level %s accepts 0 or null and rejects a negative value on create and update", (field) => {
		for (const value of [0, null]) {
			expectAccepts(appRouter.session.create, {
				...TOURNAMENT_BASE,
				blindLevels: [{ isBreak: false, [field]: value }],
			});
			expectAccepts(appRouter.session.update, {
				...UPDATE_BASE,
				blindLevels: [{ isBreak: false, [field]: value }],
			});
		}
		expectRejects(appRouter.session.create, {
			...TOURNAMENT_BASE,
			blindLevels: [{ isBreak: false, [field]: -1 }],
		});
		expectRejects(appRouter.session.update, {
			...UPDATE_BASE,
			blindLevels: [{ isBreak: false, [field]: -1 }],
		});
	});

	it.each(
		CHIP_PURCHASE_MONEY_FIELDS
	)("chip purchase %s accepts 0 and rejects a negative value", (field) => {
		expectAccepts(appRouter.session.create, {
			...TOURNAMENT_BASE,
			chipPurchases: [{ ...CHIP_PURCHASE_BASE, [field]: 0 }],
		});
		expectRejects(appRouter.session.create, {
			...TOURNAMENT_BASE,
			chipPurchases: [{ ...CHIP_PURCHASE_BASE, [field]: -1 }],
		});
	});

	it.each(TABLE_SIZE_SCHEMAS)("$label bounds tableSize to 2..10", ({
		procedure,
		base,
		nullable,
	}) => {
		expectRejects(procedure, { ...base, tableSize: 1 });
		expectAccepts(procedure, { ...base, tableSize: 2 });
		expectAccepts(procedure, { ...base, tableSize: 10 });
		expectRejects(procedure, { ...base, tableSize: 11 });
		if (nullable) {
			expectAccepts(procedure, { ...base, tableSize: null });
		} else {
			expectRejects(procedure, { ...base, tableSize: null });
		}
	});

	it.each(
		PLACEMENT_SCHEMAS
	)("$label rejects placement 0 (placement is 1-based)", ({
		procedure,
		base,
	}) => {
		expectRejects(procedure, { ...base, placement: 0 });
	});

	it.each(PLACEMENT_SCHEMAS)("$label accepts placement 1 as the minimum", ({
		procedure,
		base,
	}) => {
		expectAccepts(procedure, { ...base, placement: 1 });
	});

	it.each(PLACEMENT_SCHEMAS)("$label rejects placement above totalEntries", ({
		procedure,
		base,
	}) => {
		expectRejects(procedure, { ...base, placement: 11, totalEntries: 10 });
	});

	it.each(
		PLACEMENT_SCHEMAS
	)("$label accepts placement equal to totalEntries", ({ procedure, base }) => {
		expectAccepts(procedure, { ...base, placement: 5, totalEntries: 5 });
	});

	it.each(
		PLACEMENT_SCHEMAS
	)("$label skips the placement cap when beforeDeadline is true", ({
		procedure,
		base,
	}) => {
		expectAccepts(procedure, {
			...base,
			beforeDeadline: true,
			placement: 10,
			totalEntries: 5,
		});
	});

	it("update skips the placement cap when either side is cleared to null", () => {
		expectAccepts(appRouter.session.update, {
			...UPDATE_BASE,
			placement: null,
			totalEntries: 3,
		});
		expectAccepts(appRouter.session.update, {
			...UPDATE_BASE,
			placement: 3,
			totalEntries: null,
		});
	});

	it("update accepts explicit null clears for nullable link fields", () => {
		expectAccepts(appRouter.session.update, {
			...UPDATE_BASE,
			roomId: null,
			ringGameId: null,
			tournamentId: null,
			currencyId: null,
		});
	});
});

describe("session list cursor and profit/loss series helpers", () => {
	describe("session list cursor (composite keyset)", () => {
		it("encodes a row as <epochMs>_<id>, using startedAt when present", () => {
			expect(
				encodeSessionCursor({
					id: "s1",
					sessionDate: new Date(1000),
					startedAt: new Date(2000),
				})
			).toBe("2000_s1");
		});

		it("falls back to sessionDate when startedAt is null", () => {
			expect(
				encodeSessionCursor({
					id: "s1",
					sessionDate: new Date(1000),
					startedAt: null,
				})
			).toBe("1000_s1");
		});

		it("round-trips an encoded cursor back to its sort key and id", () => {
			const cursor = encodeSessionCursor({
				id: "abc",
				sessionDate: new Date(1_600_000_000_000),
				startedAt: new Date(1_700_000_000_000),
			});
			const parsed = parseSessionCursor(cursor);
			expect(parsed?.id).toBe("abc");
			expect(parsed?.sortKey.getTime()).toBe(1_700_000_000_000);
		});

		it("preserves underscores in the id (splits on the first separator only)", () => {
			const parsed = parseSessionCursor("1000_a_b_c");
			expect(parsed?.id).toBe("a_b_c");
			expect(parsed?.sortKey.getTime()).toBe(1000);
		});

		it("returns null when the separator is missing", () => {
			expect(parseSessionCursor("12345")).toBeNull();
		});

		it("returns null for a non-integer timestamp", () => {
			expect(parseSessionCursor("abc_s1")).toBeNull();
		});

		it("returns null for an empty timestamp", () => {
			expect(parseSessionCursor("_s1")).toBeNull();
		});

		it("returns null for an empty id", () => {
			expect(parseSessionCursor("1000_")).toBeNull();
		});

		it.each([
			["8640000000000000_s1", 8_640_000_000_000_000],
			["-8640000000000000_s1", -8_640_000_000_000_000],
		])("accepts a timestamp at the Date range boundary: %s", (cursor, ms) => {
			expect(parseSessionCursor(cursor)?.sortKey.getTime()).toBe(ms);
		});

		it.each([
			"8640000000000001_s1",
			"-8640000000000001_s1",
			"9007199254740991_s1",
		])("returns null for a timestamp outside the Date range: %s", (cursor) => {
			expect(parseSessionCursor(cursor)).toBeNull();
		});
	});

	describe("sessionKeysetCondition (SA2-150)", () => {
		const keysetDialect = new SQLiteSyncDialect();

		it("returns undefined for an omitted cursor (start from the beginning)", () => {
			expect(sessionKeysetCondition(undefined)).toBeUndefined();
		});

		it("returns undefined for an empty-string cursor", () => {
			expect(sessionKeysetCondition("")).toBeUndefined();
		});

		it("returns undefined for a malformed cursor instead of filtering everything", () => {
			expect(sessionKeysetCondition("no-separator")).toBeUndefined();
			expect(sessionKeysetCondition("abc_s1")).toBeUndefined();
		});

		it("returns undefined for a cursor timestamp outside the Date range", () => {
			expect(sessionKeysetCondition("8640000000000001_s1")).toBeUndefined();
			expect(sessionKeysetCondition("-8640000000000001_s1")).toBeUndefined();
		});

		it("binds the floored-seconds order key twice and the id once, with no subquery", () => {
			const cursor = encodeSessionCursor({
				id: "cur-id",
				startedAt: new Date(5_000_000),
				sessionDate: new Date(5_000_000),
			});
			const condition = sessionKeysetCondition(cursor);
			expect(condition).toBeDefined();
			const query = keysetDialect.sqlToQuery(condition as never);
			expect(query.sql.toLowerCase()).not.toContain("select");
			expect(query.params.filter((p) => p === 5000)).toHaveLength(2);
			expect(query.params).toContain("cur-id");
			expect(query.params).not.toContain(cursor);
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
});

describe("assertNoLiveLinkedRestrictedEdits", () => {
	const manualCashSession = {
		kind: "cash_game",
		source: "manual",
	};

	const liveCashSession = {
		kind: "cash_game",
		source: "live",
	};

	const liveTournamentSession = {
		kind: "tournament",
		source: "live",
	};

	it("allows arbitrary field edits for non-live-linked sessions", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(manualCashSession, {
				buyIn: 1000,
				cashOut: 2000,
				memo: "edited",
			})
		).not.toThrow();
	});

	it("rejects buyIn edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { buyIn: 5000 })
		).toThrow(TRPCError);
	});

	it("rejects cashOut edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { cashOut: 5000 })
		).toThrow(DERIVED_FIELDS_RE);
	});

	it("rejects ring-game config edits on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				variant: "plo",
				blind1: 2,
				blind2: 5,
			})
		).toThrow(RING_CONFIG_RE);
	});

	it("rejects sessionDate edit on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				sessionDate: 1_700_000_000,
			})
		).toThrow(SESSION_DATE_RE);
	});

	it("rejects ruleName / min-max buy-in edits on live-linked cash session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				ruleName: "renamed",
				minBuyIn: 10_000,
				maxBuyIn: 50_000,
			})
		).toThrow(DERIVED_FIELDS_RE);
	});

	it("rejects ruleName edit on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				ruleName: "renamed",
			})
		).toThrow(DERIVED_FIELDS_RE);
	});

	it("rejects placement edit on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				placement: 3,
			})
		).toThrow(PLACEMENT_RE);
	});

	it("rejects prizeMoney edit on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				prizeMoney: 10_000,
			})
		).toThrow(PRIZE_MONEY_RE);
	});

	it("rejects tournamentId retarget on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				tournamentId: "some-other-tournament",
			})
		).toThrow(TOURNAMENT_ID_RE);
	});

	it("rejects rule-snapshot / blind-structure edits on live-linked tournament session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, {
				variant: "plo",
				startingStack: 20_000,
				bountyAmount: 500,
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
			})
		).toThrow(TRPCError);
	});

	it("allows memo edit on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { memo: "new memo" })
		).not.toThrow();
	});

	it("allows roomId and currencyId edits on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				roomId: "room-1",
				currencyId: "currency-1",
			})
		).not.toThrow();
	});

	it("allows tagIds edit on live-linked session", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				tagIds: ["tag-1", "tag-2"],
			})
		).not.toThrow();
	});

	it("lists all violating fields in the error message", () => {
		try {
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				buyIn: 1,
				cashOut: 2,
				evCashOut: 3,
			});
			throw new Error("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			const message = (error as TRPCError).message;
			expect(message).toContain("buyIn");
			expect(message).toContain("cashOut");
			expect(message).toContain("evCashOut");
		}
	});

	it("uses BAD_REQUEST error code", () => {
		try {
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { buyIn: 1 });
			throw new Error("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
		}
	});

	it("applies cash field list only to cash sessions (not tournament fields)", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, { placement: 1 })
		).not.toThrow();
	});

	it("applies tournament field list only to tournament sessions (not cash fields)", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveTournamentSession, { buyIn: 1 })
		).not.toThrow();
	});

	it("ignores fields whose value is undefined", () => {
		expect(() =>
			assertNoLiveLinkedRestrictedEdits(liveCashSession, {
				buyIn: undefined,
				memo: "ok",
			})
		).not.toThrow();
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

	it("throws FORBIDDEN for a legacy row with a null userId", async () => {
		const { db } = mockDbFor({
			ringGame: [{ id: RING_GAME_ID, roomId: null, userId: null }],
		});
		await expect(
			validateEntityOwnership(db, "ringGame", RING_GAME_ID, CALLER)
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
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

describe("session.create auto-generated ring game ownership (SA2-181)", () => {
	it("stamps the creating user's id on the auto-generated ring_game", async () => {
		const { db, inserted } = createChainableMockDb({ select: {} });
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
		});

		const ringGameInserts = inserted.ring_game ?? [];
		expect(ringGameInserts).toHaveLength(1);
		expect(ringGameInserts[0]).toMatchObject({
			userId: CALLER,
			roomId: null,
		});
	});
});

describe("session.create auto-generated ring game derived name (c11)", () => {
	it("derives 'Variant blind1/blind2' when blinds are provided (non-mix)", async () => {
		const { caller, inserted } = makeCaller();
		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			blind1: 1,
			blind2: 2,
		});
		const [created] = inserted.ring_game ?? [];
		expect(created).toMatchObject({ name: "NL Hold'em 1/2" });
	});

	it("derives the display label alone (no '0/0' suffix) for a mix rule with no direct blinds", async () => {
		const { caller, inserted } = makeCaller({
			game_variant: [
				{ id: "variant-1", userId: CALLER, label: "NL Hold'em" },
				{
					id: "variant-2",
					userId: CALLER,
					label: "Pot Limit Omaha",
				},
			],
		});
		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			variant: "mix",
			mixGames: [
				{
					name: "Limit",
					variants: ["NL Hold'em", "Pot Limit Omaha"],
					blind1: 1,
					blind2: 2,
					blind3: null,
					ante: null,
					anteType: null,
				},
			],
			blind1: 10,
			blind2: 20,
			blind3: 40,
			ante: 5,
			anteType: "all",
		});
		const [created] = inserted.ring_game ?? [];
		expect(created).toMatchObject({
			name: "Mixed Game",
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
		});
		expect(inserted.session_cash_detail?.[0]).toMatchObject({
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			anteType: null,
		});
	});

	it("derives the display label alone (no '0/0' suffix) for a non-mix rule with no blinds at all", async () => {
		const { caller, inserted } = makeCaller();
		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			variant: "Dealer's Choice",
		});
		const [created] = inserted.ring_game ?? [];
		expect(created).toMatchObject({ name: "Dealer's Choice" });
	});
});

describe("validateTagsOwnership (SA2-177)", () => {
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

describe("cash rule snapshot: mixGames freezing", () => {
	const parentMix = [
		{
			name: "Limit",
			variants: ["lhe", "o8"],
			blind1: 400,
			blind2: 800,
			blind3: null,
			ante: null,
			anteType: null,
		},
	];

	it("copies the parent ring game's mixGames into the snapshot", async () => {
		const db = createChainableMockDb({
			select: {
				ring_game: [{ id: "rg-1", variant: "mix", mixGames: parentMix }],
			},
		});
		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "rg-1",
		});
		expect(snapshot.mixGames).toEqual(parentMix);
	});

	it("lets an explicit input mixGames override the parent's", async () => {
		const override = [
			{ variants: ["nlh"], blind1: 1, blind2: 2 },
			{ variants: ["plo"], blind1: 2, blind2: 5 },
		];
		const db = createChainableMockDb({
			select: {
				ring_game: [{ id: "rg-1", variant: "mix", mixGames: parentMix }],
			},
		});
		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "rg-1",
			mixGames: override as never,
		});
		expect(snapshot.mixGames).toEqual(override);
	});

	it("clears the parent's mixGames on an explicit null override", async () => {
		const db = createChainableMockDb({
			select: {
				ring_game: [{ id: "rg-1", variant: "mix", mixGames: parentMix }],
			},
		});
		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "rg-1",
			mixGames: null,
		});
		expect(snapshot.mixGames).toBeNull();
	});

	it("defaults mixGames to null with no master and no input", async () => {
		const db = createChainableMockDb({ select: {} });
		const snapshot = await resolveCashRuleSnapshot(db as never, {});
		expect(snapshot.mixGames).toBeNull();
	});
});

describe("cash rule snapshot: variant inheritance (c10)", () => {
	it("inherits the parent ring game's variant when input omits it", async () => {
		const db = createChainableMockDb({
			select: {
				ring_game: [{ id: "rg-1", variant: "Pot Limit Omaha" }],
			},
		});
		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "rg-1",
		});
		expect(snapshot.variant).toBe("Pot Limit Omaha");
	});

	it("lets an explicit input variant override the parent's", async () => {
		const db = createChainableMockDb({
			select: {
				ring_game: [{ id: "rg-1", variant: "Pot Limit Omaha" }],
			},
		});
		const snapshot = await resolveCashRuleSnapshot(db as never, {
			ringGameId: "rg-1",
			variant: "Short Deck",
		});
		expect(snapshot.variant).toBe("Short Deck");
	});

	it('defaults variant to "NL Hold\'em" with no master and no input', async () => {
		const db = createChainableMockDb({ select: {} });
		const snapshot = await resolveCashRuleSnapshot(db as never, {});
		expect(snapshot.variant).toBe("NL Hold'em");
	});
});

describe("session.create cash variant / mixGames persistence invariant", () => {
	const parentMix = [
		{
			name: "Big Bet",
			variants: ["NL Hold'em", "Pot Limit Omaha"],
			blind1: 1,
			blind2: 2,
		},
	];

	it("clears an inherited mix definition when an explicit plain variant overrides the parent", async () => {
		const { db, inserted } = createChainableMockDb({
			select: {
				ring_game: [
					{
						id: "rg-1",
						userId: CALLER,
						name: "8-Game",
						variant: "8-Game",
						mixGames: parentMix,
					},
				],
				game_mix: [],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			ringGameId: "rg-1",
			variant: "NL Hold'em",
		});

		expect(inserted.session_cash_detail).toHaveLength(1);
		expect(inserted.session_cash_detail?.[0]).toMatchObject({
			variant: "NL Hold'em",
			mixGames: null,
		});
	});

	it("rejects a manually defined plain variant carrying mixGames", async () => {
		const { db, inserted, batch } = createChainableMockDb({
			select: { game_mix: [] },
		});
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await expect(
			caller.session.create({
				type: "cash_game",
				sessionDate: 1_700_000_000,
				buyIn: 1000,
				cashOut: 2000,
				variant: "NL Hold'em",
				mixGames: parentMix,
			})
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(inserted.session_cash_detail).toBeUndefined();
		expect(batch).toHaveBeenCalledTimes(0);
	});

	it("accepts a manually defined owned named mix", async () => {
		const { db, inserted } = createChainableMockDb({
			select: withGameMixVariantFixtures({
				game_mix: [
					{
						id: "mix-1",
						userId: CALLER,
						label: "8-Game",
						games: ["variant-1", "variant-2"],
					},
				],
				game_variant: [
					{
						id: "variant-1",
						userId: CALLER,
						label: "NL Hold'em",
						groupId: "group-bigbet",
					},
					{
						id: "variant-2",
						userId: CALLER,
						label: "Pot Limit Omaha",
						groupId: "group-bigbet",
					},
				],
				game_group: [
					{
						id: "group-bigbet",
						userId: CALLER,
						builtinKey: "bigbet",
						label: "Big Bet",
					},
				],
			}),
		});
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			variant: "8-Game",
			mixGames: parentMix,
		});

		expect(inserted.session_cash_detail?.[0]).toMatchObject({
			variant: "8-Game",
			mixGames: parentMix,
		});
	});
});

describe("session.update cash variant / mixGames persistence invariant", () => {
	it("rejects invalid tags before mutating the session", async () => {
		const { batch, db, updateWhereParams } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: "session-1",
						userId: "user-1",
						kind: "cash_game",
						source: "manual",
						currencyId: null,
						sessionDate: new Date(1_700_000_000_000),
					},
				],
				session_cash_detail: [
					{
						sessionId: "session-1",
						variant: "NL Hold'em",
						mixGames: null,
						buyIn: 100,
						cashOut: 200,
						evCashOut: null,
					},
				],
				session_tournament_detail: [],
				session_chip_purchase: [],
				game_mix: [],
				session_tag: [{ id: "tag-1", userId: "user-1" }],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await expect(
			caller.session.update({
				id: "session-1",
				memo: "changed",
				tagIds: ["tag-1", "foreign-tag"],
			})
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		expect(updateWhereParams).toHaveLength(0);
		expect(batch).toHaveBeenCalledTimes(0);
	});
	it("clears the existing mix definition when variant changes to a plain game", async () => {
		const frozenMix = [
			{
				name: "Big Bet",
				variants: ["NL Hold'em", "Pot Limit Omaha"],
			},
		];
		const { db: baseDb } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: "session-1",
						userId: "user-1",
						kind: "cash_game",
						source: "manual",
						currencyId: null,
						sessionDate: new Date(1_700_000_000_000),
					},
				],
				session_cash_detail: [
					{
						sessionId: "session-1",
						variant: "8-Game",
						mixGames: frozenMix,
						buyIn: 100,
						cashOut: 200,
						evCashOut: null,
					},
				],
				game_mix: [],
				session_tournament_detail: [],
				session_chip_purchase: [],
			},
		});
		const updates: Record<string, unknown>[] = [];
		const db = {
			...(baseDb as unknown as Record<string, unknown>),
			update: () => ({
				set: (value: Record<string, unknown>) => {
					updates.push(value);
					return { where: () => Promise.resolve(undefined) };
				},
			}),
		};
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.update({
			id: "session-1",
			variant: "NL Hold'em",
		});

		expect(updates).toContainEqual(
			expect.objectContaining({
				variant: "NL Hold'em",
				mixGames: null,
			})
		);
	});

	it("replaces tag links atomically in a single batch (SA2-116)", async () => {
		const { db, inserted, batch, deleteWhereParams } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: "session-1",
						userId: "user-1",
						kind: "cash_game",
						source: "manual",
						currencyId: null,
						sessionDate: new Date(1_700_000_000_000),
					},
				],
				session_cash_detail: [
					{
						sessionId: "session-1",
						variant: "NL Hold'em",
						mixGames: null,
						buyIn: 100,
						cashOut: 200,
						evCashOut: null,
					},
				],
				session_tournament_detail: [],
				session_chip_purchase: [],
				game_mix: [],
				session_tag: [
					{ id: "tag-1", userId: "user-1" },
					{ id: "tag-2", userId: "user-1" },
				],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.update({
			id: "session-1",
			tagIds: ["tag-1", "tag-2"],
		});

		expect(batch).toHaveBeenCalledTimes(1);
		expect(batch.mock.calls[0]?.[0]).toHaveLength(2);
		expect(deleteWhereParams).toContainEqual(["session-1"]);
		expect(inserted.session_to_session_tag).toHaveLength(1);
		expect(inserted.session_to_session_tag?.[0]).toEqual([
			{ sessionId: "session-1", sessionTagId: "tag-1" },
			{ sessionId: "session-1", sessionTagId: "tag-2" },
		]);
	});

	it("re-syncs currencyTransaction.amount with chipRemoveTotal included, not just cashOut - buyIn", async () => {
		const { db, updated } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: "session-1",
						userId: "user-1",
						kind: "cash_game",
						source: "live",
						currencyId: "currency-1",
						sessionDate: new Date(1_700_000_000_000),
					},
				],
				session_cash_detail: [
					{
						sessionId: "session-1",
						variant: "NL Hold'em",
						mixGames: null,
						buyIn: 100,
						cashOut: 200,
						evCashOut: null,
						chipRemoveTotal: 50,
					},
				],
				session_tournament_detail: [],
				session_chip_purchase: [],
				game_mix: [],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.update({ id: "session-1", memo: "edited" });

		expect(updated.currency_transaction).toHaveLength(1);
		expect(updated.currency_transaction?.[0]).toMatchObject({ amount: 150 });
	});
});

describe("session.update tournament placement integrity (SA2-161)", () => {
	const existingSession = {
		id: "session-1",
		userId: "user-1",
		kind: "tournament",
		source: "manual",
		currencyId: null,
		sessionDate: new Date(1_700_000_000_000),
	};

	function makePlacementCaller(detail: {
		beforeDeadline: boolean | null;
		placement: number | null;
		totalEntries: number | null;
	}) {
		const mock = createChainableMockDb({
			select: {
				game_session: [existingSession],
				session_tournament_detail: [{ sessionId: "session-1", ...detail }],
			},
		});
		return {
			...mock,
			caller: appRouter.createCaller({
				session: { user: { id: "user-1" } },
				db: mock.db,
			} as unknown as Parameters<typeof appRouter.createCaller>[0]),
		};
	}

	it("rejects a placement-only patch above the existing total entries", async () => {
		const { caller, updateWhereParams } = makePlacementCaller({
			beforeDeadline: false,
			placement: 3,
			totalEntries: 10,
		});

		await expect(
			caller.session.update({ id: "session-1", placement: 11 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("rejects a totalEntries-only patch below the existing placement", async () => {
		const { caller, updateWhereParams } = makePlacementCaller({
			beforeDeadline: false,
			placement: 7,
			totalEntries: 10,
		});

		await expect(
			caller.session.update({ id: "session-1", totalEntries: 6 })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("accepts beforeDeadline true and clears placement fields like create", async () => {
		const { db: baseDb } = createChainableMockDb({
			select: {
				game_session: [existingSession],
				session_tournament_detail: [
					{
						sessionId: "session-1",
						beforeDeadline: false,
						placement: 3,
						totalEntries: 10,
					},
				],
			},
		});
		const updates: Record<string, unknown>[] = [];
		const db = {
			...(baseDb as unknown as Record<string, unknown>),
			update: () => ({
				set: (value: Record<string, unknown>) => {
					updates.push(value);
					return { where: () => Promise.resolve(undefined) };
				},
			}),
		};
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.update({
			id: "session-1",
			beforeDeadline: true,
			placement: 99,
			totalEntries: 1,
		});

		expect(updates).toContainEqual(
			expect.objectContaining({
				beforeDeadline: true,
				placement: null,
				totalEntries: null,
			})
		);
	});
});

describe("session joined ownership scoping", () => {
	it("owner-scopes room, currency, and tag joins that surface names", async () => {
		const { db, selectJoinParams } = createChainableMockDb({
			select: {
				game_session: [
					{
						id: "session-1",
						type: "cash_game",
						source: "manual",
						buyIn: null,
						cashOut: null,
						evCashOut: null,
					},
				],
				session_chip_purchase: [],
				session_blind_level: [],
				session_to_session_tag: [],
			},
		});
		const caller = appRouter.createCaller({
			session: { user: { id: "user-1" } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);

		await caller.session.list({});

		const ownerScopedJoins = selectJoinParams.filter((params) =>
			params.includes("user-1")
		);
		expect(ownerScopedJoins).toHaveLength(3);
	});
});

describe("session.list EV falls back to the actual result without an EV cash-out", () => {
	it("reports evProfitLoss = profitLoss and evDiff = 0 when evCashOut is null", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: 700, evCashOut: null });

		const { items } = await caller.session.list({});

		expect(items[0]).toMatchObject({
			profitLoss: 200,
			evProfitLoss: 200,
			evDiff: 0,
		});
	});

	it("adds chipRemoveTotal to the fallback EV so evDiff stays 0", async () => {
		const caller = listCaller({
			buyIn: 500,
			cashOut: 700,
			evCashOut: null,
			chipRemoveTotal: 100,
		});

		const { items } = await caller.session.list({});

		expect(items[0]).toMatchObject({
			profitLoss: 300,
			evProfitLoss: 300,
			evDiff: 0,
		});
	});

	it("still prefers a recorded evCashOut", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: 700, evCashOut: 650 });

		const { items } = await caller.session.list({});

		expect(items[0]).toMatchObject({
			profitLoss: 200,
			evProfitLoss: 150,
			evDiff: -50,
		});
	});

	it("leaves evProfitLoss null when the cash session has no recorded result", async () => {
		const caller = listCaller({ buyIn: null, cashOut: null, evCashOut: null });

		const { items } = await caller.session.list({});

		expect(items[0]).toMatchObject({
			profitLoss: null,
			evProfitLoss: null,
			evDiff: null,
		});
	});

	it("leaves the summary EV totals null when no cash session recorded an EV cash-out", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: 700, evCashOut: null });

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBeNull();
		expect(summary.totalEvDiff).toBeNull();
	});

	it("counts a cash session with a recorded EV cash-out in the summary EV totals", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: 700, evCashOut: 650 });

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBe(150);
		expect(summary.totalEvDiff).toBe(-50);
	});

	it("treats a recorded evCashOut of 0 as recorded, not as missing", async () => {
		const caller = listCaller({ buyIn: 500, cashOut: 700, evCashOut: 0 });

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBe(-500);
		expect(summary.totalEvDiff).toBe(-700);
	});

	it("sums the fallback sessions too once another session recorded an EV cash-out", async () => {
		const caller = listCallerRows([
			{ buyIn: 500, cashOut: 700, evCashOut: 650 },
			{ buyIn: 100, cashOut: 300, evCashOut: null },
		]);

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBe(350);
		expect(summary.totalEvDiff).toBe(-50);
	});

	it("leaves the summary EV totals null when no cash session has a result", async () => {
		const caller = listCaller({
			type: "tournament",
			buyIn: null,
			cashOut: null,
			evCashOut: null,
		});

		const { summary } = await caller.session.list({});

		expect(summary.totalEvProfitLoss).toBeNull();
		expect(summary.totalEvDiff).toBeNull();
	});
});

describe("session.list filter ownership", () => {
	const FILTER_CASES = [
		{ input: { roomId: "room-1" }, table: "room" },
		{ input: { currencyId: "currency-1" }, table: "currency" },
	] as const;

	it("continues to the session query when no ownership-scoped filter is supplied", async () => {
		const { caller, selectedTables } = makeCaller({ game_session: [] });

		await expect(caller.session.list({})).resolves.toMatchObject({ items: [] });

		expect(selectedTables).toContain("game_session");
		expect(selectedTables).not.toContain("room");
		expect(selectedTables).not.toContain("currency");
	});

	it.each(
		FILTER_CASES
	)("rejects a missing $table filter with uniform FORBIDDEN before querying sessions", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({ [table]: [] });

		await expect(caller.session.list(input)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		expect(selectedTables).toEqual([table]);
	});

	it.each(
		FILTER_CASES
	)("rejects another user's $table filter with uniform FORBIDDEN before querying sessions", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({
			[table]: [{ id: Object.values(input)[0], userId: OTHER }],
		});

		await expect(caller.session.list(input)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		expect(selectedTables).toEqual([table]);
	});

	it.each(
		FILTER_CASES
	)("accepts an owned $table filter and continues to the session query", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({
			[table]: [{ id: Object.values(input)[0], userId: CALLER }],
			game_session: [],
		});

		await expect(caller.session.list(input)).resolves.toMatchObject({
			items: [],
		});

		expect(selectedTables).toContain(table);
		expect(selectedTables).toContain("game_session");
	});
});

describe("session.profitLossSeries filter ownership", () => {
	const FILTER_CASES = [
		{ input: { roomId: "room-1" }, table: "room" },
		{ input: { currencyId: "currency-1" }, table: "currency" },
		{ input: { ringGameId: "ring-game-1" }, table: "ring_game" },
	] as const;

	it("continues to the session query when no ownership-scoped filter is supplied", async () => {
		const { caller, selectedTables } = makeCaller({ game_session: [] });

		await expect(caller.session.profitLossSeries({})).resolves.toEqual({
			points: [],
		});

		expect(selectedTables).toContain("game_session");
		expect(selectedTables).not.toContain("room");
		expect(selectedTables).not.toContain("currency");
		expect(selectedTables).not.toContain("ring_game");
	});

	it.each(
		FILTER_CASES
	)("rejects a missing $table filter with uniform FORBIDDEN before querying sessions", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({ [table]: [] });

		await expect(caller.session.profitLossSeries(input)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		expect(selectedTables).toEqual([table]);
	});

	it.each(
		FILTER_CASES
	)("rejects another user's $table filter with uniform FORBIDDEN before querying sessions", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({
			[table]: [{ id: Object.values(input)[0], userId: OTHER }],
		});

		await expect(caller.session.profitLossSeries(input)).rejects.toMatchObject({
			code: "FORBIDDEN",
		});

		expect(selectedTables).toEqual([table]);
	});

	it.each(
		FILTER_CASES
	)("accepts an owned $table filter and continues to the session query", async ({
		input,
		table,
	}) => {
		const { caller, selectedTables } = makeCaller({
			[table]: [{ id: Object.values(input)[0], userId: CALLER }],
			game_session: [],
		});

		await expect(caller.session.profitLossSeries(input)).resolves.toEqual({
			points: [],
		});

		expect(selectedTables).toContain(table);
		expect(selectedTables).toContain("game_session");
	});
});

describe("session ownership (getById / update / delete)", () => {
	const OWNED_SESSION = {
		id: "s1",
		userId: CALLER,
		kind: "cash_game",
		source: "manual",
		currencyId: null,
		sessionDate: new Date(1_700_000_000_000),
	};

	it("getById rejects a missing session with FORBIDDEN before enriching", async () => {
		const { caller, selectedTables } = makeCaller({ game_session: [] });

		await expect(caller.session.getById({ id: "s1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(selectedTables).toEqual(["game_session"]);
	});

	it("getById rejects another user's session with FORBIDDEN", async () => {
		const { caller, selectedTables } = makeCaller({
			game_session: [{ ...OWNED_SESSION, userId: OTHER }],
		});

		await expect(caller.session.getById({ id: "s1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(selectedTables).toEqual(["game_session"]);
	});

	it("delete refuses a missing session", async () => {
		const { caller, deleteWhereParams } = makeCaller({ game_session: [] });

		await expect(caller.session.delete({ id: "s1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(deleteWhereParams).toEqual([]);
	});

	it("delete refuses another user's session", async () => {
		const { caller, deleteWhereParams } = makeCaller({
			game_session: [{ ...OWNED_SESSION, userId: OTHER }],
		});

		await expect(caller.session.delete({ id: "s1" })).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(deleteWhereParams).toEqual([]);
	});

	it("delete removes only the owned session", async () => {
		const { caller, deleteWhereParams } = makeCaller({
			game_session: [OWNED_SESSION],
		});

		await expect(caller.session.delete({ id: "s1" })).resolves.toEqual({
			success: true,
		});
		expect(deleteWhereParams).toEqual([["s1"]]);
	});

	it("update rejects another user's session before writing", async () => {
		const { caller, inserted, updated, updateWhereParams } = makeCaller({
			game_session: [{ ...OWNED_SESSION, userId: OTHER }],
		});

		await expect(
			caller.session.update({ id: "s1", memo: "edited" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(updated).toEqual({});
		expect(inserted).toEqual({});
		expect(updateWhereParams).toEqual([]);
	});
});

describe("session.list filter predicates", () => {
	it.each([
		{
			label: "type",
			input: { type: "tournament" as const },
			param: "tournament",
		},
		{
			label: "dateFrom",
			input: { dateFrom: 1_700_000_000 },
			param: 1_700_000_000,
		},
		{ label: "dateTo", input: { dateTo: 1_800_000_000 }, param: 1_800_000_000 },
	])("binds the $label filter into both the page and the summary WHERE", async ({
		input,
		param,
	}) => {
		const { caller, selectWhereParams } = makeCaller({ game_session: [] });

		await caller.session.list(input);

		expect(selectWhereParams).toEqual([
			[CALLER, param],
			[CALLER, param],
		]);
	});

	it("binds only the owner when no filter is supplied", async () => {
		const { caller, selectWhereParams } = makeCaller({ game_session: [] });

		await caller.session.list({});

		expect(selectWhereParams).toEqual([[CALLER], [CALLER]]);
	});
});

describe("session.list tournament summary aggregates", () => {
	const TOURNAMENT_ROW = {
		type: "tournament",
		tournamentBuyIn: 100,
		entryFee: 0,
		prizeMoney: null,
		bountyPrizes: null,
		placement: null,
		totalEntries: null,
	};

	it("counts a tournament as in the money when its prize money is positive", async () => {
		const caller = listCallerRows([{ ...TOURNAMENT_ROW, prizeMoney: 100 }]);

		const { summary } = await caller.session.list({ type: "tournament" });

		expect(summary.itmRate).toBe(100);
	});

	it("counts bounty-only winnings as in the money and zero winnings as not", async () => {
		const caller = listCallerRows([
			{ ...TOURNAMENT_ROW, bountyPrizes: 20 },
			{ ...TOURNAMENT_ROW, prizeMoney: 0, bountyPrizes: 0 },
		]);

		const { summary } = await caller.session.list({ type: "tournament" });

		expect(summary.itmRate).toBe(50);
		expect(summary.totalPrizeMoney).toBe(20);
	});

	it("averages placement only over tournaments that recorded one", async () => {
		const caller = listCallerRows([
			{ ...TOURNAMENT_ROW, placement: 1 },
			{ ...TOURNAMENT_ROW, placement: null },
			{ ...TOURNAMENT_ROW, placement: 3 },
		]);

		const { summary } = await caller.session.list({ type: "tournament" });

		expect(summary.avgPlacement).toBe(2);
	});

	it("leaves the tournament aggregates null unless the list is filtered to tournaments", async () => {
		const caller = listCallerRows([
			{ ...TOURNAMENT_ROW, prizeMoney: 100, placement: 1 },
		]);

		const { summary } = await caller.session.list({});

		expect(summary).toMatchObject({
			itmRate: null,
			avgPlacement: null,
			totalPrizeMoney: null,
		});
	});
});

describe("session.create currency transaction amount", () => {
	const LINKED = {
		currency: [{ id: "c1", userId: CALLER }],
		transaction_type: [{ id: "tt1" }],
	};

	it("records cashOut - buyIn for a cash game", async () => {
		const { caller, inserted } = makeCaller(LINKED);

		await caller.session.create({
			type: "cash_game",
			sessionDate: 1_700_000_000,
			buyIn: 1000,
			cashOut: 2000,
			currencyId: "c1",
		});

		expect(inserted.currency_transaction).toEqual([
			expect.objectContaining({
				currencyId: "c1",
				transactionTypeId: "tt1",
				amount: 1000,
			}),
		]);
	});

	it("subtracts buy-in, entry fee, and cost x count of chip purchases from prize and bounty income", async () => {
		const { caller, inserted } = makeCaller(LINKED);

		await caller.session.create({
			type: "tournament",
			sessionDate: 1_700_000_000,
			tournamentBuyIn: 100,
			entryFee: 10,
			chipPurchases: [{ name: "Rebuy", cost: 50, chips: 1000, count: 2 }],
			prizeMoney: 500,
			bountyPrizes: 20,
			currencyId: "c1",
		});

		expect(inserted.currency_transaction).toEqual([
			expect.objectContaining({ currencyId: "c1", amount: 310 }),
		]);
	});

	it("treats a missing prize and bounty as zero", async () => {
		const { caller, inserted } = makeCaller(LINKED);

		await caller.session.create({
			type: "tournament",
			sessionDate: 1_700_000_000,
			tournamentBuyIn: 100,
			entryFee: 10,
			currencyId: "c1",
		});

		expect(inserted.currency_transaction).toEqual([
			expect.objectContaining({ currencyId: "c1", amount: -110 }),
		]);
	});
});
