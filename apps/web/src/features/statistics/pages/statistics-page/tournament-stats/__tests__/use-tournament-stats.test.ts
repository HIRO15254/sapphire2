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

function metricsByKey(result: {
	current: ReturnType<typeof useTournamentStats>;
}) {
	return Object.fromEntries(
		(result.current.view?.metrics ?? []).map((m) => [m.key, m])
	);
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
		expect(result.current.view).toBeNull();
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
		expect(result.current.view).toBeNull();
	});

	it("formats ROI, ITM, placement, prize, and net cards", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(ctx());
		const byKey = metricsByKey(result);
		expect(byKey.roi.value).toBe("25.0%");
		expect(byKey.itm.value).toBe("40.0%");
		expect(byKey.placement.value).toBe("12.5");
		expect(byKey.prize.value).toBe("+5,000 USD");
		expect(byKey.net.value).toBe("+2,000 USD");
	});

	it("keeps total prize in currency units even when normalized", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(
			ctx({ normalized: true, currencyUnit: "USD" })
		);
		expect(metricsByKey(result).prize.value).toBe("+5,000 USD");
	});

	it("switches the net card to the bi unit when normalized", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		const result = await renderLoadedTournament(
			ctx({ normalized: true, currencyUnit: null })
		);
		const net = metricsByKey(result).net;
		expect(net.value).toBe("+4 bi");
		expect(net.amount).toBe(4);
	});

	it("renders em dashes for null ROI / ITM / placement / prize", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({
				roi: null,
				itmRate: null,
				avgPlacement: null,
				totalPrizeMoney: null,
			})
		);
		const result = await renderLoadedTournament(ctx());
		const byKey = metricsByKey(result);
		expect(byKey.roi.value).toBe("—");
		expect(byKey.itm.value).toBe("—");
		expect(byKey.placement.value).toBe("—");
		expect(byKey.prize.value).toBe("—");
	});

	it("preserves a negative net amount for coloring", async () => {
		trpcMocks.summaryQueryFn.mockReset();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -750 })
		);
		const result = await renderLoadedTournament(ctx());
		const net = metricsByKey(result).net;
		expect(net.value).toBe("-750 USD");
		expect(net.amount).toBe(-750);
	});
});
