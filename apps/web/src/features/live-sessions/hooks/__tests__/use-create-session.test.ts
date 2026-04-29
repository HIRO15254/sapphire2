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
	createCash: vi.fn(),
	createTournament: vi.fn(),
	sessionEventCreate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
		liveTournamentSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
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
		liveCashGameSession: {
			create: { mutate: trpcMocks.createCash },
		},
		liveTournamentSession: {
			create: { mutate: trpcMocks.createTournament },
		},
		sessionEvent: {
			create: { mutate: trpcMocks.sessionEventCreate },
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
		it("forwards the full payload to liveCashGameSession.create and navigates to /active-session on success", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createCash.mockResolvedValue({ id: "new-1" });
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
				expect(trpcMocks.createCash).toHaveBeenCalledWith({
					currencyId: "c1",
					initialBuyIn: 5000,
					memo: "note",
					ringGameId: "rg1",
					storeId: "s1",
				});
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("reflects isLoading=true while createCash is in flight", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.createCash.mockImplementation(
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
		it("creates the tournament, then creates an initial update_stack event with startingStack payload", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createTournament.mockResolvedValue({ id: "tr-1" });
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "ev-1" });
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({
					buyIn: 10_000,
					startingStack: 20_000,
					currencyId: "c1",
					storeId: "s1",
					tournamentId: "tourn-1",
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.createTournament).toHaveBeenCalledWith({
					buyIn: 10_000,
					currencyId: "c1",
					storeId: "s1",
					tournamentId: "tourn-1",
				});
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "tr-1",
					eventType: "update_stack",
					payload: { stackAmount: 20_000 },
				});
			});
			await waitFor(() => {
				expect(onClose).toHaveBeenCalledTimes(1);
				expect(navigateMock).toHaveBeenCalledWith({ to: "/active-session" });
			});
		});

		it("does not fire navigation / sessionEvent create when createTournament rejects", async () => {
			const qc = createClient();
			const onClose = vi.fn();
			trpcMocks.createTournament.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(() => useCreateSession({ onClose }), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.createTournament({
					buyIn: 10_000,
					startingStack: 20_000,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.createTournament).toHaveBeenCalled();
			});
			await Promise.resolve();
			expect(trpcMocks.sessionEventCreate).not.toHaveBeenCalled();
			expect(navigateMock).not.toHaveBeenCalled();
			expect(onClose).not.toHaveBeenCalled();
		});
	});
});
