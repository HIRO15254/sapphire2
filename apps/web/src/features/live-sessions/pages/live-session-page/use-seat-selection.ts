import { useState } from "react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";

export function useSeatSelection(seats: SeatEntry[]) {
	const [selectedSeatPosition, setSelectedSeatPosition] = useState<
		number | null
	>(null);

	const selectedSeat =
		seats.find(
			(seat) =>
				seat.seatPosition === selectedSeatPosition &&
				seat.occupancy === "player"
		) ?? null;

	return {
		onSelectSeat: setSelectedSeatPosition,
		selectedPlayerId: selectedSeat?.player?.playerId ?? null,
		selectedSeat,
		selectedSeatPosition: selectedSeat === null ? null : selectedSeatPosition,
	};
}
