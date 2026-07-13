import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useBlindLevels } from "@/features/rooms/hooks/use-blind-levels";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { rowsFromVariantLabels, toLevelGames } from "@/shared/lib/mix-games";
import { BlindStructureTable } from "./blind-structure-table";
import { useLocalBlindStructure } from "./use-blind-level-editor";

// Levels carry per-level games in per-level mode (the "mix" sentinel):
// there each level picks its own variant in the sheet. A mix-master
// variant renders WSOP-structure-sheet style (hybridGames): levels default
// to one inline row per game of the composition, and each level can toggle
// back to a single flat blind set. Plain variants are always flat.
// compositionFor maps the sheet's pick to the games it stands for.
function useLevelSheetWiring(variant: string) {
	const { groupFor, labelsFor, isMixValue, mixCompositionLabels } =
		useGameGroups();
	const isPerLevel = variant.trim().toLowerCase() === MIX_VARIANT;
	const isMixMaster = !isPerLevel && isMixValue(variant);
	const compositionFor = (label: string): string[] =>
		isMixValue(label) && label.trim().toLowerCase() !== MIX_VARIANT
			? mixCompositionLabels(label)
			: [label];
	// Mix-master tournaments default new levels to per-game blind sets seeded
	// from the composition (amounts blank); typing into the empty row still
	// creates an explicit flat level.
	const defaultLevelGames = isMixMaster
		? toLevelGames(
				rowsFromVariantLabels(mixCompositionLabels(variant), groupFor)
			)
		: null;
	return {
		blindLabels: labelsFor(variant),
		compositionFor,
		defaultLevelGames,
		groupFor,
		hybridGames: isMixMaster,
		isMix: isPerLevel,
	};
}

// ---- Main content (API-backed) ----

interface BlindStructureContentProps {
	tournamentId: string;
	variant: string;
}

export function BlindStructureContent({
	tournamentId,
	variant,
}: BlindStructureContentProps) {
	const {
		levels,
		isLoading,
		isAdding,
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleCreateLevel,
	} = useBlindLevels({ tournamentId });

	const {
		blindLabels,
		compositionFor,
		defaultLevelGames,
		groupFor,
		hybridGames,
		isMix,
	} = useLevelSheetWiring(variant);

	if (isLoading) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				Loading levels...
			</p>
		);
	}

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			compositionFor={compositionFor}
			defaultGames={defaultLevelGames}
			handleAddBreak={handleAddBreak}
			handleAddLevel={() => handleAddLevel(defaultLevelGames)}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			hybridGames={hybridGames}
			isAdding={isAdding}
			isMix={isMix}
			levels={levels}
			resolveGroup={groupFor}
			sensors={sensors}
		/>
	);
}

// ---- Local-state content (for create modal) ----

interface LocalBlindStructureContentProps {
	onChange: (levels: BlindLevelRow[]) => void;
	value: BlindLevelRow[];
	variant?: string;
}

export function LocalBlindStructureContent({
	value,
	onChange,
	variant = DEFAULT_VARIANT_LABEL,
}: LocalBlindStructureContentProps) {
	const {
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleCreateLevel,
	} = useLocalBlindStructure({ value, onChange });

	const {
		blindLabels,
		compositionFor,
		defaultLevelGames,
		groupFor,
		hybridGames,
		isMix,
	} = useLevelSheetWiring(variant);

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			compositionFor={compositionFor}
			defaultGames={defaultLevelGames}
			handleAddBreak={handleAddBreak}
			handleAddLevel={() => handleAddLevel(defaultLevelGames)}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			hybridGames={hybridGames}
			isMix={isMix}
			levels={value}
			resolveGroup={groupFor}
			sensors={sensors}
		/>
	);
}
