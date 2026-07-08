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
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("ringGame", "listByRoom", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		tournament: {
			listByRoom: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("tournament", "listByRoom", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		room: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("room", "list", undefined),
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
	useRoomGames,
} from "@/features/rooms/hooks/use-room-games";

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

describe("useRoomGames", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("roomId is undefined (disabled path)", () => {
		it("returns empty arrays and does not populate any query cache", () => {
			const qc = createClient();
			const { result } = renderHook(() => useRoomGames(undefined), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.ringGames).toEqual([]);
			expect(result.current.tournaments).toEqual([]);
		});
	});

	describe("with roomId", () => {
		it("projects ring games with every rule field the wizard pre-fill consumes", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "room-1" }],
				[
					{
						id: "r1",
						name: "NLH 1/2",
						variant: "holdem",
						variantId: "gv-1",
						blind1: 1,
						blind2: 2,
						blind3: null,
						ante: 0,
						anteType: "none",
						minBuyIn: 100,
						maxBuyIn: 400,
						tableSize: 9,
						currencyId: "c1",
						// extraneous properties that must NOT be forwarded
						createdAt: "2026-01-01",
						roomId: "room-1",
						memo: null,
						archivedAt: null,
					},
				]
			);
			const { result } = renderHook(() => useRoomGames("room-1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.ringGames).toHaveLength(1));
			expect(result.current.ringGames[0]).toEqual({
				id: "r1",
				name: "NLH 1/2",
				variant: "holdem",
				variantId: "gv-1",
				blind1: 1,
				blind2: 2,
				blind3: null,
				ante: 0,
				anteType: "none",
				minBuyIn: 100,
				maxBuyIn: 400,
				tableSize: 9,
				currencyId: "c1",
			});
		});

		it("projects tournaments with every rule field the wizard pre-fill consumes", async () => {
			const qc = createClient();
			qc.setQueryData(
				["tournament", "listByRoom", { roomId: "s-1" }],
				[
					{
						id: "t1",
						name: "Sunday Major",
						variant: "holdem",
						variantId: "gv-2",
						buyIn: 100,
						entryFee: 10,
						startingStack: 10_000,
						bountyAmount: 50,
						tableSize: 9,
						currencyId: "c1",
						// extraneous master columns that should NOT leak through
						roomId: "s-1",
						archivedAt: null,
					},
				]
			);
			const { result } = renderHook(() => useRoomGames("s-1"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.tournaments).toHaveLength(1));
			expect(result.current.tournaments[0]).toEqual({
				id: "t1",
				name: "Sunday Major",
				variant: "holdem",
				variantId: "gv-2",
				buyIn: 100,
				entryFee: 10,
				startingStack: 10_000,
				bountyAmount: 50,
				tableSize: 9,
				currencyId: "c1",
			});
		});

		it("returns stable empty arrays when both lists are empty for the selected room", async () => {
			const qc = createClient();
			qc.setQueryData(["ringGame", "listByRoom", { roomId: "x" }], []);
			qc.setQueryData(["tournament", "listByRoom", { roomId: "x" }], []);
			const { result } = renderHook(() => useRoomGames("x"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => {
				expect(result.current.ringGames).toEqual([]);
				expect(result.current.tournaments).toEqual([]);
			});
		});
	});

	describe("with includeAll: true", () => {
		const BASE_RING = {
			variant: "holdem",
			blind1: 1,
			blind2: 2,
			blind3: null,
			ante: 0,
			anteType: "none",
			tableSize: 9,
			currencyId: "c1",
		};

		it("merges active and archived ring games into a single list", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "room-1" }],
				[
					{
						id: "r-active",
						name: "Active Game",
						...BASE_RING,
						archivedAt: null,
					},
				]
			);
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "room-1", includeArchived: true }],
				[
					{
						id: "r-archived",
						name: "Archived Game",
						...BASE_RING,
						archivedAt: "2026-01-01",
					},
				]
			);
			const { result } = renderHook(
				() => useRoomGames("room-1", { includeAll: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.ringGames).toHaveLength(2));
			expect(result.current.ringGames.map((g) => g.id)).toEqual(
				expect.arrayContaining(["r-active", "r-archived"])
			);
		});

		it("merges active and archived tournaments into a single list", async () => {
			const qc = createClient();
			qc.setQueryData(
				["tournament", "listByRoom", { roomId: "s-1" }],
				[{ id: "t-active", name: "Active Tourney", buyIn: 100, entryFee: 10 }]
			);
			qc.setQueryData(
				["tournament", "listByRoom", { roomId: "s-1", includeArchived: true }],
				[
					{
						id: "t-archived",
						name: "Archived Tourney",
						buyIn: 200,
						entryFee: 20,
					},
				]
			);
			const { result } = renderHook(
				() => useRoomGames("s-1", { includeAll: true }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.tournaments).toHaveLength(2));
			expect(result.current.tournaments.map((t) => t.id)).toEqual(
				expect.arrayContaining(["t-active", "t-archived"])
			);
		});

		it("excludes archived games when includeAll is not set", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "room-2" }],
				[{ id: "r-only-active", name: "Active", ...BASE_RING }]
			);
			qc.setQueryData(
				["ringGame", "listByRoom", { roomId: "room-2", includeArchived: true }],
				[{ id: "r-archived-only", name: "Archived", ...BASE_RING }]
			);
			const { result } = renderHook(() => useRoomGames("room-2"), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.ringGames).toHaveLength(1));
			expect(result.current.ringGames[0].id).toBe("r-only-active");
		});

		it("returns empty arrays when roomId is undefined even with includeAll", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useRoomGames(undefined, { includeAll: true }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.ringGames).toEqual([]);
			expect(result.current.tournaments).toEqual([]);
		});
	});
});

describe("useEntityLists", () => {
	it("returns empty arrays when caches are empty", () => {
		const qc = createClient();
		const { result } = renderHook(() => useEntityLists(), {
			wrapper: makeWrapper(qc),
		});
		expect(result.current.rooms).toEqual([]);
		expect(result.current.currencies).toEqual([]);
	});

	it("projects rooms to { id, name } and ignores extraneous fields", async () => {
		const qc = createClient();
		qc.setQueryData(
			["room", "list"],
			[
				{ id: "s1", name: "Main", memo: "drop me" },
				{ id: "s2", name: "Branch", memo: null },
			]
		);
		const { result } = renderHook(() => useEntityLists(), {
			wrapper: makeWrapper(qc),
		});
		await waitFor(() => expect(result.current.rooms).toHaveLength(2));
		expect(result.current.rooms).toEqual([
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
