import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";

describe("useOnlineStatus", () => {
	let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
	let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;
	const originalOnLine = Object.getOwnPropertyDescriptor(
		Navigator.prototype,
		"onLine"
	);

	beforeEach(() => {
		addEventListenerSpy = vi.spyOn(window, "addEventListener");
		removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => true,
		});
	});

	afterEach(() => {
		addEventListenerSpy.mockRestore();
		removeEventListenerSpy.mockRestore();
		if (originalOnLine) {
			Object.defineProperty(Navigator.prototype, "onLine", originalOnLine);
		}
	});

	it.each([
		[true],
		[false],
	])("returns %s when navigator.onLine is %s", (onLine) => {
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => onLine,
		});
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(onLine);
	});

	it("subscribes to both online and offline events", () => {
		renderHook(() => useOnlineStatus());
		const added = addEventListenerSpy.mock.calls.map(
			([type]: [string]) => type
		);
		expect(added).toContain("online");
		expect(added).toContain("offline");
	});

	it("unsubscribes both listeners on unmount", () => {
		const { unmount } = renderHook(() => useOnlineStatus());
		unmount();
		const removed = removeEventListenerSpy.mock.calls.map(
			([type]: [string]) => type
		);
		expect(removed).toContain("online");
		expect(removed).toContain("offline");
	});

	it.each([
		["offline", true, false],
		["online", false, true],
	])("re-renders with the updated value when a %s event fires", (eventName, initialValue, expectedValue) => {
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => initialValue,
		});
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(initialValue);

		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => expectedValue,
		});
		act(() => {
			window.dispatchEvent(new Event(eventName));
		});
		expect(result.current).toBe(expectedValue);
	});
});
