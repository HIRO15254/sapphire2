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
	addTemporaryPlayer: vi.fn(),
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
		player: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("player", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
	},
	trpcClient: {
		sessionEvent: {
			addPlayer: { mutate: trpcMocks.addPlayer },
			addTemporaryPlayer: { mutate: trpcMocks.addTemporaryPlayer },
			removePlayer: { mutate: trpcMocks.removePlayer },
		},
	},
}));

import { useTablePlayers } from "@/features/players/hooks/use-table-players";

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

function sessionKey(id: string) {
	return buildKey("liveSession", "getById", { id });
}

function makeSessionData(currentPlayers: Array<{
	isHero?: boolean;
	joinedAt?: string;
	playerId?: string;
	seatPosition?: number | null;
}>) {
	return {
		id: "s1",
		kind: "cash_game",
		status: "active",
		currentPlayers: currentPlayers.map((p) => ({
			isHero: p.isHero ?? false,
			joinedAt: p.joinedAt ?? new Date().toISOString(),
			playerId: p.playerId,
			seatPosition: p.seatPosition ?? null,
		})),
	};
}

describe("useTablePlayers", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("read path", () => {
		it("returns empty players when cache has no session data", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.players).toEqual([]);
			expect(result.current.excludePlayerIds).toEqual([]);
		});

		it("returns currentPlayers from liveSession.getById cache", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("s1"),
				makeSessionData([
					{ playerId: "p1", seatPosition: 1 },
					{ playerId: "p2", seatPosition: 2 },
				])
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(2));
			expect(result.current.players[0]?.playerId).toBe("p1");
		});

		it("excludePlayerIds lists only non-hero player ids", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("s1"),
				makeSessionData([
					{ playerId: "p1", isHero: false },
					{ playerId: "p2", isHero: true },
					{ playerId: "p3", isHero: false },
				])
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() =>
				expect(result.current.excludePlayerIds).toHaveLength(2)
			);
			expect(result.current.excludePlayerIds).toContain("p1");
			expect(result.current.excludePlayerIds).toContain("p3");
			expect(result.current.excludePlayerIds).not.toContain("p2");
		});

		it("excludePlayerIds excludes players with undefined playerId", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("s1"),
				makeSessionData([
					{ playerId: undefined, isHero: false },
					{ playerId: "p1", isHero: false },
				])
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() =>
				expect(result.current.excludePlayerIds).toHaveLength(1)
			);
			expect(result.current.excludePlayerIds[0]).toBe("p1");
		});
	});

	describe("handleAddExisting", () => {
		it("optimistically appends the player to currentPlayers", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey("s1"), makeSessionData([]));
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addPlayer.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddExisting("p1", 3);
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey("s1")
				);
				expect(data?.currentPlayers).toHaveLength(1);
			});
			expect(trpcMocks.addPlayer).toHaveBeenCalledWith({
				sessionId: "s1",
				playerId: "p1",
				isHero: false,
				seatPosition: 3,
			});
			resolve?.({ id: "event-1" });
		});

		it("adds player without seat position when not provided", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey("s1"), makeSessionData([]));
			trpcMocks.addPlayer.mockImplementation(() => new Promise(() => undefined));
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddExisting("p1");
			});
			await waitFor(() =>
				expect(trpcMocks.addPlayer).toHaveBeenCalledWith({
					sessionId: "s1",
					playerId: "p1",
					isHero: false,
					seatPosition: undefined,
				})
			);
		});

		it("rolls back on error", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey("s1"), makeSessionData([]));
			trpcMocks.addPlayer.mockRejectedValue(new Error("server error"));

			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddExisting("p1", 1);
			});
			await waitFor(() => expect(trpcMocks.addPlayer).toHaveBeenCalled());
			await waitFor(() => {
				const data = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey("s1")
				);
				expect(data?.currentPlayers).toHaveLength(0);
			});
		});
	});

	describe("handleAddTemporary", () => {
		it("calls addTemporaryPlayer with name and seatPosition", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey("s1"), makeSessionData([]));
			trpcMocks.addTemporaryPlayer.mockImplementation(
				() => new Promise(() => undefined)
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddTemporary("TempPlayer", 5);
			});
			await waitFor(() =>
				expect(trpcMocks.addTemporaryPlayer).toHaveBeenCalledWith({
					sessionId: "s1",
					name: "TempPlayer",
					seatPosition: 5,
				})
			);
		});

		it("optimistically appends a temporary player entry to currentPlayers", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey("s1"), makeSessionData([]));
			trpcMocks.addTemporaryPlayer.mockImplementation(
				() => new Promise(() => undefined)
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddTemporary("Temp", 2);
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey("s1")
				);
				expect(data?.currentPlayers).toHaveLength(1);
			});
		});
	});

	describe("handleRemovePlayer", () => {
		it("optimistically removes the player from currentPlayers", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("s1"),
				makeSessionData([{ playerId: "p1", seatPosition: 1 }])
			);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.removePlayer.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			act(() => {
				result.current.handleRemovePlayer("p1");
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey("s1")
				);
				expect(data?.currentPlayers).toHaveLength(0);
			});
			expect(trpcMocks.removePlayer).toHaveBeenCalledWith({
				sessionId: "s1",
				playerId: "p1",
				isHero: false,
			});
			resolve?.({ id: "event-2" });
		});

		it("rolls back on remove error", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("s1"),
				makeSessionData([{ playerId: "p1" }])
			);
			trpcMocks.removePlayer.mockRejectedValue(new Error("fail"));
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			act(() => {
				result.current.handleRemovePlayer("p1");
			});
			await waitFor(() => expect(trpcMocks.removePlayer).toHaveBeenCalled());
			await waitFor(() => {
				const data = qc.getQueryData<{ currentPlayers: unknown[] }>(
					sessionKey("s1")
				);
				expect(data?.currentPlayers).toHaveLength(1);
			});
		});
	});

	describe("uses sessionId-based key (no type discrimination)", () => {
		it("works with any session type via sessionId only", async () => {
			const qc = createClient();
			qc.setQueryData(
				sessionKey("tournament-sess-1"),
				makeSessionData([{ playerId: "p1" }])
			);
			const { result } = renderHook(
				() => useTablePlayers({ sessionId: "tournament-sess-1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
		});
	});
});
