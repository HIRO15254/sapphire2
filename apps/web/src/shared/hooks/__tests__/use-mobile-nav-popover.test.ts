import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMobileNavPopover } from "@/shared/hooks/use-mobile-nav-popover";

describe("useMobileNavPopover", () => {
	it("starts closed", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		expect(result.current.isOpen).toBe(false);
	});

	it("onOpenChange(true) opens the popover", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onOpenChange(true));
		expect(result.current.isOpen).toBe(true);
	});

	it("onOpenChange(false) closes the popover", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onOpenChange(true));
		expect(result.current.isOpen).toBe(true);
		act(() => result.current.onOpenChange(false));
		expect(result.current.isOpen).toBe(false);
	});

	it("onClose closes an already open popover", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onOpenChange(true));
		act(() => result.current.onClose());
		expect(result.current.isOpen).toBe(false);
	});

	it("onClose is a no-op when already closed", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onClose());
		expect(result.current.isOpen).toBe(false);
	});

	it("multiple toggles via onOpenChange alternate state", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onOpenChange(true));
		expect(result.current.isOpen).toBe(true);
		act(() => result.current.onOpenChange(false));
		expect(result.current.isOpen).toBe(false);
		act(() => result.current.onOpenChange(true));
		expect(result.current.isOpen).toBe(true);
	});

	it("returns stable shape with isOpen, onOpenChange, onClose", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		expect(typeof result.current.isOpen).toBe("boolean");
		expect(typeof result.current.onOpenChange).toBe("function");
		expect(typeof result.current.onClose).toBe("function");
	});
});
