import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type { StatsSectionContext } from "@/features/statistics/types";
import type { PnlSeriesPoint } from "@/features/statistics/utils/aggregate-pnl-points";

const trpcMocks = vi.hoisted(() => ({ seriesQueryFn: vi.fn() }));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		stats: {
			profitLossSeries: {
				queryOptions: (input: unknown, opts?: { enabled?: boolean }) => ({
					queryKey: ["stats", "profitLossSeries", input],
					queryFn: () => trpcMocks.seriesQueryFn(input),
					enabled: opts?.enabled,
				}),
			},
		},
	},
}));

import { usePnlGraph } from "@/features/statistics/pages/statistics-page/pnl-graph/use-pnl-graph";

function seriesPoint(
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
		sortKey: overrides.sessionDate,
		...overrides,
	};
}

function ctx(
	overrides: Partial<StatsSectionContext> = {}
): StatsSectionContext {
	return {
		statsInput: { normalized: false, currencyId: "c1" },
		enabled: true,
		normalized: false,
		currencyUnit: "USD",
		type: "all",
		...overrides,
	};
}

function renderGraph(context: StatsSectionContext) {
	return renderHook(() => usePnlGraph(context), {
		wrapper: withQueryClient(createTestQueryClient()),
	});
}

async function renderLoaded(context: StatsSectionContext) {
	const { result } = renderGraph(context);
	await waitFor(() => expect(result.current.isPending).toBe(false));
	return result;
}

const day1 = Math.floor(new Date("2026-04-01T03:00:00Z").getTime() / 1000);
const day2 = Math.floor(new Date("2026-04-02T03:00:00Z").getTime() / 1000);

