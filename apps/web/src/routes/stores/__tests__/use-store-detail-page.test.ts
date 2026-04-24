import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/trpc", () => ({
	trpc: {
		store: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: ["store", "getById", input],
					queryFn: () => Promise.resolve(undefined),
				}),
			},
		},
	},
}));

import { useStoreDetailPage } from "@/routes/stores/-use-store-detail-page";

function buildKey(id: string) {
	return ["store", "getById", { id }];
}

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

describe("useStoreDetailPage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns store=undefined and isLoading=true when cache is empty", () => {
			const qc = createClient();
			const { result } = renderHook(() => useStoreDetailPage("store-1"), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.store).toBeUndefined();
			expect(result.current.expandedGameId).toBeNull();
		});

		it("surfaces store data from the query cache", async () => {
			const qc = createClient();
			qc.setQueryData(buildKey("store-1"), {
				id: "store-1",
				name: "Akiba",
				memo: null,
			});
			const { result } = renderHook(() => useStoreDetailPage("store-1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.store).toEqual({
					id: "store-1",
					name: "Akiba",
					memo: null,
				})
			);
			expect(result.current.isLoading).toBe(false);
		});
	});

	describe("handleToggleGame", () => {
		it("stores the selected game id", () => {
			const qc = createClient();
			const { result } = renderHook(() => useStoreDetailPage("store-1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleToggleGame("game-1");
			});
			expect(result.current.expandedGameId).toBe("game-1");
		});

		it("can clear the selection by passing null", () => {
			const qc = createClient();
			const { result } = renderHook(() => useStoreDetailPage("store-1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleToggleGame("game-1");
			});
			act(() => {
				result.current.handleToggleGame(null);
			});
			expect(result.current.expandedGameId).toBeNull();
		});

		it("switches between games when called with a different id", () => {
			const qc = createClient();
			const { result } = renderHook(() => useStoreDetailPage("store-1"), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.handleToggleGame("game-1");
			});
			act(() => {
				result.current.handleToggleGame("game-2");
			});
			expect(result.current.expandedGameId).toBe("game-2");
		});
	});

	describe("storeId propagation", () => {
		it("reads the correct cache entry keyed by storeId", async () => {
			const qc = createClient();
			qc.setQueryData(buildKey("store-9"), {
				id: "store-9",
				name: "Shinjuku",
				memo: "late",
			});
			const { result } = renderHook(() => useStoreDetailPage("store-9"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() =>
				expect(result.current.store).toMatchObject({
					id: "store-9",
					name: "Shinjuku",
				})
			);
		});
	});
});
