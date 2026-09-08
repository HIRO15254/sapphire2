import { MAX_SEAT_POSITION } from "@sapphire2/db/constants/session-event-types";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTablePlayer {
	id: string;
	isActive: boolean;
	isLoading: boolean;
	player: {
		id: string;
		isTemporary: boolean;
		memo: string | null;
		name: string;
	};
	seatPosition: number | null;
}

const mocks = vi.hoisted(() => ({
	tablePlayers: {
		players: [] as MockTablePlayer[],
		excludePlayerIds: [] as string[],
		handleAddExisting: vi.fn(),
		handleAddNew: vi.fn(),
		handleAddTemporary: vi.fn(),
		handleRemovePlayer: vi.fn(),
	},
	useTablePlayersSpy: vi.fn(),
	playerDetail: {
		availableTags: [{ color: "#123456", id: "t1", name: "Fish" }],
		createTag: vi.fn(),
		player: null,
		isSaving: false,
		updatePlayer: vi.fn(),
	},
	usePlayerDetailSpy: vi.fn(),
	playerList: [] as Array<{
		id: string;
		tags: { color: string; id: string; name: string }[];
	}>,
	updateHeroSeat: vi.fn(),
	warmedPlayerIds: vi.fn(),
}));

vi.mock("@/features/players/hooks/use-table-players", () => ({
	useTablePlayers: (param: unknown) => {
		mocks.useTablePlayersSpy(param);
		return mocks.tablePlayers;
	},
}));

vi.mock("@/features/players/hooks/use-player-detail", () => ({
	usePlayerDetail: (playerId: string | null) => {
		mocks.usePlayerDetailSpy(playerId);
		return mocks.playerDetail;
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQueries: ({ queries }: { queries: { queryKey: unknown[] }[] }) => {
		mocks.warmedPlayerIds(queries.map((query) => query.queryKey[1]));
		return [];
	},
	useQuery: () => ({ data: mocks.playerList }),
	useQueryClient: () => ({
		cancelQueries: vi.fn(),
		getQueryData: vi.fn(),
		setQueryData: vi.fn(),
		invalidateQueries: vi.fn(),
	}),
	useMutation: (options: { mutationFn: (input: unknown) => unknown }) => ({
		mutate: (input: unknown) => options.mutationFn(input),
		isPending: false,
	}),
}));

vi.mock("@/features/live-sessions/utils/seat-screenshot", () => ({
	updateHeroSeatViaClient: (sessionParam: unknown, seatPosition: unknown) =>
		mocks.updateHeroSeat(sessionParam, seatPosition),
}));

vi.mock("@/utils/optimistic-update", () => ({
	cancelTargets: vi.fn(),
	invalidateTargets: vi.fn(),
	restoreSnapshots: vi.fn(),
	snapshotQuery: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["player", id],
				}),
			},
			list: { queryOptions: () => ({ queryKey: ["player", "list"] }) },
		},
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["cash-session", id],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["tournament-session", id],
				}),
			},
		},
	},
}));

import { useSessionSeats } from "@/features/live-sessions/hooks/use-session-seats";

function renderState(
	overrides: Partial<{
		heroSeatPosition: number | null;
		sessionId: string;
		sessionType: "cash_game" | "tournament";
		tableSize: number | null;
	}> = {}
) {
	return renderHook(() =>
		useSessionSeats({
			heroSeatPosition: null,
			sessionId: "s-1",
			sessionType: "cash_game",
			tableSize: 6,
			...overrides,
		})
	);
}

function player(id: string, name: string) {
	return { id, isTemporary: false, memo: null, name };
}

function makePlayer(overrides: Partial<MockTablePlayer> = {}): MockTablePlayer {
	return {
		id: "tp-1",
		isActive: true,
		isLoading: false,
		player: { id: "p-1", isTemporary: false, memo: null, name: "Alice" },
		seatPosition: null,
		...overrides,
	};
}

