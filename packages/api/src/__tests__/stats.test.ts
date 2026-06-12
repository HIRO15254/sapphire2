import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import {
	assertCurrencyScope,
	breakdownKeyLabel,
	breakdownStats,
	computeHighlights,
	computeStreaks,
	normalizedSessionValue,
	type StatsSessionRow,
	sessionDisplayValue,
	stakesLabel,
	summarizeStats,
} from "../routers/stats";
import {
	expectAccepts,
	expectProtected,
	expectRejects,
	expectType,
} from "./test-utils";

// 2023-11-14T22:13:20Z → UTC day=2 (Tue), hour=22, year=2023, month=2023-11
const EPOCH_NOV_2023 = 1_700_000_000;
// 2024-01-01T00:00:00Z → UTC day=1 (Mon), hour=0, year=2024, month=2024-01
const EPOCH_JAN_2024 = 1_704_067_200;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function cashRow(overrides: Partial<StatsSessionRow> = {}): StatsSessionRow {
	return {
		id: "cash-1",
		type: "cash_game",
		sessionDate: EPOCH_NOV_2023,
		profitLoss: 100,
		evProfitLoss: null,
		evDiff: null,
		playMinutes: 60,
		bigBlind: 2,
		buyInTotal: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		bountyPrizes: null,
		roomId: "room-1",
		roomName: "Aria",
		blind1: 1,
		blind2: 2,
		...overrides,
	};
}

