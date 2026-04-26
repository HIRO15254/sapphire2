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
					queryFn: () => Promise.resolve({ items: [], summary: undefined }),
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
	it("exposes the summary from a matching query key", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: undefined, dateFrom: undefined }],
			{
				summary: {
					totalSessions: 3,
					totalProfitLoss: 100,
					winRate: 0.5,
					avgProfitLoss: 33,
					totalEvProfitLoss: 50,
					totalEvDiff: -10,
				},
			}
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(3));
		expect(result.current.metrics).toEqual(SUMMARY_STATS_DEFAULT_METRICS);
	});

	it("passes type filter to query when type is not 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: "cash_game", dateFrom: undefined }],
			{ summary: { totalSessions: 1 } }
		);
		const { result } = renderHook(
			() => useSummaryStatsWidget({ type: "cash_game" }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(1));
	});

	it("returns undefined summary when the query has no cached data", () => {
		const qc = createClient();
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		expect(result.current.summary).toBeUndefined();
	});
});
