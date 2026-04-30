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
	GlobalFilterProvider,
	type GlobalFilterValues,
} from "@/features/dashboard/hooks/use-global-filter";
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

function wrapperWithGlobalFilter(
	client: QueryClient,
	globalFilter: GlobalFilterValues
) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client },
			createElement(GlobalFilterProvider, { value: globalFilter }, children)
		);
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

describe("useSummaryStatsWidget — global filter integration", () => {
	it("uses global filter type when local is 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: "tournament", dateFrom: undefined }],
			{ summary: { totalSessions: 9 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				type: "tournament",
				dateRangeDays: null,
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(9));
	});

	it("global filter type overrides a non-'all' local type", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: "cash_game", dateFrom: undefined }],
			{ summary: { totalSessions: 11 } }
		);
		const { result } = renderHook(
			() => useSummaryStatsWidget({ type: "tournament" }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					type: "cash_game",
					dateRangeDays: null,
				}),
			}
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(11));
	});

	it("uses global filter dateRangeDays when local is null", async () => {
		const qc = createClient();
		const dateFrom = Math.floor(Date.now() / 1000) - 7 * 86_400;
		// Match within ~2 seconds tolerance by using a custom selector
		const expectedKey = [
			"session",
			"list",
			{ type: undefined, dateFrom },
		] as const;
		qc.setQueryData(expectedKey, { summary: { totalSessions: 22 } });
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				type: "all",
				dateRangeDays: 7,
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(22));
	});

	it("global dateRangeDays overrides local dateRangeDays", async () => {
		const qc = createClient();
		const dateFrom = Math.floor(Date.now() / 1000) - 3 * 86_400;
		qc.setQueryData(["session", "list", { type: undefined, dateFrom }], {
			summary: { totalSessions: 33 },
		});
		const { result } = renderHook(
			() => useSummaryStatsWidget({ dateRangeDays: 30 }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					type: "all",
					dateRangeDays: 3,
				}),
			}
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(33));
	});

	it("falls back to local when global is fully default", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { type: "cash_game", dateFrom: undefined }],
			{ summary: { totalSessions: 44 } }
		);
		const { result } = renderHook(
			() => useSummaryStatsWidget({ type: "cash_game" }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					type: "all",
					dateRangeDays: null,
				}),
			}
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(44));
	});
});
