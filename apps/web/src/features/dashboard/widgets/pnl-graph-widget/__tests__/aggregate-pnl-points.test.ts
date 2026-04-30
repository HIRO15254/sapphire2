import { describe, expect, it } from "vitest";
import {
	aggregatePnlPoints,
	type PnlSeriesPoint,
} from "@/features/dashboard/widgets/pnl-graph-widget/aggregate-pnl-points";

function point(
	overrides: Partial<PnlSeriesPoint> & {
		id: string;
		profitLoss: number;
		sessionDate: number;
	}
): PnlSeriesPoint {
	return {
		bigBlind: null,
		buyInTotal: null,
		playMinutes: null,
		type: "cash_game",
		...overrides,
	};
}

describe("aggregatePnlPoints", () => {
	describe("xAxis = 'date'", () => {
		it("returns empty result when no points are provided", () => {
			const result = aggregatePnlPoints([], "date", "currency", "all");
			expect(result.points).toEqual([]);
			expect(result.skippedCount).toBe(0);
		});

		it("buckets points on the same UTC day to the cumulative end-of-day value", () => {
			const morning = Math.floor(
				new Date("2026-04-01T03:00:00Z").getTime() / 1000
			);
			const evening = Math.floor(
				new Date("2026-04-01T22:00:00Z").getTime() / 1000
			);
			const nextDay = Math.floor(
				new Date("2026-04-02T10:00:00Z").getTime() / 1000
			);
			const result = aggregatePnlPoints(
				[
					point({ id: "a", profitLoss: 100, sessionDate: morning }),
					point({ id: "b", profitLoss: -30, sessionDate: evening }),
					point({ id: "c", profitLoss: 50, sessionDate: nextDay }),
				],
				"date",
				"currency",
				"all"
			);
			expect(result.points).toHaveLength(2);
			expect(result.points[0]?.cumulative).toBe(70);
			expect(result.points[1]?.cumulative).toBe(120);
		});

		it("sorts unsorted input by sessionDate ascending", () => {
			const a = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
			const b = Math.floor(new Date("2026-04-05T00:00:00Z").getTime() / 1000);
			const result = aggregatePnlPoints(
				[
					point({ id: "later", profitLoss: 50, sessionDate: b }),
					point({ id: "earlier", profitLoss: 10, sessionDate: a }),
				],
				"date",
				"currency",
				"all"
			);
			expect(result.points[0]?.cumulative).toBe(10);
			expect(result.points[1]?.cumulative).toBe(60);
		});

		it("breaks sessionDate ties by id ascending for deterministic ordering", () => {
			const t = Math.floor(new Date("2026-04-01T00:00:00Z").getTime() / 1000);
			const result = aggregatePnlPoints(
				[
					point({ id: "b", profitLoss: 5, sessionDate: t }),
					point({ id: "a", profitLoss: 10, sessionDate: t }),
				],
				"sessionCount",
				"currency",
				"all"
			);
			expect(result.points.map((p) => p.cumulative)).toEqual([10, 15]);
		});
	});

	describe("xAxis = 'sessionCount'", () => {
		it("emits one point per included session, x = 1..N", () => {
			const t0 = 1;
			const result = aggregatePnlPoints(
				[
					point({ id: "a", profitLoss: 10, sessionDate: t0 }),
					point({ id: "b", profitLoss: 20, sessionDate: t0 + 1 }),
					point({ id: "c", profitLoss: -5, sessionDate: t0 + 2 }),
				],
				"sessionCount",
				"currency",
				"all"
			);
			expect(result.points).toEqual([
				{ x: 1, cumulative: 10 },
				{ x: 2, cumulative: 30 },
				{ x: 3, cumulative: 25 },
			]);
		});
	});

	describe("xAxis = 'playTime'", () => {
		it("uses cumulative play hours (minutes / 60) as the x value, treating null as 0", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 100,
						sessionDate: 1,
						playMinutes: 60,
					}),
					point({
						id: "b",
						profitLoss: -50,
						sessionDate: 2,
						playMinutes: null,
					}),
					point({
						id: "c",
						profitLoss: 25,
						sessionDate: 3,
						playMinutes: 30,
					}),
				],
				"playTime",
				"currency",
				"all"
			);
			expect(result.points).toEqual([
				{ x: 1, cumulative: 100 },
				{ x: 1, cumulative: 50 },
				{ x: 1.5, cumulative: 75 },
			]);
		});
	});

	describe("unit = 'normalized', sessionType = 'cash_game'", () => {
		it("divides cash_game profit by bigBlind and skips other rows", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 200,
						sessionDate: 1,
						bigBlind: 50,
					}),
					point({
						id: "b",
						profitLoss: 150,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({
						id: "c",
						profitLoss: 100,
						sessionDate: 3,
						bigBlind: 25,
					}),
				],
				"sessionCount",
				"normalized",
				"cash_game"
			);
			expect(result.points).toEqual([
				{ x: 1, cumulative: 4 },
				{ x: 2, cumulative: 8 },
			]);
			expect(result.skippedCount).toBe(1);
		});

		it("skips cash sessions when bigBlind is null or zero", () => {
			const result = aggregatePnlPoints(
				[
					point({ id: "a", profitLoss: 100, sessionDate: 1, bigBlind: null }),
					point({ id: "b", profitLoss: 200, sessionDate: 2, bigBlind: 0 }),
				],
				"sessionCount",
				"normalized",
				"cash_game"
			);
			expect(result.points).toEqual([]);
			expect(result.skippedCount).toBe(2);
		});
	});

	describe("unit = 'normalized', sessionType = 'tournament'", () => {
		it("divides tournament profit by buyInTotal and skips other rows", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 300,
						sessionDate: 1,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({
						id: "b",
						profitLoss: 100,
						sessionDate: 2,
						bigBlind: 25,
					}),
				],
				"sessionCount",
				"normalized",
				"tournament"
			);
			expect(result.points).toEqual([{ x: 1, cumulative: 3 }]);
			expect(result.skippedCount).toBe(1);
		});

		it("skips tournament sessions when buyInTotal is null or zero", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 100,
						sessionDate: 1,
						type: "tournament",
						buyInTotal: null,
					}),
					point({
						id: "b",
						profitLoss: 100,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 0,
					}),
				],
				"sessionCount",
				"normalized",
				"tournament"
			);
			expect(result.points).toEqual([]);
			expect(result.skippedCount).toBe(2);
		});
	});

	describe("unit = 'normalized', sessionType = 'all' (dual series)", () => {
		it("emits both cashCumulative and tournamentCumulative on every point", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 200,
						sessionDate: 1,
						bigBlind: 50,
					}),
					point({
						id: "b",
						profitLoss: 300,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({
						id: "c",
						profitLoss: 100,
						sessionDate: 3,
						bigBlind: 25,
					}),
				],
				"sessionCount",
				"normalized",
				"all"
			);
			expect(result.points).toEqual([
				{ x: 1, cashCumulative: 4, tournamentCumulative: 0 },
				{ x: 2, cashCumulative: 4, tournamentCumulative: 3 },
				{ x: 3, cashCumulative: 8, tournamentCumulative: 3 },
			]);
			expect(result.skippedCount).toBe(0);
		});

		it("skips sessions with no usable normalization base in either series", () => {
			const result = aggregatePnlPoints(
				[
					point({
						id: "a",
						profitLoss: 100,
						sessionDate: 1,
						bigBlind: null,
					}),
					point({
						id: "b",
						profitLoss: 200,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: null,
					}),
					point({
						id: "c",
						profitLoss: 50,
						sessionDate: 3,
						bigBlind: 25,
					}),
				],
				"sessionCount",
				"normalized",
				"all"
			);
			expect(result.points).toEqual([
				{ x: 1, cashCumulative: 2, tournamentCumulative: 0 },
			]);
			expect(result.skippedCount).toBe(2);
		});

		it("buckets dual-series points by UTC day for date axis", () => {
			const day1 = Math.floor(
				new Date("2026-04-01T03:00:00Z").getTime() / 1000
			);
			const day2 = Math.floor(
				new Date("2026-04-02T03:00:00Z").getTime() / 1000
			);
			const result = aggregatePnlPoints(
				[
					point({ id: "a", profitLoss: 200, sessionDate: day1, bigBlind: 50 }),
					point({
						id: "b",
						profitLoss: 300,
						sessionDate: day2,
						type: "tournament",
						buyInTotal: 100,
					}),
				],
				"date",
				"normalized",
				"all"
			);
			expect(result.points).toHaveLength(2);
			expect(result.points[0]?.cashCumulative).toBe(4);
			expect(result.points[0]?.tournamentCumulative).toBe(0);
			expect(result.points[1]?.cashCumulative).toBe(4);
			expect(result.points[1]?.tournamentCumulative).toBe(3);
		});
	});
});
