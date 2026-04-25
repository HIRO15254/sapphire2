import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActiveSessionScene } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene";
import type { TablePlayer } from "@/features/live-sessions/components/poker-table";

function makePlayer(overrides: Partial<TablePlayer>): TablePlayer {
	return {
		id: "p",
		isActive: true,
		seatPosition: 0,
		player: { id: "p", isTemporary: false, name: "Player" },
		...overrides,
	} as TablePlayer;
}

describe("useActiveSessionScene", () => {
	it("initialises both sheet flags to false and exposes setters", () => {
		const { result } = renderHook(() => useActiveSessionScene({ players: [] }));
		expect(result.current.isDiscardOpen).toBe(false);
		expect(result.current.isScanSheetOpen).toBe(false);
	});

	it("computes occupiedSeatPositions only from active players with numeric seatPosition", () => {
		const players: TablePlayer[] = [
			makePlayer({ id: "a", isActive: true, seatPosition: 0 }),
			makePlayer({ id: "b", isActive: true, seatPosition: 3 }),
			makePlayer({ id: "c", isActive: false, seatPosition: 5 }),
			makePlayer({ id: "d", isActive: true, seatPosition: null }),
		];
		const { result } = renderHook(() => useActiveSessionScene({ players }));
		expect([...result.current.occupiedSeatPositions].sort()).toEqual([0, 3]);
	});

	it("returns an empty Set when the roster has no active seated players", () => {
		const players: TablePlayer[] = [
			makePlayer({ id: "a", isActive: false, seatPosition: 1 }),
			makePlayer({ id: "b", isActive: true, seatPosition: null }),
		];
		const { result } = renderHook(() => useActiveSessionScene({ players }));
		expect(result.current.occupiedSeatPositions.size).toBe(0);
	});

	it("memoizes occupiedSeatPositions across renders when players reference is stable", () => {
		const players: TablePlayer[] = [makePlayer({ id: "a", seatPosition: 2 })];
		const { result, rerender } = renderHook(
			(p: { players: TablePlayer[] }) => useActiveSessionScene(p),
			{ initialProps: { players } }
		);
		const first = result.current.occupiedSeatPositions;
		rerender({ players });
		expect(result.current.occupiedSeatPositions).toBe(first);
	});

	it("recomputes occupiedSeatPositions when players reference changes", () => {
		const start: TablePlayer[] = [makePlayer({ id: "a", seatPosition: 1 })];
		const next: TablePlayer[] = [makePlayer({ id: "b", seatPosition: 4 })];
		const { result, rerender } = renderHook(
			(p: { players: TablePlayer[] }) => useActiveSessionScene(p),
			{ initialProps: { players: start } }
		);
		rerender({ players: next });
		expect([...result.current.occupiedSeatPositions]).toEqual([4]);
	});

	it("toggles both dialog flags independently via their setters", () => {
		const { result } = renderHook(() => useActiveSessionScene({ players: [] }));
		act(() => {
			result.current.setIsDiscardOpen(true);
		});
		expect(result.current.isDiscardOpen).toBe(true);
		expect(result.current.isScanSheetOpen).toBe(false);
		act(() => {
			result.current.setIsScanSheetOpen(true);
		});
		expect(result.current.isScanSheetOpen).toBe(true);
	});
});
