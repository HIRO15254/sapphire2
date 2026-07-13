import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

export interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	/** Per-game blind sets (mix-master empty block); null/absent = flat. */
	games?: LevelGameGroup[] | null;
	minutes: number | null;
}

/** Parse a numeric cell input; empty or non-numeric text maps to null. */
export function parseIntOrNull(value: string): number | null {
	if (!value) {
		return null;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
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
	isBreak: boolean,
	defaultGames: LevelGameGroup[] | null = null
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
			// Mix-master tournaments seed new levels with the mix's game sets
			// (default = per-game blinds); breaks never carry games.
			games: isBreak ? null : defaultGames,
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

export type BlindLevelPatch = Partial<
	Pick<
		BlindLevelRow,
		"blind1" | "blind2" | "blind3" | "ante" | "minutes" | "games"
	>
>;

export function updateLevel(
	levels: BlindLevelRow[],
	id: string,
	updates: BlindLevelPatch
): BlindLevelRow[] {
	return levels.map((l) => (l.id === id ? { ...l, ...updates } : l));
}

/**
 * Collapse a level's per-game blind sets into a single flat set. The first
 * set's amounts survive on the flat cells so minimizing the rows never
 * silently drops what was entered; the extra sets are intentionally
 * dropped (flat = one set), which is why the collapse carries the primary
 * set instead of clearing everything.
 */
export function toSingleSetPatch(
	games: LevelGameGroup[] | null
): BlindLevelPatch {
	const first = games?.[0] ?? null;
	return {
		games: null,
		blind1: first?.blind1 ?? null,
		blind2: first?.blind2 ?? null,
		blind3: first?.blind3 ?? null,
		ante: first?.ante ?? null,
	};
}

/**
 * Expand a flat level into per-game blind sets seeded from the mix
 * composition. The flat amounts are carried into the first set so the
 * inverse of `toSingleSetPatch` round-trips losslessly; the remaining sets
 * start blank for the user to fill.
 */
export function toGameSetsPatch(
	row: Pick<BlindLevelRow, "ante" | "blind1" | "blind2" | "blind3">,
	seeds: LevelGameGroup[]
): BlindLevelPatch {
	if (seeds.length === 0) {
		return { games: null };
	}
	const games = seeds.map((set, index) =>
		index === 0
			? {
					...set,
					blind1: row.blind1,
					blind2: row.blind2,
					blind3: row.blind3,
					ante: row.ante,
				}
			: { ...set }
	);
	return { games };
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
			games: vals.games ?? null,
		},
	];
}
