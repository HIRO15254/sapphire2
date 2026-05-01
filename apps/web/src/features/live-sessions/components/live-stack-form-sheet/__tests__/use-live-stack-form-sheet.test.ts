import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "@/features/live-sessions/components/live-stack-form-sheet/use-live-stack-form-sheet";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";

const mocks = vi.hoisted(() => ({
	events: [] as { eventType: string; payload: unknown }[],
	setStackAmount: vi.fn(),
	setRemainingPlayers: vi.fn(),
	setTotalEntries: vi.fn(),
}));

vi.mock("@/features/live-sessions/hooks/use-session-form", () => ({
	useStackFormContext: () => ({
		state: { stackAmount: "", allIns: [] },
		setStackAmount: mocks.setStackAmount,
		setAllIns: vi.fn(),
	}),
	useTournamentFormContext: () => ({
		state: {
			stackAmount: "",
			remainingPlayers: "",
			totalEntries: "",
			chipPurchaseCounts: [],
		},
		setStackAmount: mocks.setStackAmount,
		setRemainingPlayers: mocks.setRemainingPlayers,
		setTotalEntries: mocks.setTotalEntries,
		setChipPurchaseCounts: vi.fn(),
	}),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionEvent: {
			list: {
				queryOptions: (input: Record<string, unknown>) => ({
					queryKey: ["sessionEvent", "list", input],
				}),
			},
		},
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: () => ({ data: mocks.events }),
}));

const SESSION_ID = "session-abc";

function wrapper({ children }: { children: ReactNode }) {
	return createElement(StackSheetProvider, null, children);
}

describe("useCashGameStackSheet", () => {
	it("initialises isCompleteOpen=false and defaultFinalStack=undefined", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.defaultFinalStack).toBeUndefined();
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles independently of the stack sheet", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setDefaultFinalStack updates the default value", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.setDefaultFinalStack(5000);
		});
		expect(result.current.defaultFinalStack).toBe(5000);
	});

	it("stackSheet.open / close flips isOpen", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
		act(() => {
			result.current.stackSheet.close();
		});
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("does not call setStackAmount when opened with no events", () => {
		mocks.events = [];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).not.toHaveBeenCalled();
	});

	it("pre-populates stackAmount from the last update_stack event on open", () => {
		mocks.events = [
			{ eventType: "session_start", payload: { buyInAmount: 1000 } },
			{ eventType: "update_stack", payload: { stackAmount: 2500 } },
		];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(1);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("2500");
	});

	it("falls back to session_start buyInAmount when no update_stack events exist", () => {
		mocks.events = [
			{ eventType: "session_start", payload: { buyInAmount: 3000 } },
		];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(1);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("3000");
	});

	it("does not pre-populate again on close (only on open transition)", () => {
		mocks.events = [
			{ eventType: "update_stack", payload: { stackAmount: 1500 } },
		];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(1);
		act(() => {
			result.current.stackSheet.close();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(1);
	});

	it("pre-populates again when the sheet is reopened", () => {
		mocks.events = [
			{ eventType: "update_stack", payload: { stackAmount: 4000 } },
		];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		act(() => {
			result.current.stackSheet.close();
		});
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(2);
		expect(mocks.setStackAmount).toHaveBeenNthCalledWith(1, "4000");
		expect(mocks.setStackAmount).toHaveBeenNthCalledWith(2, "4000");
	});
});

describe("useTournamentStackSheet", () => {
	it("initialises isCompleteOpen=false and exposes the StackSheet context", () => {
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles", () => {
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
	});

	it("does not call setters when opened with no events", () => {
		mocks.events = [];
		mocks.setStackAmount.mockClear();
		mocks.setRemainingPlayers.mockClear();
		mocks.setTotalEntries.mockClear();
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).not.toHaveBeenCalled();
		expect(mocks.setRemainingPlayers).not.toHaveBeenCalled();
		expect(mocks.setTotalEntries).not.toHaveBeenCalled();
	});

	it("pre-populates all fields from the last update_stack event", () => {
		mocks.events = [
			{
				eventType: "update_stack",
				payload: { stackAmount: 8000, remainingPlayers: 12, totalEntries: 50 },
			},
		];
		mocks.setStackAmount.mockClear();
		mocks.setRemainingPlayers.mockClear();
		mocks.setTotalEntries.mockClear();
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledTimes(1);
		expect(mocks.setStackAmount).toHaveBeenCalledWith("8000");
		expect(mocks.setRemainingPlayers).toHaveBeenCalledTimes(1);
		expect(mocks.setRemainingPlayers).toHaveBeenCalledWith("12");
		expect(mocks.setTotalEntries).toHaveBeenCalledTimes(1);
		expect(mocks.setTotalEntries).toHaveBeenCalledWith("50");
	});

	it("sets remainingPlayers and totalEntries to empty string when null in payload", () => {
		mocks.events = [
			{
				eventType: "update_stack",
				payload: {
					stackAmount: 5000,
					remainingPlayers: null,
					totalEntries: null,
				},
			},
		];
		mocks.setStackAmount.mockClear();
		mocks.setRemainingPlayers.mockClear();
		mocks.setTotalEntries.mockClear();
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setRemainingPlayers).toHaveBeenCalledWith("");
		expect(mocks.setTotalEntries).toHaveBeenCalledWith("");
	});

	it("uses the most recent update_stack event when multiple exist", () => {
		mocks.events = [
			{ eventType: "update_stack", payload: { stackAmount: 1000 } },
			{ eventType: "update_stack", payload: { stackAmount: 9999 } },
		];
		mocks.setStackAmount.mockClear();
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: SESSION_ID }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(mocks.setStackAmount).toHaveBeenCalledWith("9999");
	});
});
