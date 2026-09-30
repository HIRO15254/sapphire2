import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useKeyboardOpen } from "@/shared/hooks/use-keyboard-open";

const originalDescriptor = Object.getOwnPropertyDescriptor(
	window,
	"visualViewport"
);

function stubVisualViewport(height: number) {
	const listeners = new Set<() => void>();
	const viewport = {
		height,
		addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_type: string, fn: () => void) =>
			listeners.delete(fn),
	};
	Object.defineProperty(window, "visualViewport", {
		configurable: true,
		value: viewport,
	});
	return {
		resizeTo(next: number) {
			viewport.height = next;
			act(() => {
				for (const fn of listeners) {
					fn();
				}
			});
		},
		listenerCount: () => listeners.size,
	};
}

function removeVisualViewport() {
	Object.defineProperty(window, "visualViewport", {
		configurable: true,
		value: undefined,
	});
}

afterEach(() => {
	if (originalDescriptor) {
		Object.defineProperty(window, "visualViewport", originalDescriptor);
	} else {
		Reflect.deleteProperty(window, "visualViewport");
	}
});

describe("useKeyboardOpen", () => {
	it("is closed while the viewport keeps its height", () => {
		const viewport = stubVisualViewport(800);
		const { result } = renderHook(() => useKeyboardOpen());
		expect(result.current).toBe(false);
		viewport.resizeTo(800);
		expect(result.current).toBe(false);
	});

	it("opens once the viewport loses enough height for a keyboard", () => {
		const viewport = stubVisualViewport(800);
		const { result } = renderHook(() => useKeyboardOpen());
		viewport.resizeTo(500);
		expect(result.current).toBe(true);
	});

	it("ignores a shrink too small to be a keyboard", () => {
		const viewport = stubVisualViewport(800);
		const { result } = renderHook(() => useKeyboardOpen());
		viewport.resizeTo(720);
		expect(result.current).toBe(false);
	});

	it("closes again when the viewport comes back", () => {
		const viewport = stubVisualViewport(800);
		const { result } = renderHook(() => useKeyboardOpen());
		viewport.resizeTo(500);
		viewport.resizeTo(800);
		expect(result.current).toBe(false);
	});

	it("re-baselines when the viewport grows past the tallest seen height", () => {
		const viewport = stubVisualViewport(500);
		const { result } = renderHook(() => useKeyboardOpen());
		viewport.resizeTo(800);
		expect(result.current).toBe(false);
		viewport.resizeTo(500);
		expect(result.current).toBe(true);
	});

	it("stays closed where the browser exposes no visual viewport", () => {
		removeVisualViewport();
		const { result } = renderHook(() => useKeyboardOpen());
		expect(result.current).toBe(false);
	});

	it("detaches its listener on unmount", () => {
		const viewport = stubVisualViewport(800);
		const { unmount } = renderHook(() => useKeyboardOpen());
		expect(viewport.listenerCount()).toBe(1);
		unmount();
		expect(viewport.listenerCount()).toBe(0);
	});
});
