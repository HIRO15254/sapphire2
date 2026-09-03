import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trpcMocks = vi.hoisted(() => ({
	currencyListQueryFn: vi.fn(),
	roomListQueryFn: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: ["currency", "list"],
					queryFn: () => trpcMocks.currencyListQueryFn(),
				}),
			},
		},
		room: {
			list: {
				queryOptions: () => ({
					queryKey: ["room", "list"],
					queryFn: () => trpcMocks.roomListQueryFn(),
				}),
			},
		},
	},
}));

import { useStatsReferenceData } from "@/features/statistics/hooks/use-stats-reference-data";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: 0,
				staleTime: Number.POSITIVE_INFINITY,
			},
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useStatsReferenceData", () => {
	beforeEach(() => {
		trpcMocks.currencyListQueryFn.mockReset();
		trpcMocks.roomListQueryFn.mockReset();
		trpcMocks.currencyListQueryFn.mockResolvedValue([]);
		trpcMocks.roomListQueryFn.mockResolvedValue([]);
	});

	it("returns empty currency and room lists before either query resolves", () => {
		trpcMocks.currencyListQueryFn.mockImplementation(
			() => new Promise(() => undefined)
		);
		trpcMocks.roomListQueryFn.mockImplementation(
			() => new Promise(() => undefined)
		);
		const qc = createClient();
		const { result } = renderHook(() => useStatsReferenceData(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.currencies).toEqual([]);
		expect(result.current.rooms).toEqual([]);
	});

	it("is loading while only one of the two queries is still in flight", () => {
		trpcMocks.currencyListQueryFn.mockImplementation(
			() => new Promise(() => undefined)
		);
		trpcMocks.roomListQueryFn.mockResolvedValue([]);
		const qc = createClient();
		const { result } = renderHook(() => useStatsReferenceData(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.isLoading).toBe(true);
	});

	it("stops loading once both queries have settled", async () => {
		const qc = createClient();
		const { result } = renderHook(() => useStatsReferenceData(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.isLoading).toBe(false));
	});

	it("maps currency rows to id/name/unit and drops unused fields", async () => {
		trpcMocks.currencyListQueryFn.mockResolvedValue([
			{ id: "c1", name: "USD", unit: "$", balance: 500 },
			{ id: "c2", name: "Euro", unit: undefined },
		]);
		const qc = createClient();
		const { result } = renderHook(() => useStatsReferenceData(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.currencies).toHaveLength(2));
		expect(result.current.currencies).toEqual([
			{ id: "c1", name: "USD", unit: "$" },
			{ id: "c2", name: "Euro", unit: null },
		]);
	});

	it("maps room rows to id/name and drops unused fields", async () => {
		trpcMocks.roomListQueryFn.mockResolvedValue([
			{ id: "r1", name: "Aria", isArchived: false },
		]);
		const qc = createClient();
		const { result } = renderHook(() => useStatsReferenceData(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.rooms).toHaveLength(1));
		expect(result.current.rooms).toEqual([{ id: "r1", name: "Aria" }]);
	});
});
