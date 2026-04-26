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

	it("returns true when navigator.onLine is true", () => {
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(true);
	});

	it("returns false when navigator.onLine is false", () => {
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => false,
		});
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(false);
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

	it("re-renders with the updated value when an offline event fires", () => {
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(true);

		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => false,
		});
		act(() => {
			window.dispatchEvent(new Event("offline"));
		});
		expect(result.current).toBe(false);
	});

	it("re-renders with the updated value when an online event fires", () => {
		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => false,
		});
		const { result } = renderHook(() => useOnlineStatus());
		expect(result.current).toBe(false);

		Object.defineProperty(navigator, "onLine", {
			configurable: true,
			get: () => true,
		});
		act(() => {
			window.dispatchEvent(new Event("online"));
		});
		expect(result.current).toBe(true);
	});
});
