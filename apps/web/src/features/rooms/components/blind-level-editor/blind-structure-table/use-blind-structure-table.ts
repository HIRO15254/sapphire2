import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { ResolveGroup } from "@/shared/lib/mix-games";

interface UseBlindStructureTableOptions {
	defaultGames?: LevelGameGroup[] | null;
	hybridGames: boolean;
	resolveGroup?: ResolveGroup;
}

export interface GameHeaderRow {
	blind1Label: string;
	blind2Label: string;
	key: string;
	label: string;
}

/**
 * Sheet-state for the mix-mode table (which level's game groups are being
 * edited — resolving the row from `levels` keeps the sheet in sync with
 * optimistic updates while open) plus the hybrid table's per-group header
 * rows: one per game of the mix composition, labeled with that group's
 * blind slots (WSOP structure-sheet style).
 */
export function useBlindStructureTable(
	levels: BlindLevelRow[],
	{ defaultGames, hybridGames, resolveGroup }: UseBlindStructureTableOptions
) {
	const [openGamesLevelId, setOpenGamesLevelId] = useState<string | null>(null);
	const openLevel = levels.find((l) => l.id === openGamesLevelId) ?? null;

	const headerGroups: GameHeaderRow[] | null =
		hybridGames && resolveGroup && defaultGames?.length
			? defaultGames.map((set) => {
					const group = resolveGroup(set.variants[0] ?? "");
					return {
						key: set.variants.join("+"),
						label: group.label,
						blind1Label: group.blind1Label,
						blind2Label: group.blind2Label,
					};
				})
			: null;

	return {
		headerGroups,
		openLevel,
		openGamesFor: (id: string) => setOpenGamesLevelId(id),
		closeGames: () => setOpenGamesLevelId(null),
	};
}
