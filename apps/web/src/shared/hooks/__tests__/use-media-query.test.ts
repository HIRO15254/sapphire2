import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "@/shared/hooks/use-media-query";

type Listener = (event: MediaQueryListEvent) => void;

interface FakeMediaQueryList {
	addEventListener: ReturnType<typeof vi.fn>;
	listeners: Listener[];
	matches: boolean;
	removeEventListener: ReturnType<typeof vi.fn>;
}

function makeFakeMediaQueryList(matches: boolean): FakeMediaQueryList {
	const listeners: Listener[] = [];
	return {
		matches,
		listeners,
		addEventListener: vi.fn((_type: string, listener: Listener) => {
			listeners.push(listener);
		}),
		removeEventListener: vi.fn((_type: string, listener: Listener) => {
			const index = listeners.indexOf(listener);
			if (index >= 0) {
				listeners.splice(index, 1);
			}
		}),
	};
}

describe("useMediaQuery", () => {
	const mediaRegistry = new Map<string, FakeMediaQueryList>();
	const matchMediaSpy = vi.fn((query: string) => {
		let media = mediaRegistry.get(query);
		if (!media) {
			media = makeFakeMediaQueryList(false);
			mediaRegistry.set(query, media);
		}
		return media as unknown as MediaQueryList;
	});

	const originalMatchMedia = window.matchMedia;

	beforeEach(() => {
		mediaRegistry.clear();
		matchMediaSpy.mockClear();
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			writable: true,
			value: matchMediaSpy,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			writable: true,
			value: originalMatchMedia,
		});
	});

	it("returns false initially (before effect runs)", () => {
		// The hook seeds state to false; effect will update to actual match immediately.
		const media = makeFakeMediaQueryList(true);
		mediaRegistry.set("(min-width: 768px)", media);
		const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
		// Effect has run synchronously in renderHook → matches.
		expect(result.current).toBe(true);
	});

	it("returns false when media does not match", () => {
		const { result } = renderHook(() => useMediaQuery("(min-width: 9999px)"));
		expect(result.current).toBe(false);
	});

	it("subscribes to 'change' on the MediaQueryList", () => {
		renderHook(() => useMediaQuery("(min-width: 768px)"));
		const media = mediaRegistry.get("(min-width: 768px)");
		expect(media).toBeDefined();
		expect(media?.addEventListener).toHaveBeenCalledWith(
			"change",
			expect.any(Function)
		);
	});

	it("unsubscribes on unmount", () => {
		const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
		const media = mediaRegistry.get("(min-width: 768px)");
		expect(media?.removeEventListener).not.toHaveBeenCalled();
		unmount();
		expect(media?.removeEventListener).toHaveBeenCalledWith(
			"change",
			expect.any(Function)
		);
	});

	it("updates when the media query matches change", () => {
		const media = makeFakeMediaQueryList(false);
		mediaRegistry.set("(min-width: 768px)", media);
		const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
		expect(result.current).toBe(false);

		act(() => {
			for (const listener of media.listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}
		});
		expect(result.current).toBe(true);
	});

	it("resubscribes when the query string changes", () => {
		const first = makeFakeMediaQueryList(true);
		const second = makeFakeMediaQueryList(false);
		mediaRegistry.set("(min-width: 768px)", first);
		mediaRegistry.set("(min-width: 1024px)", second);
		const { result, rerender } = renderHook(
			({ query }) => useMediaQuery(query),
			{ initialProps: { query: "(min-width: 768px)" } }
		);
		expect(result.current).toBe(true);
		expect(first.removeEventListener).not.toHaveBeenCalled();

		rerender({ query: "(min-width: 1024px)" });
		expect(first.removeEventListener).toHaveBeenCalled();
		expect(second.addEventListener).toHaveBeenCalled();
		expect(result.current).toBe(false);
	});
});
