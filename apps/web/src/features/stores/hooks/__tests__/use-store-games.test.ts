import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

vi.mock("@/utils/trpc", () => ({
	trpc: {
		ringGame: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByStore", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		tournament: {
			listByStore: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByStore", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		store: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("store", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		currency: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("currency", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {},
}));

import {
	useEntityLists,
	useStoreGames,
} from "@/features/stores/hooks/use-store-games";

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

describe("useStoreGames", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("storeId is undefined (disabled path)", () => {
		it("returns empty arrays and does not populate any query cache", () => {
			const qc = createClient();
			const { result } = renderHook(() => useStoreGames(undefined), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.ringGames).toEqual([]);
			expect(result.current.tournaments).toEqual([]);
		});
	});

	describe("with storeId", () => {
		it("projects ring games to a narrow shape with selected fields only", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByStore", { storeId: "store-1" }],
				[
					{
						id: "r1",
						name: "NLH 1/2",
						variant: "holdem",
						blind1: 1,
						blind2: 2,
						blind3: null,
						ante: 0,
						anteType: "none",
						tableSize: 9,
						currencyId: "c1",
						// extraneous properties that must NOT be forwarded
						createdAt: "2026-01-01",
						storeId: "store-1",
						memo: null,
						archivedAt: null,
					},
				]
			);
			const { result } = renderHook(() => useStoreGames("store-1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.ringGames).toHaveLength(1));
			expect(result.current.ringGames[0]).toEqual({
				id: "r1",
				name: "NLH 1/2",
				variant: "holdem",
				blind1: 1,
				blind2: 2,
				blind3: null,
				ante: 0,
				anteType: "none",
				tableSize: 9,
				currencyId: "c1",
			});
		});

		it("projects tournaments to a narrow shape (id, name, buyIn, entryFee)", async () => {
			const qc = createClient();
			qc.setQueryData(
				["tournament", "listByStore", { storeId: "s-1" }],
				[
					{
						id: "t1",
						name: "Sunday Major",
						buyIn: 100,
						entryFee: 10,
						// extraneous
						startingStack: 10_000,
						storeId: "s-1",
					},
				]
			);
			const { result } = renderHook(() => useStoreGames("s-1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tournaments).toHaveLength(1));
			expect(result.current.tournaments[0]).toEqual({
				id: "t1",
				name: "Sunday Major",
				buyIn: 100,
				entryFee: 10,
			});
		});

		it("returns stable empty arrays when both lists are empty for the selected store", async () => {
			const qc = createClient();
			qc.setQueryData(["ringGame", "listByStore", { storeId: "x" }], []);
			qc.setQueryData(["tournament", "listByStore", { storeId: "x" }], []);
			const { result } = renderHook(() => useStoreGames("x"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => {
				expect(result.current.ringGames).toEqual([]);
				expect(result.current.tournaments).toEqual([]);
			});
		});
	});
});

describe("useEntityLists", () => {
	it("returns empty arrays when caches are empty", () => {
		const qc = createClient();
		const { result } = renderHook(() => useEntityLists(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.stores).toEqual([]);
		expect(result.current.currencies).toEqual([]);
	});

	it("projects stores to { id, name } and ignores extraneous fields", async () => {
		const qc = createClient();
		qc.setQueryData(
			["store", "list"],
			[
				{ id: "s1", name: "Main", memo: "drop me" },
				{ id: "s2", name: "Branch", memo: null },
			]
		);
		const { result } = renderHook(() => useEntityLists(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.stores).toHaveLength(2));
		expect(result.current.stores).toEqual([
			{ id: "s1", name: "Main" },
			{ id: "s2", name: "Branch" },
		]);
	});

	it("projects currencies to { id, name } and ignores extraneous fields", async () => {
		const qc = createClient();
		qc.setQueryData(
			["currency", "list"],
			[{ id: "c1", name: "Chips", unit: "c", balance: 100 }]
		);
		const { result } = renderHook(() => useEntityLists(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.currencies).toHaveLength(1));
		expect(result.current.currencies[0]).toEqual({ id: "c1", name: "Chips" });
	});
});
