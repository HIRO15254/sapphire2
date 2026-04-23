import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	onlineStatus: true,
	mutatingCount: 0,
}));

vi.mock("@/shared/hooks/use-online-status", () => ({
	useOnlineStatus: () => mocks.onlineStatus,
}));

vi.mock("@tanstack/react-query", () => ({
	useIsMutating: () => mocks.mutatingCount,
}));

import { useOnlineStatusBar } from "@/shared/components/online-status-bar/use-online-status-bar";

describe("useOnlineStatusBar", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mocks.onlineStatus = true;
		mocks.mutatingCount = 0;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts hidden when initially online and never went offline", () => {
		const { result } = renderHook(() => useOnlineStatusBar());
		expect(result.current.displayState).toBe("hidden");
	});

	it("transitions to 'offline' when offline", () => {
		mocks.onlineStatus = false;
		const { result } = renderHook(() => useOnlineStatusBar());
		expect(result.current.displayState).toBe("offline");
	});

	it("shows 'syncing' when coming back online with active mutations", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderHook(() => useOnlineStatusBar());
		expect(result.current.displayState).toBe("offline");

		mocks.onlineStatus = true;
		mocks.mutatingCount = 2;
		rerender();
		expect(result.current.displayState).toBe("syncing");
	});

	it("shows 'back-online' when coming back online with no mutations, then fades to hidden after 2s", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderHook(() => useOnlineStatusBar());
		expect(result.current.displayState).toBe("offline");

		mocks.onlineStatus = true;
		rerender();
		expect(result.current.displayState).toBe("back-online");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.displayState).toBe("hidden");
	});

	it("goes offline again, clears any pending fade", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderHook(() => useOnlineStatusBar());
		mocks.onlineStatus = true;
		rerender();
		expect(result.current.displayState).toBe("back-online");

		// Go offline again before fade completes
		mocks.onlineStatus = false;
		rerender();
		expect(result.current.displayState).toBe("offline");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		// Remains offline; fade must not kick in
		expect(result.current.displayState).toBe("offline");
	});

	it("stays 'hidden' when online and never went offline, even if a mutation is pending", () => {
		mocks.mutatingCount = 3;
		const { result } = renderHook(() => useOnlineStatusBar());
		expect(result.current.displayState).toBe("hidden");
	});

	it("mutation count dropping to 0 while syncing transitions to back-online and then hidden", () => {
		mocks.onlineStatus = false;
		const { result, rerender } = renderHook(() => useOnlineStatusBar());
		mocks.onlineStatus = true;
		mocks.mutatingCount = 1;
		rerender();
		expect(result.current.displayState).toBe("syncing");

		mocks.mutatingCount = 0;
		rerender();
		expect(result.current.displayState).toBe("back-online");

		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.displayState).toBe("hidden");
	});
});
