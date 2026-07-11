import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

/**
 * Sheet-state for the mix-mode table: which level's game groups are being
 * edited. Resolving the row from `levels` (instead of storing the row)
 * keeps the sheet in sync with optimistic updates while it is open.
 */
export function useBlindStructureTable(levels: BlindLevelRow[]) {
	const [openGamesLevelId, setOpenGamesLevelId] = useState<string | null>(null);
	const openLevel = levels.find((l) => l.id === openGamesLevelId) ?? null;

	return {
		openLevel,
		openGamesFor: (id: string) => setOpenGamesLevelId(id),
		closeGames: () => setOpenGamesLevelId(null),
	};
}
