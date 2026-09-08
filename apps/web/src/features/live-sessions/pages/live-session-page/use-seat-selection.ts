import { useState } from "react";
import type { SeatEntry } from "@/features/live-sessions/hooks/use-session-seats";
import type { ScanSeatState } from "@/features/live-sessions/utils/seat-scan-review";

export type SeatSheet = "reset" | "scan" | "sitIn";

export function toScanSeatStates(seats: SeatEntry[]): ScanSeatState[] {
	return seats.map((seat) => ({
		occupancy: seat.occupancy,
		playerId: seat.player?.playerId ?? null,
		playerName: seat.player?.name ?? null,
		seatPosition: seat.seatPosition,
	}));
}

export function useSeatSelection(seats: SeatEntry[]) {
	const [selectedSeatPosition, setSelectedSeatPosition] = useState<
		number | null
	>(null);
	const [sitInSeatPosition, setSitInSeatPosition] = useState<number | null>(
		null
	);
	const [seatSheet, setSeatSheet] = useState<SeatSheet | null>(null);

	const selectedSeat =
		seats.find(
			(seat) =>
				seat.seatPosition === selectedSeatPosition &&
				seat.occupancy === "player" &&
				seat.player?.isLoading !== true
		) ?? null;

	return {
		onCloseSeatSheet: () => setSeatSheet(null),
		onOpenResetSeats: () => setSeatSheet("reset"),
		onOpenScan: () => setSeatSheet("scan"),
		onSelectSeat: (seatPosition: number) => {
			const seat = seats.find((item) => item.seatPosition === seatPosition);
			if (seat?.player?.isLoading) {
				return;
			}
			if (seat?.occupancy === "player") {
				setSelectedSeatPosition(seatPosition);
				return;
			}
			setSitInSeatPosition(seatPosition);
			setSeatSheet("sitIn");
		},
		scanSeats: toScanSeatStates(seats),
		seatSheet,
		selectedPlayerId: selectedSeat?.player?.playerId ?? null,
		selectedSeat,
		selectedSeatPosition: selectedSeat === null ? null : selectedSeatPosition,
		sitInSeatPosition,
	};
}
