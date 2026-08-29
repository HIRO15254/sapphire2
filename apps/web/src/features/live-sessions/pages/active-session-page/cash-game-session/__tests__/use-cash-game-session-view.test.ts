import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatNumber } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";

const EVENTS_REFETCH_MS = 30_000;

interface MockSeat {
	player: { name: string; playerId: string } | null;
	seatPosition: number;
}

interface MockSceneState {
	onRemovePlayer: ReturnType<typeof vi.fn>;
	seats: MockSeat[];
}

const mocks = vi.hoisted(() => {
	const state = {
		session: null as Record<string, unknown> | null,
		isDiscardPending: false,
		discard: vi.fn(),
		events: [] as Array<{
			eventType: string;
			id: string;
			occurredAt: string;
			payload: unknown;
		}>,
		sceneState: {
			onRemovePlayer: vi.fn(),
			seats: [] as MockSeat[],
		} as MockSceneState,
		stack: {
			addAllIn: vi.fn(),
			adjustChips: vi.fn(),
			addMemo: vi.fn(),
			complete: vi.fn(),
			isCompletePending: false,
			isStackPending: false,
			pause: vi.fn(),
			recordStack: vi.fn(),
			resume: vi.fn(),
		},
		useActiveSessionSceneState: vi.fn(),
		useCashGameSession: vi.fn(),
		useCashGameStack: vi.fn(),
		useSessionEvents: vi.fn(),
	};
	state.useCashGameSession.mockImplementation(() => ({
		discard: state.discard,
		isDiscardPending: state.isDiscardPending,
		session: state.session,
	}));
	state.useCashGameStack.mockImplementation(() => state.stack);
	state.useSessionEvents.mockImplementation(() => ({ events: state.events }));
	state.useActiveSessionSceneState.mockImplementation(() => state.sceneState);
	return state;
});

vi.mock("@/features/live-sessions/hooks/use-cash-game-session", () => ({
	useCashGameSession: mocks.useCashGameSession,
}));

vi.mock("@/features/live-sessions/hooks/use-cash-game-stack", () => ({
	useCashGameStack: mocks.useCashGameStack,
}));

vi.mock("@/features/live-sessions/hooks/use-session-events", () => ({
	useSessionEvents: mocks.useSessionEvents,
}));

vi.mock(
	"@/features/live-sessions/hooks/use-active-session-scene-state",
	() => ({
		useActiveSessionSceneState: mocks.useActiveSessionSceneState,
	})
);

import { useCashGameSessionView } from "@/features/live-sessions/pages/active-session-page/cash-game-session/use-cash-game-session-view";
import {
	deltaToneOf,
	findLastStackUpdateAt,
} from "@/features/live-sessions/utils/live-session-view";

function makeSession(
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		heroSeatPosition: null,
		id: "cg-1",
		startedAt: new Date("2026-06-01T10:00:00Z"),
		status: "active",
		summary: {
			chipRemoveTotal: 0,
			currentStack: 1500,
			evDiff: 0,
			totalBuyIn: 1000,
		},
		tableSize: 6,
		...overrides,
	};
}

function makeEvent(
	eventType: string,
	occurredAt: string,
	overrides: Record<string, unknown> = {}
): { eventType: string; id: string; occurredAt: string; payload: unknown } {
	return {
		eventType,
		id: `evt-${occurredAt}`,
		occurredAt,
		payload: {},
		...overrides,
	} as { eventType: string; id: string; occurredAt: string; payload: unknown };
}