function tournamentRow(
	overrides: Partial<StatsSessionRow> = {}
): StatsSessionRow {
	return {
		id: "tourney-1",
		type: "tournament",
		sessionDate: EPOCH_NOV_2023,
		profitLoss: 500,
		evProfitLoss: null,
		evDiff: null,
		playMinutes: 120,
		bigBlind: null,
		buyInTotal: 100,
		placement: 3,
		totalEntries: 50,
		prizeMoney: 600,
		bountyPrizes: 0,
		roomId: "room-2",
		roomName: "Bellagio",
		blind1: null,
		blind2: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("stats router structure", () => {
	it("appRouter has stats namespace", () => {
		expect(appRouter.stats).toBeDefined();
	});

	it("exposes exactly the expected procedure set", () => {
		expect(Object.keys(appRouter.stats).sort()).toEqual([
			"breakdown",
			"highlights",
			"profitLossSeries",
			"summary",
		]);
	});

	it("every procedure is a protected query", () => {
		for (const proc of [
			appRouter.stats.summary,
			appRouter.stats.breakdown,
			appRouter.stats.highlights,
			appRouter.stats.profitLossSeries,
		]) {
			expectProtected(proc);
			expectType(proc, "query");
		}
	});
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("stats shared filter input validation", () => {
	const FULL_FILTER = {
		currencyId: "c1",
		type: "cash_game",
		roomId: "r1",
		dateFrom: EPOCH_NOV_2023,
		dateTo: EPOCH_JAN_2024,
		normalized: true,
	} as const;

	for (const [name, proc] of [
		["summary", appRouter.stats.summary],
		["highlights", appRouter.stats.highlights],
		["profitLossSeries", appRouter.stats.profitLossSeries],
	] as const) {
		describe(`stats.${name}`, () => {
			it("accepts an empty object (currency guard is runtime, not schema)", () => {
				expectAccepts(proc, {});
			});

			it("defaults normalized to false when omitted", () => {
				const schema = (proc as unknown as { _def: { inputs: unknown[] } })._def
					.inputs[0] as {
					safeParse: (v: unknown) => {
						success: true;
						data: { normalized: boolean };
					};
				};
				const parsed = schema.safeParse({});
				expect(parsed.success).toBe(true);
				expect(parsed.data.normalized).toBe(false);
			});

			it("accepts the full filter combination", () => {
				expectAccepts(proc, FULL_FILTER);
			});

			it("rejects an unknown type value", () => {
				expectRejects(proc, { type: "spin_and_go" });
			});

			it("rejects a non-numeric dateFrom", () => {
				expectRejects(proc, { dateFrom: "today" });
			});

			it("rejects a non-boolean normalized", () => {
				expectRejects(proc, { normalized: "yes" });
			});
		});
	}
});

describe("stats.breakdown input validation", () => {
	it("rejects a payload missing groupBy", () => {
		expectRejects(appRouter.stats.breakdown, { currencyId: "c1" });
	});

	it("rejects an unknown groupBy value", () => {
		expectRejects(appRouter.stats.breakdown, { groupBy: "decade" });
	});

	it("accepts each valid groupBy value", () => {
		for (const groupBy of [
			"room",
			"stakes",
			"type",
			"dayOfWeek",
			"length",
			"month",
			"year",
		]) {
			expectAccepts(appRouter.stats.breakdown, { groupBy });
		}
	});

	it("accepts groupBy together with the full filter set", () => {
		expectAccepts(appRouter.stats.breakdown, {
			currencyId: "c1",
			type: "tournament",
			roomId: "r1",
			dateFrom: 1,
			dateTo: 2,
			normalized: true,
			groupBy: "room",
		});
	});

	it("rejects a non-boolean normalized", () => {
		expectRejects(appRouter.stats.breakdown, {
			groupBy: "type",
			normalized: 1,
		});
	});
});

// ---------------------------------------------------------------------------
// assertCurrencyScope
// ---------------------------------------------------------------------------

describe("assertCurrencyScope", () => {
	it("throws TRPCError BAD_REQUEST for an empty filter object", () => {
		try {
			assertCurrencyScope({});
			throw new Error("expected throw");
		} catch (error) {
			expect(error).toBeInstanceOf(TRPCError);
			expect((error as TRPCError).code).toBe("BAD_REQUEST");
			expect((error as TRPCError).message).toBe(
				"currencyId is required unless normalized is enabled"
			);
		}
	});

	it("throws when normalized is explicitly false and no currency", () => {
		expect(() => assertCurrencyScope({ normalized: false })).toThrow(TRPCError);
	});

	it("throws when currencyId is an empty string and not normalized", () => {
		expect(() =>
			assertCurrencyScope({ currencyId: "", normalized: false })
		).toThrow(TRPCError);
	});

	it("does not throw when a currencyId is present", () => {
		expect(() => assertCurrencyScope({ currencyId: "c1" })).not.toThrow();
	});

	it("does not throw when normalized is true even without a currencyId", () => {
		expect(() => assertCurrencyScope({ normalized: true })).not.toThrow();
	});

	it("does not throw when both currencyId and normalized are set", () => {
		expect(() =>
			assertCurrencyScope({ currencyId: "c1", normalized: true })
		).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// normalizedSessionValue
// ---------------------------------------------------------------------------

describe("normalizedSessionValue", () => {
	it("divides cash profitLoss by bigBlind when bigBlind > 0", () => {
		expect(
			normalizedSessionValue(cashRow({ profitLoss: 100, bigBlind: 2 }))
		).toBe(50);
	});

	it("returns null for a cash row with bigBlind === 0", () => {
		expect(
			normalizedSessionValue(cashRow({ profitLoss: 100, bigBlind: 0 }))
		).toBeNull();
	});

	it("returns null for a cash row with a negative bigBlind", () => {
		expect(
			normalizedSessionValue(cashRow({ profitLoss: 100, bigBlind: -2 }))
		).toBeNull();
	});

	it("returns null for a cash row with bigBlind null", () => {
		expect(
			normalizedSessionValue(cashRow({ profitLoss: 100, bigBlind: null }))
		).toBeNull();
	});

	it("divides tournament profitLoss by buyInTotal when buyInTotal > 0", () => {
		expect(
			normalizedSessionValue(
				tournamentRow({ profitLoss: 500, buyInTotal: 100 })
			)
		).toBe(5);
	});

	it("returns null for a tournament row with buyInTotal === 0", () => {
		expect(normalizedSessionValue(tournamentRow({ buyInTotal: 0 }))).toBeNull();
	});

	it("returns null for a tournament row with buyInTotal null", () => {
		expect(
			normalizedSessionValue(tournamentRow({ buyInTotal: null }))
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// sessionDisplayValue
// ---------------------------------------------------------------------------

describe("sessionDisplayValue", () => {
	it("returns raw profitLoss when normalized is false", () => {
		expect(sessionDisplayValue(cashRow({ profitLoss: 100 }), false)).toBe(100);
	});

	it("returns the normalized value when normalized is true", () => {
		expect(
			sessionDisplayValue(cashRow({ profitLoss: 100, bigBlind: 2 }), true)
		).toBe(50);
	});

	it("returns null when normalized is true but the row is not normalizable", () => {
		expect(
			sessionDisplayValue(cashRow({ profitLoss: 100, bigBlind: null }), true)
		).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// stakesLabel
// ---------------------------------------------------------------------------

describe("stakesLabel", () => {
	it("formats blind1/blind2 when both present", () => {
		expect(stakesLabel(cashRow({ blind1: 1, blind2: 2 }))).toBe("1/2");
	});

	it("substitutes 0 for null blinds", () => {
		expect(stakesLabel(cashRow({ blind1: null, blind2: null }))).toBe("0/0");
	});

	it("substitutes 0 only for the null side", () => {
		expect(stakesLabel(cashRow({ blind1: null, blind2: 5 }))).toBe("0/5");
	});
});

// ---------------------------------------------------------------------------
// breakdownKeyLabel
// ---------------------------------------------------------------------------

describe("breakdownKeyLabel", () => {
	it("groups by room id and name", () => {
		expect(
			breakdownKeyLabel(cashRow({ roomId: "r1", roomName: "Aria" }), "room")
		).toEqual({ key: "r1", label: "Aria" });
	});

	it("falls back to none / No room when room is missing", () => {
		expect(
			breakdownKeyLabel(cashRow({ roomId: null, roomName: null }), "room")
		).toEqual({ key: "none", label: "No room" });
	});

	it("labels cash type as 'Cash game'", () => {
		expect(breakdownKeyLabel(cashRow(), "type")).toEqual({
			key: "cash_game",
			label: "Cash game",
		});
	});

	it("labels tournament type as 'Tournament'", () => {
		expect(breakdownKeyLabel(tournamentRow(), "type")).toEqual({
			key: "tournament",
			label: "Tournament",
		});
	});

	it("groups cash stakes by the stakes label", () => {
		expect(
			breakdownKeyLabel(cashRow({ blind1: 1, blind2: 2 }), "stakes")
		).toEqual({ key: "1/2", label: "1/2" });
	});

	it("excludes tournament rows from the stakes grouping (returns null)", () => {
		expect(breakdownKeyLabel(tournamentRow(), "stakes")).toBeNull();
	});

	it("buckets dayOfWeek by UTC day index and label", () => {
		// 2023-11-14T22:13:20Z is a Tuesday (UTC day 2).
		expect(
			breakdownKeyLabel(cashRow({ sessionDate: EPOCH_NOV_2023 }), "dayOfWeek")
		).toEqual({ key: "2", label: "Tue" });
	});

	it("buckets Sunday correctly as day 0", () => {
		// 2024-01-07T00:00:00Z is a Sunday.
		expect(
			breakdownKeyLabel(cashRow({ sessionDate: 1_704_585_600 }), "dayOfWeek")
		).toEqual({ key: "0", label: "Sun" });
	});

	it("buckets length by whole hours of session duration", () => {
		expect(breakdownKeyLabel(cashRow({ playMinutes: 150 }), "length")).toEqual({
			key: "2",
			label: "2~3h",
		});
	});

	it("buckets a sub-hour session into the 0~1h length bucket", () => {
		expect(breakdownKeyLabel(cashRow({ playMinutes: 45 }), "length")).toEqual({
			key: "0",
			label: "0~1h",
		});
	});

	it("excludes a session with no recorded duration from length grouping", () => {
		expect(
			breakdownKeyLabel(cashRow({ playMinutes: null }), "length")
		).toBeNull();
	});

	it("buckets month as zero-padded YYYY-MM in UTC", () => {
		expect(
			breakdownKeyLabel(cashRow({ sessionDate: EPOCH_NOV_2023 }), "month")
		).toEqual({ key: "2023-11", label: "2023-11" });
	});

	it("zero-pads single-digit months", () => {
		expect(
			breakdownKeyLabel(cashRow({ sessionDate: EPOCH_JAN_2024 }), "month")
		).toEqual({ key: "2024-01", label: "2024-01" });
	});

	it("buckets year by UTC year", () => {
		expect(
			breakdownKeyLabel(cashRow({ sessionDate: EPOCH_NOV_2023 }), "year")
		).toEqual({ key: "2023", label: "2023" });
	});
});

// ---------------------------------------------------------------------------
// breakdownStats
// ---------------------------------------------------------------------------

describe("breakdownStats", () => {
	it("returns an empty array for no rows", () => {
		expect(breakdownStats([], "type")).toEqual([]);
	});

	it("aggregates sessions, currency profitLoss, normalized sums, winRate and playMinutes per group", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, playMinutes: 60, bigBlind: 2 }),
			cashRow({ id: "b", profitLoss: -40, playMinutes: 30, bigBlind: 2 }),
		];
		const [group] = breakdownStats(rows, "type");
		expect(group).toEqual({
			key: "cash_game",
			label: "Cash game",
			sessions: 2,
			profitLoss: 60,
			cashNormalizedProfitLoss: 30, // 50 + (-20)
			tournamentNormalizedProfitLoss: null,
			winRate: 50,
			playMinutes: 90,
		});
	});

	it("excludes tournament rows entirely when grouping by stakes", () => {
		const rows = [
			cashRow({ id: "a", blind1: 1, blind2: 2 }),
			tournamentRow({ id: "t" }),
		];
		const groups = breakdownStats(rows, "stakes");
		expect(groups).toHaveLength(1);
		expect(groups[0]?.key).toBe("1/2");
		expect(groups[0]?.sessions).toBe(1);
	});

	it("keeps cash (bb) and tournament (bi) normalized sums apart within a mixed group", () => {
		const rows = [
			cashRow({
				id: "a",
				roomId: "R",
				roomName: "R",
				profitLoss: 100,
				bigBlind: 2,
			}), // bb 50
			tournamentRow({
				id: "t",
				roomId: "R",
				roomName: "R",
				profitLoss: 300,
				buyInTotal: 100,
			}), // bi 3
		];
		const [group] = breakdownStats(rows, "room");
		expect(group?.sessions).toBe(2);
		expect(group?.profitLoss).toBe(400); // currency 100 + 300
		expect(group?.cashNormalizedProfitLoss).toBe(50);
		expect(group?.tournamentNormalizedProfitLoss).toBe(3);
	});

	it("reports null normalized sums when a group has no normalizable rows of that type", () => {
		const rows = [cashRow({ id: "a", profitLoss: 100, bigBlind: null })];
		const [group] = breakdownStats(rows, "type");
		expect(group?.sessions).toBe(1);
		expect(group?.cashNormalizedProfitLoss).toBeNull();
		expect(group?.tournamentNormalizedProfitLoss).toBeNull();
	});

	it("computes winRate from currency sign", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, bigBlind: 2 }),
			cashRow({ id: "b", profitLoss: -50, bigBlind: 2 }),
		];
		const [group] = breakdownStats(rows, "type");
		expect(group?.winRate).toBe(50);
	});

	it("sorts chronological dimensions ascending by numeric key", () => {
		const rows = [
			cashRow({ id: "a", sessionDate: 1_704_585_600 }), // Sunday -> 0
			cashRow({ id: "b", sessionDate: EPOCH_NOV_2023 }), // Tuesday -> 2
			cashRow({ id: "c", sessionDate: EPOCH_JAN_2024 }), // Monday -> 1
		];
		const groups = breakdownStats(rows, "dayOfWeek");
		expect(groups.map((g) => g.key)).toEqual(["0", "1", "2"]);
	});

	it("sorts month chronologically by lexical YYYY-MM key", () => {
		const rows = [
			cashRow({ id: "a", sessionDate: EPOCH_JAN_2024 }), // 2024-01
			cashRow({ id: "b", sessionDate: EPOCH_NOV_2023 }), // 2023-11
		];
		const groups = breakdownStats(rows, "month");
		expect(groups.map((g) => g.key)).toEqual(["2023-11", "2024-01"]);
	});

	it("sorts count-based dimensions by sessions desc, then profitLoss desc, then label asc", () => {
		const rows = [
			// Room A: 1 session, +10
			cashRow({ id: "a", roomId: "A", roomName: "A", profitLoss: 10 }),
			// Room B: 2 sessions, +5 total
			cashRow({ id: "b1", roomId: "B", roomName: "B", profitLoss: 5 }),
			cashRow({ id: "b2", roomId: "B", roomName: "B", profitLoss: 0 }),
			// Room C: 2 sessions, +20 total (more sessions ties with B; higher PL wins)
			cashRow({ id: "c1", roomId: "C", roomName: "C", profitLoss: 10 }),
			cashRow({ id: "c2", roomId: "C", roomName: "C", profitLoss: 10 }),
		];
		const groups = breakdownStats(rows, "room");
		// C and B both have 2 sessions; C has higher PL → first. A has 1 → last.
		expect(groups.map((g) => g.key)).toEqual(["C", "B", "A"]);
	});

	it("breaks count-desc ties on profitLoss with label ascending", () => {
		const rows = [
			cashRow({ id: "z", roomId: "Z", roomName: "Zeta", profitLoss: 10 }),
			cashRow({ id: "a", roomId: "A", roomName: "Alpha", profitLoss: 10 }),
		];
		const groups = breakdownStats(rows, "room");
		// Same sessions (1) and same PL (10) → label ascending: Alpha before Zeta.
		expect(groups.map((g) => g.label)).toEqual(["Alpha", "Zeta"]);
	});
});

// ---------------------------------------------------------------------------
// summarizeStats
// ---------------------------------------------------------------------------

describe("summarizeStats", () => {
	it("returns a zeroed/null summary for no rows", () => {
		const summary = summarizeStats([]);
		expect(summary.totalSessions).toBe(0);
		expect(summary.totalProfitLoss).toBe(0);
		expect(summary.winRate).toBe(0);
		expect(summary.totalPlayMinutes).toBe(0);
		expect(summary.cashNormalizedProfitLoss).toBeNull();
		expect(summary.tournamentNormalizedProfitLoss).toBeNull();
		expect(summary.totalEvProfitLoss).toBeNull();
		expect(summary.totalEvDiff).toBeNull();
		expect(summary.avgProfitLoss).toBeNull();
		expect(summary.hourlyRate).toBeNull();
		expect(summary.bbPerHour).toBeNull();
		expect(summary.roi).toBeNull();
		expect(summary.itmRate).toBeNull();
		expect(summary.avgPlacement).toBeNull();
		expect(summary.totalPrizeMoney).toBeNull();
	});

	it("computes totals, winRate and avg for a set of cash rows", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, playMinutes: 60, bigBlind: 2 }),
			cashRow({ id: "b", profitLoss: -40, playMinutes: 60, bigBlind: 2 }),
		];
		const summary = summarizeStats(rows);
		expect(summary.totalSessions).toBe(2);
		expect(summary.totalProfitLoss).toBe(60);
		expect(summary.winRate).toBe(50);
		expect(summary.avgProfitLoss).toBe(30);
		expect(summary.totalPlayMinutes).toBe(120);
	});

	it("sums cash bb into cashNormalizedProfitLoss and tournament bi into tournamentNormalizedProfitLoss separately", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, bigBlind: 2 }), // bb 50
			cashRow({ id: "b", profitLoss: 50, bigBlind: 5 }), // bb 10
			tournamentRow({ id: "t", profitLoss: 300, buyInTotal: 100 }), // bi 3
		];
		const summary = summarizeStats(rows);
		expect(summary.cashNormalizedProfitLoss).toBe(60);
		expect(summary.tournamentNormalizedProfitLoss).toBe(3);
	});

	it("returns null normalized figures when no row of that type is normalizable", () => {
		const summary = summarizeStats([
			cashRow({ profitLoss: 100, bigBlind: null }),
		]);
		expect(summary.cashNormalizedProfitLoss).toBeNull();
		expect(summary.tournamentNormalizedProfitLoss).toBeNull();
	});

	it("computes cash hourlyRate from cash play time", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 120, playMinutes: 60, bigBlind: 2 }),
		];
		// 120 over 1 hour → 120/hr.
		expect(summarizeStats(rows).hourlyRate).toBe(120);
	});

	it("computes bbPerHour from cash bb won over cash hours", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, playMinutes: 60, bigBlind: 2 }),
		];
		// 50 bb over 1 hour → 50 bb/hr.
		expect(summarizeStats(rows).bbPerHour).toBe(50);
	});

	it("returns null hourlyRate and bbPerHour when there is no cash play time", () => {
		const rows = [cashRow({ playMinutes: null })];
		const summary = summarizeStats(rows);
		expect(summary.hourlyRate).toBeNull();
		expect(summary.bbPerHour).toBeNull();
	});

	it("excludes tournament rows from hourlyRate / bbPerHour", () => {
		const rows = [tournamentRow({ playMinutes: 120, profitLoss: 500 })];
		const summary = summarizeStats(rows);
		expect(summary.hourlyRate).toBeNull();
		expect(summary.bbPerHour).toBeNull();
	});

	it("sums ev metrics over cash rows that have ev", () => {
		const rows = [
			cashRow({
				id: "a",
				profitLoss: 100,
				evProfitLoss: 120,
				evDiff: 20,
				bigBlind: 2,
			}),
		];
		const summary = summarizeStats(rows);
		expect(summary.totalEvProfitLoss).toBe(120);
		expect(summary.totalEvDiff).toBe(20);
		// 20 / bigBlind 2 = 10 bb.
		expect(summary.cashEvDiffNormalized).toBe(10);
	});

	it("returns null ev metrics when no cash row has ev", () => {
		const rows = [cashRow({ evProfitLoss: null, evDiff: null })];
		const summary = summarizeStats(rows);
		expect(summary.totalEvProfitLoss).toBeNull();
		expect(summary.totalEvDiff).toBeNull();
		expect(summary.cashEvDiffNormalized).toBeNull();
	});

	it("returns null cashEvDiffNormalized when ev rows have no big blind", () => {
		const rows = [
			cashRow({
				profitLoss: 100,
				evProfitLoss: 120,
				evDiff: 20,
				bigBlind: null,
			}),
		];
		const summary = summarizeStats(rows);
		expect(summary.totalEvDiff).toBe(20);
		expect(summary.cashEvDiffNormalized).toBeNull();
	});

	it("computes tournament roi, itmRate, avgPlacement and totalPrizeMoney", () => {
		const rows = [
			tournamentRow({
				id: "a",
				profitLoss: 400,
				buyInTotal: 100,
				placement: 1,
				prizeMoney: 500,
				bountyPrizes: 0,
			}),
			tournamentRow({
				id: "b",
				profitLoss: -100,
				buyInTotal: 100,
				placement: 50,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		];
		const summary = summarizeStats(rows);
		// invested 200, prize 500 → (500-200)/200*100 = 150
		expect(summary.roi).toBe(150);
		// 1 of 2 in the money
		expect(summary.itmRate).toBe(50);
		// (1 + 50) / 2 = 25.5
		expect(summary.avgPlacement).toBe(25.5);
		// prizeMoney + bounty = 500
		expect(summary.totalPrizeMoney).toBe(500);
	});

	it("returns null roi when no tournament has invested amount", () => {
		const rows = [tournamentRow({ buyInTotal: null, prizeMoney: 100 })];
		expect(summarizeStats(rows).roi).toBeNull();
	});

	it("includes bounty prizes in itm detection and totalPrizeMoney", () => {
		const rows = [
			tournamentRow({
				profitLoss: 0,
				buyInTotal: 100,
				placement: 10,
				prizeMoney: 0,
				bountyPrizes: 200,
			}),
		];
		const summary = summarizeStats(rows);
		expect(summary.itmRate).toBe(100);
		expect(summary.totalPrizeMoney).toBe(200);
	});

	it("returns null avgPlacement when no tournament has a placement", () => {
		const rows = [tournamentRow({ placement: null })];
		expect(summarizeStats(rows).avgPlacement).toBeNull();
	});

	it("returns null tournament metrics when there are only cash rows", () => {
		const rows = [cashRow()];
		const summary = summarizeStats(rows);
		expect(summary.roi).toBeNull();
		expect(summary.itmRate).toBeNull();
		expect(summary.avgPlacement).toBeNull();
		expect(summary.totalPrizeMoney).toBeNull();
	});

	it("aggregates mixed cash and tournament rows", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, playMinutes: 60, bigBlind: 2 }),
			tournamentRow({
				id: "b",
				profitLoss: 400,
				buyInTotal: 100,
				placement: 1,
				prizeMoney: 500,
				bountyPrizes: 0,
				playMinutes: 120,
			}),
		];
		const summary = summarizeStats(rows);
		expect(summary.totalSessions).toBe(2);
		expect(summary.totalProfitLoss).toBe(500);
		expect(summary.winRate).toBe(100);
		expect(summary.totalPlayMinutes).toBe(180);
		// Cash-only hourly: 100 over 1 hour.
		expect(summary.hourlyRate).toBe(100);
		// Tournament-only roi: (500-100)/100*100 = 400.
		expect(summary.roi).toBe(400);
	});
});

