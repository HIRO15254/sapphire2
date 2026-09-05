import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMobileNavPopover } from "@/shared/hooks/use-mobile-nav-popover";

describe("useMobileNavPopover", () => {
	it("starts closed and follows the drawer's controlled open state", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		expect(result.current.isOpen).toBe(false);
		act(() => result.current.onOpenChange(true));
		expect(result.current.isOpen).toBe(true);
		act(() => result.current.onOpenChange(false));
		expect(result.current.isOpen).toBe(false);
	});

	it("closes after an action and remains closed on a repeated close", () => {
		const { result } = renderHook(() => useMobileNavPopover());
		act(() => result.current.onOpenChange(true));
		act(() => result.current.onClose());
		expect(result.current.isOpen).toBe(false);
		act(() => result.current.onClose());
		expect(result.current.isOpen).toBe(false);
	});
});
