import { useMemo, useState } from "react";
import type { TablePlayer } from "@/features/live-sessions/components/poker-table";

interface UseActiveSessionSceneOptions {
	players: TablePlayer[];
}

export function useActiveSessionScene({
	players,
}: UseActiveSessionSceneOptions) {
	const [isDiscardOpen, setIsDiscardOpen] = useState(false);
	const [isScanSheetOpen, setIsScanSheetOpen] = useState(false);

	const occupiedSeatPositions = useMemo(() => {
		const set = new Set<number>();
		for (const p of players) {
			if (p.isActive && typeof p.seatPosition === "number") {
				set.add(p.seatPosition);
			}
		}
		return set;
	}, [players]);

	return {
		isDiscardOpen,
		setIsDiscardOpen,
		isScanSheetOpen,
		setIsScanSheetOpen,
		occupiedSeatPositions,
	};
}
