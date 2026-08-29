import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCompactNumber, formatNumber } from "@/utils/format-number";

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
		discard: vi.fn(),
		events: [] as Array<{
			eventType: string;
			id: string;
			occurredAt: string;
			payload: unknown;
		}>,
		isDiscardPending: false,
		isUpdatingTimer: false,
		sceneState: {
			onRemovePlayer: vi.fn(),
			seats: [] as MockSeat[],
		} as MockSceneState,
		session: null as Record<string, unknown> | null,
		stack: {
			addMemo: vi.fn(),
			chipPurchaseTypes: [] as Array<{
				chips: number;
				cost: number;
				id: string;
				name: string;
			}>,
			complete: vi.fn(),
			isCompletePending: false,
			isStackPending: false,
			pause: vi.fn(),
			purchaseChips: vi.fn(),
			recordStack: vi.fn(),
			resume: vi.fn(),
		},
		updateTimerStartedAt: vi.fn(),
		useActiveSessionSceneState: vi.fn(),
		useSessionEvents: vi.fn(),
		useTournamentSession: vi.fn(),
		useTournamentStack: vi.fn(),
	};
	state.useTournamentSession.mockImplementation(() => ({
		discard: state.discard,
		isDiscardPending: state.isDiscardPending,
		isUpdatingTimer: state.isUpdatingTimer,
		session: state.session,
		updateTimerStartedAt: state.updateTimerStartedAt,
	}));
	state.useTournamentStack.mockImplementation(() => state.stack);
	state.useSessionEvents.mockImplementation(() => ({ events: state.events }));
	state.useActiveSessionSceneState.mockImplementation(() => state.sceneState);
	return state;
});

