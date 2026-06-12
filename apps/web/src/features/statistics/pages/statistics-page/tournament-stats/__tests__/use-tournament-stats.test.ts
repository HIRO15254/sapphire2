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

import { useTournamentStats } from "@/features/statistics/pages/statistics-page/tournament-stats/use-tournament-stats";

interface Summary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	avgRoi: number | null;
	bbPerHour: number | null;
	cashEvDiffNormalized: number | null;
	cashNormalizedProfitLoss: number | null;
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
	winRate: number;
}

function summary(overrides: Partial<Summary> = {}): Summary {
	return {
		totalSessions: 8,
		totalProfitLoss: 2000,
		cashNormalizedProfitLoss: null,
		cashEvDiffNormalized: null,
		tournamentNormalizedProfitLoss: 4,
		totalEvProfitLoss: null,
		totalEvDiff: null,
		winRate: 50,
		avgProfitLoss: 250,
		totalPlayMinutes: 720,
		hourlyRate: null,
		bbPerHour: null,
		roi: 25,
		avgRoi: 30,
		itmRate: 40,
		avgPlacement: 12.5,
		totalPrizeMoney: 5000,
		...overrides,
	};
}

/** Default context: a single currency is selected (currency mode). */
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

/** Context with no currency selected (the normalized, cross-currency scope). */
function noCurrencyCtx(): StatsSectionContext {
	return {
		statsInput: { normalized: true },
		enabled: true,
		normalized: true,
		currencyUnit: null,
		type: "all",
	};
}

function renderTournament(context: StatsSectionContext) {
	return renderHook(() => useTournamentStats(context), {
		wrapper: withQueryClient(createTestQueryClient()),
	});
}

async function renderLoadedTournament(context: StatsSectionContext) {
	const view = renderTournament(context);
	await waitFor(() => expect(view.result.current.isPending).toBe(false));
	return view.result;
}

function rowsByKey(result: { current: ReturnType<typeof useTournamentStats> }) {
	return Object.fromEntries(result.current.rows.map((r) => [r.key, r]));
}

function lastSummaryInput(): { type?: unknown } | undefined {
	return trpcMocks.summaryQueryFn.mock.calls.at(-1)?.[0] as
		| { type?: unknown }
		| undefined;
}

describe("useTournamentStats", () => {
	it("does not query and stays settled when the scope is disabled", () => {
		trpcMocks.summaryQueryFn.mockReset();
		const { result } = renderTournament(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.rows).toEqual([]);
		expect(trpcMocks.summaryQueryFn).not.toHaveBeenCalled();
	});

	it("forces the tournament type on the query even when the global type is 'all'", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		await renderLoadedTournament(ctx({ type: "all" }));
		expect(lastSummaryInput()?.type).toBe("tournament");
	});

	it("is empty when there are zero sessions", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 0 }));
		const result = await renderLoadedTournament(ctx());
		expect(result.current.isEmpty).toBe(true);
		expect(result.current.rows).toEqual([]);
	});

	it("lists every row including aggregate ROI and total prize when a currency is selected", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(ctx());
		expect(result.current.rows.map((r) => r.key)).toEqual([
			"sessions",
			"net",
			"avg",
			"winRate",
			"playTime",
			"avgRoi",
			"roi",
			"itm",
			"placement",
			"prize",
		]);
		const byKey = rowsByKey(result);
		expect(byKey.sessions.value).toBe("8");
		expect(byKey.net.value).toBe("+2,000 USD");
		expect(byKey.avg.value).toBe("+250 USD");
		expect(byKey.winRate.value).toBe("50.0%");
		expect(byKey.playTime.value).toBe("12h");
		expect(byKey.avgRoi.value).toBe("30.0%");
		expect(byKey.roi.value).toBe("25.0%");
		expect(byKey.itm.value).toBe("40.0%");
		expect(byKey.placement.value).toBe("12.5");
		expect(byKey.prize.value).toBe("+5,000 USD");
	});

	it("shows only Avg ROI (hides aggregate ROI and total prize) when no currency is selected", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(noCurrencyCtx());
		const keys = result.current.rows.map((r) => r.key);
		expect(keys).toContain("avgRoi");
		expect(keys).not.toContain("roi");
		expect(keys).not.toContain("prize");
		const byKey = rowsByKey(result);
		expect(byKey.avgRoi.value).toBe("30.0%");
		// Net stays normalized to bi in this scope.
		expect(byKey.net.value).toBe("+4 bi");
	});

	it("still shows aggregate ROI and total prize while normalized when a currency is selected", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(
			ctx({
				statsInput: { normalized: true, currencyId: "c1" },
				normalized: true,
				currencyUnit: "USD",
			})
		);
		const byKey = rowsByKey(result);
		expect(byKey.net.value).toBe("+4 bi");
		expect(byKey.roi.value).toBe("25.0%");
		expect(byKey.prize.value).toBe("+5,000 USD");
	});

	it("renders em dashes for null Avg ROI / ROI / ITM / placement", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ roi: null, avgRoi: null, itmRate: null, avgPlacement: null })
		);
		const result = await renderLoadedTournament(ctx());
		const byKey = rowsByKey(result);
		expect(byKey.avgRoi.value).toBe("—");
		expect(byKey.roi.value).toBe("—");
		expect(byKey.itm.value).toBe("—");
		expect(byKey.placement.value).toBe("—");
	});

	it("colors a negative net with the destructive class", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -750 })
		);
		const result = await renderLoadedTournament(ctx());
		const net = rowsByKey(result).net;
		expect(net.value).toBe("-750 USD");
		expect(net.valueColor).toBe("text-red-600 dark:text-red-400");
	});
});
