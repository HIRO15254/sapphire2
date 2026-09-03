import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSeatList } from "@/features/live-sessions/components/active-session-scene/seat-list/use-seat-list";

describe("useSeatList", () => {
	it("initializes with expandedKey null", () => {
		const { result } = renderHook(() => useSeatList());
		expect(result.current.expandedKey).toBe(null);
	});

	it("onToggle opens a closed key", () => {
		const { result } = renderHook(() => useSeatList());

		act(() => {
			result.current.onToggle("seat-1");
		});

		expect(result.current.expandedKey).toBe("seat-1");
	});

	it("onToggle closes an open key", () => {
		const { result } = renderHook(() => useSeatList());

		act(() => {
			result.current.onToggle("seat-1");
		});
		act(() => {
			result.current.onToggle("seat-1");
		});

		expect(result.current.expandedKey).toBe(null);
	});

	it("onToggle switches from one open key to another", () => {
		const { result } = renderHook(() => useSeatList());

		act(() => {
			result.current.onToggle("seat-1");
		});
		act(() => {
			result.current.onToggle("seat-2");
		});

		expect(result.current.expandedKey).toBe("seat-2");
	});

	it("collapse resets expandedKey to null", () => {
		const { result } = renderHook(() => useSeatList());

		act(() => {
			result.current.onToggle("seat-1");
		});
		act(() => {
			result.current.collapse();
		});

		expect(result.current.expandedKey).toBe(null);
	});
});
