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
				queryOptions: (input: {
					currencyId?: string;
					dateFrom?: number;
					dateTo?: number;
					storeId?: string;
					type?: string;
				}) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () => Promise.resolve({ items: [], summary: undefined }),
				}),
			},
		},
	},
}));

import {
	DEFAULT_GLOBAL_FILTER_VALUES,
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
	values: GlobalFilterValues
) {
	const setValue = vi.fn();
	const reset = vi.fn();
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(
			QueryClientProvider,
			{ client },
			createElement(
				GlobalFilterProvider,
				{ value: { values, setValue, reset } },
				children
			)
		);
	};
}

const DEFAULT_QUERY_INPUT = {
	type: undefined,
	storeId: undefined,
	currencyId: undefined,
	dateFrom: undefined,
	dateTo: undefined,
};

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
	it("exposes the summary from a default-input query key", async () => {
		const qc = createClient();
		qc.setQueryData(["session", "list", DEFAULT_QUERY_INPUT], {
			summary: {
				totalSessions: 3,
				totalProfitLoss: 100,
				winRate: 0.5,
				avgProfitLoss: 33,
				totalEvProfitLoss: 50,
				totalEvDiff: -10,
			},
		});
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(3));
		expect(result.current.metrics).toEqual(SUMMARY_STATS_DEFAULT_METRICS);
	});

	it("passes type filter to query when type is not 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { ...DEFAULT_QUERY_INPUT, type: "cash_game" }],
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
			["session", "list", { ...DEFAULT_QUERY_INPUT, type: "tournament" }],
			{ summary: { totalSessions: 9 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				type: "tournament",
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(9));
	});

	it("global filter type overrides a non-'all' local type", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { ...DEFAULT_QUERY_INPUT, type: "cash_game" }],
			{ summary: { totalSessions: 11 } }
		);
		const { result } = renderHook(
			() => useSummaryStatsWidget({ type: "tournament" }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					...DEFAULT_GLOBAL_FILTER_VALUES,
					type: "cash_game",
				}),
			}
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(11));
	});

	it("global filter storeId is forwarded to query", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { ...DEFAULT_QUERY_INPUT, storeId: "store-7" }],
			{ summary: { totalSessions: 55 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				storeId: "store-7",
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(55));
	});

	it("global filter currencyId is forwarded to query", async () => {
		const qc = createClient();
		qc.setQueryData(
			["session", "list", { ...DEFAULT_QUERY_INPUT, currencyId: "currency-1" }],
			{ summary: { totalSessions: 66 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				currencyId: "currency-1",
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(66));
	});

	it("global filter dateFrom is converted to start-of-day epoch", async () => {
		const qc = createClient();
		const expectedDateFrom = Math.floor(
			new Date("2026-01-01T00:00:00").getTime() / 1000
		);
		qc.setQueryData(
			[
				"session",
				"list",
				{ ...DEFAULT_QUERY_INPUT, dateFrom: expectedDateFrom },
			],
			{ summary: { totalSessions: 7 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				dateFrom: "2026-01-01",
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(7));
	});

	it("global filter dateTo is converted to end-of-day epoch", async () => {
		const qc = createClient();
		const expectedDateTo = Math.floor(
			new Date("2026-12-31T23:59:59").getTime() / 1000
		);
		qc.setQueryData(
			["session", "list", { ...DEFAULT_QUERY_INPUT, dateTo: expectedDateTo }],
			{ summary: { totalSessions: 8 } }
		);
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				dateTo: "2026-12-31",
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(8));
	});

	it("global dateRangeDays converts to dateFrom (now - N*86400)", async () => {
		const qc = createClient();
		const dateFrom = Math.floor(Date.now() / 1000) - 7 * 86_400;
		qc.setQueryData(["session", "list", { ...DEFAULT_QUERY_INPUT, dateFrom }], {
			summary: { totalSessions: 22 },
		});
		const { result } = renderHook(() => useSummaryStatsWidget({}), {
			wrapper: wrapperWithGlobalFilter(qc, {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				dateRangeDays: 7,
			}),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(22));
	});

	it("global dateRangeDays takes precedence over local dateRangeDays", async () => {
		const qc = createClient();
		const dateFrom = Math.floor(Date.now() / 1000) - 3 * 86_400;
		qc.setQueryData(["session", "list", { ...DEFAULT_QUERY_INPUT, dateFrom }], {
			summary: { totalSessions: 33 },
		});
		const { result } = renderHook(
			() => useSummaryStatsWidget({ dateRangeDays: 30 }),
			{
				wrapper: wrapperWithGlobalFilter(qc, {
					...DEFAULT_GLOBAL_FILTER_VALUES,
					dateRangeDays: 3,
				}),
			}
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(33));
	});

	it("falls back to local dateRangeDays when global is fully default", async () => {
		const qc = createClient();
		const dateFrom = Math.floor(Date.now() / 1000) - 14 * 86_400;
		qc.setQueryData(["session", "list", { ...DEFAULT_QUERY_INPUT, dateFrom }], {
			summary: { totalSessions: 44 },
		});
		const { result } = renderHook(
			() => useSummaryStatsWidget({ dateRangeDays: 14 }),
			{ wrapper: wrapper(qc) }
		);
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(44));
	});
});
