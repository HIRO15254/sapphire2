import { IconCoin } from "@tabler/icons-react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

const mocks = vi.hoisted(() => ({
	eventMenu: {
		isOpen: false,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	},
	stackSheet: {
		isOpen: false,
		open: vi.fn(),
		close: vi.fn(),
		setIsOpen: vi.fn(),
	},
}));

vi.mock("@/features/live-sessions/hooks/use-event-menu", () => ({
	useEventMenu: () => mocks.eventMenu,
}));

vi.mock("@/features/live-sessions/hooks/use-stack-sheet", () => ({
	useStackSheet: () => mocks.stackSheet,
}));

import { useActiveSessionScene } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene";

function makeState(
	overrides: Partial<ActiveSessionSceneState> = {}
): ActiveSessionSceneState {
	return {
		addPlayerSheetOpen: false,
		availableTags: [],
		createTag: vi.fn(),
		excludePlayerIds: [],
		heroSeatPosition: null,
		isSavingPlayer: false,
		occupiedSeatPositions: new Set<number>(),
		onAddExisting: vi.fn(),
		onAddNew: vi.fn(),
		onAddTemporary: vi.fn(),
		onOpenAddPlayer: vi.fn(),
		onPlayerRemove: vi.fn(),
		onPlayerSave: vi.fn(),
		onPlayerTap: vi.fn(),
		players: [],
		playerSheetOpen: false,
		selectedPlayer: null,
		sessionParam: { liveCashGameSessionId: "s-1" },
		setAddPlayerSheetOpen: vi.fn(),
		setPlayerSheetOpen: vi.fn(),
		...overrides,
	};
}

function renderScene(
	overrides: Partial<Parameters<typeof useActiveSessionScene>[0]> = {}
) {
	const options: Parameters<typeof useActiveSessionScene>[0] = {
		eventMenuExtraItems: [],
		onEndSession: vi.fn(),
		onPause: vi.fn(),
		state: makeState(),
		...overrides,
	};
	return { options, ...renderHook(() => useActiveSessionScene(options)) };
}

