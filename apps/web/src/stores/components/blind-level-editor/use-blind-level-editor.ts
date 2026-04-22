import type { DragEndEvent } from "@dnd-kit/core";
import {
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import {
	addLevel,
	createLevel,
	deleteLevel,
	getEffectiveLastMinutes,
	type NewLevelValues,
	reorderLevels,
	updateLevel,
} from "@/stores/utils/blind-level-helpers";

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

	const handleAddLevel = () => {
		onChange(addLevel(value, effectiveLastMinutes, false));
	};

	const handleAddBreak = () => {
		onChange(addLevel(value, effectiveLastMinutes, true));
	};

	const handleDelete = (id: string) => {
		onChange(deleteLevel(value, id));
	};

	const handleUpdate = (id: string, updates: Record<string, number | null>) => {
		onChange(updateLevel(value, id, updates));
		if (updates.minutes != null) {
			setLastMinutes(updates.minutes);
		}
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
		handleCreateLevel,
	};
}
