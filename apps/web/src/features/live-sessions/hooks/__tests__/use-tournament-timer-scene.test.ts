import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNowTick } from "@/features/live-sessions/hooks/use-tournament-timer-scene";

describe("useNowTick", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the initial Date.now() synchronously on mount", () => {
		const base = Date.now();
		const { result } = renderHook(() => useNowTick(1000));
		expect(result.current).toBe(base);
	});

	it("advances on each interval tick to the new Date.now()", () => {
		const { result } = renderHook(() => useNowTick(1000));
		const initial = result.current;
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(result.current).toBe(initial + 1000);
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current).toBe(initial + 3000);
	});

	it("respects the intervalMs parameter (no tick before the interval elapses)", () => {
		const { result } = renderHook(() => useNowTick(5000));
		const initial = result.current;
		act(() => {
			vi.advanceTimersByTime(4999);
		});
		expect(result.current).toBe(initial);
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current).toBe(initial + 5000);
	});

	it("clears the interval on unmount (no further ticks / no timer warnings)", () => {
		const clearSpy = vi.spyOn(globalThis, "clearInterval");
		const { unmount } = renderHook(() => useNowTick(1000));
		unmount();
		expect(clearSpy).toHaveBeenCalled();
	});

	it("resubscribes with new interval when intervalMs changes", () => {
		const { result, rerender } = renderHook(
			({ ms }: { ms: number }) => useNowTick(ms),
			{ initialProps: { ms: 1000 } }
		);
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		const afterFirst = result.current;
		rerender({ ms: 500 });
		// After rerender, the new setInterval fires at +500ms → Date.now() was
		// incremented by 500ms since afterFirst.
		act(() => {
			vi.advanceTimersByTime(500);
		});
		expect(result.current).toBe(afterFirst + 500);
	});
});
