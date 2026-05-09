import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: (input: { type?: string; dateFrom?: number }) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
}));

import {
	parseSummaryStatsWidgetConfig,
	SUMMARY_STATS_DEFAULT_METRICS,
	useSummaryStatsWidget,
} from "@/features/dashboard/widgets/summary-stats-widget/use-summary-stats-widget";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function wrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

function makeCashItem(
	cashBuyIn: number,
	cashOut: number,
	evCashOut?: number | null
) {
	return {
		kind: "cash_game",
		cashBuyIn,
		cashOut,
		evCashOut: evCashOut ?? null,
		tournamentBuyIn: null,
		tournamentEntryFee: null,
		prizeMoney: null,
	};
}

function makeTournamentItem(
	tournamentBuyIn: number,
	tournamentEntryFee: number,
	prizeMoney: number
) {
	return {
		kind: "tournament",
		cashBuyIn: null,
		cashOut: null,
		evCashOut: null,
		tournamentBuyIn,
		tournamentEntryFee,
		prizeMoney,
	};
}

describe("parseSummaryStatsWidgetConfig", () => {
	it("returns defaults when raw is empty", () => {
		const parsed = parseSummaryStatsWidgetConfig({});
		expect(parsed.metrics).toEqual(SUMMARY_STATS_DEFAULT_METRICS);
		expect(parsed.type).toBe("all");
		expect(parsed.dateRangeDays).toBeNull();
	});

	it("filters invalid metric keys and falls back to defaults when empty", () => {
		expect(
			parseSummaryStatsWidgetConfig({ metrics: ["garbage"] }).metrics
		).toEqual(SUMMARY_STATS_DEFAULT_METRICS);
	});

	it("keeps valid metric keys", () => {
		expect(
			parseSummaryStatsWidgetConfig({ metrics: ["winRate", "totalSessions"] })
				.metrics
		).toEqual(["winRate", "totalSessions"]);
	});

	it("coerces unknown type to 'all'", () => {
		expect(parseSummaryStatsWidgetConfig({ type: "weird" }).type).toBe("all");
		expect(parseSummaryStatsWidgetConfig({ type: "cash_game" }).type).toBe(
			"cash_game"
		);
	});

	it("keeps dateRangeDays when numeric, nulls otherwise", () => {
		expect(
			parseSummaryStatsWidgetConfig({ dateRangeDays: 7 }).dateRangeDays
		).toBe(7);
		expect(
			parseSummaryStatsWidgetConfig({ dateRangeDays: "7" }).dateRangeDays
		).toBeNull();
	});
});

describe("useSummaryStatsWidget", () => {
	it("returns undefined summary when no cached data", () => {
		const qc = createClient();
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.summary).toBeUndefined();
	});

	it("exposes the default metrics", () => {
		const qc = createClient();
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.metrics).toEqual(SUMMARY_STATS_DEFAULT_METRICS);
	});

	it("computes totalSessions from items count", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [
					makeCashItem(10_000, 15_000),
					makeCashItem(10_000, 8000),
					makeCashItem(10_000, 12_000),
				],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(3));
	});

	it("computes totalProfitLoss for cash game sessions", async () => {
		const qc = createClient();
		// Session 1: 15000 - 10000 = +5000
		// Session 2: 8000 - 10000 = -2000
		// Total: +3000
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [makeCashItem(10_000, 15_000), makeCashItem(10_000, 8000)],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() =>
			expect(result.current.summary?.totalProfitLoss).toBe(3000)
		);
	});

	it("computes totalProfitLoss for tournament sessions", async () => {
		const qc = createClient();
		// Session 1: prizeMoney (30000) - buyIn (10000) - entryFee (1000) = +19000
		// Session 2: prizeMoney (0) - buyIn (5000) - entryFee (500) = -5500
		// Total: +13500
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [
					makeTournamentItem(10_000, 1000, 30_000),
					makeTournamentItem(5000, 500, 0),
				],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() =>
			expect(result.current.summary?.totalProfitLoss).toBe(13_500)
		);
	});

	it("computes winRate as fraction of winning sessions", async () => {
		const qc = createClient();
		// 2 wins, 1 loss → winRate = 2/3
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [
					makeCashItem(10_000, 12_000), // +2000 win
					makeCashItem(10_000, 15_000), // +5000 win
					makeCashItem(10_000, 8000), // -2000 loss
				],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.summary?.winRate).toBeCloseTo(2 / 3, 5);
		});
	});

	it("computes avgProfitLoss as total / count", async () => {
		const qc = createClient();
		// (+5000 + -2000) / 2 = 1500
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [makeCashItem(10_000, 15_000), makeCashItem(10_000, 8000)],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() =>
			expect(result.current.summary?.avgProfitLoss).toBe(1500)
		);
	});

	it("returns null avgProfitLoss and zero winRate when items is empty", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{ items: [] }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(0));
		expect(result.current.summary?.avgProfitLoss).toBeNull();
		expect(result.current.summary?.winRate).toBe(0);
	});

	it("computes EV P&L from evCashOut when present", async () => {
		const qc = createClient();
		// evCashOut (12000) - cashBuyIn (10000) = +2000 evPL
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [makeCashItem(10_000, 11_000, 12_000)],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() =>
			expect(result.current.summary?.totalEvProfitLoss).toBe(2000)
		);
	});

	it("returns null totalEvProfitLoss when no evCashOut data", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [makeCashItem(10_000, 15_000)],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(1));
		expect(result.current.summary?.totalEvProfitLoss).toBeNull();
		expect(result.current.summary?.totalEvDiff).toBeNull();
	});

	it("passes type filter to query when type is not 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: "cash_game", dateFrom: undefined }],
			{ items: [makeCashItem(10_000, 15_000)] }
		);
		const { result } = renderHook(
			() => useSummaryStatsWidget({ type: "cash_game" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(1));
	});

	it("handles null cashBuyIn/cashOut as zero in profit calculation", async () => {
		const qc = createClient();
		// cashBuyIn=null → 0, cashOut=null → 0 → P/L = 0
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				items: [
					{
						kind: "cash_game",
						cashBuyIn: null,
						cashOut: null,
						evCashOut: null,
						tournamentBuyIn: null,
						tournamentEntryFee: null,
						prizeMoney: null,
					},
				],
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() =>
			expect(result.current.summary?.totalProfitLoss).toBe(0)
		);
	});
});
