import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	cashUpdateHero: vi.fn(),
	tournamentUpdateHero: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionEvent", "list", input),
				}),
			},
		},
	},
	trpcClient: {
		liveCashGameSession: {
			updateHeroSeat: { mutate: trpcMocks.cashUpdateHero },
		},
		liveTournamentSession: {
			updateHeroSeat: { mutate: trpcMocks.tournamentUpdateHero },
		},
	},
}));

import { usePokerTableInteraction } from "@/features/players/hooks/use-poker-table-interaction";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: Number.POSITIVE_INFINITY,
				staleTime: Number.POSITIVE_INFINITY,
			},
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

const cashSessionKey = ["liveCashGameSession", "getById", { id: "s1" }];
const tourSessionKey = ["liveTournamentSession", "getById", { id: "t1" }];

describe("usePokerTableInteraction", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("initial state", () => {
		it("returns null addPlayerSeat/selectedPlayer and waiting-for-hero=true when heroSeatPosition is null", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", null),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.addPlayerSeat).toBeNull();
			expect(result.current.selectedPlayer).toBeNull();
			expect(result.current.heroSeatPosition).toBeNull();
			expect(result.current.waitingForHero).toBe(true);
		});

		it("waitingForHero is false when heroSeatPosition is a number", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", 3),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.heroSeatPosition).toBe(3);
			expect(result.current.waitingForHero).toBe(false);
		});
	});

	describe("handleEmptySeatTap", () => {
		it("when hero seat is unset, invokes updateHeroSeat with the tapped seat and optimistically sets session.heroSeatPosition", async () => {
			const qc = createClient();
			qc.setQueryData(cashSessionKey, { heroSeatPosition: null, foo: 1 });
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.cashUpdateHero.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", null),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(5);
			});
			await waitFor(() =>
				expect(trpcMocks.cashUpdateHero).toHaveBeenCalledWith({
					id: "s1",
					heroSeatPosition: 5,
				})
			);
			const session = qc.getQueryData<{
				heroSeatPosition: number | null;
				foo: number;
			}>(cashSessionKey);
			expect(session?.heroSeatPosition).toBe(5);
			expect(session?.foo).toBe(1);
			expect(result.current.heroSeatPosition).toBe(5);
			expect(result.current.waitingForHero).toBe(false);
			expect(result.current.addPlayerSeat).toBeNull();
			resolve?.({ id: "s1" });
		});

		it("when hero seat is set, stores the tapped seat in addPlayerSeat without calling mutation", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", 3),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(7);
			});
			expect(result.current.addPlayerSeat).toBe(7);
			expect(trpcMocks.cashUpdateHero).not.toHaveBeenCalled();
		});

		it("uses the tournament mutation when sessionType is 'tournament'", async () => {
			const qc = createClient();
			qc.setQueryData(tourSessionKey, { heroSeatPosition: null });
			trpcMocks.tournamentUpdateHero.mockResolvedValue({ id: "t1" });
			const { result } = renderHook(
				() => usePokerTableInteraction("tournament", "t1", null),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(2);
			});
			await waitFor(() =>
				expect(trpcMocks.tournamentUpdateHero).toHaveBeenCalledWith({
					id: "t1",
					heroSeatPosition: 2,
				})
			);
			expect(trpcMocks.cashUpdateHero).not.toHaveBeenCalled();
		});
	});

	describe("handleHeroSeatTap", () => {
		it("clears the hero seat (posts null) and updates the session cache optimistically", async () => {
			const qc = createClient();
			qc.setQueryData(cashSessionKey, { heroSeatPosition: 5 });
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.cashUpdateHero.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", 5),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleHeroSeatTap();
			});
			await waitFor(() =>
				expect(trpcMocks.cashUpdateHero).toHaveBeenCalledWith({
					id: "s1",
					heroSeatPosition: null,
				})
			);
			// Optimistic: localHeroSeat=null → effectiveHeroSeat=null while pending.
			await waitFor(() => expect(result.current.heroSeatPosition).toBe(null));
			expect(result.current.waitingForHero).toBe(true);
			resolve?.({ id: "s1" });
		});
	});

	describe("handlePlayerSeatTap", () => {
		it("sets selectedPlayer from the tapped seat", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", 2),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handlePlayerSeatTap(
					{
						id: "tp-1",
						player: { id: "p1", name: "Alice", isTemporary: false },
						isActive: true,
						isLoading: false,
						seatPosition: 4,
					},
					4
				);
			});
			expect(result.current.selectedPlayer).toEqual({
				playerId: "p1",
				seatPosition: 4,
			});
		});
	});

	describe("rollback on hero update failure", () => {
		it("restores session cache and clears localHeroSeat when mutation rejects", async () => {
			const qc = createClient();
			qc.setQueryData(cashSessionKey, { heroSeatPosition: null });
			trpcMocks.cashUpdateHero.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", null),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(3);
			});
			await waitFor(() => expect(trpcMocks.cashUpdateHero).toHaveBeenCalled());
			// onError restores snapshot (heroSeatPosition back to null), and
			// onSettled sets localHeroSeat back to undefined so effectiveHeroSeat
			// falls back to heroSeatPosition prop (null here).
			await waitFor(() => {
				const session = qc.getQueryData<{ heroSeatPosition: number | null }>(
					cashSessionKey
				);
				expect(session?.heroSeatPosition).toBeNull();
			});
			await waitFor(() => expect(result.current.heroSeatPosition).toBe(null));
		});
	});

	describe("setters", () => {
		it("setAddPlayerSeat and setSelectedPlayer are exposed and mutate state", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", 2),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.setAddPlayerSeat(9);
			});
			expect(result.current.addPlayerSeat).toBe(9);
			act(() => {
				result.current.setSelectedPlayer({ playerId: "px", seatPosition: 1 });
			});
			expect(result.current.selectedPlayer).toEqual({
				playerId: "px",
				seatPosition: 1,
			});
		});
	});
});
