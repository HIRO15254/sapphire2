import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const navigateMock = vi.hoisted(() => vi.fn());
const trpcMocks = vi.hoisted(() => ({
	liveSessionCreate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
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
	},
	trpcClient: {
		liveSession: {
			create: { mutate: trpcMocks.liveSessionCreate },
		},
	},
}));

import { useCreateSession } from "@/features/live-sessions/hooks/use-create-session";

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

describe("useCreateSession", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("exposes empty arrays and undefined selectedStoreId by default", () => {
			const qc = createClient();
			const onClose = vi.fn();
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.stores).toEqual([]);
			expect(result.current.currencies).toEqual([]);
			expect(result.current.ringGames).toEqual([]);
			expect(result.current.tournaments).toEqual([]);
			expect(result.current.selectedStoreId).toBeUndefined();
			expect(result.current.isLoading).toBe(false);
		});

		it("projects stores to {id,name} and currencies to {id,name}", async () => {
			const qc = createClient();
			qc.setQueryData(
				["store", "list"],
				[{ id: "s1", name: "Store 1", extra: "ignored" }]
			);
			qc.setQueryData(
				["currency", "list"],
				[{ id: "c1", name: "JPY", unit: "¥" }]
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => {
				expect(result.current.stores).toEqual([{ id: "s1", name: "Store 1" }]);
				expect(result.current.currencies).toEqual([{ id: "c1", name: "JPY" }]);
			});
		});
	});

	describe("setSelectedStoreId", () => {
		it("enables ringGames + tournaments queries when a store is selected, projecting rows", async () => {
			const qc = createClient();
			qc.setQueryData(
				["ringGame", "listByStore", { storeId: "s1" }],
				[
					{
						id: "rg1",
						name: "NL100",
						minBuyIn: 1000,
						maxBuyIn: 10_000,
						currencyId: "c1",
						extra: "ignored",
					},
				]
			);
			qc.setQueryData(
				[
					"tournament",
					"listByStore",
					{ storeId: "s1", includeArchived: false },
				],
				[
					{
						id: "t1",
						name: "Main",
						buyIn: 10_000,
						entryFee: 1000,
						startingStack: 20_000,
						currencyId: "c1",
						extra: "ignored",
					},
				]
			);

			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.setSelectedStoreId("s1");
			});
			await waitFor(() => {
				expect(result.current.ringGames).toEqual([
					{
						id: "rg1",
						name: "NL100",
						minBuyIn: 1000,
						maxBuyIn: 10_000,
						currencyId: "c1",
					},
				]);
				expect(result.current.tournaments).toEqual([
					{
						id: "t1",
						name: "Main",
						buyIn: 10_000,
						entryFee: 1000,
						startingStack: 20_000,
						currencyId: "c1",
					},
				]);
			});
		});
	});

	describe("createCash", () => {
		it("forwards payload to liveSession.create with kind=cash_game and navigates to /active-session on success", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.liveSessionCreate.mockResolvedValue({ id: "new-1" });
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createCash({
					currencyId: "c1",
					initialBuyIn: 5000,
					memo: "note",
					ringGameId: "rg1",
					storeId: "s1",
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.liveSessionCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						kind: "cash_game",
						buyInAmount: 5000,
						currencyId: "c1",
						memo: "note",
						ringGameId: "rg1",
						storeId: "s1",
					})
				);
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("reflects isLoading=true while createCash is in flight", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.liveSessionCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.createCash({ initialBuyIn: 1 });
			});
			await waitFor(() => expect(result.current.isLoading).toBe(true));
			resolve?.({ id: "x" });
			await waitFor(() => expect(result.current.isLoading).toBe(false));
		});
	});

	describe("createTournament", () => {
		it("calls liveSession.create with kind=tournament and navigates on success", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.liveSessionCreate.mockResolvedValue({ id: "tr-1" });
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({
					currencyId: "c1",
					storeId: "s1",
					tournamentId: "tourn-1",
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.liveSessionCreate).toHaveBeenCalledWith(
					expect.objectContaining({
						kind: "tournament",
						currencyId: "c1",
						storeId: "s1",
						tournamentId: "tourn-1",
					})
				);
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("reflects isLoading=true while createTournament is in flight", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.liveSessionCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useCreateSession({ onClose: vi.fn() }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.createTournament({});
			});
			await waitFor(() => expect(result.current.isLoading).toBe(true));
			resolve?.({ id: "tr-1" });
			await waitFor(() => expect(result.current.isLoading).toBe(false));
		});

		it("does not fire navigation when createTournament rejects", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.liveSessionCreate.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.liveSessionCreate).toHaveBeenCalled();
			});
			await Promise.resolve();
			expect(navigateMock).not.toHaveBeenCalled();
			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
