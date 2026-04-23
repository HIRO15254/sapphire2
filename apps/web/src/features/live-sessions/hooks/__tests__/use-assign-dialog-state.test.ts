import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssignDialogState } from "@/features/live-sessions/hooks/use-assign-dialog-state";

describe("useAssignDialogState", () => {
	it("starts closed", () => {
		const { result } = renderHook(() => useAssignDialogState());
		expect(result.current.isAssignOpen).toBe(false);
	});

	it("opens when setIsAssignOpen(true) is called", () => {
		const { result } = renderHook(() => useAssignDialogState());
		act(() => {
			result.current.setIsAssignOpen(true);
		});
		expect(result.current.isAssignOpen).toBe(true);
	});

	it("toggles closed again when setIsAssignOpen(false) is called", () => {
		const { result } = renderHook(() => useAssignDialogState());
		act(() => {
			result.current.setIsAssignOpen(true);
		});
		act(() => {
			result.current.setIsAssignOpen(false);
		});
		expect(result.current.isAssignOpen).toBe(false);
	});

	it("accepts a setter function and computes next value", () => {
		const { result } = renderHook(() => useAssignDialogState());
		act(() => {
			result.current.setIsAssignOpen((prev) => !prev);
		});
		expect(result.current.isAssignOpen).toBe(true);
		act(() => {
			result.current.setIsAssignOpen((prev) => !prev);
		});
		expect(result.current.isAssignOpen).toBe(false);
	});

	it("returns a stable setter across re-renders", () => {
		const { result, rerender } = renderHook(() => useAssignDialogState());
		const firstSetter = result.current.setIsAssignOpen;
		rerender();
		expect(result.current.setIsAssignOpen).toBe(firstSetter);
	});
});
