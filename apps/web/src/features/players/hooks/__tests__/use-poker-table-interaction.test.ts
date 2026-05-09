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
	addPlayer: vi.fn(),
	removePlayer: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveSession", "getById", input),
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
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
				}),
			},
		},
	},
	trpcClient: {
		sessionEvent: {
			addPlayer: { mutate: trpcMocks.addPlayer },
			removePlayer: { mutate: trpcMocks.removePlayer },
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

const sessionKey = ["liveSession", "getById", { id: "s1" }];

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
		it("when hero seat is unset, invokes sessionEvent.addPlayer with isHero=true and optimistically updates currentPlayers", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				currentPlayers: [],
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addPlayer.mockImplementation(
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
				expect(trpcMocks.addPlayer).toHaveBeenCalledWith({
					sessionId: "s1",
					isHero: true,
					seatPosition: 5,
				})
			);
			const session = qc.getQueryData<{
				currentPlayers: Array<{ isHero: boolean; seatPosition: number }>;
			}>(sessionKey);
			expect(session?.currentPlayers).toHaveLength(1);
			expect(session?.currentPlayers[0]).toMatchObject({
				isHero: true,
				seatPosition: 5,
			});
			expect(result.current.heroSeatPosition).toBe(5);
			expect(result.current.waitingForHero).toBe(false);
			expect(result.current.addPlayerSeat).toBeNull();
			resolve?.({ id: "ev-1" });
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
			expect(trpcMocks.addPlayer).not.toHaveBeenCalled();
		});

		it("sessionType parameter is passed through (tournament scenario)", async () => {
			const tourSessionKey = ["liveSession", "getById", { id: "t1" }];
			const qc = createClient();
			qc.setQueryData(tourSessionKey, { currentPlayers: [] });
			trpcMocks.addPlayer.mockResolvedValue({ id: "ev-t" });
			const { result } = renderHook(
				() => usePokerTableInteraction("tournament", "t1", null),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(2);
			});
			await waitFor(() =>
				expect(trpcMocks.addPlayer).toHaveBeenCalledWith(
					expect.objectContaining({
						sessionId: "t1",
						isHero: true,
						seatPosition: 2,
					})
				)
			);
		});
	});

	describe("handleHeroSeatTap", () => {
		it("calls sessionEvent.removePlayer with isHero=true and optimistically clears hero from currentPlayers", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				currentPlayers: [
					{ isHero: true, seatPosition: 5, joinedAt: "2026-01-01" },
					{
						isHero: false,
						seatPosition: 2,
						joinedAt: "2026-01-01",
						playerId: "p1",
					},
				],
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removePlayer.mockImplementation(
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
				expect(trpcMocks.removePlayer).toHaveBeenCalledWith({
					sessionId: "s1",
					isHero: true,
				})
			);
			// Optimistic: localHeroSeat=null → effectiveHeroSeat=null while pending.
			await waitFor(() => expect(result.current.heroSeatPosition).toBe(null));
			expect(result.current.waitingForHero).toBe(true);
			resolve?.({ id: "ev-r" });
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
		it("restores session cache and clears localHeroSeat when addPlayer rejects", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { currentPlayers: [] });
			trpcMocks.addPlayer.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(
				() => usePokerTableInteraction("cash_game", "s1", null),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleEmptySeatTap(3);
			});
			await waitFor(() => expect(trpcMocks.addPlayer).toHaveBeenCalled());
			// onError restores snapshot (currentPlayers back to []), and
			// onSettled sets localHeroSeat back to undefined so effectiveHeroSeat
			// falls back to heroSeatPosition prop (null here).
			await waitFor(() => {
				const session = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey
				);
				expect(session?.currentPlayers).toHaveLength(0);
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