vi.mock("@/features/live-sessions/hooks/use-tournament-session", () => ({
	useTournamentSession: mocks.useTournamentSession,
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-stack", () => ({
	useTournamentStack: mocks.useTournamentStack,
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

import { useTournamentSessionView } from "@/features/live-sessions/pages/active-session-page/tournament-session/use-tournament-session-view";

function makeSession(
	overrides: Record<string, unknown> = {}
): Record<string, unknown> {
	return {
		blindLevels: [],
		heroSeatPosition: null,
		id: "t-1",
		status: "active",
		summary: {
			averageStack: null,
			currentStack: null,
			remainingPlayers: null,
			totalEntries: null,
		},
		tableSize: 9,
		timerStartedAt: null,
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

describe("useTournamentSessionView", () => {
	beforeEach(() => {
		mocks.discard.mockReset();
		mocks.events = [];
		mocks.isDiscardPending = false;
		mocks.isUpdatingTimer = false;
		mocks.sceneState = { onRemovePlayer: vi.fn(), seats: [] };
		mocks.session = null;
		for (const fn of Object.values(mocks.stack)) {
			if (typeof fn === "function") {
				(fn as ReturnType<typeof vi.fn>).mockReset();
			}
		}
		mocks.stack.chipPurchaseTypes = [];
		mocks.stack.isStackPending = false;
		mocks.stack.isCompletePending = false;
		mocks.updateTimerStartedAt.mockReset();
		mocks.useActiveSessionSceneState.mockClear();
		mocks.useSessionEvents.mockClear();
		mocks.useTournamentSession.mockClear();
		mocks.useTournamentStack.mockClear();
	});

	describe("wiring to data hooks", () => {
		it("forwards sessionId into every data hook", () => {
			renderHook(() => useTournamentSessionView("t-42"));
			expect(mocks.useTournamentSession).toHaveBeenCalledWith("t-42");
			expect(mocks.useTournamentStack).toHaveBeenCalledWith({
				sessionId: "t-42",
			});
			expect(mocks.useSessionEvents).toHaveBeenCalledWith({
				refetchInterval: EVENTS_REFETCH_MS,
				sessionId: "t-42",
				sessionType: "tournament",
			});
		});
	});

	describe("hero seat normalization", () => {
		it("keeps a positive hero seat", () => {
			mocks.session = makeSession({ heroSeatPosition: 4 });
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith({
				heroSeatPosition: 4,
				sessionId: "t-1",
				sessionType: "tournament",
				tableSize: 9,
			});
		});

		it("keeps hero seat 0 (lower boundary)", () => {
			mocks.session = makeSession({ heroSeatPosition: 0 });
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: 0 })
			);
		});

		it("normalizes a negative hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: -2 });
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});

		it("normalizes an undefined hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: undefined });
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});

		it("normalizes a non-numeric hero seat to null", () => {
			mocks.session = makeSession({ heroSeatPosition: "3" });
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.useActiveSessionSceneState).toHaveBeenCalledWith(
				expect.objectContaining({ heroSeatPosition: null })
			);
		});
	});

	describe("isPaused", () => {
		it("is true when session.status is paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isPaused).toBe(true);
		});

		it("is false when session.status is active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isPaused).toBe(false);
		});

		it("is false when there is no session", () => {
			mocks.session = null;
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isPaused).toBe(false);
		});
	});

	describe("tableCenter", () => {
		it("shows dashes when currentStack, averageStack, remaining and entries are all null", () => {
			mocks.session = makeSession();
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableCenter.stackText).toBe("—");
			expect(result.current.tableCenter.averageStackText).toBe("—");
			expect(result.current.tableCenter.remainText).toBe("—");
		});

		it("formats currentStack and averageStack when present", () => {
			mocks.session = makeSession({
				summary: {
					averageStack: 8500,
					currentStack: 12_000,
					remainingPlayers: null,
					totalEntries: null,
				},
			});
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableCenter.stackText).toBe(formatNumber(12_000));
			expect(result.current.tableCenter.averageStackText).toBe(
				formatCompactNumber(8500)
			);
		});

		it("shows both remainingPlayers and totalEntries when present", () => {
			mocks.session = makeSession({
				summary: {
					averageStack: null,
					currentStack: null,
					remainingPlayers: 45,
					totalEntries: 120,
				},
			});
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableCenter.remainText).toBe("45/120");
		});

		it("falls back to a dash for a missing remainingPlayers", () => {
			mocks.session = makeSession({
				summary: {
					averageStack: null,
					currentStack: null,
					remainingPlayers: null,
					totalEntries: 120,
				},
			});
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableCenter.remainText).toBe("—/120");
		});

		it("falls back to a dash for a missing totalEntries", () => {
			mocks.session = makeSession({
				summary: {
					averageStack: null,
					currentStack: null,
					remainingPlayers: 45,
					totalEntries: null,
				},
			});
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableCenter.remainText).toBe("45/—");
		});
	});

	describe("pause guards", () => {
		it("blocks onEmptySeatTap while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEmptySeatTap(2));
			expect(result.current.joinSeatPosition).toBeNull();
		});

		it("allows onEmptySeatTap while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEmptySeatTap(2));
			expect(result.current.joinSeatPosition).toBe(2);
		});

		it("blocks onPlayerSeatTap while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			mocks.sceneState = {
				onRemovePlayer: vi.fn(),
				seats: [{ player: { name: "Alice", playerId: "p1" }, seatPosition: 2 }],
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() =>
				result.current.onPlayerSeatTap({
					playerId: "p1",
					playerName: "Alice",
					seatPosition: 2,
				})
			);
			expect(result.current.selection).toBeNull();
		});

		it("blocks onOpenBuyChips while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenBuyChips());
			expect(result.current.isBuyChipsOpen).toBe(false);
		});

		it("allows onOpenBuyChips while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenBuyChips());
			expect(result.current.isBuyChipsOpen).toBe(true);
		});

		it("blocks onScanFromTable while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onScanFromTable());
			expect(result.current.isScanOpen).toBe(false);
		});

		it("allows onScanFromTable while active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onScanFromTable());
			expect(result.current.isScanOpen).toBe(true);
		});

		it("allows onOpenMemo while paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
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
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
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
				useTournamentSessionView("t-1")
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
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
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
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEmptySeatTap(4));
			act(() => result.current.onCloseJoin());
			expect(result.current.joinSeatPosition).toBeNull();
		});

		it("onScanFromJoin closes the join sheet and opens the scan sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEmptySeatTap(4));
			act(() => result.current.onScanFromJoin());
			expect(result.current.joinSeatPosition).toBeNull();
			expect(result.current.isScanOpen).toBe(true);
		});
	});

	describe("event submissions", () => {
		it("handleBuyChipsSubmit records the purchase and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const purchase = {
				chips: 10_000,
				cost: 100,
				name: "Add-on",
				sessionChipPurchaseId: "scp-1",
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenBuyChips());
			act(() => result.current.handleBuyChipsSubmit(purchase));
			expect(mocks.stack.purchaseChips).toHaveBeenCalledTimes(1);
			expect(mocks.stack.purchaseChips).toHaveBeenCalledWith(purchase);
			expect(result.current.isBuyChipsOpen).toBe(false);
		});

		it("handleMemoSubmit records the memo and closes the sheet", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenMemo());
			act(() => result.current.handleMemoSubmit("note"));
			expect(mocks.stack.addMemo).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addMemo).toHaveBeenCalledWith("note");
			expect(result.current.isMemoOpen).toBe(false);
		});

		it("exposes chipPurchaseTypes from the stack hook", () => {
			mocks.stack.chipPurchaseTypes = [
				{ chips: 10_000, cost: 100, id: "scp-1", name: "Add-on" },
			];
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.chipPurchaseTypes).toBe(
				mocks.stack.chipPurchaseTypes
			);
		});
	});

	describe("handleCompleteSubmit", () => {
		it("completes before the deadline and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const values = {
				beforeDeadline: true as const,
				bountyPrizes: 0,
				prizeMoney: 5000,
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEndSession());
			act(() => result.current.handleCompleteSubmit(values));
			expect(mocks.stack.complete).toHaveBeenCalledTimes(1);
			expect(mocks.stack.complete).toHaveBeenCalledWith(values);
			expect(result.current.isCompleteOpen).toBe(false);
		});

		it("completes after the deadline with placement and totalEntries and closes the sheet", () => {
			mocks.session = makeSession({ status: "active" });
			const values = {
				beforeDeadline: false as const,
				bountyPrizes: 100,
				placement: 3,
				prizeMoney: 5000,
				totalEntries: 80,
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onEndSession());
			act(() => result.current.handleCompleteSubmit(values));
			expect(mocks.stack.complete).toHaveBeenCalledTimes(1);
			expect(mocks.stack.complete).toHaveBeenCalledWith(values);
			expect(result.current.isCompleteOpen).toBe(false);
		});
	});

	describe("timer dialog", () => {
		it("onOpenTimerDialog opens the timer dialog", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenTimerDialog());
			expect(result.current.isTimerDialogOpen).toBe(true);
		});

		it("handleClearTimer calls updateTimerStartedAt with null and closes the dialog", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenTimerDialog());
			act(() => result.current.handleClearTimer());
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledTimes(1);
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledWith(null);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});

		it("handleSubmitTimer calls updateTimerStartedAt with the value and closes the dialog", () => {
			const date = new Date("2026-04-24T10:00:00Z");
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onOpenTimerDialog());
			act(() => result.current.handleSubmitTimer(date));
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledTimes(1);
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledWith(date);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});
	});

	describe("onTogglePause", () => {
		it("resumes exactly once when paused", () => {
			mocks.session = makeSession({ status: "paused" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onTogglePause());
			expect(mocks.stack.resume).toHaveBeenCalledTimes(1);
			expect(mocks.stack.pause).toHaveBeenCalledTimes(0);
		});

		it("pauses exactly once when active", () => {
			mocks.session = makeSession({ status: "active" });
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onTogglePause());
			expect(mocks.stack.pause).toHaveBeenCalledTimes(1);
			expect(mocks.stack.resume).toHaveBeenCalledTimes(0);
		});
	});

	describe("onOpenRule", () => {
		it("opens the rule sheet", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isRuleOpen).toBe(false);
			act(() => result.current.onOpenRule());
			expect(result.current.isRuleOpen).toBe(true);
		});
	});

	describe("lastStackUpdatedAt", () => {
		it("is null when no update_stack event exists", () => {
			mocks.events = [makeEvent("memo", "2026-06-01T10:00:00Z")];
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.lastStackUpdatedAt).toBeNull();
		});

		it("reflects the latest update_stack event from the events hook", () => {
			mocks.events = [
				makeEvent("update_stack", "2026-06-01T10:00:00Z"),
				makeEvent("update_stack", "2026-06-01T10:20:00Z"),
			];
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.lastStackUpdatedAt).toBe("2026-06-01T10:20:00Z");
		});
	});

	describe("handleRecordStack", () => {
		it("passes through the values verbatim", () => {
			const values = {
				remainingPlayers: 40,
				stackAmount: 15_000,
				totalEntries: 80,
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.handleRecordStack(values));
			expect(mocks.stack.recordStack).toHaveBeenCalledTimes(1);
			expect(mocks.stack.recordStack).toHaveBeenCalledWith(values);
		});
	});
});
