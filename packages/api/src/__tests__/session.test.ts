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
	selectInChunks,
	sessionKeysetCondition,
	toProfitLossSeriesPoint,
	validateEntityOwnership,
	validateTagsOwnership,
} from "../routers/session";
import { createChainableMockDb } from "./test-utils";

const DERIVED_FIELDS_RE = /Cannot edit fields derived from live session events/;
const RING_CONFIG_RE = /variant|blind1|blind2/;
const SESSION_DATE_RE = /sessionDate/;
const PLACEMENT_RE = /placement/;
const PRIZE_MONEY_RE = /prizeMoney/;
const TOURNAMENT_ID_RE = /tournamentId/;

describe("computeCashGamePL", () => {
	it("returns cashOut - buyIn when no chips were removed early", () => {
		expect(computeCashGamePL(500, 700)).toBe(200);
	});

	it("adds a positive chipRemoveTotal back into profit/loss (chip remove bug)", () => {
		// Removing 100 in chips mid-session and cashing out 600 at the table
		// nets the same 200 profit as never removing anything and cashing out
		// 700 — the removed chips are already in the player's pocket.
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
		// Generic illustration: 14 rows at 9 columns bind 126 params in one
		// INSERT — over D1's cap of 100 — and must split into <=11-row chunks.
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
		// session_blind_level gained the `games` column (9 -> 10). At 10 columns
		// the safe max is floor(100 / 10) = 10 rows/INSERT (10 x 10 = 100). This
		// guards the zero-headroom boundary: an 11th column silently overflows.
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
		// 2 columns -> up to 50 rows/chunk; 6 columns -> up to 16 rows/chunk.
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
		// 101 session ids in a single `inArray` binds 101 params — over D1's cap
		// of 100 — and D1 rejects the statement at runtime (the SA2 chip-purchase
		// batched lookup outage). The lookup must run in <=100-id chunks.
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
		// Rows are concatenated across chunks, preserving order.
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
		// 2 rows per id, chunked as [100, 50], concatenated in order.
		expect(rows).toHaveLength(300);
		expect(rows[0]).toEqual({ id: 0, n: 0 });
		expect(rows[1]).toEqual({ id: 0, n: 1 });
		expect(rows.at(-1)).toEqual({ id: 149, n: 1 });
	});
});

describe("session router", () => {
	it("appRouter has session namespace", () => {
		expect(appRouter.session).toBeDefined();
	});

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
});

