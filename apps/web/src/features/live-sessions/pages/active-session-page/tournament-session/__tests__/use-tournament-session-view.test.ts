import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	updateTimerStartedAt: vi.fn(),
	discard: vi.fn(),
	session: { id: "t1", memo: null } as Record<string, unknown> | null,
	isDiscardPending: false,
	isUpdatingTimer: false,
	lastSessionId: null as string | null,
	sceneState: { scene: "table" },
	lastSceneOptions: null as Record<string, unknown> | null,
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
	});

	describe("initial state", () => {
		it("forwards sessionId into useTournamentSession", () => {
			renderHook(() => useTournamentSessionView("t-42"));
			expect(mocks.lastSessionId).toBe("t-42");
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
			mocks.session = { id: "t1", memo: null, heroSeatPosition: 4 };
			renderHook(() => useTournamentSessionView("t-1"));
			expect(mocks.lastSceneOptions).toEqual({
				heroSeatPosition: 4,
				sessionId: "t-1",
				sessionType: "tournament",
			});
		});

		it("normalizes a negative or missing hero seat to null", () => {
			mocks.session = { id: "t1", memo: null, heroSeatPosition: -2 };
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

	describe("tableSize", () => {
		it("defaults to null when absent", () => {
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableSize).toBeNull();
		});

		it("passes through a numeric table size", () => {
			mocks.session = { id: "t1", memo: null, tableSize: 8 };
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.tableSize).toBe(8);
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

	describe("discard passthrough", () => {
		it("exposes discard and reflects isDiscardPending", () => {
			mocks.isDiscardPending = true;
			const { result } = renderHook(() => useTournamentSessionView("t-1"));
			expect(result.current.isDiscardPending).toBe(true);
			expect(result.current.discard).toBe(mocks.discard);
		});
	});
});
