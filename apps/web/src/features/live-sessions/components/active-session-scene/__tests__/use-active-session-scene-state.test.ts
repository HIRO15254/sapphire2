import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockTablePlayer {
	id: string;
	isActive: boolean;
	isLoading: boolean;
	player: { id: string; isTemporary: boolean; name: string };
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
		player: null as {
			id: string;
			memo: string | null;
			name: string;
			tags: { color: string; id: string; name: string }[];
		} | null,
		isSaving: false,
		updatePlayer: vi.fn(),
	},
	usePlayerDetailSpy: vi.fn(),
	playerList: [] as Array<{
		id: string;
		tags: { color: string; id: string; name: string }[];
	}>,
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
	useQuery: () => ({ data: mocks.playerList }),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		player: {
			list: {
				queryOptions: () => ({ queryKey: ["player", "list"] }),
			},
		},
	},
}));

import { useActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

function renderState(
	overrides: Partial<{
		heroSeatPosition: number | null;
		sessionId: string;
		sessionType: "cash_game" | "tournament";
	}> = {}
) {
	return renderHook(() =>
		useActiveSessionSceneState({
			heroSeatPosition: null,
			sessionId: "s-1",
			sessionType: "cash_game",
			...overrides,
		})
	);
}

function makePlayer(overrides: Partial<MockTablePlayer> = {}): MockTablePlayer {
	return {
		id: "tp-1",
		isActive: true,
		isLoading: false,
		player: { id: "p-1", isTemporary: false, name: "Alice" },
		seatPosition: null,
		...overrides,
	};
}

describe("useActiveSessionSceneState", () => {
	beforeEach(() => {
		mocks.tablePlayers.players = [];
		mocks.tablePlayers.excludePlayerIds = [];
		mocks.tablePlayers.handleAddExisting.mockReset();
		mocks.tablePlayers.handleAddNew.mockReset();
		mocks.tablePlayers.handleAddTemporary.mockReset();
		mocks.tablePlayers.handleRemovePlayer.mockReset();
		mocks.useTablePlayersSpy.mockReset();
		mocks.usePlayerDetailSpy.mockReset();
		mocks.playerDetail.player = null;
		mocks.playerDetail.updatePlayer.mockReset();
		mocks.playerList = [];
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
			expect(mocks.useTablePlayersSpy).toHaveBeenCalledWith({
				liveTournamentSessionId: "s-1",
			});
		});
	});

	describe("players list", () => {
		it("excludes players who already left", () => {
			mocks.tablePlayers.players = [
				makePlayer(),
				makePlayer({
					id: "tp-2",
					isActive: false,
					player: { id: "p-2", isTemporary: false, name: "Gone" },
				}),
			];
			const { result } = renderState();
			expect(result.current.players.map((p) => p.name)).toEqual(["Alice"]);
		});

		it("joins tag badges from the player list by playerId", () => {
			mocks.tablePlayers.players = [makePlayer()];
			mocks.playerList = [
				{ id: "p-1", tags: [{ color: "#f00", id: "t9", name: "Whale" }] },
			];
			const { result } = renderState();
			expect(result.current.players[0]?.tags).toEqual([
				{ color: "#f00", id: "t9", name: "Whale" },
			]);
		});

		it("defaults to no tags when the player is not in the player list", () => {
			mocks.tablePlayers.players = [makePlayer()];
			const { result } = renderState();
			expect(result.current.players[0]?.tags).toEqual([]);
		});

		it("sorts seated players by seat ascending, seatless players last by name", () => {
			mocks.tablePlayers.players = [
				makePlayer({
					id: "tp-z",
					player: { id: "p-z", isTemporary: false, name: "Zed" },
					seatPosition: null,
				}),
				makePlayer({
					id: "tp-5",
					player: { id: "p-5", isTemporary: false, name: "Eve" },
					seatPosition: 5,
				}),
				makePlayer({
					id: "tp-0",
					player: { id: "p-0", isTemporary: false, name: "Ann" },
					seatPosition: 0,
				}),
				makePlayer({
					id: "tp-b",
					player: { id: "p-b", isTemporary: false, name: "Bob" },
					seatPosition: null,
				}),
			];
			const { result } = renderState();
			expect(result.current.players.map((p) => p.name)).toEqual([
				"Ann",
				"Eve",
				"Bob",
				"Zed",
			]);
		});

		it("collects occupied seats of active players only", () => {
			mocks.tablePlayers.players = [
				makePlayer({ seatPosition: 2 }),
				makePlayer({
					id: "tp-2",
					isActive: false,
					player: { id: "p-2", isTemporary: false, name: "Gone" },
					seatPosition: 4,
				}),
				makePlayer({
					id: "tp-3",
					player: { id: "p-3", isTemporary: false, name: "Nul" },
					seatPosition: null,
				}),
			];
			const { result } = renderState();
			expect(result.current.occupiedSeatPositions).toEqual(new Set([2]));
		});
	});

	describe("add player sheet", () => {
		it("opens via onOpenAddPlayer and closes via setAddPlayerSheetOpen", () => {
			const { result } = renderState();
			expect(result.current.addPlayerSheetOpen).toBe(false);
			act(() => result.current.onOpenAddPlayer());
			expect(result.current.addPlayerSheetOpen).toBe(true);
			act(() => result.current.setAddPlayerSheetOpen(false));
			expect(result.current.addPlayerSheetOpen).toBe(false);
		});

		it("onAddExisting seats the player without a seat and closes the sheet", () => {
			const { result } = renderState();
			act(() => result.current.onOpenAddPlayer());
			act(() => result.current.onAddExisting("p-9", "Nina"));
			expect(mocks.tablePlayers.handleAddExisting).toHaveBeenCalledTimes(1);
			expect(mocks.tablePlayers.handleAddExisting).toHaveBeenCalledWith(
				"p-9",
				"Nina",
				undefined
			);
			expect(result.current.addPlayerSheetOpen).toBe(false);
		});

		it("onAddNew forwards name / memo / tagIds without a seat and closes the sheet", () => {
			const { result } = renderState();
			act(() => result.current.onOpenAddPlayer());
			act(() =>
				result.current.onAddNew({
					memo: "note",
					name: "Nina",
					tagIds: ["t1"],
				})
			);
			expect(mocks.tablePlayers.handleAddNew).toHaveBeenCalledTimes(1);
			expect(mocks.tablePlayers.handleAddNew).toHaveBeenCalledWith(
				"Nina",
				undefined,
				"note",
				["t1"]
			);
			expect(result.current.addPlayerSheetOpen).toBe(false);
		});

		it("onAddNew converts a null memo to undefined", () => {
			const { result } = renderState();
			act(() => result.current.onAddNew({ memo: null, name: "Nina" }));
			expect(mocks.tablePlayers.handleAddNew).toHaveBeenCalledWith(
				"Nina",
				undefined,
				undefined,
				undefined
			);
		});

		it("onAddTemporary seats a temp player and closes the sheet", () => {
			const { result } = renderState();
			act(() => result.current.onOpenAddPlayer());
			act(() => result.current.onAddTemporary());
			expect(mocks.tablePlayers.handleAddTemporary).toHaveBeenCalledTimes(1);
			expect(result.current.addPlayerSheetOpen).toBe(false);
		});
	});

	describe("player detail sheet", () => {
		it("onPlayerTap selects the player and opens the sheet", () => {
			const { result } = renderState();
			expect(result.current.playerSheetOpen).toBe(false);
			act(() => result.current.onPlayerTap("p-1"));
			expect(result.current.playerSheetOpen).toBe(true);
			expect(mocks.usePlayerDetailSpy).toHaveBeenLastCalledWith("p-1");
		});

		it("setPlayerSheetOpen(false) clears the selection", () => {
			const { result } = renderState();
			act(() => result.current.onPlayerTap("p-1"));
			act(() => result.current.setPlayerSheetOpen(false));
			expect(result.current.playerSheetOpen).toBe(false);
			expect(mocks.usePlayerDetailSpy).toHaveBeenLastCalledWith(null);
		});

		it("derives selectedPlayer from the detail query and table temp flag", () => {
			mocks.tablePlayers.players = [
				makePlayer({
					player: { id: "p-1", isTemporary: true, name: "Temp guy" },
				}),
			];
			mocks.playerDetail.player = {
				id: "p-1",
				memo: "memo",
				name: "Temp guy",
				tags: [],
			};
			const { result } = renderState();
			act(() => result.current.onPlayerTap("p-1"));
			expect(result.current.selectedPlayer).toEqual({
				id: "p-1",
				isTemporary: true,
				memo: "memo",
				name: "Temp guy",
				tags: [],
			});
		});

		it("selectedPlayer is null while the detail query has no data", () => {
			const { result } = renderState();
			act(() => result.current.onPlayerTap("p-1"));
			expect(result.current.selectedPlayer).toBeNull();
		});

		it("onPlayerSave updates the selected player", () => {
			mocks.playerDetail.player = {
				id: "p-1",
				memo: null,
				name: "Alice",
				tags: [],
			};
			const { result } = renderState();
			act(() => result.current.onPlayerTap("p-1"));
			act(() =>
				result.current.onPlayerSave({
					memo: "m",
					name: "Alice2",
					tagIds: ["t1"],
				})
			);
			expect(mocks.playerDetail.updatePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.playerDetail.updatePlayer).toHaveBeenCalledWith({
				id: "p-1",
				memo: "m",
				name: "Alice2",
				tagIds: ["t1"],
			});
		});

		it("onPlayerSave without a selection is a no-op", () => {
			const { result } = renderState();
			act(() =>
				result.current.onPlayerSave({ memo: null, name: "X", tagIds: [] })
			);
			expect(mocks.playerDetail.updatePlayer).not.toHaveBeenCalled();
		});

		it("onPlayerRemove unseats the selected player and closes the sheet", () => {
			const { result } = renderState();
			act(() => result.current.onPlayerTap("p-1"));
			act(() => result.current.onPlayerRemove());
			expect(mocks.tablePlayers.handleRemovePlayer).toHaveBeenCalledTimes(1);
			expect(mocks.tablePlayers.handleRemovePlayer).toHaveBeenCalledWith("p-1");
			expect(result.current.playerSheetOpen).toBe(false);
		});

		it("onPlayerRemove without a selection is a no-op", () => {
			const { result } = renderState();
			act(() => result.current.onPlayerRemove());
			expect(mocks.tablePlayers.handleRemovePlayer).not.toHaveBeenCalled();
		});
	});

	describe("passthrough", () => {
		it("exposes availableTags, createTag, isSavingPlayer, excludePlayerIds and heroSeatPosition", () => {
			mocks.tablePlayers.excludePlayerIds = ["p-1"];
			const { result } = renderState({ heroSeatPosition: 4 });
			expect(result.current.availableTags).toBe(
				mocks.playerDetail.availableTags
			);
			expect(result.current.createTag).toBe(mocks.playerDetail.createTag);
			expect(result.current.isSavingPlayer).toBe(false);
			expect(result.current.excludePlayerIds).toEqual(["p-1"]);
			expect(result.current.heroSeatPosition).toBe(4);
		});
	});
});
