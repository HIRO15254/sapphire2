import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeatCombobox } from "@/features/live-sessions/hooks/use-seat-combobox";

describe("useSeatCombobox", () => {
	it("starts closed with anchorRef detached and undefined contentWidth", () => {
		const { result } = renderHook(() => useSeatCombobox());
		expect(result.current.popoverOpen).toBe(false);
		expect(result.current.contentWidth).toBeUndefined();
		expect(result.current.anchorRef.current).toBeNull();
	});

	it("does not set contentWidth while popover is closed even if anchor is attached", () => {
		const { result } = renderHook(() => useSeatCombobox());
		const element = document.createElement("div");
		Object.defineProperty(element, "offsetWidth", { value: 320 });
		result.current.anchorRef.current = element;
		expect(result.current.contentWidth).toBeUndefined();
	});

	it("reads offsetWidth into contentWidth when opened with an attached anchor", async () => {
		const { result } = renderHook(() => useSeatCombobox());
		const element = document.createElement("div");
		Object.defineProperty(element, "offsetWidth", { value: 320 });
		result.current.anchorRef.current = element;
		act(() => {
			result.current.setPopoverOpen(true);
		});
		await waitFor(() => {
			expect(result.current.contentWidth).toBe(320);
		});
	});

	it("does not update contentWidth when opened without an attached anchor", () => {
		const { result } = renderHook(() => useSeatCombobox());
		act(() => {
			result.current.setPopoverOpen(true);
		});
		expect(result.current.contentWidth).toBeUndefined();
	});

	it("keeps the last measured width even after the popover closes (hook does not reset)", async () => {
		const { result } = renderHook(() => useSeatCombobox());
		const element = document.createElement("div");
		Object.defineProperty(element, "offsetWidth", { value: 240 });
		result.current.anchorRef.current = element;
		act(() => {
			result.current.setPopoverOpen(true);
		});
		await waitFor(() => expect(result.current.contentWidth).toBe(240));
		act(() => {
			result.current.setPopoverOpen(false);
		});
		expect(result.current.contentWidth).toBe(240);
		expect(result.current.popoverOpen).toBe(false);
	});

	it("re-measures when reopened with a new offsetWidth", async () => {
		const { result } = renderHook(() => useSeatCombobox());
		const element = document.createElement("div");
		let offset = 100;
		Object.defineProperty(element, "offsetWidth", {
			get: () => offset,
		});
		result.current.anchorRef.current = element;
		act(() => {
			result.current.setPopoverOpen(true);
		});
		await waitFor(() => expect(result.current.contentWidth).toBe(100));
		act(() => {
			result.current.setPopoverOpen(false);
		});
		offset = 500;
		act(() => {
			result.current.setPopoverOpen(true);
		});
		await waitFor(() => expect(result.current.contentWidth).toBe(500));
	});
});
