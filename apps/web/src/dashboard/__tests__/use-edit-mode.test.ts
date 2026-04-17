import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEditMode } from "@/dashboard/hooks/use-edit-mode";

describe("useEditMode", () => {
	it("defaults to not editing", () => {
		const { result } = renderHook(() => useEditMode());
		expect(result.current.isEditing).toBe(false);
	});

	it("toggles editing state", () => {
		const { result } = renderHook(() => useEditMode());
		act(() => result.current.toggle());
		expect(result.current.isEditing).toBe(true);
		act(() => result.current.toggle());
		expect(result.current.isEditing).toBe(false);
	});

	it("sets editing state directly", () => {
		const { result } = renderHook(() => useEditMode());
		act(() => result.current.setEditing(true));
		expect(result.current.isEditing).toBe(true);
	});
});
