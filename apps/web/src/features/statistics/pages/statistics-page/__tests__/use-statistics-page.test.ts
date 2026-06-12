import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

function buildKey(input: unknown) {
	return input === undefined ? ["session", "list"] : ["session", "list", input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: (input: { type?: string }) => ({
					queryKey: buildKey(input),
					queryFn: () =>
						Promise.resolve({
							items: [],
							nextCursor: null,
							summary: undefined,
						}),
				}),
			},
		},
	},
}));

import { useStatisticsPage } from "@/features/statistics/pages/statistics-page/use-statistics-page";

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

const fullSummary = {
	totalSessions: 5,
	totalProfitLoss: 500,
	winRate: 60,
	avgProfitLoss: 100,
	avgPlacement: null,
	itmRate: null,
	totalPrizeMoney: null,
	totalEvProfitLoss: 450,
	totalEvDiff: -50,
};

describe("useStatisticsPage", () => {
	it("initial sessionType is 'all'", () => {
		const qc = createClient();
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.sessionType).toBe("all");
	});

	it("isLoading is true when no cached data exists", () => {
		const qc = createClient();
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.isLoading).toBe(true);
	});

	it("summary is undefined when no cached data exists", () => {
		const qc = createClient();
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		expect(result.current.summary).toBeUndefined();
	});

	it("exposes summary when cached data is present for 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(buildKey({ type: undefined }), { summary: fullSummary });
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(5));
	});

	it("isLoading becomes false once data is available", async () => {
		const qc = createClient();
		qc.setQueryData(buildKey({ type: undefined }), { summary: fullSummary });
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("passes type: undefined to queryOptions when sessionType is 'all'", async () => {
		const qc = createClient();
		qc.setQueryData(buildKey({ type: undefined }), {
			summary: { ...fullSummary, totalSessions: 7 },
		});
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(7));
	});

	it("setSessionType to 'cash_game' updates sessionType and query type", async () => {
		const qc = createClient();
		qc.setQueryData(buildKey({ type: "cash_game" }), {
			summary: { ...fullSummary, totalSessions: 3 },
		});
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setSessionType("cash_game");
		});
		expect(result.current.sessionType).toBe("cash_game");
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(3));
	});

	it("setSessionType to 'tournament' updates sessionType and query type", async () => {
		const qc = createClient();
		qc.setQueryData(buildKey({ type: "tournament" }), {
			summary: { ...fullSummary, totalSessions: 2, itmRate: 50 },
		});
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setSessionType("tournament");
		});
		expect(result.current.sessionType).toBe("tournament");
		await waitFor(() => expect(result.current.summary?.totalSessions).toBe(2));
	});

	it("setSessionType resets to 'all' correctly from another type", () => {
		const qc = createClient();
		const { result } = renderHook(() => useStatisticsPage(), {
			wrapper: wrapper(qc),
		});
		act(() => {
			result.current.setSessionType("tournament");
		});
		expect(result.current.sessionType).toBe("tournament");
		act(() => {
			result.current.setSessionType("all");
		});
		expect(result.current.sessionType).toBe("all");
	});
});
