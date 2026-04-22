import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";

export interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	minutes: number | null;
}

export function getEffectiveLastMinutes(
	lastMinutes: number | null,
	levels: BlindLevelRow[]
): number | null {
	if (lastMinutes != null) {
		return lastMinutes;
	}
	for (let i = levels.length - 1; i >= 0; i--) {
		if (levels[i].minutes != null) {
			return levels[i].minutes;
		}
	}
	return null;
}

export function reorderLevels(
	levels: BlindLevelRow[],
	event: DragEndEvent
): BlindLevelRow[] | null {
	const { active, over } = event;
	if (!over || active.id === over.id) {
		return null;
	}
	const oldIndex = levels.findIndex((l) => l.id === active.id);
	const newIndex = levels.findIndex((l) => l.id === over.id);
	if (oldIndex === -1 || newIndex === -1) {
		return null;
	}
	return arrayMove(levels, oldIndex, newIndex).map((l, i) => ({
		...l,
		level: i + 1,
	}));
}

export function addLevel(
	levels: BlindLevelRow[],
	effectiveLastMinutes: number | null,
	isBreak: boolean
): BlindLevelRow[] {
	return [
		...levels,
		{
			id: crypto.randomUUID(),
			tournamentId: "",
			level: levels.length + 1,
			isBreak,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: effectiveLastMinutes,
		},
	];
}

export function deleteLevel(
	levels: BlindLevelRow[],
	id: string
): BlindLevelRow[] {
	return levels
		.filter((l) => l.id !== id)
		.map((l, i) => ({ ...l, level: i + 1 }));
}

export function updateLevel(
	levels: BlindLevelRow[],
	id: string,
	updates: Record<string, number | null>
): BlindLevelRow[] {
	return levels.map((l) => (l.id === id ? { ...l, ...updates } : l));
}

export function createLevel(
	levels: BlindLevelRow[],
	vals: NewLevelValues,
	effectiveLastMinutes: number | null
): BlindLevelRow[] {
	const minutes = vals.minutes ?? effectiveLastMinutes;
	return [
		...levels,
		{
			id: crypto.randomUUID(),
			tournamentId: "",
			level: levels.length + 1,
			isBreak: false,
			blind1: vals.blind1,
			blind2: vals.blind2,
			blind3: null,
			ante: vals.ante,
			minutes,
		},
	];
}
