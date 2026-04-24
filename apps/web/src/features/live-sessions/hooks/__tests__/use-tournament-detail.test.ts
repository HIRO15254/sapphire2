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
		tournament: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "getById", input),
					queryFn: () => Promise.resolve(null),
				}),
			},
		},
		tournamentChipPurchase: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey(
						"tournamentChipPurchase",
						"listByTournament",
						input
					),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		blindLevel: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("blindLevel", "listByTournament", input),
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

import { useTournamentDetail } from "@/features/live-sessions/hooks/use-tournament-detail";

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

describe("useTournamentDetail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns undefined tournament, empty arrays and isTournamentLoading=false when all queries disabled (empty id)", async () => {
		const qc = createClient();
		const { result } = renderHook(() => useTournamentDetail(""), {
			wrapper: makeWrapper(qc),
		});
		// enabled=false because id is empty.
		expect(result.current.tournament).toBeUndefined();
		expect(result.current.chipPurchases).toEqual([]);
		expect(result.current.levels).toEqual([]);
		expect(result.current.currencies).toEqual([]);
		await waitFor(() => {
			expect(result.current.isTournamentLoading).toBe(false);
			expect(result.current.isLevelsLoading).toBe(false);
		});
	});

	it("returns seeded tournament data when a valid id is provided", async () => {
		const qc = createClient();
		qc.setQueryData(["tournament", "getById", { id: "t1" }], {
			id: "t1",
			name: "Main Event",
		});
		qc.setQueryData(
			["tournamentChipPurchase", "listByTournament", { tournamentId: "t1" }],
			[{ id: "cp1", name: "Rebuy", cost: 100, chips: 10_000 }]
		);
		qc.setQueryData(
			["blindLevel", "listByTournament", { tournamentId: "t1" }],
			[{ id: "bl1", blind1: 100, blind2: 200 }]
		);
		qc.setQueryData(["currency", "list"], [{ id: "c1", name: "JPY" }]);
		const { result } = renderHook(() => useTournamentDetail("t1"), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => {
			expect(result.current.tournament).toEqual({
				id: "t1",
				name: "Main Event",
			});
		});
		expect(result.current.chipPurchases).toHaveLength(1);
		expect(result.current.levels).toHaveLength(1);
		expect(result.current.currencies).toEqual([{ id: "c1", name: "JPY" }]);
	});

	it("defaults chipPurchases, levels, currencies to empty arrays when their caches are undefined", () => {
		const qc = createClient();
		qc.setQueryData(["tournament", "getById", { id: "t1" }], { id: "t1" });
		const { result } = renderHook(() => useTournamentDetail("t1"), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.chipPurchases).toEqual([]);
		expect(result.current.levels).toEqual([]);
		expect(result.current.currencies).toEqual([]);
	});
});
