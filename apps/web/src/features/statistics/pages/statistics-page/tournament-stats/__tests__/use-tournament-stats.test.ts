import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, withQueryClient } from "@/__tests__/test-utils";
import type { StatsSectionContext } from "@/features/statistics/types";
import { formatYmdSlash } from "@/utils/format-number";

const trpcMocks = vi.hoisted(() => ({
	summaryQueryFn: vi.fn(),
	highlightsQueryFn: vi.fn(),
}));

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

import { useTournamentStats } from "@/features/statistics/pages/statistics-page/tournament-stats/use-tournament-stats";

interface Summary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	bbPerHour: number | null;
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

interface HighlightSession {
	date: number;
	id: string;
	normalizedProfitLoss: number | null;
	profitLoss: number;
	type: "cash_game" | "tournament";
}

interface Highlights {
	bestSession: HighlightSession | null;
	currentLoseStreak: number;
	currentWinStreak: number;
	longestSession: { date: number; id: string; playMinutes: number } | null;
	maxLoseStreak: number;
	maxWinStreak: number;
	worstSession: HighlightSession | null;
}

function summary(overrides: Partial<Summary> = {}): Summary {
	return {
		totalSessions: 8,
		totalProfitLoss: 2000,
		cashNormalizedProfitLoss: null,
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

function session(overrides: Partial<HighlightSession> = {}): HighlightSession {
	return {
		id: "t1",
		date: 1_700_000_000,
		profitLoss: 3000,
		normalizedProfitLoss: 6,
		type: "tournament",
		...overrides,
	};
}

function highlights(overrides: Partial<Highlights> = {}): Highlights {
	return {
		bestSession: session({
			id: "best",
			profitLoss: 3000,
			normalizedProfitLoss: 6,
		}),
		worstSession: session({
			id: "worst",
			profitLoss: -1000,
			normalizedProfitLoss: -2,
		}),
		longestSession: { id: "long", date: 1_700_000_000, playMinutes: 600 },
		currentWinStreak: 1,
		currentLoseStreak: 0,
		maxWinStreak: 4,
		maxLoseStreak: 2,
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

function resetMocks() {
	trpcMocks.summaryQueryFn.mockReset();
	trpcMocks.highlightsQueryFn.mockReset();
}

function lastSummaryType(): unknown {
	const last = trpcMocks.summaryQueryFn.mock.calls.at(-1)?.[0] as
		| { type?: unknown }
		| undefined;
	return last?.type;
}

function lastHighlightsType(): unknown {
	const last = trpcMocks.highlightsQueryFn.mock.calls.at(-1)?.[0] as
		| { type?: unknown }
		| undefined;
	return last?.type;
}

describe("useTournamentStats", () => {
	it("does not query and stays settled when the scope is disabled", () => {
		resetMocks();
		const { result } = renderTournament(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.view).toBeNull();
		expect(trpcMocks.summaryQueryFn).not.toHaveBeenCalled();
		expect(trpcMocks.highlightsQueryFn).not.toHaveBeenCalled();
	});

	it("forces the tournament type on both queries even when the global type is 'all'", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		await renderLoadedTournament(ctx({ type: "all" }));
		expect(lastSummaryType()).toBe("tournament");
		expect(lastHighlightsType()).toBe("tournament");
	});

	it("keeps the rest of the stats input when overriding the type", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		await renderLoadedTournament(
			ctx({
				type: "cash_game",
				statsInput: {
					normalized: false,
					currencyId: "c9",
					dateFrom: 100,
					dateTo: 200,
				},
			})
		);
		expect(trpcMocks.summaryQueryFn.mock.calls.at(-1)?.[0]).toEqual({
			normalized: false,
			currencyId: "c9",
			dateFrom: 100,
			dateTo: 200,
			type: "tournament",
		});
	});

	it("is empty when there are zero sessions", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 0 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ bestSession: null, worstSession: null })
		);
		const result = await renderLoadedTournament(ctx());
		expect(result.current.isEmpty).toBe(true);
		expect(result.current.view).toBeNull();
	});

	it("is not empty when at least one session exists", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 1 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(ctx());
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.view).not.toBeNull();
	});

	it("formats ROI, ITM, avg placement, total prize, and net", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(ctx());
		const byKey = Object.fromEntries(
			(result.current.view?.metrics ?? []).map((m) => [m.key, m])
		);
		expect(byKey.roi.label).toBe("ROI");
		expect(byKey.roi.value).toBe("25.0%");
		expect(byKey.roi.isProfitLoss).toBe(false);
		expect(byKey.itm.label).toBe("ITM rate");
		expect(byKey.itm.value).toBe("40.0%");
		expect(byKey.placement.label).toBe("Avg placement");
		expect(byKey.placement.value).toBe("12.5");
		expect(byKey.prize.label).toBe("Total prize");
		expect(byKey.prize.value).toBe("+5,000 USD");
		expect(byKey.net.label).toBe("Net");
		expect(byKey.net.value).toBe("+2,000 USD");
		expect(byKey.net.amount).toBe(2000);
	});

	it("renders em dashes for null ROI, ITM, placement, and prize", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({
				roi: null,
				itmRate: null,
				avgPlacement: null,
				totalPrizeMoney: null,
			})
		);
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(ctx());
		const byKey = Object.fromEntries(
			(result.current.view?.metrics ?? []).map((m) => [m.key, m])
		);
		expect(byKey.roi.value).toBe("—");
		expect(byKey.itm.value).toBe("—");
		expect(byKey.placement.value).toBe("—");
		expect(byKey.prize.value).toBe("—");
		expect(byKey.prize.amount).toBeNull();
	});

	it("keeps total prize in currency units even when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(
			ctx({ normalized: true, currencyUnit: "USD" })
		);
		const prize = result.current.view?.metrics.find((m) => m.key === "prize");
		expect(prize?.value).toBe("+5,000 USD");
	});

	it("switches the net card to the normalized value and unit when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(
			ctx({ normalized: true, currencyUnit: null })
		);
		const net = result.current.view?.metrics.find((m) => m.key === "net");
		expect(net?.value).toBe("+4 bi");
		expect(net?.amount).toBe(4);
	});

	it("renders a negative net with the loss amount preserved", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -750 })
		);
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedTournament(ctx());
		const net = result.current.view?.metrics.find((m) => m.key === "net");
		expect(net?.value).toBe("-750 USD");
		expect(net?.amount).toBe(-750);
	});

	it("builds best and worst session rows with currency value, date, and id", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: session({
					id: "best",
					date: 1_700_000_000,
					profitLoss: 3000,
					normalizedProfitLoss: 6,
				}),
				worstSession: session({
					id: "worst",
					date: 1_700_086_400,
					profitLoss: -1000,
					normalizedProfitLoss: -2,
				}),
			})
		);
		const result = await renderLoadedTournament(ctx());
		const best = result.current.view?.bestSession;
		const worst = result.current.view?.worstSession;
		expect(best?.id).toBe("best");
		expect(best?.value).toBe("+3,000 USD");
		expect(best?.amount).toBe(3000);
		expect(best?.dateText).toBe(formatYmdSlash(new Date(1_700_000_000 * 1000)));
		expect(worst?.id).toBe("worst");
		expect(worst?.value).toBe("-1,000 USD");
		expect(worst?.amount).toBe(-1000);
	});

	it("uses the normalized session value and unit in best/worst rows when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: session({
					id: "best",
					profitLoss: 3000,
					normalizedProfitLoss: 6,
				}),
			})
		);
		const result = await renderLoadedTournament(
			ctx({ normalized: true, currencyUnit: null })
		);
		const best = result.current.view?.bestSession;
		expect(best?.value).toBe("+6 bi");
		expect(best?.amount).toBe(6);
	});

	it("returns null best/worst rows when highlights have none", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 4 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ bestSession: null, worstSession: null })
		);
		const result = await renderLoadedTournament(ctx());
		expect(result.current.view?.bestSession).toBeNull();
		expect(result.current.view?.worstSession).toBeNull();
	});
});
