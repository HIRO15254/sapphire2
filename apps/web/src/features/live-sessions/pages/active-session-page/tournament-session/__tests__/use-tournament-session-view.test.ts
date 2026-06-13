import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	updateTimerStartedAt: vi.fn(),
	discard: vi.fn(),
	session: { id: "t1", memo: null } as Record<string, unknown> | null,
	isDiscardPending: false,
	isUpdatingTimer: false,
	lastSessionId: null as string | null,
	sceneState: { scene: "list" },
	lastSceneOptions: null as Record<string, unknown> | null,
	stack: {
		chipPurchaseTypes: [] as Array<{
			chips: number;
			cost: number;
			id: string;
			name: string;
		}>,
		recordStack: vi.fn(),
		purchaseChips: vi.fn(),
		complete: vi.fn(),
		addMemo: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		isStackPending: false,
		isCompletePending: false,
	},
	lastStackOptions: null as Record<string, unknown> | null,
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-session", () => ({
	useTournamentSession: (sessionId: string) => {
		mocks.lastSessionId = sessionId;
		return {
			session: mocks.session,
			isDiscardPending: mocks.isDiscardPending,
			discard: mocks.discard,
			isUpdatingTimer: mocks.isUpdatingTimer,
			updateTimerStartedAt: mocks.updateTimerStartedAt,
		};
	},
}));

vi.mock("@/features/live-sessions/hooks/use-tournament-stack", () => ({
	useTournamentStack: (options: Record<string, unknown>) => {
		mocks.lastStackOptions = options;
		return mocks.stack;
	},
}));

vi.mock("@/features/live-sessions/components/active-session-scene", () => ({
	useActiveSessionSceneState: (options: Record<string, unknown>) => {
		mocks.lastSceneOptions = options;
		return mocks.sceneState;
	},
}));

import { useTournamentSessionView } from "@/features/live-sessions/pages/active-session-page/tournament-session/use-tournament-session-view";

