import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	useCashGameStackSheet,
	useTournamentStackSheet,
} from "@/features/live-sessions/components/live-stack-form-sheet/use-live-stack-form-sheet";
import { StackSheetProvider } from "@/features/live-sessions/hooks/use-stack-sheet";

const STACK_SHEET_PROVIDER_RE = /StackSheetProvider/;

function wrapper({ children }: { children: ReactNode }) {
	return createElement(StackSheetProvider, null, children);
}

describe("useCashGameStackSheet", () => {
	it("initialises isCompleteOpen=false and defaultFinalStack=undefined, exposes StackSheet from context", () => {
		const { result } = renderHook(() => useCashGameStackSheet(), { wrapper });
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.defaultFinalStack).toBeUndefined();
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles independently of the stack sheet", () => {
		const { result } = renderHook(() => useCashGameStackSheet(), { wrapper });
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setDefaultFinalStack updates the default value", () => {
		const { result } = renderHook(() => useCashGameStackSheet(), { wrapper });
		act(() => {
			result.current.setDefaultFinalStack(5000);
		});
		expect(result.current.defaultFinalStack).toBe(5000);
	});

	it("stackSheet.open / close flips isOpen on the underlying sheet", () => {
		const { result } = renderHook(() => useCashGameStackSheet(), { wrapper });
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
		// Suppress the expected error being logged.
		const spy = vi.spyOn(console, "error").mockImplementation(() => {
			/* noop */
		});
		expect(() => renderHook(() => useCashGameStackSheet())).toThrow(
			STACK_SHEET_PROVIDER_RE
		);
		spy.mockRestore();
	});
});

describe("useTournamentStackSheet", () => {
	it("initialises isCompleteOpen=false and exposes the StackSheet context", () => {
		const { result } = renderHook(() => useTournamentStackSheet(), {
			wrapper,
		});
		expect(result.current.isCompleteOpen).toBe(false);
		expect(result.current.stackSheet.isOpen).toBe(false);
	});

	it("setIsCompleteOpen toggles", () => {
		const { result } = renderHook(() => useTournamentStackSheet(), {
			wrapper,
		});
		act(() => {
			result.current.setIsCompleteOpen(true);
		});
		expect(result.current.isCompleteOpen).toBe(true);
	});
});
