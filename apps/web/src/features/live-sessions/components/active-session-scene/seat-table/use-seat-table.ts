import { useState } from "react";
import type { SeatPlayer } from "@/features/live-sessions/components/active-session-scene/use-active-session-scene-state";

interface UseSeatTableOptions {
	onRemovePlayer: (playerId: string) => void;
	onSeatExisting: (
		seatPosition: number,
		playerId: string,
		playerName: string
	) => void;
	onSeatHero: (seatPosition: number) => void;
	onSeatNew: (
		seatPosition: number,
		values: { memo?: string | null; name: string; tagIds?: string[] }
	) => void;
	onSeatTemporary: (seatPosition: number) => void;
	onUnseatHero: () => void;
}

/**
 * Drawer state for the poker-table seat view: an empty-seat tap opens the
 * seating drawer for that position, an occupied-seat (or unseated-row) tap
 * opens the edit drawer for that player, and a hero-seat tap unseats the hero
 * directly — matching the one-tap unseat the old table view had. Every seating
 * action closes its drawer after delegating to the scene-state handler.
 */
export function useSeatTable({
	onRemovePlayer,
	onSeatExisting,
	onSeatHero,
	onSeatNew,
	onSeatTemporary,
	onUnseatHero,
}: UseSeatTableOptions) {
	const [activeEmptySeat, setActiveEmptySeat] = useState<number | null>(null);
	const [activePlayer, setActivePlayer] = useState<SeatPlayer | null>(null);

	return {
		activeEmptySeat,
		activePlayer,
		onCloseEmptySeat: () => setActiveEmptySeat(null),
		onClosePlayer: () => setActivePlayer(null),
		onEmptySeatTap: (seatPosition: number) => {
			setActiveEmptySeat(seatPosition);
		},
		onHeroSeatTap: () => {
			onUnseatHero();
		},
		onPlayerTap: (player: SeatPlayer) => {
			setActivePlayer(player);
		},
		onSeatExisting: (playerId: string, playerName: string) => {
			if (activeEmptySeat === null) {
				return;
			}
			onSeatExisting(activeEmptySeat, playerId, playerName);
			setActiveEmptySeat(null);
		},
		onSeatHero: () => {
			if (activeEmptySeat === null) {
				return;
			}
			onSeatHero(activeEmptySeat);
			setActiveEmptySeat(null);
		},
		onSeatNew: (values: {
			memo?: string | null;
			name: string;
			tagIds?: string[];
		}) => {
			if (activeEmptySeat === null) {
				return;
			}
			onSeatNew(activeEmptySeat, values);
			setActiveEmptySeat(null);
		},
		onSeatTemporary: () => {
			if (activeEmptySeat === null) {
				return;
			}
			onSeatTemporary(activeEmptySeat);
			setActiveEmptySeat(null);
		},
		onUnseatActivePlayer: () => {
			if (!activePlayer) {
				return;
			}
			onRemovePlayer(activePlayer.playerId);
			setActivePlayer(null);
		},
	};
}
