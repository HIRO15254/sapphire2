import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { ResolveGroup } from "@/shared/lib/mix-games";

interface UseBlindStructureTableOptions {
	defaultGames?: LevelGameGroup[] | null;
	hybridGames: boolean;
	plainBlind3Label?: string | null;
	resolveGroup?: ResolveGroup;
}

export interface GameHeaderRow {
	blind1Label: string;
	blind2Label: string;
	blind3Label: string | null;
	key: string;
	label: string;
}

function setGroupId(resolveGroup: ResolveGroup, set: LevelGameGroup): string {
	return resolveGroup(set.variants[0] ?? "").id;
}

/**
 * The grouped header labels amounts by position, so it is only safe when
 * every non-break level with game sets follows the composition's group
 * sequence (same length, same group per position). A stored level from an
 * older/edited composition falls back to the generic single header row
 * (null) instead of letting amounts be edited under wrong labels; per-row
 * game labels stay correct either way.
 */
function levelsMatchComposition(
	levels: BlindLevelRow[],
	composition: LevelGameGroup[],
	resolveGroup: ResolveGroup
): boolean {
	const compositionIds = composition.map((set) =>
		setGroupId(resolveGroup, set)
	);
	return levels.every((level) => {
		const games = level.games ?? [];
		if (level.isBreak || games.length === 0) {
			return true;
		}
		if (games.length !== compositionIds.length) {
			return false;
		}
		return games.every(
			(set, i) => setGroupId(resolveGroup, set) === compositionIds[i]
		);
	});
}

/**
 * Sheet-state for the mix-mode table (which level's game groups are being
 * edited — resolving the row from `levels` keeps the sheet in sync with
 * optimistic updates while open) plus the hybrid table's per-group header
 * rows: one per game of the mix composition, labeled with that group's
 * blind slots (WSOP structure-sheet style). Header rows are null when any
 * stored level mismatches the composition (see levelsMatchComposition).
 */
export function useBlindStructureTable(
	levels: BlindLevelRow[],
	{
		defaultGames,
		hybridGames,
		plainBlind3Label,
		resolveGroup,
	}: UseBlindStructureTableOptions
) {
	const [openGamesLevelId, setOpenGamesLevelId] = useState<string | null>(null);
	const openLevel = levels.find((l) => l.id === openGamesLevelId) ?? null;

	const headerGroups: GameHeaderRow[] | null =
		hybridGames &&
		resolveGroup &&
		defaultGames?.length &&
		levelsMatchComposition(levels, defaultGames, resolveGroup)
			? defaultGames.map((set) => {
					const group = resolveGroup(set.variants[0] ?? "");
					return {
						key: set.variants.join("+"),
						label: group.label,
						blind1Label: group.blind1Label,
						blind2Label: group.blind2Label,
						blind3Label: group.blind3Label,
					};
				})
			: null;
	const visibleGameSets = [
		...(defaultGames ?? []),
		...levels.flatMap((level) => level.games ?? []),
	];
	const hasBlind3Column = hybridGames
		? resolveGroup !== undefined &&
			visibleGameSets.some(
				(set) => resolveGroup(set.variants[0] ?? "").blind3Label !== null
			)
		: plainBlind3Label != null;

	return {
		hasBlind3Column,
		headerGroups,
		openLevel,
		openGamesFor: (id: string) => setOpenGamesLevelId(id),
		closeGames: () => setOpenGamesLevelId(null),
	};
}