describe("session.profitLossSeries input validation", () => {
	function getSchema() {
		return (
			appRouter.session.profitLossSeries as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
	}

	it("accepts an empty object (all filters optional)", () => {
		expect(getSchema().safeParse({}).success).toBe(true);
	});

	it("accepts the full filter combination", () => {
		expect(
			getSchema().safeParse({
				type: "cash_game",
				roomId: "s1",
				ringGameId: "rg1",
				currencyId: "c1",
				dateFrom: 1_700_000_000,
				dateTo: 1_800_000_000,
			}).success
		).toBe(true);
	});

	it("rejects an unknown type value", () => {
		expect(getSchema().safeParse({ type: "spin_and_go" }).success).toBe(false);
	});

	it("rejects non-numeric dateFrom", () => {
		expect(getSchema().safeParse({ dateFrom: "today" }).success).toBe(false);
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

	const CASH_RULE_AMOUNT_FIELDS = [
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minBuyIn",
		"maxBuyIn",
	] as const;
	const TOURNAMENT_BLIND_LEVEL_AMOUNT_FIELDS = [
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"minutes",
	] as const;

	it("create accepts a valid cash_game session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse(CASH_BASE).success).toBe(true);
	});

	it("create leaves cash_game variant undefined when omitted (c10: no schema default that would defeat ring-game inheritance)", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: true;
				data: { variant?: string };
			};
		};
		const parsed = schema.safeParse(CASH_BASE) as unknown as {
			success: true;
			data: { variant?: string };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.variant).toBeUndefined();
	});

	it("create accepts a valid tournament session (entryFee defaults to 0)", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				success: true;
				data: { entryFee: number };
			};
		};
		const parsed = schema.safeParse(TOURNAMENT_BASE) as unknown as {
			success: true;
			data: { entryFee: number };
		};
		expect(parsed.success).toBe(true);
		expect(parsed.data.entryFee).toBe(0);
	});

	it("create rejects tournament session where placement > totalEntries", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				placement: 10,
				totalEntries: 5,
			}).success
		).toBe(false);
	});

	it("create accepts tournament session where placement == totalEntries (boundary)", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				placement: 5,
				totalEntries: 5,
			}).success
		).toBe(true);
	});

	it("create rejects unknown discriminator type", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				type: "other",
				sessionDate: 1,
				buyIn: 0,
				cashOut: 0,
			}).success
		).toBe(false);
	});

	it("create rejects negative buyIn", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ ...CASH_BASE, buyIn: -1 }).success).toBe(false);
	});

	it("create accepts zero cash rule amounts and rejects every negative cash rule amount", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		const zeroAmounts = Object.fromEntries(
			CASH_RULE_AMOUNT_FIELDS.map((field) => [field, 0])
		);
		expect(schema.safeParse({ ...CASH_BASE, ...zeroAmounts }).success).toBe(
			true
		);
		for (const field of CASH_RULE_AMOUNT_FIELDS) {
			expect(schema.safeParse({ ...CASH_BASE, [field]: -1 }).success).toBe(
				false
			);
		}
		for (const [tableSize, expected] of [
			[1, false],
			[2, true],
			[10, true],
			[11, false],
		] as const) {
			expect(schema.safeParse({ ...CASH_BASE, tableSize }).success).toBe(
				expected
			);
		}
	});

	it("create accepts zero tournament rule amounts and rejects invalid structure values", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		const zeroBlindLevel = Object.fromEntries(
			TOURNAMENT_BLIND_LEVEL_AMOUNT_FIELDS.map((field) => [field, 0])
		);
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				startingStack: 0,
				bountyAmount: 0,
				blindLevels: [{ isBreak: false, ...zeroBlindLevel }],
			}).success
		).toBe(true);
		for (const field of ["startingStack", "bountyAmount"] as const) {
			expect(
				schema.safeParse({ ...TOURNAMENT_BASE, [field]: -1 }).success
			).toBe(false);
		}
		for (const field of TOURNAMENT_BLIND_LEVEL_AMOUNT_FIELDS) {
			expect(
				schema.safeParse({
					...TOURNAMENT_BASE,
					blindLevels: [{ isBreak: false, [field]: -1 }],
				}).success
			).toBe(false);
		}
		for (const [tableSize, expected] of [
			[1, false],
			[2, true],
			[10, true],
			[11, false],
		] as const) {
			expect(schema.safeParse({ ...TOURNAMENT_BASE, tableSize }).success).toBe(
				expected
			);
		}
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				chipPurchases: [{ name: "", cost: 0, chips: 0 }],
			}).success
		).toBe(false);
	});

	it("list accepts empty object (all filters optional)", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("list accepts all filter combinations", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				cursor: "s1",
				type: "cash_game",
				roomId: "st1",
				currencyId: "c1",
				dateFrom: 1,
				dateTo: 2,
			}).success
		).toBe(true);
	});

	it("list rejects unknown type", () => {
		const schema = (
			appRouter.session.list as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ type: "hybrid" }).success).toBe(false);
	});

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
			// A garbage / deleted-row cursor must degrade to 'no cursor', never to
			// a boundary that drops the whole page (the SA2-150 regression).
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
			// The comparison embeds the value directly — no `SELECT ... WHERE id`.
			expect(query.sql.toLowerCase()).not.toContain("select");
			// 5_000_000 ms floored to 5000 s, bound in both the `<` and `=` arms.
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
			// 700 + 100 - 500, not the chip-remove-blind 700 - 500 = 200.
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

	it("getById accepts {id}", () => {
		const schema = (
			appRouter.session.getById as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1" }).success).toBe(true);
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("update accepts id-only payload", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1" }).success).toBe(true);
	});

	it("update rejects negative buyIn", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1", buyIn: -1 }).success).toBe(false);
	});

	it("update accepts zero and null cash rule values and rejects invalid values", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		for (const value of [0, null]) {
			for (const field of CASH_RULE_AMOUNT_FIELDS) {
				expect(schema.safeParse({ id: "s1", [field]: value }).success).toBe(
					true
				);
			}
		}
		for (const field of CASH_RULE_AMOUNT_FIELDS) {
			expect(schema.safeParse({ id: "s1", [field]: -1 }).success).toBe(false);
		}
		for (const [tableSize, expected] of [
			[1, false],
			[2, true],
			[10, true],
			[11, false],
			[null, true],
		] as const) {
			expect(schema.safeParse({ id: "s1", tableSize }).success).toBe(expected);
		}
	});

	it("update accepts zero and null tournament rule values and rejects invalid values", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		const zeroBlindLevel = Object.fromEntries(
			TOURNAMENT_BLIND_LEVEL_AMOUNT_FIELDS.map((field) => [field, 0])
		);
		expect(
			schema.safeParse({
				id: "s1",
				startingStack: 0,
				bountyAmount: 0,
				blindLevels: [{ isBreak: false, ...zeroBlindLevel }],
			}).success
		).toBe(true);
		expect(
			schema.safeParse({
				id: "s1",
				startingStack: null,
				bountyAmount: null,
				blindLevels: [
					{
						isBreak: false,
						blind1: null,
						blind2: null,
						blind3: null,
						ante: null,
						minutes: null,
					},
				],
			}).success
		).toBe(true);
		for (const field of ["startingStack", "bountyAmount"] as const) {
			expect(schema.safeParse({ id: "s1", [field]: -1 }).success).toBe(false);
		}
		for (const field of TOURNAMENT_BLIND_LEVEL_AMOUNT_FIELDS) {
			expect(
				schema.safeParse({
					id: "s1",
					blindLevels: [{ isBreak: false, [field]: -1 }],
				}).success
			).toBe(false);
		}
		for (const [tableSize, expected] of [
			[1, false],
			[2, true],
			[10, true],
			[11, false],
			[null, true],
		] as const) {
			expect(schema.safeParse({ id: "s1", tableSize }).success).toBe(expected);
		}
		expect(
			schema.safeParse({
				id: "s1",
				chipPurchases: [{ name: "", cost: 0, chips: 0 }],
			}).success
		).toBe(false);
	});

	it("update rejects placement < 1", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ id: "s1", placement: 0 }).success).toBe(false);
	});

	it("update rejects placement greater than totalEntries", () => {
		const schema = (
			appRouter.session.update as unknown as { _def: { inputs: unknown[] } }
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({ id: "s1", placement: 11, totalEntries: 10 }).success
		).toBe(false);
	});
	it("update accepts and retains an edited rule name", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				data?: { ruleName?: string };
				success: boolean;
			};
		};
		const parsed = schema.safeParse({ id: "s1", ruleName: "My 1/2 NLH" });
		expect(parsed.success).toBe(true);
		expect(parsed.data?.ruleName).toBe("My 1/2 NLH");
	});

	it("update accepts and retains cash min/max buy-in", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				data?: { maxBuyIn?: number; minBuyIn?: number };
				success: boolean;
			};
		};
		const parsed = schema.safeParse({ id: "s1", minBuyIn: 100, maxBuyIn: 500 });
		expect(parsed.success).toBe(true);
		expect(parsed.data?.minBuyIn).toBe(100);
		expect(parsed.data?.maxBuyIn).toBe(500);
	});

	it("create accepts cash session with snapshot override fields", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...CASH_BASE,
				ruleName: "1/2 NLH (this session)",
				minBuyIn: 100,
				maxBuyIn: 400,
				tableSize: 9,
			}).success
		).toBe(true);
	});

	it("create rejects empty ruleName on cash session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({ ...CASH_BASE, ruleName: "" }).success).toBe(
			false
		);
	});

	it("create accepts tournament session with snapshot override fields and structure arrays", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				ruleName: "Main Event (session-only)",
				variant: "nlh",
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
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000 }],
			}).success
		).toBe(true);
	});

	it("create accepts chipPurchases carrying an explicit count", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000, count: 3 }],
			}).success
		).toBe(true);
	});

	it("create rejects a negative chip purchase count", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				chipPurchases: [{ name: "Rebuy", cost: 100, chips: 10_000, count: -1 }],
			}).success
		).toBe(false);
	});

	it("create no longer accepts the legacy rebuyCount field as a real column", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				data?: Record<string, unknown>;
				success: boolean;
			};
		};
		const parsed = schema.safeParse({ ...TOURNAMENT_BASE, rebuyCount: 5 });
		expect(parsed.success).toBe(true);
		// Zod strips the unknown legacy key — it never reaches the DB layer.
		expect(parsed.data?.rebuyCount).toBeUndefined();
	});

	it("create rejects a blind level missing isBreak on tournament session", () => {
		const schema = (
			appRouter.session.create as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				...TOURNAMENT_BASE,
				blindLevels: [{ blind1: 100 }],
			}).success
		).toBe(false);
	});

	it("update accepts explicit null clears for nullable link fields", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				id: "s1",
				roomId: null,
				ringGameId: null,
				tournamentId: null,
				currencyId: null,
			}).success
		).toBe(true);
	});

	it("update accepts and retains tournament snapshot override fields and blind level structure", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as {
			safeParse: (v: unknown) => {
				data?: Record<string, unknown>;
				success: boolean;
			};
		};
		const input = {
			id: "s1",
			variant: "nlh",
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
		};
		const parsed = schema.safeParse(input);
		expect(parsed.success).toBe(true);
		// Guards against Zod silently stripping these as unknown keys.
		expect(parsed.data?.startingStack).toBe(20_000);
		expect(parsed.data?.bountyAmount).toBe(500);
		expect(parsed.data?.blindLevels).toEqual(input.blindLevels);
	});

	it("update rejects a blind level missing isBreak", () => {
		const schema = (
			appRouter.session.update as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(
			schema.safeParse({
				id: "s1",
				blindLevels: [{ blind1: 100 }],
			}).success
		).toBe(false);
	});

	it("delete rejects missing id", () => {
		const schema = (
			appRouter.session.delete as unknown as {
				_def: { inputs: unknown[] };
			}
		)._def.inputs[0] as { safeParse: (v: unknown) => { success: boolean } };
		expect(schema.safeParse({}).success).toBe(false);
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
		// income (1000 + 200) - cost (500 + 50 + 300) = 1200 - 850 = 350
		expect(computeTournamentPL(500, 50, 300, 1000, 200)).toBe(350);
	});

	it("treats null buy-in / entry fee / prizes as zero", () => {
		expect(computeTournamentPL(null, null, 0, null, null)).toBe(0);
	});

	it("returns a loss when chip purchases exceed income", () => {
		// income 0 - cost (100 + 0 + 250) = -350
		expect(computeTournamentPL(100, null, 250, null, null)).toBe(-350);
	});

	it("adds bounty prizes to income", () => {
		// income (0 + 400) - cost (100 + 0 + 0) = 300
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
		// The room must be read to confirm ownership.
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
		// Must short-circuit before reading the room.
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
		// Ownership is a direct userId check; the room is never read (SA2-181).
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
		// Must not fall through to reading a room.
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
	const CALLER = "user-1";

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
	const CALLER = "user-1";

	function callerFor(select: Record<string, Record<string, unknown>[]> = {}) {
		const { db, inserted } = createChainableMockDb({ select });
		const caller = appRouter.createCaller({
			session: { user: { id: CALLER } },
			db,
		} as unknown as Parameters<typeof appRouter.createCaller>[0]);
		return { caller, inserted };
	}

	it("derives 'Variant blind1/blind2' when blinds are provided (non-mix)", async () => {
		const { caller, inserted } = callerFor();
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
		const { caller, inserted } = callerFor({
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
		const { caller, inserted } = callerFor();
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
	const CALLER = "user-1";
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
			select: {
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

		// The DELETE and the re-INSERT of the tag links commit together — a bare
		// DELETE followed by a separate awaited INSERT could strand the session
		// with no tags on a failed re-insert. Exactly one batch fires for the
		// whole replace, and it bundles both statements (the scoped DELETE +
		// the single re-INSERT chunk) so they roll back together (SA2-116).
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
						// 50 in chips racked off the table mid-session — already in the
						// player's pocket on top of the 200 they cashed out at the end.
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

		// Editing a live-sourced session (e.g. its memo) must not regress the
		// currency ledger back to the chip-remove-blind cashOut - buyIn (150,
		// not 100): the true P/L is cashOut + chipRemoveTotal - buyIn = 150.
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

	function makeCaller(detail: {
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
		const { caller, updateWhereParams } = makeCaller({
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
		const { caller, updateWhereParams } = makeCaller({
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

describe("session.list filter ownership", () => {
	const CALLER = "user-1";
	const OTHER = "user-2";
	const FILTER_CASES = [
		{ input: { roomId: "room-1" }, table: "room" },
		{ input: { currencyId: "currency-1" }, table: "currency" },
	] as const;

	function makeCaller(select: Record<string, Record<string, unknown>[]>) {
		const mock = createChainableMockDb({ select });
		return {
			...mock,
			caller: appRouter.createCaller({
				session: { user: { id: CALLER } },
				db: mock.db,
			} as unknown as Parameters<typeof appRouter.createCaller>[0]),
		};
	}

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
	const CALLER = "user-1";
	const OTHER = "user-2";
	const FILTER_CASES = [
		{ input: { roomId: "room-1" }, table: "room" },
		{ input: { currencyId: "currency-1" }, table: "currency" },
		{ input: { ringGameId: "ring-game-1" }, table: "ring_game" },
	] as const;

	function makeCaller(select: Record<string, Record<string, unknown>[]>) {
		const mock = createChainableMockDb({ select });
		return {
			...mock,
			caller: appRouter.createCaller({
				session: { user: { id: CALLER } },
				db: mock.db,
			} as unknown as Parameters<typeof appRouter.createCaller>[0]),
		};
	}

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
