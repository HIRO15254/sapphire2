import {
	type BlindLabels,
	DEFAULT_BLIND_LABELS,
} from "@/features/game-variants/utils/blind-labels";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useBlindLevels } from "@/features/rooms/hooks/use-blind-levels";
import { BlindStructureTable } from "./blind-structure-table";
import { useLocalBlindStructure } from "./use-blind-level-editor";

// ---- Main content (API-backed) ----

interface BlindStructureContentProps {
	/** Blind-slot labels for the tournament's variant. Falls back to the
	 * SB/BB/Straddle defaults when omitted (e.g. an external caller that
	 * hasn't resolved the variant's labels yet). */
	blindLabels?: BlindLabels;
	tournamentId: string;
}

export function BlindStructureContent({
	tournamentId,
	blindLabels = DEFAULT_BLIND_LABELS,
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
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			isAdding={isAdding}
			levels={levels}
			sensors={sensors}
		/>
	);
}

// ---- Local-state content (for create modal) ----

interface LocalBlindStructureContentProps {
	/** Blind-slot labels for the currently-selected variant. Falls back to the
	 * SB/BB/Straddle defaults when omitted, keeping existing external callers
	 * (which still pass the legacy `variant` text prop) compiling. */
	blindLabels?: BlindLabels;
	onChange: (levels: BlindLevelRow[]) => void;
	value: BlindLevelRow[];
	/**
	 * @deprecated unused now that `blindLabels` is resolved by the caller from
	 * the user's game variants; kept so existing callers that still pass a
	 * free-text variant keep compiling.
	 */
	variant?: string;
}

export function LocalBlindStructureContent({
	value,
	onChange,
	blindLabels = DEFAULT_BLIND_LABELS,
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

	return (
		<BlindStructureTable
			blindLabels={blindLabels}
			handleAddBreak={handleAddBreak}
			handleAddLevel={handleAddLevel}
			handleCreateLevel={handleCreateLevel}
			handleDelete={handleDelete}
			handleDragEnd={handleDragEnd}
			handleUpdate={handleUpdate}
			levels={value}
			sensors={sensors}
		/>
	);
}
