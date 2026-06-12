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

import { useCashGameStats } from "@/features/statistics/pages/statistics-page/cash-game-stats/use-cash-game-stats";

interface Summary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	bbPerHour: number | null;
	hourlyRate: number | null;
	itmRate: number | null;
	normalizedProfitLoss: number | null;
	roi: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalPlayMinutes: number;
	totalPrizeMoney: number | null;
	totalProfitLoss: number;
	totalSessions: number;
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
		totalSessions: 10,
		totalProfitLoss: 1500,
		normalizedProfitLoss: 30,
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

function session(overrides: Partial<HighlightSession> = {}): HighlightSession {
	return {
		id: "s1",
		date: 1_700_000_000,
		profitLoss: 1200,
		normalizedProfitLoss: 24,
		type: "cash_game",
		...overrides,
	};
}

function highlights(overrides: Partial<Highlights> = {}): Highlights {
	return {
		bestSession: session({
			id: "best",
			profitLoss: 1200,
			normalizedProfitLoss: 24,
		}),
		worstSession: session({
			id: "worst",
			profitLoss: -800,
			normalizedProfitLoss: -16,
		}),
		longestSession: { id: "long", date: 1_700_000_000, playMinutes: 480 },
		currentWinStreak: 2,
		currentLoseStreak: 0,
		maxWinStreak: 5,
		maxLoseStreak: 3,
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
		normalizationUnit: null,
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

function resetMocks() {
	trpcMocks.summaryQueryFn.mockReset();
	trpcMocks.highlightsQueryFn.mockReset();
}

/** Pull the `type` from the latest summary query input. */
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

describe("useCashGameStats", () => {
	it("does not query and stays settled when the scope is disabled", () => {
		resetMocks();
		const { result } = renderCash(ctx({ enabled: false }));
		expect(result.current.isPending).toBe(false);
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.view).toBeNull();
		expect(trpcMocks.summaryQueryFn).not.toHaveBeenCalled();
		expect(trpcMocks.highlightsQueryFn).not.toHaveBeenCalled();
	});

	it("forces the cash_game type on both queries even when the global type is 'all'", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		await renderLoadedCash(ctx({ type: "all" }));
		expect(lastSummaryType()).toBe("cash_game");
		expect(lastHighlightsType()).toBe("cash_game");
	});

	it("keeps the rest of the stats input when overriding the type", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
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
		expect(trpcMocks.summaryQueryFn.mock.calls.at(-1)?.[0]).toEqual({
			normalized: false,
			currencyId: "c9",
			dateFrom: 100,
			dateTo: 200,
			type: "cash_game",
		});
	});

	it("is empty when there are zero sessions", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 0 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ bestSession: null, worstSession: null })
		);
		const result = await renderLoadedCash(ctx());
		expect(result.current.isEmpty).toBe(true);
		expect(result.current.view).toBeNull();
	});

	it("is not empty when at least one session exists", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 1 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(ctx());
		expect(result.current.isEmpty).toBe(false);
		expect(result.current.view).not.toBeNull();
	});

	it("formats the metric cards with the currency unit when not normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(ctx());
		const byKey = Object.fromEntries(
			(result.current.view?.metrics ?? []).map((m) => [m.key, m])
		);
		expect(byKey.hourly.label).toBe("Hourly rate");
		expect(byKey.hourly.value).toBe("+150 USD/h");
		expect(byKey.hourly.isProfitLoss).toBe(true);
		expect(byKey.hourly.amount).toBe(150);
		expect(byKey.evDiff.label).toBe("EV diff");
		expect(byKey.evDiff.value).toBe("+300 USD");
		expect(byKey.evDiff.amount).toBe(300);
		expect(byKey.net.label).toBe("Net");
		expect(byKey.net.value).toBe("+1,500 USD");
		expect(byKey.net.amount).toBe(1500);
	});

	it("switches the net and hourly cards to bb units when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(
			ctx({ normalized: true, normalizationUnit: "bb", currencyUnit: null })
		);
		const byKey = Object.fromEntries(
			(result.current.view?.metrics ?? []).map((m) => [m.key, m])
		);
		expect(byKey.hourly.label).toBe("BB / hr");
		expect(byKey.hourly.value).toBe("+3 bb/h");
		expect(byKey.hourly.amount).toBe(3);
		expect(byKey.net.value).toBe("+30 bb");
		expect(byKey.net.amount).toBe(30);
	});

	it("renders an em dash for a null hourly rate", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ hourlyRate: null }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(ctx());
		const hourly = result.current.view?.metrics.find((m) => m.key === "hourly");
		expect(hourly?.value).toBe("—");
		expect(hourly?.amount).toBeNull();
	});

	it("renders an em dash for a null bb/hr when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ bbPerHour: null }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(
			ctx({ normalized: true, normalizationUnit: "bb", currencyUnit: null })
		);
		const hourly = result.current.view?.metrics.find((m) => m.key === "hourly");
		expect(hourly?.value).toBe("—");
		expect(hourly?.amount).toBeNull();
	});

	it("renders an em dash for a null EV diff", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalEvDiff: null }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(ctx());
		const evDiff = result.current.view?.metrics.find((m) => m.key === "evDiff");
		expect(evDiff?.value).toBe("—");
		expect(evDiff?.amount).toBeNull();
	});

	it("renders a negative net with the loss amount preserved", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(
			summary({ totalProfitLoss: -500 })
		);
		trpcMocks.highlightsQueryFn.mockResolvedValue(highlights());
		const result = await renderLoadedCash(ctx());
		const net = result.current.view?.metrics.find((m) => m.key === "net");
		expect(net?.value).toBe("-500 USD");
		expect(net?.amount).toBe(-500);
	});

	it("builds best and worst session rows with currency value, date, and id", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: session({
					id: "best",
					date: 1_700_000_000,
					profitLoss: 1200,
					normalizedProfitLoss: 24,
				}),
				worstSession: session({
					id: "worst",
					date: 1_700_086_400,
					profitLoss: -800,
					normalizedProfitLoss: -16,
				}),
			})
		);
		const result = await renderLoadedCash(ctx());
		const best = result.current.view?.bestSession;
		const worst = result.current.view?.worstSession;
		expect(best?.id).toBe("best");
		expect(best?.value).toBe("+1,200 USD");
		expect(best?.amount).toBe(1200);
		expect(best?.dateText).toBe(formatYmdSlash(new Date(1_700_000_000 * 1000)));
		expect(worst?.id).toBe("worst");
		expect(worst?.value).toBe("-800 USD");
		expect(worst?.amount).toBe(-800);
	});

	it("uses the normalized session value and unit in best/worst rows when normalized", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: session({
					id: "best",
					profitLoss: 1200,
					normalizedProfitLoss: 24,
				}),
			})
		);
		const result = await renderLoadedCash(
			ctx({ normalized: true, normalizationUnit: "bb", currencyUnit: null })
		);
		const best = result.current.view?.bestSession;
		expect(best?.value).toBe("+24 bb");
		expect(best?.amount).toBe(24);
	});

	it("returns null best/worst rows when highlights have none", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary({ totalSessions: 4 }));
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({ bestSession: null, worstSession: null })
		);
		const result = await renderLoadedCash(ctx());
		expect(result.current.view?.bestSession).toBeNull();
		expect(result.current.view?.worstSession).toBeNull();
	});

	it("treats a normalized session value of null as an em dash", async () => {
		resetMocks();
		trpcMocks.summaryQueryFn.mockResolvedValue(summary());
		trpcMocks.highlightsQueryFn.mockResolvedValue(
			highlights({
				bestSession: session({ id: "best", normalizedProfitLoss: null }),
			})
		);
		const result = await renderLoadedCash(
			ctx({ normalized: true, normalizationUnit: "bb", currencyUnit: null })
		);
		const best = result.current.view?.bestSession;
		expect(best?.value).toBe("—");
		expect(best?.amount).toBeNull();
	});
});
