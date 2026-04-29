import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStoreCard } from "@/features/stores/components/store-card/use-store-card";

describe("useStoreCard", () => {
	it("starts with expandedGameId=null", () => {
		const { result } = renderHook(() => useStoreCard());
		expect(result.current.expandedGameId).toBeNull();
	});

	it("handleToggleGame sets the expanded id", () => {
		const { result } = renderHook(() => useStoreCard());
		act(() => {
			result.current.handleToggleGame("g1");
		});
		expect(result.current.expandedGameId).toBe("g1");
	});

	it("handleToggleGame with null collapses", () => {
		const { result } = renderHook(() => useStoreCard());
		act(() => {
			result.current.handleToggleGame("g1");
		});
		act(() => {
			result.current.handleToggleGame(null);
		});
		expect(result.current.expandedGameId).toBeNull();
	});
});
