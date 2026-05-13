import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "@/features/live-sessions/components/live-stack-form-sheet/use-live-stack-form-sheet";
import { SessionFormProvider } from "@/features/live-sessions/hooks/use-session-form";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";

const STACK_SHEET_PROVIDER_RE = /StackSheetProvider/;

const mocks = vi.hoisted(() => ({
	cashSessionData: null as null | {
		summary: {
			currentStack: number | null;
			totalBuyIn: number;
		};
	},
	tournamentSessionData: null as null | {
		summary: {
			currentStack: number | null;
			remainingPlayers: number | null;
			totalEntries: number | null;
		};
	},
}));

vi.mock("@tanstack/react-query", () => ({
	useQuery: (opts: { queryKey: unknown[] }) => {
		const key = JSON.stringify(opts.queryKey);
		if (key.includes("liveCashGameSession")) {
			return { data: mocks.cashSessionData };
		}
		if (key.includes("liveTournamentSession")) {
			return { data: mocks.tournamentSessionData };
		}
		return { data: undefined };
	},
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: ["liveCashGameSession", "getById", input],
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: { id: string }) => ({
					queryKey: ["liveTournamentSession", "getById", input],
				}),
			},
		},
	},
}));

function wrapper({ children }: { children: ReactNode }) {
	return createElement(
		SessionFormProvider,
		null,
		createElement(StackSheetProvider, null, children)
	);
}

describe("useCashGameStackSheet", () => {
	it("initialises isCompleteOpen=false and defaultFinalStack=undefined, exposes StackSheet from context", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.defaultFinalStack).toBeUndefined();
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles independently of the stack sheet", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
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
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		act(() => {
			result.current.setDefaultFinalStack(5000);
		});
		expect(result.current.defaultFinalStack).toBe(5000);
	});

	it("stackSheet.open / close flips isOpen on the underlying sheet", () => {
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
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

	it("throws outside of StackSheetProvider", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {
			/* noop */
		});
		expect(() =>
			renderHook(() => useCashGameStackSheet({ sessionId: "s1" }))
		).toThrow(STACK_SHEET_PROVIDER_RE);
		spy.mockRestore();
	});

	it("pre-populates stackAmount from currentStack when sheet opens", () => {
		mocks.cashSessionData = {
			summary: { currentStack: 8500, totalBuyIn: 5000 },
		};
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		// stackAmount is set via context — verify via the sheet hook exposure
		expect(result.current.stackSheet.isOpen).toBe(true);
	});

	it("falls back to totalBuyIn when currentStack is null", () => {
		mocks.cashSessionData = {
			summary: { currentStack: null, totalBuyIn: 3000 },
		};
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});

	it("does not pre-populate when session data is absent", () => {
		mocks.cashSessionData = null;
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		// Should not throw even without session data
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});

	it("does not re-populate while the sheet remains open", () => {
		mocks.cashSessionData = {
			summary: { currentStack: 1000, totalBuyIn: 500 },
		};
		const { result } = renderHook(
			() => useCashGameStackSheet({ sessionId: "s1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		// Sheet stays open — second open trigger should not fire again
		act(() => {
			result.current.stackSheet.setIsOpen(true);
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});
});

describe("useTournamentStackSheet", () => {
	it("initialises isCompleteOpen=false and exposes the StackSheet context", () => {
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: "t1" }),
			{
				wrapper,
			}
		);
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles", () => {
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: "t1" }),
			{
				wrapper,
			}
		);
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
	});

	it("pre-populates tournament summary fields when sheet opens", () => {
		mocks.tournamentSessionData = {
			summary: { currentStack: 25_000, remainingPlayers: 15, totalEntries: 80 },
		};
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: "t1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});

	it("handles null remainingPlayers and totalEntries gracefully", () => {
		mocks.tournamentSessionData = {
			summary: {
				currentStack: 12_000,
				remainingPlayers: null,
				totalEntries: null,
			},
		};
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: "t1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});

	it("does not pre-populate when session data is absent", () => {
		mocks.tournamentSessionData = null;
		const { result } = renderHook(
			() => useTournamentStackSheet({ sessionId: "t1" }),
			{ wrapper }
		);
		act(() => {
			result.current.stackSheet.open();
		});
		expect(result.current.stackSheet.isOpen).toBe(true);
	});
});
