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
		evProfitLoss: null,
		playMinutes: null,
		type: "cash_game",
		...overrides,
	};
}

const baseOptions = {
	rawPoints: [] as PnlSeriesPoint[],
	xAxis: "date" as const,
	unit: "currency" as const,
	sessionType: "all" as const,
	showEvCash: false,
};

describe("aggregatePnlPoints", () => {
	describe("xAxis = 'date'", () => {
		it("returns empty result when no points are provided", () => {
			const result = aggregatePnlPoints({ ...baseOptions, rawPoints: [] });
			expect(result.points).toEqual([]);
			expect(result.skippedCount).toBe(0);
		});

		it("prepends an origin point one day before the earliest session", () => {
			const day1 = Math.floor(
				new Date("2026-04-01T03:00:00Z").getTime() / 1000
			);
			const result = aggregatePnlPoints({
				...baseOptions,
				rawPoints: [point({ id: "a", profitLoss: 100, sessionDate: day1 })],
			});
			expect(result.points).toHaveLength(2);
			expect(result.points[0]?.cumulative).toBe(0);
			expect(result.points[0]?.x).toBe(
				new Date("2026-03-31T00:00:00Z").getTime()
			);
			expect(result.points[1]?.cumulative).toBe(100);
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
			const result = aggregatePnlPoints({
				...baseOptions,
				rawPoints: [
					point({ id: "a", profitLoss: 100, sessionDate: morning }),
					point({ id: "b", profitLoss: -30, sessionDate: evening }),
					point({ id: "c", profitLoss: 50, sessionDate: nextDay }),
				],
			});
			expect(result.points).toHaveLength(3);
			expect(result.points[0]?.cumulative).toBe(0);
			expect(result.points[1]?.cumulative).toBe(70);
			expect(result.points[2]?.cumulative).toBe(120);
		});
	});

	describe("xAxis = 'sessionCount'", () => {
		it("emits one point per included session, x = 1..N, prefixed by origin (0, 0)", () => {
			const t0 = 1;
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				rawPoints: [
					point({ id: "a", profitLoss: 10, sessionDate: t0 }),
					point({ id: "b", profitLoss: 20, sessionDate: t0 + 1 }),
					point({ id: "c", profitLoss: -5, sessionDate: t0 + 2 }),
				],
			});
			expect(result.points).toEqual([
				{ x: 0, cumulative: 0 },
				{ x: 1, cumulative: 10 },
				{ x: 2, cumulative: 30 },
				{ x: 3, cumulative: 25 },
			]);
		});
	});

	describe("xAxis = 'playTime'", () => {
		it("uses cumulative play hours and prepends origin (0, 0)", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "playTime",
				rawPoints: [
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
			});
			expect(result.points).toEqual([
				{ x: 0, cumulative: 0 },
				{ x: 1, cumulative: 100 },
				{ x: 1, cumulative: 50 },
				{ x: 1.5, cumulative: 75 },
			]);
		});
	});

	describe("unit = 'normalized', sessionType = 'cash_game'", () => {
		it("divides cash_game profit by bigBlind and skips other rows", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "normalized",
				sessionType: "cash_game",
				rawPoints: [
					point({ id: "a", profitLoss: 200, sessionDate: 1, bigBlind: 50 }),
					point({
						id: "b",
						profitLoss: 150,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({ id: "c", profitLoss: 100, sessionDate: 3, bigBlind: 25 }),
				],
			});
			expect(result.points).toEqual([
				{ x: 0, cumulative: 0 },
				{ x: 1, cumulative: 4 },
				{ x: 2, cumulative: 8 },
			]);
			expect(result.skippedCount).toBe(1);
		});
	});

	describe("unit = 'normalized', sessionType = 'tournament'", () => {
		it("divides tournament profit by buyInTotal and skips other rows", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "normalized",
				sessionType: "tournament",
				rawPoints: [
					point({
						id: "a",
						profitLoss: 300,
						sessionDate: 1,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({ id: "b", profitLoss: 100, sessionDate: 2, bigBlind: 25 }),
				],
			});
			expect(result.points).toEqual([
				{ x: 0, cumulative: 0 },
				{ x: 1, cumulative: 3 },
			]);
			expect(result.skippedCount).toBe(1);
		});
	});

	describe("unit = 'normalized', sessionType = 'all' (dual series)", () => {
		it("emits both cashCumulative and tournamentCumulative on every point with shared origin", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "normalized",
				sessionType: "all",
				rawPoints: [
					point({ id: "a", profitLoss: 200, sessionDate: 1, bigBlind: 50 }),
					point({
						id: "b",
						profitLoss: 300,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 100,
					}),
					point({ id: "c", profitLoss: 100, sessionDate: 3, bigBlind: 25 }),
				],
			});
			expect(result.points).toEqual([
				{ x: 0, cashCumulative: 0, tournamentCumulative: 0 },
				{ x: 1, cashCumulative: 4, tournamentCumulative: 0 },
				{ x: 2, cashCumulative: 4, tournamentCumulative: 3 },
				{ x: 3, cashCumulative: 8, tournamentCumulative: 3 },
			]);
			expect(result.skippedCount).toBe(0);
		});

		it("includes evCashCumulative when showEvCash is enabled", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "normalized",
				sessionType: "all",
				showEvCash: true,
				rawPoints: [
					point({
						id: "a",
						profitLoss: 200,
						evProfitLoss: 250,
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
				],
			});
			expect(result.points).toEqual([
				{
					x: 0,
					cashCumulative: 0,
					tournamentCumulative: 0,
					evCashCumulative: 0,
				},
				{
					x: 1,
					cashCumulative: 4,
					tournamentCumulative: 0,
					evCashCumulative: 5,
				},
				{
					x: 2,
					cashCumulative: 4,
					tournamentCumulative: 3,
					evCashCumulative: 5,
				},
			]);
		});
	});

	describe("unit = 'currency', showEvCash = true", () => {
		it("adds evCashCumulative alongside cumulative", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "currency",
				sessionType: "all",
				showEvCash: true,
				rawPoints: [
					point({
						id: "a",
						profitLoss: 100,
						evProfitLoss: 150,
						sessionDate: 1,
					}),
					point({
						id: "b",
						profitLoss: 50,
						sessionDate: 2,
						type: "tournament",
						buyInTotal: 25,
					}),
					point({
						id: "c",
						profitLoss: -20,
						evProfitLoss: 10,
						sessionDate: 3,
					}),
				],
			});
			expect(result.points).toEqual([
				{ x: 0, cumulative: 0, evCashCumulative: 0 },
				{ x: 1, cumulative: 100, evCashCumulative: 150 },
				{ x: 2, cumulative: 150, evCashCumulative: 150 },
				{ x: 3, cumulative: 130, evCashCumulative: 160 },
			]);
		});

		it("skips EV contribution from tournament sessions", () => {
			const result = aggregatePnlPoints({
				...baseOptions,
				xAxis: "sessionCount",
				unit: "currency",
				sessionType: "tournament",
				showEvCash: true,
				rawPoints: [
					point({
						id: "a",
						profitLoss: 50,
						sessionDate: 1,
						type: "tournament",
						buyInTotal: 25,
					}),
				],
			});
			expect(result.points[0]?.evCashCumulative).toBe(0);
			expect(result.points[1]?.evCashCumulative).toBe(0);
		});
	});
});
