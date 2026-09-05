import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAssignDialogState } from "@/features/live-sessions/hooks/use-assign-dialog-state";

describe("useAssignDialogState", () => {
	it("starts closed and opens and closes on user request", () => {
		const { result } = renderHook(() => useAssignDialogState());
		expect(result.current.isAssignOpen).toBe(false);
		act(() => {
			result.current.setIsAssignOpen(true);
		});
		expect(result.current.isAssignOpen).toBe(true);
		act(() => {
			result.current.setIsAssignOpen(false);
		});
		expect(result.current.isAssignOpen).toBe(false);
	});
});
