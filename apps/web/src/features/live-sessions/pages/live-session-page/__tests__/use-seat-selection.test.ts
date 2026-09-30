import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	SeatEntry,
	SeatPlayer,
} from "@/features/live-sessions/hooks/use-session-seats";
import { useSeatSelection } from "@/features/live-sessions/pages/live-session-page/use-seat-selection";

function player(overrides: Partial<SeatPlayer> = {}): SeatPlayer {
	return {
		id: "seat-1",
		isLoading: false,
		isTemporary: false,
		memo: null,
		name: "Young guy",
		playerId: "player-1",
		seatPosition: 2,
		tags: [],
		...overrides,
	};
}

function seats(entry: Partial<SeatEntry>): SeatEntry[] {
	return [
		{
			isHero: false,
			occupancy: "player",
			player: player(),
			seatPosition: 2,
			...entry,
		},
	];
}

describe("useSeatSelection", () => {
	it("opens the profile of a seat whose player is saved", () => {
		const { result } = renderHook(() => useSeatSelection(seats({})));

		act(() => {
			result.current.onSelectSeat(2);
		});

		expect(result.current.selectedPlayerId).toBe("player-1");
	});

	it("ignores a seat whose player has not been saved yet", () => {
		const { result } = renderHook(() =>
			useSeatSelection(seats({ player: player({ isLoading: true }) }))
		);

		act(() => {
			result.current.onSelectSeat(2);
		});

		expect(result.current.selectedPlayerId).toBeNull();
		expect(result.current.seatSheet).toBeNull();
	});
});
