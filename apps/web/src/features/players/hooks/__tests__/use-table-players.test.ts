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
	add: vi.fn(),
	addNew: vi.fn(),
	addTemporary: vi.fn(),
	remove: vi.fn(),
	updateSeat: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionTablePlayer", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
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
		sessionTablePlayer: {
			add: { mutate: trpcMocks.add },
			addNew: { mutate: trpcMocks.addNew },
			addTemporary: { mutate: trpcMocks.addTemporary },
			remove: { mutate: trpcMocks.remove },
			updateSeat: { mutate: trpcMocks.updateSeat },
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

const cashKey = ["sessionTablePlayer", "list", { liveCashGameSessionId: "s1" }];
const tournamentKey = [
	"sessionTablePlayer",
	"list",
	{ liveTournamentSessionId: "t1" },
];

describe("useTablePlayers", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("query key selection", () => {
		it("uses the liveCashGameSessionId queryKey when cash id is provided", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, {
				items: [
					{
						id: "tp1",
						seatPosition: 1,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p1",
							isTemporary: false,
							memo: null,
							name: "Alice",
						},
					},
				],
			});
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			expect(result.current.players[0]?.player.name).toBe("Alice");
		});

		it("uses the liveTournamentSessionId queryKey when tournament id is provided", async () => {
			const qc = createClient();
			qc.setQueryData(tournamentKey, {
				items: [
					{
						id: "tp2",
						seatPosition: 5,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p2",
							isTemporary: false,
							memo: null,
							name: "Bob",
						},
					},
				],
			});
			const { result } = renderHook(
				() => useTablePlayers({ liveTournamentSessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			expect(result.current.players[0]?.player.name).toBe("Bob");
		});
	});

	describe("projection (players)", () => {
		it("marks rows with optimistic- id prefix as isLoading=true", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, {
				items: [
					{
						id: "optimistic-123",
						seatPosition: 1,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p1",
							isTemporary: false,
							memo: null,
							name: "Loading",
						},
					},
				],
			});
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			expect(result.current.players[0]?.isLoading).toBe(true);
		});

		it("excludePlayerIds lists only active player ids", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, {
				items: [
					{
						id: "tp1",
						seatPosition: 1,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p-active",
							isTemporary: false,
							memo: null,
							name: "A",
						},
					},
					{
						id: "tp2",
						seatPosition: 2,
						isActive: false,
						joinedAt: "x",
						leftAt: "y",
						player: {
							id: "p-inactive",
							isTemporary: false,
							memo: null,
							name: "B",
						},
					},
				],
			});
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() =>
				expect(result.current.excludePlayerIds).toEqual(["p-active"])
			);
		});
	});

	describe("handleAddExisting", () => {
		it("optimistically appends the player and forwards the cash session id to mutate", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, { items: [] });
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.add.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddExisting("p1", "Alice", 3);
			});
			await waitFor(() => {
				expect(trpcMocks.add).toHaveBeenCalledWith({
					liveCashGameSessionId: "s1",
					playerId: "p1",
					seatPosition: 3,
				});
			});
			const data = qc.getQueryData<{
				items: Array<{
					id: string;
					seatPosition: number;
					player: { name: string };
				}>;
			}>(cashKey);
			expect(data?.items).toHaveLength(1);
			expect(data?.items[0]?.player.name).toBe("Alice");
			expect(data?.items[0]?.id.startsWith("optimistic-")).toBe(true);
			expect(data?.items[0]?.seatPosition).toBe(3);
			resolve?.({ id: "tp-new" });
		});
	});

	describe("handleAddNew", () => {
		it("posts player attrs + tag ids + seat to sessionTablePlayer.addNew", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, { items: [] });
			trpcMocks.addNew.mockResolvedValue({ id: "tp-new" });
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddNew("NewPlayer", 4, "memo", ["tag1"]);
			});
			await waitFor(() => {
				expect(trpcMocks.addNew).toHaveBeenCalledWith({
					liveCashGameSessionId: "s1",
					playerName: "NewPlayer",
					playerMemo: "memo",
					playerTagIds: ["tag1"],
					seatPosition: 4,
				});
			});
		});
	});

	describe("handleAddTemporary", () => {
		it("creates an optimistic temporary row with placeholder name and temp-prefixed player id", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, { items: [] });
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.addTemporary.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddTemporary(6);
			});
			await waitFor(() => {
				const data = qc.getQueryData<{
					items: Array<{
						id: string;
						player: { id: string; isTemporary: boolean; name: string };
					}>;
				}>(cashKey);
				expect(data?.items).toHaveLength(1);
				const row = data?.items[0];
				expect(row?.player.isTemporary).toBe(true);
				expect(row?.player.name).toBe("...");
				expect(row?.player.id.startsWith("temp-")).toBe(true);
			});
			resolve?.({ id: "tp-temp" });
		});
	});

	describe("handleRemovePlayer", () => {
		it("optimistically marks the row inactive with a leftAt timestamp", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, {
				items: [
					{
						id: "tp1",
						seatPosition: 1,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p1",
							isTemporary: false,
							memo: null,
							name: "Alice",
						},
					},
				],
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.remove.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			act(() => {
				result.current.handleRemovePlayer("p1");
			});
			await waitFor(() => {
				const data = qc.getQueryData<{
					items: Array<{ isActive: boolean; leftAt: string | null }>;
				}>(cashKey);
				expect(data?.items[0]?.isActive).toBe(false);
				expect(data?.items[0]?.leftAt).not.toBeNull();
			});
			resolve?.({ id: "tp1" });
		});
	});

	describe("updateSeatMutation (raw mutation exposed)", () => {
		it("optimistically patches the seatPosition for the player id", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, {
				items: [
					{
						id: "tp1",
						seatPosition: 1,
						isActive: true,
						joinedAt: "x",
						leftAt: null,
						player: {
							id: "p1",
							isTemporary: false,
							memo: null,
							name: "A",
						},
					},
				],
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.updateSeat.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.players).toHaveLength(1));
			act(() => {
				result.current.updateSeatMutation.mutate({
					playerId: "p1",
					seatPosition: 9,
				});
			});
			await waitFor(() => {
				const data = qc.getQueryData<{
					items: Array<{ seatPosition: number | null }>;
				}>(cashKey);
				expect(data?.items[0]?.seatPosition).toBe(9);
			});
			expect(trpcMocks.updateSeat).toHaveBeenCalledWith({
				liveCashGameSessionId: "s1",
				playerId: "p1",
				seatPosition: 9,
			});
			resolve?.({ id: "tp1" });
		});
	});

	describe("onError rollback", () => {
		it("rolls back optimistic add when mutation rejects (observed via setQueryData spy)", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey, { items: [] });
			trpcMocks.add.mockRejectedValue(new Error("server error"));

			let snapshotAtRollback: { items: unknown[] } | undefined;
			const originalSetQueryData = qc.setQueryData.bind(qc);
			vi.spyOn(qc, "setQueryData").mockImplementation(
				<T>(key: unknown, updater: unknown) => {
					const r = originalSetQueryData(
						key as Parameters<typeof originalSetQueryData>[0],
						updater as Parameters<typeof originalSetQueryData>[1]
					) as T;
					const post = qc.getQueryData<{ items: unknown[] }>(cashKey);
					if (!snapshotAtRollback && post?.items.length === 0) {
						snapshotAtRollback = post;
					}
					return r;
				}
			);

			const { result } = renderHook(
				() => useTablePlayers({ liveCashGameSessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.handleAddExisting("p1", "A", 1);
			});
			await waitFor(() => expect(trpcMocks.add).toHaveBeenCalled());
			await waitFor(() => expect(snapshotAtRollback?.items).toEqual([]));
		});
	});
});
