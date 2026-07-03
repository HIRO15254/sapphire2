import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type { StatsSectionContext } from "@/features/statistics/types";

const trpcMocks = vi.hoisted(() => ({ summaryQueryFn: vi.fn() }));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		stats: {
			summary: {
				queryOptions: (input: unknown, opts?: { enabled?: boolean }) => ({
					queryKey: ["stats", "summary", input],
					queryFn: () => trpcMocks.summaryQueryFn(input),
					enabled: opts?.enabled,
				}),
			},
		},
	},
}));

import { useKpiCards } from "@/features/statistics/pages/statistics-page/kpi-cards/use-kpi-cards";

interface Summary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	avgRoi: number | null;
	bbPerHour: number | null;
	cashEvDiffNormalized: number | null;
	cashNormalizedProfitLoss: number | null;
	cashUnnormalizedSessions: number;
	hourlyRate: number | null;
	itmRate: number | null;
	roi: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalPlayMinutes: number;
	totalPrizeMoney: number | null;
	totalProfitLoss: number;
	totalSessions: number;
	tournamentNormalizedProfitLoss: number | null;
	tournamentUnnormalizedSessions: number;
	winRate: number;
}

function summary(overrides: Partial<Summary> = {}): Summary {
	return {
		totalSessions: 10,
		totalProfitLoss: 1500,
		cashNormalizedProfitLoss: 30,
		cashUnnormalizedSessions: 0,
		cashEvDiffNormalized: 6,
		tournamentNormalizedProfitLoss: 5,
		tournamentUnnormalizedSessions: 0,
		totalEvProfitLoss: 1800,
		totalEvDiff: 300,
		winRate: 60,
		avgProfitLoss: 150,
		totalPlayMinutes: 600,
		hourlyRate: 150,
		bbPerHour: 3,
		roi: 25,
		avgRoi: 30,
		itmRate: 40,
		avgPlacement: 12.5,
		totalPrizeMoney: 5000,
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

function renderKpi(context: StatsSectionContext) {
	return renderHook(() => useKpiCards(context), {
		wrapper: withQueryClient(createTestQueryClient()),
	});
}

async function renderLoadedKpi(context: StatsSectionContext) {
	const { result } = renderKpi(context);
	await waitFor(() => expect(result.current.isPending).toBe(false));
	return result;
}

describe("useKpiCards", () => {
	it("does not query and returns no cards when the scope is disabled", () => {
		trpcMocks.summaryQueryFn.mockReset();
		const { result } = renderKpi(ctx({ enabled: false }));
		expect(result.current.cards).toEqual([]);
		expect(result.current.isPending).toBe(false);
		expect(trpcMocks.summaryQueryFn).not.toHaveBeenCalled();
	});

	it("shows only the shared metrics for the 'all' type", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(ctx({ type: "all" }));
		expect(result.current.cards.map((c) => c.key)).toEqual([
			"net",
			"sessions",
			"playTime",
		]);
	});

	it("formats the shared card values with the currency unit and play time", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(ctx({ type: "all" }));
		const byKey = Object.fromEntries(
			result.current.cards.map((c) => [c.key, c])
		);
		expect(byKey.net.value).toBe("+1,500 USD");
		expect(byKey.net.trend).toBe("up");
		expect(byKey.sessions.value).toBe("10");
		expect(byKey.playTime.value).toBe("10h");
		expect(byKey.winRate).toBeUndefined();
	});

	it("adds EV diff and hourly cards for cash game", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(ctx({ type: "cash_game" }));
		const keys = result.current.cards.map((c) => c.key);
		expect(keys).toContain("evDiff");
		expect(keys).toContain("hourly");
		expect(keys).not.toContain("roi");
		const hourly = result.current.cards.find((c) => c.key === "hourly");
		expect(hourly?.value).toBe("+150 USD/h");
	});

	it("adds Avg ROI, ROI, ITM, and placement cards for tournament when a currency is selected", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(ctx({ type: "tournament" }));
		const byKey = Object.fromEntries(
			result.current.cards.map((c) => [c.key, c])
		);
		expect(byKey.avgRoi.value).toBe("30.0%");
		expect(byKey.roi.value).toBe("25.0%");
		expect(byKey.itm.value).toBe("40.0%");
		expect(byKey.placement.value).toBe("12.5");
		expect(result.current.cards.map((c) => c.key)).not.toContain("evDiff");
	});

	it("hides the aggregate ROI card for tournament when no currency is selected", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(
			ctx({
				type: "tournament",
				statsInput: { normalized: true },
				normalized: true,
			})
		);
		const keys = result.current.cards.map((c) => c.key);
		expect(keys).toContain("avgRoi");
		expect(keys).not.toContain("roi");
		const byKey = Object.fromEntries(
			result.current.cards.map((c) => [c.key, c])
		);
		expect(byKey.avgRoi.value).toBe("30.0%");
	});

	it("uses the cash bb total and bb/hr when normalized for cash", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(
			ctx({ type: "cash_game", normalized: true, currencyUnit: null })
		);
		const byKey = Object.fromEntries(
			result.current.cards.map((c) => [c.key, c])
		);
		expect(byKey.net.label).toBe("Net (BB)");
		expect(byKey.net.value).toBe("+30 bb");
		expect(byKey.bbPerHour).toBeDefined();
		expect(byKey.bbPerHour.value).toBe("+3 bb/h");
		expect(byKey.hourly).toBeUndefined();
		// EV diff carries the bb unit when normalized.
		expect(byKey.evDiff.value).toBe("+6 bb");
	});

	it("splits net into separate BB (cash) and BI (tournament) cards when normalized for all types", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({
				cashNormalizedProfitLoss: 30,
				tournamentNormalizedProfitLoss: 5,
			})
		);
		const result = await renderLoadedKpi(
			ctx({ type: "all", normalized: true, currencyUnit: null })
		);
		const byKey = Object.fromEntries(
			result.current.cards.map((c) => [c.key, c])
		);
		expect(byKey.net).toBeUndefined();
		expect(byKey.netCash.value).toBe("+30 bb");
		expect(byKey.netTournament.value).toBe("+5 bi");
	});

	it("renders em dash for a null EV diff", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalEvDiff: null }));
		const result = await renderLoadedKpi(ctx({ type: "cash_game" }));
		const evDiff = result.current.cards.find((c) => c.key === "evDiff");
		expect(evDiff?.value).toBe("—");
		expect(evDiff?.trend).toBeNull();
	});

	it("marks a negative net P&L with a down trend", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -500 })
		);
		const result = await renderLoadedKpi(ctx({ type: "all" }));
		const net = result.current.cards.find((c) => c.key === "net");
		expect(net?.value).toBe("-500 USD");
		expect(net?.trend).toBe("down");
	});

	it("leaves the sessions card without a hint when nothing is unnormalized", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedKpi(
			ctx({ type: "all", normalized: true, currencyUnit: null })
		);
		const sessions = result.current.cards.find((c) => c.key === "sessions");
		expect(sessions?.hint).toBeUndefined();
	});

	it("does not add a hint when normalization is off, even with unnormalized sessions", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ cashUnnormalizedSessions: 2 })
		);
		const result = await renderLoadedKpi(
			ctx({ type: "all", normalized: false })
		);
		const sessions = result.current.cards.find((c) => c.key === "sessions");
		expect(sessions?.hint).toBeUndefined();
	});

	it("hints at cash sessions missing stakes when normalized for cash", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ cashUnnormalizedSessions: 2 })
		);
		const result = await renderLoadedKpi(
			ctx({ type: "cash_game", normalized: true, currencyUnit: null })
		);
		const sessions = result.current.cards.find((c) => c.key === "sessions");
		expect(sessions?.hint).toBe("2 excluded from BB total (no stakes)");
	});

	it("hints at tournaments missing buy-in when normalized for tournament", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ tournamentUnnormalizedSessions: 1 })
		);
		const result = await renderLoadedKpi(
			ctx({ type: "tournament", normalized: true, currencyUnit: null })
		);
		const sessions = result.current.cards.find((c) => c.key === "sessions");
		expect(sessions?.hint).toBe("1 excluded from BI total (no buy-in)");
	});

	it("combines cash and tournament hints for the 'all' type", async () => {
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({
				cashUnnormalizedSessions: 2,
				tournamentUnnormalizedSessions: 1,
			})
		);
		const result = await renderLoadedKpi(
			ctx({ type: "all", normalized: true, currencyUnit: null })
		);
		const sessions = result.current.cards.find((c) => c.key === "sessions");
		expect(sessions?.hint).toBe(
			"2 excluded from BB total (no stakes), 1 excluded from BI total (no buy-in)"
		);
	});
});