describe("useTournamentSessionView", () => {
	beforeEach(() => {
		mocks.updateTimerStartedAt.mockReset();
		mocks.discard.mockReset();
		mocks.lastSessionId = null;
		mocks.session = { id: "t1", memo: null };
		mocks.isDiscardPending = false;
		mocks.isUpdatingTimer = false;
		mocks.lastSceneOptions = null;
		mocks.lastStackOptions = null;
		mocks.stack.chipPurchaseTypes = [];
		mocks.stack.purchaseChips.mockReset();
		mocks.stack.complete.mockReset();
		mocks.stack.addMemo.mockReset();
		mocks.stack.pause.mockReset();
		mocks.stack.isCompletePending = false;
	});

	describe("initial state", () => {
		it("forwards sessionId into useTournamentSession and useTournamentStack", () => {
			renderHook(() => useTournamentSessionView("t-42"));
			expect(mocks.lastSessionId).toBe("t-42");
			expect(mocks.lastStackOptions).toEqual({ sessionId: "t-42" });
		});

		it("timer dialog starts closed and spreads inner hook data", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isTimerDialogOpen).toBe(false);
			expect(result.current.session).toBe(mocks.session);
			expect(result.current.isDiscardPending).toBe(false);
			expect(result.current.isUpdatingTimer).toBe(false);
		});
	});

	describe("scene state wiring", () => {
		it("passes a normalized hero seat for a valid seat", () => {
			mocks.session = {
				id: "t1",
				memo: null,
				heroSeatPosition: 4,
				tableSize: 8,
			};
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions).toEqual({
				heroSeatPosition: 4,
				sessionId: "t-1",
				sessionType: "tournament",
				tableSize: 8,
			});
		});

		it("passes through a zero hero seat (lower boundary)", () => {
			mocks.session = { id: "t1", memo: null, heroSeatPosition: 0 };
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBe(0);
		});

		it("normalizes a negative hero seat to null", () => {
			mocks.session = { id: "t1", memo: null, heroSeatPosition: -2 };
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBeNull();
		});

		it("normalizes a missing hero seat to null", () => {
			mocks.session = { id: "t1", memo: null };
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBeNull();
		});

		it("normalizes a non-numeric hero seat to null", () => {
			mocks.session = { id: "t1", memo: null, heroSeatPosition: "3" };
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions?.heroSeatPosition).toBeNull();
		});

		it("returns the scene state from useActiveSessionSceneState", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.sceneState).toBe(mocks.sceneState);
		});
	});

	describe("tournament summary derivation", () => {
		it("extracts numeric summary fields", () => {
			mocks.session = {
				id: "t1",
				memo: null,
				summary: { averageStack: 5000, remainingPlayers: 12, totalEntries: 80 },
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tournamentSummary).toEqual({
				averageStack: 5000,
				remainingPlayers: 12,
				totalEntries: 80,
			});
		});

		it("nulls out non-numeric summary fields", () => {
			mocks.session = {
				id: "t1",
				memo: null,
				summary: { averageStack: "5000", remainingPlayers: null },
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tournamentSummary).toEqual({
				averageStack: null,
				remainingPlayers: null,
				totalEntries: null,
			});
		});

		it("survives a session without a summary object", () => {
			mocks.session = { id: "t1", memo: null };
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tournamentSummary).toEqual({
				averageStack: null,
				remainingPlayers: null,
				totalEntries: null,
			});
		});

		it("is null when there is no session", () => {
			mocks.session = null;
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tournamentSummary).toBeNull();
		});
	});

	describe("timer structure derivation", () => {
		it("defaults to no structure when blindLevels are absent", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.blindLevels).toEqual([]);
			expect(result.current.hasStructure).toBe(false);
			expect(result.current.timerStartedAt).toBeNull();
		});

		it("exposes blind levels and timerStartedAt when present", () => {
			const level = {
				ante: null,
				blind1: 100,
				blind2: 200,
				blind3: null,
				id: "l1",
				isBreak: false,
				level: 1,
				minutes: 20,
			};
			const startedAt = new Date("2026-06-01T09:00:00Z");
			mocks.session = {
				id: "t1",
				memo: null,
				blindLevels: [level],
				timerStartedAt: startedAt,
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.blindLevels).toEqual([level]);
			expect(result.current.hasStructure).toBe(true);
			expect(result.current.timerStartedAt).toBe(startedAt);
		});
	});

	describe("handleOpenTimerDialog", () => {
		it("opens the timer dialog", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			expect(result.current.isTimerDialogOpen).toBe(true);
		});
	});

	describe("setIsTimerDialogOpen", () => {
		it("lets the caller close the dialog directly", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			act(() => {
				result.current.setIsTimerDialogOpen(false);
			});
			expect(result.current.isTimerDialogOpen).toBe(false);
		});
	});

	describe("handleClearTimer", () => {
		it("calls updateTimerStartedAt with null and closes the dialog", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			act(() => {
				result.current.handleClearTimer();
			});
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledTimes(1);
			expect(mocks.updateTimerStartedAt).toHaveBeenNthCalledWith(1, null);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});
	});

	describe("handleSubmitTimer", () => {
		it("calls updateTimerStartedAt with the value and closes the dialog", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			const date = new Date("2026-04-24T10:00:00Z");
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			act(() => {
				result.current.handleSubmitTimer(date);
			});
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledTimes(1);
			expect(mocks.updateTimerStartedAt).toHaveBeenNthCalledWith(1, date);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});

		it("still closes the dialog when submit is invoked without opening first", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			const date = new Date("2026-04-24T10:00:00Z");
			act(() => {
				result.current.handleSubmitTimer(date);
			});
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledOnce();
			expect(result.current.isTimerDialogOpen).toBe(false);
		});
	});

	describe("event menu extra items", () => {
		it("lists Buy chips / Memo in that order", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.eventMenuExtraItems.map((i) => i.label)).toEqual([
				"Buy chips",
				"Memo",
			]);
		});

		it("'Buy chips' opens the chip purchase sheet", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isBuyChipsOpen).toBe(false);
			act(() => result.current.eventMenuExtraItems[0]?.onSelect());
			expect(result.current.isBuyChipsOpen).toBe(true);
		});

		it("'Memo' opens the memo sheet", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.eventMenuExtraItems[1]?.onSelect());
			expect(result.current.isMemoOpen).toBe(true);
		});
	});

	describe("event submissions", () => {
		it("handleBuyChipsSubmit records the purchase and closes the sheet", () => {
			const purchase = {
				chips: 10_000,
				cost: 100,
				name: "Add-on",
				sessionChipPurchaseId: "scp-1",
			};
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.eventMenuExtraItems[0]?.onSelect());
			act(() => result.current.handleBuyChipsSubmit(purchase));
			expect(mocks.stack.purchaseChips).toHaveBeenCalledTimes(1);
			expect(mocks.stack.purchaseChips).toHaveBeenCalledWith(purchase);
			expect(result.current.isBuyChipsOpen).toBe(false);
		});

		it("handleMemoSubmit records the memo and closes the sheet", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.eventMenuExtraItems[1]?.onSelect());
			act(() => result.current.handleMemoSubmit("note"));
			expect(mocks.stack.addMemo).toHaveBeenCalledTimes(1);
			expect(mocks.stack.addMemo).toHaveBeenCalledWith("note");
			expect(result.current.isMemoOpen).toBe(false);
		});

		it("exposes chipPurchaseTypes for the purchase sheet options", () => {
			mocks.stack.chipPurchaseTypes = [
				{ chips: 10_000, cost: 100, id: "scp-1", name: "Add-on" },
			];
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.chipPurchaseTypes).toBe(
				mocks.stack.chipPurchaseTypes
			);
		});
	});

	describe("session lifecycle", () => {
		it("onPause pauses the session", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			act(() => result.current.onPause());
			expect(mocks.stack.pause).toHaveBeenCalledTimes(1);
		});

		it("onEndSession opens the complete sheet", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isCompleteOpen).toBe(false);
			act(() => result.current.onEndSession());
			expect(result.current.isCompleteOpen).toBe(true);
		});

		it("handleCompleteSubmit completes the tournament and closes the sheet", () => {
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

		it("exposes isCompletePending from the stack hook", () => {
			mocks.stack.isCompletePending = true;
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isCompletePending).toBe(true);
		});
	});

	describe("discard passthrough", () => {
		it("exposes discard and reflects isDiscardPending", () => {
			mocks.isDiscardPending = true;
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isDiscardPending).toBe(true);
			expect(result.current.discard).toBe(mocks.discard);
		});
	});
});
