import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type { StatsSectionContext } from "@/features/statistics/types";

const trpcMocks = vi.hoisted(() => ({ highlightsQueryFn: vi.fn() }));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		stats: {
			highlights: {
				queryOptions: (input: unknown, opts?: { enabled?: boolean }) => ({
					queryKey: ["stats", "highlights", input],
					queryFn: () => trpcMocks.highlightsQueryFn(input),
					enabled: opts?.enabled,
				}),
			},
		},
	},
}));

import { useHighlightsSection } from "@/features/statistics/pages/statistics-page/highlights-section/use-highlights-section";

interface HighlightSession {
	date: number;
	id: string;
	normalizedProfitLoss: number;
	profitLoss: number;
	type: "cash_game" | "tournament";
}

interface LongestSession {
	date: number;
	id: string;
	playMinutes: number;
}

interface Highlights {
	bestSession: HighlightSession | null;
	currentLoseStreak: number;
	currentWinStreak: number;
	longestSession: LongestSession | null;
	maxLoseStreak: number;
	maxWinStreak: number;
	worstSession: HighlightSession | null;
}

// 2024-01-15T00:00:00Z → 1_705_276_800 unix seconds.
const BEST_DATE = 1_705_276_800;
// 2024-02-20T00:00:00Z → 1_708_387_200 unix seconds.
const WORST_DATE = 1_708_387_200;
// 2024-03-10T00:00:00Z → 1_710_028_800 unix seconds.
const LONGEST_DATE = 1_710_028_800;

function highlights(overrides: Partial<Highlights> = {}): Highlights {
	return {
		bestSession: {
			id: "best-1",
			date: BEST_DATE,
			profitLoss: 1500,
			normalizedProfitLoss: 30,
			type: "cash_game",
		},
		worstSession: {
			id: "worst-1",
			date: WORST_DATE,
			profitLoss: -800,
			normalizedProfitLoss: -16,
			type: "tournament",
		},
		longestSession: {
			id: "long-1",
			date: LONGEST_DATE,
			playMinutes: 615,
		},
		currentWinStreak: 3,
		currentLoseStreak: 0,
		maxWinStreak: 7,
		maxLoseStreak: 4,
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

function renderHighlights(context: StatsSectionContext) {
	return renderHook(() => useHighlightsSection(context), {
		wrapper: withQueryClient(createTestQueryClient()),
	});
}

async function renderLoaded(context: StatsSectionContext) {
	const { result } = renderHighlights(context);
	await waitFor(() => expect(result.current.isPending).toBe(false));
	return result;
}

describe("useHighlightsSection", () => {
	it("does not query and reports empty when the scope is disabled", () => {
		trpcMocks.highlightsQueryFn.mockReset();
		const { result } = renderHighlights(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.isEmpty).toBe(true);
		expect(trpcMocks.highlightsQueryFn).not.toHaveBeenCalled();
	});

	it("is pending while the enabled query is in flight", () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockReturnValue(new Promise(() => undefined));
		const { result } = renderHighlights(ctx());
		expect(result.current.isPending).toBe(true);
		expect(trpcMocks.highlightsQueryFn).toHaveBeenCalledTimes(1);
	});

	it("reports empty when bestSession is null (no sessions in scope)", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ bestSession: null })
		);
		const result = await renderLoaded(ctx());
		expect(result.current.isEmpty).toBe(true);
	});

	it("is not empty when bestSession is present", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.isEmpty).toBe(false);
	});

	it("formats best/worst session with the currency P&L when not normalized", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.best?.valueText).toBe("+1,500 USD");
		expect(result.current.worst?.valueText).toBe("-800 USD");
	});

	it("formats each highlight in its own normalized unit (cash bb, tournament bi) when normalized", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(
			ctx({ normalized: true, currencyUnit: null })
		);
		// best is a cash session → bb; worst is a tournament session → bi.
		expect(result.current.best?.valueText).toBe("+30 bb");
		expect(result.current.worst?.valueText).toBe("-16 bi");
	});

	it("uses the bi unit for a tournament highlight when normalized", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: {
					id: "best-1",
					date: BEST_DATE,
					profitLoss: 900,
					normalizedProfitLoss: 9,
					type: "tournament",
				},
			})
		);
		const result = await renderLoaded(
			ctx({ normalized: true, currencyUnit: null })
		);
		expect(result.current.best?.valueText).toBe("+9 bi");
	});

	it("colors a positive best value as profit and a negative worst value as loss", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.best?.valueColor).toBe(
			"text-green-600 dark:text-green-400"
		);
		expect(result.current.worst?.valueColor).toBe(
			"text-red-600 dark:text-red-400"
		);
	});

	it("colors a negative best value as loss (all-losing scope)", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: {
					id: "best-1",
					date: BEST_DATE,
					profitLoss: -200,
					normalizedProfitLoss: -4,
					type: "cash_game",
				},
			})
		);
		const result = await renderLoaded(ctx());
		expect(result.current.best?.valueText).toBe("-200 USD");
		expect(result.current.best?.valueColor).toBe(
			"text-red-600 dark:text-red-400"
		);
	});

	it("formats best/worst dates from unix seconds via formatYmdSlash", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.best?.dateText).toBe("2024/01/15");
		expect(result.current.worst?.dateText).toBe("2024/02/20");
	});

	it("exposes best/worst session ids for links", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.best?.id).toBe("best-1");
		expect(result.current.worst?.id).toBe("worst-1");
	});

	it("returns null best/worst when those sessions are absent", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ worstSession: null })
		);
		const result = await renderLoaded(ctx());
		expect(result.current.best).not.toBeNull();
		expect(result.current.worst).toBeNull();
	});

	it("formats the longest session duration via formatMinutes with its date and id", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.longest?.durationText).toBe("10h 15m");
		expect(result.current.longest?.dateText).toBe("2024/03/10");
		expect(result.current.longest?.id).toBe("long-1");
	});

	it("returns null longest when there is no longest session", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ longestSession: null })
		);
		const result = await renderLoaded(ctx());
		expect(result.current.longest).toBeNull();
	});

	it("passes the four streak values through unchanged", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoaded(ctx());
		expect(result.current.currentWinStreak).toBe(3);
		expect(result.current.currentLoseStreak).toBe(0);
		expect(result.current.maxWinStreak).toBe(7);
		expect(result.current.maxLoseStreak).toBe(4);
	});

	it("passes zero streaks through at the boundary", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				currentWinStreak: 0,
				currentLoseStreak: 0,
				maxWinStreak: 0,
				maxLoseStreak: 0,
			})
		);
		const result = await renderLoaded(ctx());
		expect(result.current.currentWinStreak).toBe(0);
		expect(result.current.currentLoseStreak).toBe(0);
		expect(result.current.maxWinStreak).toBe(0);
		expect(result.current.maxLoseStreak).toBe(0);
	});

	it("queries with the stats input from the context", async () => {
		trpcMocks.highlightsQueryFn.mockReset();
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		await renderLoaded(ctx());
		expect(trpcMocks.highlightsQueryFn).toHaveBeenCalledTimes(1);
		expect(trpcMocks.highlightsQueryFn).toHaveBeenNthCalledWith(1, {
			normalized: false,
			currencyId: "c1",
		});
	});
});