describe("usePnlGraph", () => {
	it("defaults the x-axis to 'playTime'", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx());
		expect(result.current.xAxis).toBe("playTime");
	});

	it("defaults the EV-cash toggle to false", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ type: "cash_game" }));
		expect(result.current.showEvCash).toBe(false);
	});

	it("changes the x-axis when setXAxis is called with a value", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx());
		act(() => result.current.setXAxis("sessionCount"));
		expect(result.current.xAxis).toBe("sessionCount");
		act(() => result.current.setXAxis("playTime"));
		expect(result.current.xAxis).toBe("playTime");
	});

	it("ignores an empty x-axis value (segmented control deselect)", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx());
		act(() => result.current.setXAxis("sessionCount"));
		expect(result.current.xAxis).toBe("sessionCount");
		act(() => result.current.setXAxis("" as never));
		expect(result.current.xAxis).toBe("sessionCount");
	});

	it("derives the currency unit from a non-normalized context", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ normalized: false }));
		expect(result.current.unit).toBe("currency");
	});

	it("derives the normalized unit from a normalized context", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ normalized: true }));
		expect(result.current.unit).toBe("normalized");
	});

	it("exposes the EV toggle only for the cash-game type", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const cash = await renderLoaded(ctx({ type: "cash_game" }));
		expect(cash.current.evToggleAvailable).toBe(true);

		const all = await renderLoaded(ctx({ type: "all" }));
		expect(all.current.evToggleAvailable).toBe(false);

		const tournament = await renderLoaded(ctx({ type: "tournament" }));
		expect(tournament.current.evToggleAvailable).toBe(false);
	});

	it("reflects the EV toggle when cash game and setShowEvCash(true) is called", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ type: "cash_game" }));
		act(() => result.current.setShowEvCash(true));
		expect(result.current.showEvCash).toBe(true);
	});

	it("forces the effective EV toggle off for a non-cash type even after setShowEvCash(true)", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ type: "all" }));
		act(() => result.current.setShowEvCash(true));
		expect(result.current.showEvCash).toBe(false);
	});

	it("forces the effective EV toggle off for tournaments even after setShowEvCash(true)", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx({ type: "tournament" }));
		act(() => result.current.setShowEvCash(true));
		expect(result.current.showEvCash).toBe(false);
	});

	it("marks dual true only when normalized and the type is 'all'", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const dual = await renderLoaded(ctx({ normalized: true, type: "all" }));
		expect(dual.current.dual).toBe(true);

		const single = await renderLoaded(
			ctx({ normalized: true, type: "cash_game" })
		);
		expect(single.current.dual).toBe(false);

		const currency = await renderLoaded(
			ctx({ normalized: false, type: "all" })
		);
		expect(currency.current.dual).toBe(false);
	});

	it("aggregates the fetched raw points and prepends an origin point", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({
			points: [
				seriesPoint({ id: "a", profitLoss: 100, sessionDate: day1 }),
				seriesPoint({ id: "b", profitLoss: -40, sessionDate: day2 }),
			],
		});
		const result = await renderLoaded(ctx());
		// origin + 2 session days
		expect(result.current.points).toHaveLength(3);
		expect(result.current.points[0]?.cumulative).toBe(0);
		expect(result.current.points[1]?.cumulative).toBe(100);
		expect(result.current.points[2]?.cumulative).toBe(60);
		expect(result.current.isEmpty).toBe(false);
	});

	it("re-aggregates with session-count x values when the x-axis changes", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({
			points: [
				seriesPoint({ id: "a", profitLoss: 100, sessionDate: day1 }),
				seriesPoint({ id: "b", profitLoss: -40, sessionDate: day2 }),
			],
		});
		const result = await renderLoaded(ctx());
		act(() => result.current.setXAxis("sessionCount"));
		const xs = result.current.points.map((p) => p.x);
		expect(xs).toEqual([0, 1, 2]);
	});

	it("includes the EV cash series in the aggregation when the toggle is on for cash game", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({
			points: [
				seriesPoint({
					id: "a",
					profitLoss: 100,
					evProfitLoss: 120,
					sessionDate: day1,
				}),
			],
		});
		const result = await renderLoaded(ctx({ type: "cash_game" }));
		act(() => result.current.setShowEvCash(true));
		const last = result.current.points.at(-1);
		expect(last?.evCashCumulative).toBe(120);
	});

	it("omits the EV cash series when the toggle is forced off for a non-cash type", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({
			points: [
				seriesPoint({
					id: "a",
					profitLoss: 100,
					evProfitLoss: 120,
					sessionDate: day1,
				}),
			],
		});
		const result = await renderLoaded(ctx({ type: "all" }));
		act(() => result.current.setShowEvCash(true));
		const last = result.current.points.at(-1);
		expect(last?.evCashCumulative).toBeUndefined();
	});

	it("orders same-day sessions by sortKey (actual start time), not id (SA2-98)", async () => {
		const morning = day1 + 3 * 60 * 60;
		const evening = day1 + 22 * 60 * 60;
		trpcMocks.seriesQueryFn.mockResolvedValue({
			points: [
				seriesPoint({
					id: "z",
					profitLoss: 100,
					sessionDate: day1,
					sortKey: morning,
				}),
				seriesPoint({
					id: "a",
					profitLoss: -30,
					sessionDate: day1,
					sortKey: evening,
				}),
			],
		});
		const result = await renderLoaded(ctx());
		act(() => result.current.setXAxis("sessionCount"));
		expect(result.current.points.map((p) => p.cumulative)).toEqual([
			0, 100, 70,
		]);
	});

	it("reports an empty graph when the series has no usable points", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue({ points: [] });
		const result = await renderLoaded(ctx());
		expect(result.current.points).toEqual([]);
		expect(result.current.isEmpty).toBe(true);
	});

	it("treats missing data as an empty point set without throwing", async () => {
		trpcMocks.seriesQueryFn.mockResolvedValue(undefined);
		const result = await renderLoaded(ctx());
		expect(result.current.points).toEqual([]);
		expect(result.current.isEmpty).toBe(true);
	});

	it("does not query, is not pending, and stays empty when the scope is disabled", () => {
		trpcMocks.seriesQueryFn.mockReset();
		const { result } = renderGraph(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.points).toEqual([]);
		expect(result.current.isEmpty).toBe(true);
		expect(trpcMocks.seriesQueryFn).not.toHaveBeenCalled();
	});
});
