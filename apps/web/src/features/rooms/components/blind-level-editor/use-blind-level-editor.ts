import type { DragEndEvent } from "@dnd-kit/core";
import {
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	addLevel,
	applyGameSetCell,
	type BlindLevelPatch,
	createLevel,
	deleteLevel,
	type GameSetCellPatch,
	getEffectiveLastMinutes,
	type NewLevelValues,
	reorderLevels,
	updateLevel,
} from "@/features/rooms/utils/blind-level-helpers";

interface UseLocalBlindStructureOptions {
	onChange: (levels: BlindLevelRow[]) => void;
	value: BlindLevelRow[];
}

export function useLocalBlindStructure({
	value,
	onChange,
}: UseLocalBlindStructureOptions) {
	const [lastMinutes, setLastMinutes] = useState<number | null>(null);

	const effectiveLastMinutes = getEffectiveLastMinutes(lastMinutes, value);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 8 },
		})
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const reordered = reorderLevels(value, event);
		if (reordered) {
			onChange(reordered);
		}
	};

	const handleAddLevel = (defaultGames?: LevelGameGroup[] | null) => {
		onChange(
			addLevel(value, effectiveLastMinutes, false, defaultGames ?? null)
		);
	};

	const handleAddBreak = () => {
		onChange(addLevel(value, effectiveLastMinutes, true));
	};

	const handleDelete = (id: string) => {
		onChange(deleteLevel(value, id));
	};

	const handleUpdate = (id: string, updates: BlindLevelPatch) => {
		onChange(updateLevel(value, id, updates));
		if (updates.minutes != null) {
			setLastMinutes(updates.minutes);
		}
	};

	const handleUpdateGameSet = (id: string, cell: GameSetCellPatch) => {
		const games = applyGameSetCell(value.find((l) => l.id === id)?.games, cell);
		if (!games) {
			return;
		}
		onChange(updateLevel(value, id, { games }));
	};

	const handleCreateLevel = (vals: NewLevelValues) => {
		const minutes = vals.minutes ?? effectiveLastMinutes;
		onChange(createLevel(value, vals, effectiveLastMinutes));
		if (minutes != null) {
			setLastMinutes(minutes);
		}
	};

	return {
		sensors,
		handleDragEnd,
		handleAddLevel,
		handleAddBreak,
		handleDelete,
		handleUpdate,
		handleUpdateGameSet,
		handleCreateLevel,
	};
}
