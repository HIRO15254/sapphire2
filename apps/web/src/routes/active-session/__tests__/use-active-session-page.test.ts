import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	updateTimerStartedAt: vi.fn(),
	discard: vi.fn(),
	session: { id: "t1", memo: null } as unknown as Record<string, unknown>,
	isDiscardPending: false,
	isUpdatingTimer: false,
	lastSessionId: null as string | null,
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

import { useTournamentSessionPage } from "@/routes/active-session/-use-active-session-page";

describe("useTournamentSessionPage", () => {
	beforeEach(() => {
		mocks.updateTimerStartedAt.mockReset();
		mocks.discard.mockReset();
		mocks.lastSessionId = null;
		mocks.isDiscardPending = false;
		mocks.isUpdatingTimer = false;
	});

	describe("initial state", () => {
		it("forwards sessionId into useTournamentSession", () => {
			renderHook(() => useTournamentSessionPage("t-42"));
			expect(mocks.lastSessionId).toBe("t-42");
		});

		it("timer dialog starts closed and spreads inner hook data", () => {
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
			expect(result.current.isTimerDialogOpen).toBe(false);
			expect(result.current.session).toBe(mocks.session);
			expect(result.current.isDiscardPending).toBe(false);
			expect(result.current.isUpdatingTimer).toBe(false);
		});
	});

	describe("handleOpenTimerDialog", () => {
		it("opens the timer dialog", () => {
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			expect(result.current.isTimerDialogOpen).toBe(true);
		});
	});

	describe("setIsTimerDialogOpen", () => {
		it("lets the caller close the dialog directly", () => {
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
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
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			act(() => {
				result.current.handleClearTimer();
			});
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledWith(null);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});
	});

	describe("handleSubmitTimer", () => {
		it("calls updateTimerStartedAt with the value and closes the dialog", () => {
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
			const date = new Date("2026-04-24T10:00:00Z");
			act(() => {
				result.current.handleOpenTimerDialog();
			});
			act(() => {
				result.current.handleSubmitTimer(date);
			});
			expect(mocks.updateTimerStartedAt).toHaveBeenCalledWith(date);
			expect(result.current.isTimerDialogOpen).toBe(false);
		});

		it("still closes the dialog when submit is invoked without opening first", () => {
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
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
			const { result } = renderHook(() => useTournamentSessionPage("t-1"));
			expect(result.current.isDiscardPending).toBe(true);
			expect(result.current.discard).toBe(mocks.discard);
		});
	});
});