describe("useActiveSessionScene", () => {
	beforeEach(() => {
		mocks.eventMenu.isOpen = false;
		mocks.eventMenu.open.mockReset();
		mocks.eventMenu.close.mockReset();
		mocks.eventMenu.setIsOpen.mockReset();
		mocks.stackSheet.open.mockReset();
	});

	describe("session identity", () => {
		it("derives sessionId/sessionType from a cash session param", () => {
			const { result } = renderScene();
			expect(result.current.sessionId).toBe("s-1");
			expect(result.current.sessionType).toBe("cash_game");
		});

		it("derives sessionId/sessionType from a tournament session param", () => {
			const { result } = renderScene({
				state: makeState({
					sessionParam: { liveTournamentSessionId: "t-1" },
				}),
			});
			expect(result.current.sessionId).toBe("t-1");
			expect(result.current.sessionType).toBe("tournament");
		});
	});

	describe("event menu (+)", () => {
		it("lists the common actions in priority order and appends extra items", () => {
			const { result } = renderScene({
				eventMenuExtraItems: [
					{ icon: IconCoin, label: "All-in", onSelect: vi.fn() },
				],
			});
			expect(result.current.eventMenuItems.map((i) => i.label)).toEqual([
				"Record stack",
				"Player notes & tags",
				"Seat player",
				"Seat from screenshot",
				"All-in",
			]);
		});

		it("exposes the shared event-menu open state", () => {
			mocks.eventMenu.isOpen = true;
			const { result } = renderScene();
			expect(result.current.isEventMenuOpen).toBe(true);
			expect(result.current.setEventMenuOpen).toBe(mocks.eventMenu.setIsOpen);
		});

		it("'Record stack' closes the menu and opens the stack sheet", () => {
			const { result } = renderScene();
			act(() => result.current.eventMenuItems[0]?.onSelect());
			expect(mocks.eventMenu.close).toHaveBeenCalledTimes(1);
			expect(mocks.stackSheet.open).toHaveBeenCalledTimes(1);
		});

		it("'Player notes & tags' closes the menu and opens the player picker", () => {
			const { result } = renderScene();
			expect(result.current.isPlayerPickerOpen).toBe(false);
			act(() => result.current.eventMenuItems[1]?.onSelect());
			expect(mocks.eventMenu.close).toHaveBeenCalledTimes(1);
			expect(result.current.isPlayerPickerOpen).toBe(true);
		});

		it("'Seat player' closes the menu and opens the add-player sheet", () => {
			const { options, result } = renderScene();
			act(() => result.current.eventMenuItems[2]?.onSelect());
			expect(mocks.eventMenu.close).toHaveBeenCalledTimes(1);
			expect(options.state.onOpenAddPlayer).toHaveBeenCalledTimes(1);
		});

		it("'Seat from screenshot' closes the menu and opens the scan sheet", () => {
			const { result } = renderScene();
			expect(result.current.isScanSheetOpen).toBe(false);
			act(() => result.current.eventMenuItems[3]?.onSelect());
			expect(mocks.eventMenu.close).toHaveBeenCalledTimes(1);
			expect(result.current.isScanSheetOpen).toBe(true);
		});

		it("an extra item closes the menu before running its own action", () => {
			const extra = vi.fn();
			const { result } = renderScene({
				eventMenuExtraItems: [
					{ icon: IconCoin, label: "All-in", onSelect: extra },
				],
			});
			act(() => result.current.eventMenuItems[4]?.onSelect());
			expect(mocks.eventMenu.close).toHaveBeenCalledTimes(1);
			expect(extra).toHaveBeenCalledTimes(1);
		});
	});

	describe("session menu (header)", () => {
		it("lists pause / end / game settings / discard", () => {
			const { result } = renderScene();
			expect(result.current.sessionMenuItems.map((i) => i.label)).toEqual([
				"Pause session",
				"End session",
				"Game settings",
				"Discard session",
			]);
		});

		it("marks only the discard item as destructive", () => {
			const { result } = renderScene();
			expect(
				result.current.sessionMenuItems.map((i) => i.tone ?? "default")
			).toEqual(["default", "default", "default", "destructive"]);
		});

		it("opens via onOpenSessionMenu", () => {
			const { result } = renderScene();
			expect(result.current.isSessionMenuOpen).toBe(false);
			act(() => result.current.onOpenSessionMenu());
			expect(result.current.isSessionMenuOpen).toBe(true);
		});

		it("'Pause session' closes the menu and pauses", () => {
			const { options, result } = renderScene();
			act(() => result.current.onOpenSessionMenu());
			act(() => result.current.sessionMenuItems[0]?.onSelect());
			expect(result.current.isSessionMenuOpen).toBe(false);
			expect(options.onPause).toHaveBeenCalledTimes(1);
		});

		it("'End session' closes the menu and starts the complete flow", () => {
			const { options, result } = renderScene();
			act(() => result.current.onOpenSessionMenu());
			act(() => result.current.sessionMenuItems[1]?.onSelect());
			expect(result.current.isSessionMenuOpen).toBe(false);
			expect(options.onEndSession).toHaveBeenCalledTimes(1);
		});

		it("'Game settings' closes the menu and opens the game settings sheet", () => {
			const { result } = renderScene();
			act(() => result.current.onOpenSessionMenu());
			act(() => result.current.sessionMenuItems[2]?.onSelect());
			expect(result.current.isSessionMenuOpen).toBe(false);
			expect(result.current.isGameSettingsOpen).toBe(true);
		});

		it("'Discard session' closes the menu and opens the confirm dialog", () => {
			const { result } = renderScene();
			act(() => result.current.onOpenSessionMenu());
			act(() => result.current.sessionMenuItems[3]?.onSelect());
			expect(result.current.isSessionMenuOpen).toBe(false);
			expect(result.current.isDiscardOpen).toBe(true);
		});
	});

	describe("player picker", () => {
		it("builds one item per player labeled with name and 1-based seat", () => {
			const { result } = renderScene({
				state: makeState({
					players: [
						{
							id: "tp-1",
							isLoading: false,
							isTemporary: false,
							name: "Alice",
							playerId: "p-1",
							seatPosition: 2,
							tags: [],
						},
						{
							id: "tp-2",
							isLoading: false,
							isTemporary: false,
							name: "Bob",
							playerId: "p-2",
							seatPosition: null,
							tags: [],
						},
					],
				}),
			});
			expect(result.current.playerPickerItems.map((i) => i.label)).toEqual([
				"Alice · Seat 3",
				"Bob",
			]);
		});

		it("selecting a player closes the picker and opens their detail", () => {
			const state = makeState({
				players: [
					{
						id: "tp-1",
						isLoading: false,
						isTemporary: false,
						name: "Alice",
						playerId: "p-1",
						seatPosition: null,
						tags: [],
					},
				],
			});
			const { result } = renderScene({ state });
			act(() => result.current.eventMenuItems[1]?.onSelect());
			expect(result.current.isPlayerPickerOpen).toBe(true);
			act(() => result.current.playerPickerItems[0]?.onSelect());
			expect(result.current.isPlayerPickerOpen).toBe(false);
			expect(state.onPlayerTap).toHaveBeenCalledTimes(1);
			expect(state.onPlayerTap).toHaveBeenCalledWith("p-1");
		});
	});

	describe("discard / scan / game settings", () => {
		it("setIsDiscardOpen toggles the discard dialog", () => {
			const { result } = renderScene();
			act(() => result.current.setIsDiscardOpen(true));
			expect(result.current.isDiscardOpen).toBe(true);
			act(() => result.current.setIsDiscardOpen(false));
			expect(result.current.isDiscardOpen).toBe(false);
		});

		it("setIsScanSheetOpen toggles the screenshot sheet", () => {
			const { result } = renderScene();
			act(() => result.current.setIsScanSheetOpen(true));
			expect(result.current.isScanSheetOpen).toBe(true);
		});

		it("setIsGameSettingsOpen toggles the game settings sheet", () => {
			const { result } = renderScene();
			act(() => result.current.setIsGameSettingsOpen(true));
			expect(result.current.isGameSettingsOpen).toBe(true);
		});
	});
});
