import {
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
} from "@sapphire2/db/constants/game-variants";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useBlindLevels } from "@/features/rooms/hooks/use-blind-levels";
import { QueryError } from "@/shared/components/query-error";
import { useGameGroups } from "@/shared/hooks/use-game-groups";
import { rowsFromVariantLabels, toLevelGames } from "@/shared/lib/mix-games";
import { BlindStructureTable } from "./blind-structure-table";
import { useLocalBlindStructure } from "./use-blind-level-editor";

// Levels carry per-level games in per-level mode (the "mix" sentinel):
// there each level picks its own variant in the sheet and renders as a
// "Games" summary row. A mix-master variant renders WSOP-structure-sheet
// style (hybridGames): levels with game sets are always one inline row per
// set (no flat toggle); breaks and legacy flat levels stay single-row.
// Hybrid rendering also derives from the levels themselves so game-set
// levels survive a deleted/renamed mix master, and the table is deferred
// while the masters load so blur edits cannot write conflicting flat
// values. compositionFor maps the sheet's pick to the games it stands for.
function useLevelSheetWiring(variant: string, levels: BlindLevelRow[]) {
	const { groupFor, isLoading, labelsFor, isMixValue, mixCompositionLabels } =
		useGameGroups();
	const isPerLevel = variant.trim().toLowerCase() === MIX_VARIANT;
	const isMixMaster = !isPerLevel && isMixValue(variant);
	const hasGameSetLevels = levels.some((l) => (l.games?.length ?? 0) > 0);
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
		hybridGames: !isPerLevel && (isMixMaster || hasGameSetLevels),
		isMastersLoading: isLoading,
		isMix: isPerLevel,
	};
}

function LoadingLevels() {
	return (
		<p className="py-8 text-center text-muted-foreground text-sm">
			Loading levels...
		</p>
	);
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
		isInitialLoadError,
		isLoading,
		isAdding,
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleUpdateGameSet,
		handleCreateLevel,
		onRetry,
	} = useBlindLevels({ tournamentId });

	const {
		blindLabels,
		compositionFor,
		defaultLevelGames,
		groupFor,
		hybridGames,
		isMastersLoading,
		isMix,
	} = useLevelSheetWiring(variant, levels);

	if (isLoading || isMastersLoading) {
		return <LoadingLevels />;
	}
	if (isInitialLoadError) {
		return (
			<QueryError message="Unable to load blind levels" onRetry={onRetry} />
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
			handleUpdateGameSet={handleUpdateGameSet}
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
		handleUpdateGameSet,
		handleCreateLevel,
	} = useLocalBlindStructure({ value, onChange });

	const {
		blindLabels,
		compositionFor,
		defaultLevelGames,
		groupFor,
		hybridGames,
		isMastersLoading,
		isMix,
	} = useLevelSheetWiring(variant, value);

	if (isMastersLoading) {
		return <LoadingLevels />;
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
			handleUpdateGameSet={handleUpdateGameSet}
			hybridGames={hybridGames}
			isMix={isMix}
			levels={value}
			resolveGroup={groupFor}
			sensors={sensors}
		/>
	);
}