// ---------------------------------------------------------------------------
// computeStreaks
// ---------------------------------------------------------------------------

describe("computeStreaks", () => {
	function row(id: string, sessionDate: number, profitLoss: number) {
		return cashRow({ id, sessionDate, profitLoss });
	}

	it("returns all-zero streaks for no rows", () => {
		expect(computeStreaks([])).toEqual({
			currentWinStreak: 0,
			currentLoseStreak: 0,
			maxWinStreak: 0,
			maxLoseStreak: 0,
		});
	});

	it("counts a pure winning sequence", () => {
		const rows = [row("a", 1, 10), row("b", 2, 20), row("c", 3, 30)];
		expect(computeStreaks(rows)).toEqual({
			currentWinStreak: 3,
			currentLoseStreak: 0,
			maxWinStreak: 3,
			maxLoseStreak: 0,
		});
	});

	it("counts a pure losing sequence", () => {
		const rows = [row("a", 1, -10), row("b", 2, -20)];
		expect(computeStreaks(rows)).toEqual({
			currentWinStreak: 0,
			currentLoseStreak: 2,
			maxWinStreak: 0,
			maxLoseStreak: 2,
		});
	});

	it("tracks max streaks across an alternating sequence", () => {
		const rows = [
			row("a", 1, 10),
			row("b", 2, -5),
			row("c", 3, 10),
			row("d", 4, -5),
		];
		const result = computeStreaks(rows);
		expect(result.maxWinStreak).toBe(1);
		expect(result.maxLoseStreak).toBe(1);
		// Last session is a loss → current win 0, current lose 1.
		expect(result.currentWinStreak).toBe(0);
		expect(result.currentLoseStreak).toBe(1);
	});

	it("resets the running streak on a break-even (PL === 0) session", () => {
		const rows = [
			row("a", 1, 10),
			row("b", 2, 10),
			row("c", 3, 0),
			row("d", 4, 10),
		];
		const result = computeStreaks(rows);
		// Best run was 2 before the zero, then 1 after.
		expect(result.maxWinStreak).toBe(2);
		expect(result.currentWinStreak).toBe(1);
	});

	it("returns a zero current streak when the last session is break-even", () => {
		const rows = [row("a", 1, 10), row("b", 2, 0)];
		const result = computeStreaks(rows);
		expect(result.currentWinStreak).toBe(0);
		expect(result.currentLoseStreak).toBe(0);
		expect(result.maxWinStreak).toBe(1);
	});

	it("computes current streak from the last session backward", () => {
		const rows = [row("a", 1, -10), row("b", 2, 10), row("c", 3, 10)];
		const result = computeStreaks(rows);
		// Trailing two wins → current win 2; overall max win is also 2.
		expect(result.currentWinStreak).toBe(2);
		expect(result.currentLoseStreak).toBe(0);
		expect(result.maxWinStreak).toBe(2);
		expect(result.maxLoseStreak).toBe(1);
	});

	it("orders by (sessionDate, id) before computing", () => {
		// Supplied out of order; chronological order is a(+10) → b(+10) → c(-5).
		const rows = [row("c", 3, -5), row("a", 1, 10), row("b", 2, 10)];
		const result = computeStreaks(rows);
		expect(result.maxWinStreak).toBe(2);
		expect(result.currentLoseStreak).toBe(1);
		expect(result.currentWinStreak).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// computeHighlights
// ---------------------------------------------------------------------------

describe("computeHighlights", () => {
	it("returns all nulls for no rows", () => {
		expect(computeHighlights([])).toEqual({
			bestSession: null,
			worstSession: null,
			longestSession: null,
		});
	});

	it("selects best and worst by currency profitLoss", () => {
		const rows = [
			cashRow({ id: "a", profitLoss: 100, bigBlind: 2 }),
			cashRow({ id: "b", profitLoss: -50, bigBlind: 5 }),
			cashRow({ id: "c", profitLoss: 30, bigBlind: 2 }),
		];
		const { bestSession, worstSession } = computeHighlights(rows);
		expect(bestSession).toEqual({
			id: "a",
			date: EPOCH_NOV_2023,
			profitLoss: 100,
			normalizedProfitLoss: 50,
			type: "cash_game",
		});
		expect(worstSession).toEqual({
			id: "b",
			date: EPOCH_NOV_2023,
			profitLoss: -50,
			normalizedProfitLoss: -10,
			type: "cash_game",
		});
	});

	it("includes a null normalizedProfitLoss when the best row is not normalizable", () => {
		const rows = [cashRow({ id: "a", profitLoss: 100, bigBlind: null })];
		const { bestSession } = computeHighlights(rows);
		expect(bestSession?.normalizedProfitLoss).toBeNull();
	});

	it("keeps the first row when best/worst values tie", () => {
		const rows = [
			cashRow({ id: "first", profitLoss: 100 }),
			cashRow({ id: "second", profitLoss: 100 }),
		];
		const { bestSession, worstSession } = computeHighlights(rows);
		expect(bestSession?.id).toBe("first");
		expect(worstSession?.id).toBe("first");
	});

	it("selects the longest session by max playMinutes", () => {
		const rows = [
			cashRow({ id: "a", playMinutes: 60 }),
			cashRow({ id: "b", playMinutes: 180 }),
			cashRow({ id: "c", playMinutes: 90 }),
		];
		expect(computeHighlights(rows).longestSession).toEqual({
			id: "b",
			date: EPOCH_NOV_2023,
			playMinutes: 180,
		});
	});

	it("ignores rows with null playMinutes when selecting the longest", () => {
		const rows = [
			cashRow({ id: "a", playMinutes: null }),
			cashRow({ id: "b", playMinutes: 45 }),
		];
		expect(computeHighlights(rows).longestSession?.id).toBe("b");
	});

	it("returns a null longestSession when no row has playMinutes", () => {
		const rows = [
			cashRow({ id: "a", playMinutes: null }),
			cashRow({ id: "b", playMinutes: null }),
		];
		expect(computeHighlights(rows).longestSession).toBeNull();
	});

	it("treats a zero-minute session as a valid longest when it is the only timed row", () => {
		const rows = [
			cashRow({ id: "a", playMinutes: null }),
			cashRow({ id: "b", playMinutes: 0 }),
		];
		expect(computeHighlights(rows).longestSession).toEqual({
			id: "b",
			date: EPOCH_NOV_2023,
			playMinutes: 0,
		});
	});
});
