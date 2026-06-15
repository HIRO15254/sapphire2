import { IconCoin } from "@tabler/icons-react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useActiveSessionScene } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene";
import type { ActiveSessionSceneState } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

function makeState(
	overrides: Partial<ActiveSessionSceneState> = {}
): ActiveSessionSceneState {
	return {
		excludePlayerIds: [],
		heroAvailable: true,
		heroSeatPosition: null,
		occupiedSeatPositions: new Set<number>(),
		onRemovePlayer: vi.fn(),
		onSeatExisting: vi.fn(),
		onSeatHero: vi.fn(),
		onSeatNew: vi.fn(),
		onSeatTemporary: vi.fn(),
		onUnseatHero: vi.fn(),
		seats: [],
		sessionParam: { liveCashGameSessionId: "s-1" },
		tableSize: 9,
		unseatedPlayers: [],
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

	describe("session menu (header)", () => {
		it("lists the lifecycle actions when there are no extra event items", () => {
			const { result } = renderScene();
			expect(result.current.sessionMenuItems.map((i) => i.label)).toEqual([
				"Pause session",
				"End session",
				"Game settings",
				"Discard session",
			]);
		});

		it("prepends the type-specific event items above the lifecycle actions", () => {
			const { result } = renderScene({
				eventMenuExtraItems: [
					{ icon: IconCoin, label: "All-in", onSelect: vi.fn() },
					{ icon: IconCoin, label: "Memo", onSelect: vi.fn() },
				],
			});
			expect(result.current.sessionMenuItems.map((i) => i.label)).toEqual([
				"All-in",
				"Memo",
				"Pause session",
				"End session",
				"Game settings",
				"Discard session",
			]);
		});

		it("marks only the discard item as destructive", () => {
			const { result } = renderScene({
				eventMenuExtraItems: [
					{ icon: IconCoin, label: "All-in", onSelect: vi.fn() },
				],
			});
			expect(
				result.current.sessionMenuItems.map((i) => i.tone ?? "default")
			).toEqual(["default", "default", "default", "default", "destructive"]);
		});

		it("opens via onOpenSessionMenu", () => {
			const { result } = renderScene();
			expect(result.current.isSessionMenuOpen).toBe(false);
			act(() => result.current.onOpenSessionMenu());
			expect(result.current.isSessionMenuOpen).toBe(true);
		});

		it("an extra event item closes the menu before running its own action", () => {
			const extra = vi.fn();
			const { result } = renderScene({
				eventMenuExtraItems: [
					{ icon: IconCoin, label: "All-in", onSelect: extra },
				],
			});
			act(() => result.current.onOpenSessionMenu());
			act(() => result.current.sessionMenuItems[0]?.onSelect());
			expect(result.current.isSessionMenuOpen).toBe(false);
			expect(extra).toHaveBeenCalledTimes(1);
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
