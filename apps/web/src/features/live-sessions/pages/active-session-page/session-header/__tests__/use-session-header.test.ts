import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionHeader } from "../use-session-header";

const NOW = new Date("2026-04-22T12:00:00Z");

describe("useSessionHeader", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the initial clock text for the given start", () => {
		const { result } = renderHook(() =>
			useSessionHeader({ startedAt: new Date(NOW.getTime() - 65_000) })
		);
		expect(result.current.elapsedText).toBe("00:01:05");
	});

	it("returns em dash when startedAt is null", () => {
		const { result } = renderHook(() => useSessionHeader({ startedAt: null }));
		expect(result.current.elapsedText).toBe("—");
	});

	it("ticks the clock every second", () => {
		const { result } = renderHook(() => useSessionHeader({ startedAt: NOW }));
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(result.current.elapsedText).toBe("00:00:03");
	});

	it("re-seeds the clock when startedAt changes", () => {
		const { result, rerender } = renderHook(
			({ startedAt }: { startedAt: Date }) => useSessionHeader({ startedAt }),
			{ initialProps: { startedAt: NOW } }
		);
		rerender({ startedAt: new Date(NOW.getTime() - 3_600_000) });
		expect(result.current.elapsedText).toBe("01:00:00");
	});

	it("clears the interval on unmount", () => {
		const spy = vi.spyOn(globalThis, "clearInterval");
		const { unmount } = renderHook(() => useSessionHeader({ startedAt: NOW }));
		const callsBefore = spy.mock.calls.length;
		unmount();
		expect(spy.mock.calls.length).toBeGreaterThan(callsBefore);
		spy.mockRestore();
	});
});
