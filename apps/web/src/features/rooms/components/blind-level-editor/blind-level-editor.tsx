import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useBlindLevels } from "@/features/rooms/hooks/use-blind-levels";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { BlindStructureTable } from "./blind-structure-table";
import { useLocalBlindStructure } from "./use-blind-level-editor";

// Levels carry per-level games in per-level mode (the "mix" sentinel):
// there each level picks its own variant in the sheet. A mix-master
// variant keeps the flat blind columns — its games rotate independently of
// the level structure — but each level can OPTIONALLY split into per-game
// blind sets (hybridGames), locked to the mix's composition. Plain
// variants are always flat. compositionFor maps the sheet's pick to the
// games it stands for.
function useLevelSheetWiring(variant: string) {
	const { groupFor, labelsFor, isMixValue, mixCompositionLabels } =
		useGameGroups();
	const isPerLevel = variant.trim().toLowerCase() === MIX_VARIANT;
	const isMixMaster = !isPerLevel && isMixValue(variant);
	const compositionFor = (label: string): string[] =>
		isMixValue(label) && label.trim().toLowerCase() !== MIX_VARIANT
			? mixCompositionLabels(label)
			: [label];
	return {
		blindLabels: labelsFor(variant),
		compositionFor,
		groupFor,
		hybridGames: isMixMaster,
		isMix: isPerLevel,
		levelSheetMode: (isPerLevel ? "assign" : "locked") as "assign" | "locked",
		lockedLabels: isMixMaster ? mixCompositionLabels(variant) : [],
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
		groupFor,
		hybridGames,
		isMix,
		levelSheetMode,
		lockedLabels,
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
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			hybridGames={hybridGames}
			isAdding={isAdding}
			isMix={isMix}
			levelSheetMode={levelSheetMode}
			levels={levels}
			lockedLabels={lockedLabels}
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
		groupFor,
		hybridGames,
		isMix,
		levelSheetMode,
		lockedLabels,
	} = useLevelSheetWiring(variant);

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			compositionFor={compositionFor}
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			hybridGames={hybridGames}
			isMix={isMix}
			levelSheetMode={levelSheetMode}
			levels={value}
			lockedLabels={lockedLabels}
			resolveGroup={groupFor}
			sensors={sensors}
		/>
	);
}