describe("useCashGameSessionView", () => {
	beforeEach(() => {
		mocks.session = null;
		mocks.isDiscardPending = false;
		mocks.discard.mockReset();
		mocks.events = [];
		mocks.sceneState = { onRemovePlayer: vi.fn(), seats: [] };
		for (const fn of Object.values(mocks.stack)) {
			if (typeof fn === "function") {
				(fn as ReturnType<typeof vi.fn>).mockReset();
			}
		}
		mocks.stack.isStackPending = false;
		mocks.stack.isCompletePending = false;
		mocks.useCashGameSession.mockClear();
		mocks.useCashGameStack.mockClear();
		mocks.useSessionEvents.mockClear();
		mocks.useActiveSessionSceneState.mockClear();
	});

	describe("wiring to data hooks", () => {
		it("forwards sessionId into every data hook", () => {
			renderHook(() => useCashGameSessionView("cg-42"));
			expect(mocks.useCashGameSession).toHaveBeenCalledWith("cg-42");
			expect(mocks.useCashGameStack).toHaveBeenCalledWith({
				sessionId: "cg-42",
			});
			expect(mocks.useSessionEvents).toHaveBeenCalledWith({
				refetchInterval: EVENTS_REFETCH_MS,
				sessionId: "cg-42",
				sessionType: "cash_game",
			});
		});
	});

	describe("hero seat normalization", () => {
		it("keeps a positive hero seat", () => {
			mocks.session = makeSession({ heroSeatPosition: 3 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith({
				heroSeatPosition: 3,
				sessionId: "cg-1",
				sessionType: "cash_game",
				tableSize: 6,
			});
		});

		it("keeps hero seat 0 (lower boundary)", () => {
			mocks.session = makeSession({ heroSeatPosition: 0 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: 0 })
			);
		});

		it("normalizes a negative hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: -1 });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});

		it("normalizes an undefined hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: undefined });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});

		it("normalizes a non-numeric hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: "2" });
			renderHook(() => useCashGameSessionView("cg-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});
	});

	describe("isPaused", () => {
		it("is true when session.status is paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isPaused).toBe(true);
		});

		it("is false when session.status is active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isPaused).toBe(false);
		});

		it("is false when there is no session", () => {
			mocks.session = null;
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isPaused).toBe(false);
		});
	});

	describe("tableCenter", () => {
		it("shows a dash and no delta when currentStack is null", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: null,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.stackText).toBe("—");
			expect(result.current.tableCenter.deltaText).toBeUndefined();
			expect(result.current.tableCenter.deltaTone).toBe("neutral");
			expect(result.current.tableCenter.evText).toBeUndefined();
		});

		it("renders a positive P/L as a positive delta", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: 1500,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.stackText).toBe(formatNumber(1500));
			expect(result.current.tableCenter.deltaTone).toBe("positive");
			expect(result.current.tableCenter.deltaText).toBe(formatProfitLoss(500));
		});

		it("renders a negative P/L as a negative delta", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: 500,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.deltaTone).toBe("negative");
			expect(result.current.tableCenter.deltaText).toBe(formatProfitLoss(-500));
		});

		it("renders a zero P/L as a neutral delta", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: 1000,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.deltaTone).toBe("neutral");
			expect(result.current.tableCenter.deltaText).toBe(formatProfitLoss(0));
		});

		it("omits evText when evDiff is zero", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: 1500,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.evText).toBeUndefined();
		});

		it("shows evText when evDiff is nonzero and evPL differs from displayPL", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: 1500,
					evDiff: 200,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.evText).toBe(formatProfitLoss(700));
		});

		it("omits evText when currentStack is null even with a nonzero evDiff", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 0,
					currentStack: null,
					evDiff: 200,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.tableCenter.evText).toBeUndefined();
		});
	});

	describe("findLastStackUpdateAt", () => {
		it("returns null for an empty event list", () => {
			expect(findLastStackUpdateAt([])).toBeNull();
		});

		it("returns null when no event is update_stack", () => {
			expect(
				findLastStackUpdateAt([
					makeEvent("chips_add_remove", "2026-06-01T10:00:00Z"),
					makeEvent("memo", "2026-06-01T10:05:00Z"),
				])
			).toBeNull();
		});

		it("returns the latest update_stack occurredAt among several events", () => {
			expect(
				findLastStackUpdateAt([
					makeEvent("update_stack", "2026-06-01T10:00:00Z"),
					makeEvent("chips_add_remove", "2026-06-01T10:05:00Z"),
					makeEvent("update_stack", "2026-06-01T10:10:00Z"),
				])
			).toBe("2026-06-01T10:10:00Z");
		});
	});

	describe("deltaToneOf", () => {
		it("returns neutral for null", () => {
			expect(deltaToneOf(null)).toBe("neutral");
		});

		it("returns neutral for zero", () => {
			expect(deltaToneOf(0)).toBe("neutral");
		});

		it("returns positive for a positive value", () => {
			expect(deltaToneOf(100)).toBe("positive");
		});

		it("returns negative for a negative value", () => {
			expect(deltaToneOf(-100)).toBe("negative");
		});
	});

	describe("pause guards", () => {
		it("blocks onEmptySeatTap while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEmptySeatTap(2));
			expect(result.current.joinSeatPosition).toBeNull();
		});

		it("allows onEmptySeatTap while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEmptySeatTap(2));
			expect(result.current.joinSeatPosition).toBe(2);
		});

		it("blocks onPlayerSeatTap while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			mocks.sceneState = {
				onRemovePlayer: vi.fn(),
				seats: [{ player: { name: "Alice", playerId: "p1" }, seatPosition: 2 }],
			};
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() =>
				result.current.onPlayerSeatTap({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			expect(result.current.selection).toBeNull();
		});

		it("blocks onOpenAllIn while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenAllIn());
			expect(result.current.isAllInOpen).toBe(false);
		});

		it("allows onOpenAllIn while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenAllIn());
			expect(result.current.isAllInOpen).toBe(true);
		});

		it("blocks onOpenChips while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenChips());
			expect(result.current.isChipsOpen).toBe(false);
		});

		it("allows onOpenChips while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenChips());
			expect(result.current.isChipsOpen).toBe(true);
		});

		it("blocks onScanFromTable while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onScanFromTable());
			expect(result.current.isScanOpen).toBe(false);
		});

		it("allows onScanFromTable while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onScanFromTable());
			expect(result.current.isScanOpen).toBe(true);
		});

		it("allows onOpenMemo while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenMemo());
			expect(result.current.isMemoOpen).toBe(true);
		});
	});

	describe("selection lifecycle", () => {
		it("sets selection when tapping a seated player", () => {
			mocks.session = makeSession({ status: "active" });
			mocks.sceneState = {
				onRemovePlayer: vi.fn(),
				seats: [{ player: { name: "Alice", playerId: "p1" }, seatPosition: 2 }],
			};
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() =>
				result.current.onPlayerSeatTap({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			expect(result.current.selection).toEqual({
				playerId: "p1",
				playerName: "Alice",
				seatPosition: 2,
			});
		});

		it("clears selection once the seated player leaves the scene state", () => {
			mocks.session = makeSession({ status: "active" });
			mocks.sceneState = {
				onRemovePlayer: vi.fn(),
				seats: [{ player: { name: "Alice", playerId: "p1" }, seatPosition: 2 }],
			};
			const { rerender, result } = renderHook(() =>
				useCashGameSessionView("cg-1")
			);
			act(() =>
				result.current.onPlayerSeatTap({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			expect(result.current.selection).not.toBeNull();

			mocks.sceneState.seats = [];
			rerender();
			expect(result.current.selection).toBeNull();
		});

		it("calls sceneState.onRemovePlayer once and clears selection on leave", () => {
			mocks.session = makeSession({ status: "active" });
			const onRemovePlayer = vi.fn();
			mocks.sceneState = {
				onRemovePlayer,
				seats: [{ player: { name: "Alice", playerId: "p1" }, seatPosition: 2 }],
			};
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() =>
				result.current.onPlayerSeatTap({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			act(() =>
				result.current.onLeavePlayer({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			expect(onRemovePlayer).toHaveBeenCalledTimes(1);
			expect(onRemovePlayer).toHaveBeenCalledWith("p1");
			expect(result.current.selection).toBeNull();
		});
	});

	describe("join sheet", () => {
		it("onCloseJoin clears the join seat position", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEmptySeatTap(4));
			act(() => result.current.onCloseJoin());
			expect(result.current.joinSeatPosition).toBeNull();
		});

		it("onScanFromJoin closes the join sheet and opens the scan sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEmptySeatTap(4));
			act(() => result.current.onScanFromJoin());
			expect(result.current.joinSeatPosition).toBeNull();
			expect(result.current.isScanOpen).toBe(true);
		});
	});

	describe("chips sheet state (single sheet, no chip menu)", () => {
		it("starts closed and setIsChipsOpen toggles it directly", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isChipsOpen).toBe(false);
			act(() => result.current.setIsChipsOpen(true));
			expect(result.current.isChipsOpen).toBe(true);
		});
	});

	describe("event submissions", () => {
		it("handleAllInSubmit records the all-in and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const values = { equity: 50, potSize: 900, trials: 1, wins: 1 };
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenAllIn());
			act(() => result.current.handleAllInSubmit(values));
			expect(mocks.stack.addAllIn).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addAllIn).toHaveBeenCalledWith(values);
			expect(result.current.isAllInOpen).toBe(false);
		});

		it("handleChipsSubmit forwards a positive (add) amount and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenChips());
			act(() => result.current.handleChipsSubmit({ amount: 300 }));
			expect(mocks.stack.adjustChips).toHaveBeenCalledTimes(1);
			expect(mocks.stack.adjustChips).toHaveBeenCalledWith(300);
			expect(result.current.isChipsOpen).toBe(false);
		});

		it("handleChipsSubmit forwards a negative (withdraw) amount and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenChips());
			act(() => result.current.handleChipsSubmit({ amount: -200 }));
			expect(mocks.stack.adjustChips).toHaveBeenCalledTimes(1);
			expect(mocks.stack.adjustChips).toHaveBeenCalledWith(-200);
			expect(result.current.isChipsOpen).toBe(false);
		});

		it("handleMemoSubmit records the memo and closes the sheet", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onOpenMemo());
			act(() => result.current.handleMemoSubmit("note"));
			expect(mocks.stack.addMemo).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addMemo).toHaveBeenCalledWith("note");
			expect(result.current.isMemoOpen).toBe(false);
		});

		it("handleCompleteSubmit completes the session and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onEndSession());
			act(() => result.current.handleCompleteSubmit({ finalStack: 2500 }));
			expect(mocks.stack.complete).toHaveBeenCalledTimes(1);
			expect(mocks.stack.complete).toHaveBeenCalledWith({ finalStack: 2500 });
			expect(result.current.isCompleteOpen).toBe(false);
		});
	});

	describe("completePreviewInput", () => {
		it("maps a zero evDiff to null", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 50,
					currentStack: 1500,
					evDiff: 0,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.completePreviewInput).toEqual({
				chipRemoveTotal: 50,
				evDiff: null,
				totalBuyIn: 1000,
			});
		});

		it("passes through a nonzero evDiff unchanged", () => {
			mocks.session = makeSession({
				summary: {
					chipRemoveTotal: 50,
					currentStack: 1500,
					evDiff: 200,
					totalBuyIn: 1000,
				},
			});
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.completePreviewInput).toEqual({
				chipRemoveTotal: 50,
				evDiff: 200,
				totalBuyIn: 1000,
			});
		});
	});

	describe("onTogglePause", () => {
		it("resumes exactly once when paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onTogglePause());
			expect(mocks.stack.resume).toHaveBeenCalledTimes(1);
			expect(mocks.stack.pause).toHaveBeenCalledTimes(0);
		});

		it("pauses exactly once when active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.onTogglePause());
			expect(mocks.stack.pause).toHaveBeenCalledTimes(1);
			expect(mocks.stack.resume).toHaveBeenCalledTimes(0);
		});
	});

	describe("onOpenRule", () => {
		it("opens the rule sheet", () => {
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.isRuleOpen).toBe(false);
			act(() => result.current.onOpenRule());
			expect(result.current.isRuleOpen).toBe(true);
		});
	});

	describe("lastStackUpdatedAt", () => {
		it("is null when no update_stack event exists", () => {
			mocks.events = [makeEvent("memo", "2026-06-01T10:00:00Z")];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.lastStackUpdatedAt).toBeNull();
		});

		it("reflects the latest update_stack event from the events hook", () => {
			mocks.events = [
				makeEvent("update_stack", "2026-06-01T10:00:00Z"),
				makeEvent("update_stack", "2026-06-01T10:20:00Z"),
			];
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			expect(result.current.lastStackUpdatedAt).toBe("2026-06-01T10:20:00Z");
		});
	});

	describe("handleRecordStack", () => {
		it("passes through the values verbatim", () => {
			const values = { stackAmount: 777 };
			const { result } = renderHook(() => useCashGameSessionView("cg-1"));
			act(() => result.current.handleRecordStack(values));
			expect(mocks.stack.recordStack).toHaveBeenCalledTimes(1);
			expect(mocks.stack.recordStack).toHaveBeenCalledWith(values);
		});
	});
});
