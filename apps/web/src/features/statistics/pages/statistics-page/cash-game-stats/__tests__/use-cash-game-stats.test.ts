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

import { useCashGameStats } from "@/features/statistics/pages/statistics-page/cash-game-stats/use-cash-game-stats";

interface Summary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	bbPerHour: number | null;
	cashBbCount: number;
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
		totalSessions: 10,
		totalProfitLoss: 1500,
		cashBbCount: 5,
		cashNormalizedProfitLoss: 30,
		cashEvDiffNormalized: 6,
		tournamentNormalizedProfitLoss: null,
		totalEvProfitLoss: 1800,
		totalEvDiff: 300,
		winRate: 60,
		avgProfitLoss: 150,
		totalPlayMinutes: 600,
		hourlyRate: 150,
		bbPerHour: 3,
		roi: null,
		itmRate: null,
		avgPlacement: null,
		totalPrizeMoney: null,
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

function renderCash(context: StatsSectionContext) {
	return renderHook(() => useCashGameStats(context), {
		wrapper: withQueryClient(createTestQueryClient()),
	});
}

async function renderLoadedCash(context: StatsSectionContext) {
	const view = renderCash(context);
	await waitFor(() => expect(view.result.current.isPending).toBe(false));
	return view.result;
}

function rowsByKey(result: { current: ReturnType<typeof useCashGameStats> }) {
	return Object.fromEntries(result.current.rows.map((r) => [r.key, r]));
}

function lastSummaryInput(): { type?: unknown } | undefined {
	return trpcMocks.summaryQueryFn.mock.calls.at(-1)?.[0] as
		| { type?: unknown }
		| undefined;
}

describe("useCashGameStats", () => {
	it("does not query and stays settled when the scope is disabled", () => {
		trpcMocks.summaryQueryFn.mockReset();
		const { result } = renderCash(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.rows).toEqual([]);
		expect(trpcMocks.summaryQueryFn).not.toHaveBeenCalled();
	});

	it("forces the cash_game type on the query even when the global type is 'all'", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		await renderLoadedCash(ctx({ type: "all" }));
		expect(lastSummaryInput()?.type).toBe("cash_game");
	});

	it("keeps the rest of the stats input when overriding the type", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		await renderLoadedCash(
			ctx({
				type: "tournament",
				statsInput: {
					normalized: false,
					currencyId: "c9",
					dateFrom: 100,
					dateTo: 200,
				},
			})
		);
		expect(lastSummaryInput()).toEqual({
			normalized: false,
			currencyId: "c9",
			dateFrom: 100,
			dateTo: 200,
			type: "cash_game",
		});
	});

	it("is empty when there are zero sessions", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 0 }));
		const result = await renderLoadedCash(ctx());
		expect(result.current.isEmpty).toBe(true);
		expect(result.current.rows).toEqual([]);
	});

	it("lists the cash stat rows with currency units when not normalized", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedCash(ctx());
		expect(result.current.rows.map((r) => r.key)).toEqual([
			"sessions",
			"net",
			"avg",
			"winRate",
			"playTime",
			"hourly",
			"evDiff",
		]);
		const byKey = rowsByKey(result);
		expect(byKey.sessions.value).toBe("10");
		expect(byKey.net.value).toBe("+1,500 USD");
		expect(byKey.avg.value).toBe("+150 USD");
		expect(byKey.winRate.value).toBe("60.0%");
		expect(byKey.playTime.value).toBe("10h");
		expect(byKey.hourly.label).toBe("Hourly rate");
		expect(byKey.hourly.value).toBe("+150 USD/h");
		expect(byKey.evDiff.value).toBe("+300 USD");
	});

	it("switches net, avg, hourly, and EV diff to bb units when normalized", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedCash(
			ctx({ normalized: true, currencyUnit: null })
		);
		const byKey = rowsByKey(result);
		expect(byKey.net.value).toBe("+30 bb");
		expect(byKey.avg.value).toBe("+6 bb");
		expect(byKey.hourly.label).toBe("BB / hr");
		expect(byKey.hourly.value).toBe("+3 bb/h");
		expect(byKey.evDiff.value).toBe("+6 bb");
	});

	it("renders an em dash for a null hourly rate", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ hourlyRate: null }));
		const result = await renderLoadedCash(ctx());
		expect(rowsByKey(result).hourly.value).toBe("—");
	});

	it("renders an em dash for a null EV diff", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalEvDiff: null }));
		const result = await renderLoadedCash(ctx());
		expect(rowsByKey(result).evDiff.value).toBe("—");
	});

	it("colors a negative net with the destructive class", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -500 })
		);
		const result = await renderLoadedCash(ctx());
		const net = rowsByKey(result).net;
		expect(net.value).toBe("-500 USD");
		expect(net.valueColor).toBe("text-red-600 dark:text-red-400");
	});
	it("exposes query errors and retries the summary request", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn
			.mockRejectedValueOnce(new Error("network"))
			.mockResolvedValueOnce(summary());
		const view = renderCash(ctx());
		await waitFor(() => expect(view.result.current.isError).toBe(true));
		view.result.current.retry();
		await waitFor(() => expect(view.result.current.isError).toBe(false));
		expect(trpcMocks.summaryQueryFn).toHaveBeenCalledTimes(2);
	});
});
