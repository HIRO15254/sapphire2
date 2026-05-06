import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "@/features/live-sessions/components/live-stack-form-sheet/use-live-stack-form-sheet";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";

const STACK_SHEET_PROVIDER_RE = /StackSheetProvider/;

const mocks = vi.hoisted(() => ({
	setStackAmount: vi.fn(),
	setRemainingPlayers: vi.fn(),
	setTotalEntries: vi.fn(),
	cashSummary: undefined as Record<string, unknown> | undefined,
	tournamentSummary: undefined as Record<string, unknown> | undefined,
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

vi.mock("@tanstack/react-query", () => ({
	useQuery: (options: { queryKey?: unknown[] }) => {
		const key = options.queryKey?.[0];
		if (key === "liveCashGameSession.getById") {
			return {
				data: mocks.cashSummary ? { summary: mocks.cashSummary } : undefined,
			};
		}
		if (key === "liveTournamentSession.getById") {
			return {
				data: mocks.tournamentSummary
					? { summary: mocks.tournamentSummary }
					: undefined,
			};
		}
		return { data: undefined };
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["liveCashGameSession.getById", id],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: ({ id }: { id: string }) => ({
					queryKey: ["liveTournamentSession.getById", id],
				}),
			},
		},
	},
}));

function wrapper({ children }: { children: ReactNode }) {
	return createElement(StackSheetProvider, null, children);
}

describe("useCashGameStackSheet", () => {
	it("initialises isCompleteOpen=false and defaultFinalStack=undefined, exposes StackSheet from context", () => {
		const { result } = renderHook(() => useCashGameStackSheet("s1"), {
			wrapper,
		});
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.defaultFinalStack).toBeUndefined();
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles independently of the stack sheet", () => {
		const { result } = renderHook(() => useCashGameStackSheet("s1"), {
			wrapper,
		});
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setDefaultFinalStack updates the default value", () => {
		const { result } = renderHook(() => useCashGameStackSheet("s1"), {
			wrapper,
		});
		act(() => {
			result.current.setDefaultFinalStack(5000);
		});
		expect(result.current.defaultFinalStack).toBe(5000);
	});

	it("stackSheet.open / close flips isOpen on the underlying sheet", () => {
		const { result } = renderHook(() => useCashGameStackSheet("s1"), {
			wrapper,
		});
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
		act(() => {
			result.current.stackSheet.close();
		});
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("throws outside of StackSheetProvider", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {
			/* noop */
		});
		expect(() => renderHook(() => useCashGameStackSheet("s1"))).toThrow(
			STACK_SHEET_PROVIDER_RE
		);
		spy.mockRestore();
	});

	describe("pre-population on open", () => {
		it("sets stackAmount from currentStack when sheet opens", () => {
			mocks.cashSummary = { currentStack: 3000 };
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			expect(mocks.setStackAmount).toHaveBeenCalledWith("3000");
		});

		it("falls back to totalBuyIn when currentStack is null", () => {
			mocks.cashSummary = { currentStack: null, totalBuyIn: 5000 };
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			expect(mocks.setStackAmount).toHaveBeenCalledWith("5000");
		});

		it("does not call setStackAmount when summary is empty", () => {
			mocks.cashSummary = {};
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).not.toHaveBeenCalled();
		});

		it("does not call setStackAmount when session data is undefined", () => {
			mocks.cashSummary = undefined;
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).not.toHaveBeenCalled();
		});

		it("does not re-populate while sheet remains open", () => {
			mocks.cashSummary = { currentStack: 3000 };
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			// Simulate another render without closing: setIsOpen(true) again
			act(() => {
				result.current.stackSheet.setIsOpen(true);
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
		});

		it("re-populates on second open after close", () => {
			mocks.cashSummary = { currentStack: 3000 };
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useCashGameStackSheet("s1"), {
				wrapper,
			});
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
			expect(mocks.setStackAmount).toHaveBeenNthCalledWith(1, "3000");
			expect(mocks.setStackAmount).toHaveBeenNthCalledWith(2, "3000");
		});
	});
});

describe("useTournamentStackSheet", () => {
	it("initialises isCompleteOpen=false and exposes the StackSheet context", () => {
		const { result } = renderHook(() => useTournamentStackSheet("t1"), {
			wrapper,
		});
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles", () => {
		const { result } = renderHook(() => useTournamentStackSheet("t1"), {
			wrapper,
		});
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
	});

	describe("pre-population on open", () => {
		it("sets all tournament fields from summary when sheet opens", () => {
			mocks.tournamentSummary = {
				currentStack: 8000,
				remainingPlayers: 42,
				totalEntries: 100,
			};
			mocks.setStackAmount.mockReset();
			mocks.setRemainingPlayers.mockReset();
			mocks.setTotalEntries.mockReset();
			const { result } = renderHook(() => useTournamentStackSheet("t1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			expect(mocks.setStackAmount).toHaveBeenCalledWith("8000");
			expect(mocks.setRemainingPlayers).toHaveBeenCalledOnce();
			expect(mocks.setRemainingPlayers).toHaveBeenCalledWith("42");
			expect(mocks.setTotalEntries).toHaveBeenCalledOnce();
			expect(mocks.setTotalEntries).toHaveBeenCalledWith("100");
		});

		it("only sets fields where values are numbers", () => {
			mocks.tournamentSummary = { currentStack: 5000 };
			mocks.setStackAmount.mockReset();
			mocks.setRemainingPlayers.mockReset();
			mocks.setTotalEntries.mockReset();
			const { result } = renderHook(() => useTournamentStackSheet("t1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			expect(mocks.setRemainingPlayers).not.toHaveBeenCalled();
			expect(mocks.setTotalEntries).not.toHaveBeenCalled();
		});

		it("does not populate when summary is undefined", () => {
			mocks.tournamentSummary = undefined;
			mocks.setStackAmount.mockReset();
			mocks.setRemainingPlayers.mockReset();
			mocks.setTotalEntries.mockReset();
			const { result } = renderHook(() => useTournamentStackSheet("t1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).not.toHaveBeenCalled();
			expect(mocks.setRemainingPlayers).not.toHaveBeenCalled();
			expect(mocks.setTotalEntries).not.toHaveBeenCalled();
		});

		it("does not re-populate while sheet remains open", () => {
			mocks.tournamentSummary = { currentStack: 8000 };
			mocks.setStackAmount.mockReset();
			const { result } = renderHook(() => useTournamentStackSheet("t1"), {
				wrapper,
			});
			act(() => {
				result.current.stackSheet.open();
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
			act(() => {
				result.current.stackSheet.setIsOpen(true);
			});
			expect(mocks.setStackAmount).toHaveBeenCalledOnce();
		});
	});
});
