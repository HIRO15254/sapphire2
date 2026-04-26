import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";

const NOW = new Date("2026-04-22T12:00:00Z");

describe("useElapsedTime", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the formatted initial value synchronously", () => {
		const past = new Date(NOW.getTime() - 30 * 60_000);
		const { result } = renderHook(() => useElapsedTime(past));
		expect(result.current).toBe("30m");
	});

	it("returns '—' for null startedAt", () => {
		const { result } = renderHook(() => useElapsedTime(null));
		expect(result.current).toBe("—");
	});

	it("returns '—' for undefined startedAt", () => {
		const { result } = renderHook(() => useElapsedTime(undefined));
		expect(result.current).toBe("—");
	});

	it("re-renders after the interval elapses", () => {
		const past = new Date(NOW.getTime() - 30 * 60_000);
		const { result } = renderHook(() => useElapsedTime(past));
		expect(result.current).toBe("30m");

		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		// 31 minutes elapsed now (30m + 60s)
		expect(result.current).toBe("31m");
	});

	it("respects a custom interval", () => {
		const past = new Date(NOW.getTime() - 30 * 60_000);
		const { result } = renderHook(() => useElapsedTime(past, 30_000));
		expect(result.current).toBe("30m");

		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(result.current).toBe("30m");

		act(() => {
			vi.advanceTimersByTime(30_000);
		});
		expect(result.current).toBe("31m");
	});

	it("recomputes immediately when startedAt changes", () => {
		const firstPast = new Date(NOW.getTime() - 30 * 60_000);
		const secondPast = new Date(NOW.getTime() - 60 * 60_000);
		const { result, rerender } = renderHook(
			({ startedAt }) => useElapsedTime(startedAt),
			{ initialProps: { startedAt: firstPast as Date | null } }
		);
		expect(result.current).toBe("30m");

		rerender({ startedAt: secondPast });
		expect(result.current).toBe("1h 0m");
	});

	it("clears the interval on unmount (no further setText calls)", () => {
		const past = new Date(NOW.getTime() - 30 * 60_000);
		const clearSpy = vi.spyOn(globalThis, "clearInterval");
		const { unmount } = renderHook(() => useElapsedTime(past));
		unmount();
		expect(clearSpy).toHaveBeenCalled();
		clearSpy.mockRestore();
	});

	it("accepts ISO string startedAt", () => {
		const iso = new Date(NOW.getTime() - 45 * 60_000).toISOString();
		const { result } = renderHook(() => useElapsedTime(iso));
		expect(result.current).toBe("45m");
	});

	it("accepts epoch number startedAt", () => {
		const epoch = NOW.getTime() - 2 * 60 * 60_000;
		const { result } = renderHook(() => useElapsedTime(epoch));
		expect(result.current).toBe("2h 0m");
	});
});
