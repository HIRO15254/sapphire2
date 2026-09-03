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