describe("useSessionSeats", () => {
	beforeEach(() => {
		mocks.tablePlayers.players = [];
		mocks.tablePlayers.excludePlayerIds = [];
		mocks.tablePlayers.handleAddExisting.mockReset();
		mocks.tablePlayers.handleAddNew.mockReset();
		mocks.tablePlayers.handleAddTemporary.mockReset();
		mocks.tablePlayers.handleRemovePlayer.mockReset();
		mocks.useTablePlayersSpy.mockReset();
		mocks.usePlayerDetailSpy.mockReset();
		mocks.playerList = [];
		mocks.updateHeroSeat.mockReset();
	});

	describe("session param", () => {
		it("builds the cash-game session param", () => {
			const { result } = renderState({ sessionType: "cash_game" });
			expect(result.current.sessionParam).toEqual({
				liveCashGameSessionId: "s-1",
			});
			expect(mocks.useTablePlayersSpy).toHaveBeenCalledWith({
				liveCashGameSessionId: "s-1",
			});
		});

		it("builds the tournament session param", () => {
			const { result } = renderState({ sessionType: "tournament" });
			expect(result.current.sessionParam).toEqual({
				liveTournamentSessionId: "s-1",
			});
		});
	});

	describe("seat count resolution", () => {
		it("uses the game-defined table size when within 2..10", () => {
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.tableSize).toBe(6);
			expect(result.current.seats).toHaveLength(6);
		});

		it("falls back to 9 seats when table size is null", () => {
			const { result } = renderState({ tableSize: null });
			expect(result.current.tableSize).toBe(9);
			expect(result.current.seats).toHaveLength(9);
		});

		it("falls back to 9 seats when table size is out of range", () => {
			const { result } = renderState({ tableSize: 25 });
			expect(result.current.tableSize).toBe(9);
		});

		it("accepts a table size at the shared MAX_SEAT_POSITION-derived maximum", () => {
			const { result } = renderState({ tableSize: MAX_SEAT_POSITION + 1 });
			expect(result.current.tableSize).toBe(MAX_SEAT_POSITION + 1);
			expect(result.current.seats).toHaveLength(MAX_SEAT_POSITION + 1);
		});

		it("falls back to 9 seats when table size exceeds the shared maximum by one", () => {
			const { result } = renderState({ tableSize: MAX_SEAT_POSITION + 2 });
			expect(result.current.tableSize).toBe(9);
		});

		it("numbers seats from 0 in ascending order", () => {
			const { result } = renderState({ tableSize: 3 });
			expect(result.current.seats.map((s) => s.seatPosition)).toEqual([
				0, 1, 2,
			]);
		});
	});

	describe("seat placement", () => {
		it("places an active player into their seat", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 2 })];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.seats[2]?.player?.name).toBe("Alice");
			expect(result.current.seats[2]?.occupancy).toBe("player");
			expect(result.current.seats[0]?.player).toBeNull();
			expect(result.current.seats[0]?.occupancy).toBe("empty");
		});

		it("leaves a seat empty when no active player occupies it", () => {
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.seats.every((s) => s.player === null)).toBe(true);
		});

		it("ignores players who already left", () => {
			mocks.tablePlayers.players = [
				makePlayer({ isActive: false, seatPosition: 1 }),
			];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.seats[1]?.player).toBeNull();
		});

		it("joins tag badges from the player list by playerId", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 0 })];
			mocks.playerList = [
				{ id: "p-1", tags: [{ color: "#f00", id: "t9", name: "Whale" }] },
			];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.seats[0]?.player?.tags).toEqual([
				{ color: "#f00", id: "t9", name: "Whale" },
			]);
		});

		it("marks the hero seat as hero while keeping the player record on it", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 3 })];
			const { result } = renderState({ tableSize: 6, heroSeatPosition: 3 });
			expect(result.current.seats[3]?.isHero).toBe(true);
			expect(result.current.seats[3]?.occupancy).toBe("hero");
			expect(result.current.seats[3]?.player?.name).toBe("Alice");
		});

		it("keeps a hero-displaced player in the unseated list", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 3 })];
			const { result } = renderState({ tableSize: 6, heroSeatPosition: 3 });
			expect(result.current.unseatedPlayers.map((p) => p.playerId)).toEqual([
				"p-1",
			]);
		});

		it("marks an empty hero seat as hero", () => {
			const { result } = renderState({ tableSize: 6, heroSeatPosition: 3 });
			expect(result.current.seats[3]?.occupancy).toBe("hero");
			expect(result.current.seats[3]?.player).toBeNull();
		});
	});

	describe("unseated players", () => {
		it("collects seatless active players", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: null })];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.unseatedPlayers.map((p) => p.name)).toEqual([
				"Alice",
			]);
		});

		it("collects players seated beyond the seat count", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 8 })];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.unseatedPlayers).toHaveLength(1);
		});

		it("collects a player displaced by the hero seat", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 2 })];
			const { result } = renderState({ tableSize: 6, heroSeatPosition: 2 });
			expect(result.current.unseatedPlayers.map((p) => p.playerId)).toEqual([
				"p-1",
			]);
		});

		it("excludes seated players from the unseated list", () => {
			mocks.tablePlayers.players = [makePlayer({ seatPosition: 1 })];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.unseatedPlayers).toHaveLength(0);
		});
	});

	describe("occupiedSeatPositions", () => {
		it("collects seats of active players for the screenshot sheet", () => {
			mocks.tablePlayers.players = [
				makePlayer({ seatPosition: 2 }),
				makePlayer({
					id: "tp-2",
					player: { id: "p-2", isTemporary: false, memo: null, name: "Bob" },
					seatPosition: 4,
				}),
				makePlayer({
					id: "tp-3",
					isActive: false,
					player: { id: "p-3", isTemporary: false, memo: null, name: "Gone" },
					seatPosition: 1,
				}),
			];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.occupiedSeatPositions).toEqual(new Set([2, 4]));
		});
	});

	describe("seating handlers", () => {
		it("onSeatExisting adds the player at the given seat", () => {
			const { result } = renderState();
			result.current.onSeatExisting(3, "p-9", "Nina");
			expect(mocks.tablePlayers.handleAddExisting).toHaveBeenCalledTimes(1);
			expect(mocks.tablePlayers.handleAddExisting).toHaveBeenCalledWith(
				"p-9",
				"Nina",
				3
			);
		});

		it("onSeatNew forwards name / memo / tagIds with the seat", () => {
			const { result } = renderState();
			result.current.onSeatNew(2, {
				memo: "note",
				name: "Nina",
				tagIds: ["t1"],
			});
			expect(mocks.tablePlayers.handleAddNew).toHaveBeenCalledWith(
				"Nina",
				2,
				"note",
				["t1"]
			);
		});

		it("onSeatNew converts a null memo to undefined", () => {
			const { result } = renderState();
			result.current.onSeatNew(2, { memo: null, name: "Nina" });
			expect(mocks.tablePlayers.handleAddNew).toHaveBeenCalledWith(
				"Nina",
				2,
				undefined,
				undefined
			);
		});

		it("onSeatTemporary seats a temp player at the given seat", () => {
			const { result } = renderState();
			result.current.onSeatTemporary(5);
			expect(mocks.tablePlayers.handleAddTemporary).toHaveBeenCalledWith(5);
		});

		it("onRemovePlayer removes the player by id", () => {
			const { result } = renderState();
			result.current.onRemovePlayer("p-1");
			expect(mocks.tablePlayers.handleRemovePlayer).toHaveBeenCalledWith("p-1");
		});

		it("onSeatHero updates the hero seat via the session client", () => {
			const { result } = renderState({ sessionType: "cash_game" });
			result.current.onSeatHero(4);
			expect(mocks.updateHeroSeat).toHaveBeenCalledTimes(1);
			expect(mocks.updateHeroSeat).toHaveBeenCalledWith(
				{ liveCashGameSessionId: "s-1" },
				4
			);
		});

		it("onUnseatHero clears the hero seat via the session client", () => {
			const { result } = renderState({ sessionType: "cash_game" });
			result.current.onUnseatHero();
			expect(mocks.updateHeroSeat).toHaveBeenCalledTimes(1);
			expect(mocks.updateHeroSeat).toHaveBeenCalledWith(
				{ liveCashGameSessionId: "s-1" },
				null
			);
		});
	});

	describe("heroAvailable", () => {
		it("is true when no hero seat is set", () => {
			const { result } = renderState({ heroSeatPosition: null });
			expect(result.current.heroAvailable).toBe(true);
		});

		it("is false once a hero seat exists", () => {
			const { result } = renderState({ heroSeatPosition: 2 });
			expect(result.current.heroAvailable).toBe(false);
		});
	});

	describe("player detail prefetch", () => {
		it("warms the profile of every seated player before it is opened", () => {
			mocks.tablePlayers.players = [
				makePlayer({ player: player("p-1", "Alice"), seatPosition: 0 }),
				makePlayer({ player: player("p-2", "Bob"), seatPosition: 3 }),
			];

			renderState({ tableSize: 6 });

			expect(mocks.warmedPlayerIds).toHaveBeenLastCalledWith(["p-1", "p-2"]);
		});

		it("skips a seat whose player has not been saved yet", () => {
			mocks.tablePlayers.players = [
				makePlayer({ player: player("p-1", "Alice"), seatPosition: 0 }),
				makePlayer({
					isLoading: true,
					player: player("new-optimistic", "Bob"),
					seatPosition: 3,
				}),
			];

			renderState({ tableSize: 6 });

			expect(mocks.warmedPlayerIds).toHaveBeenLastCalledWith(["p-1"]);
		});
	});

	describe("passthrough", () => {
		it("exposes excludePlayerIds for the empty-seat search", () => {
			mocks.tablePlayers.excludePlayerIds = ["p-1"];
			const { result } = renderState();
			expect(result.current.excludePlayerIds).toEqual(["p-1"]);
		});

		it("passes the player's memo through to the seat entry", () => {
			mocks.tablePlayers.players = [
				makePlayer({
					player: {
						id: "p-1",
						isTemporary: false,
						memo: "<p>note</p>",
						name: "Alice",
					},
					seatPosition: 0,
				}),
			];
			const { result } = renderState({ tableSize: 6 });
			expect(result.current.seats[0]?.player?.memo).toBe("<p>note</p>");
		});
	});
});
