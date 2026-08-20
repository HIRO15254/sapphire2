import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

export interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3?: number | null;
	games?: LevelGameGroup[] | null;
	minutes: number | null;
}

export const BLIND_LEVEL_INPUT_ERROR = "Enter a non-negative whole number";

export function isValidBlindLevelInput(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed === "") {
		return true;
	}
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) && parsed >= 0;
}

export function parseIntOrNull(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "" || !isValidBlindLevelInput(trimmed)) {
		return null;
	}
	return Number(trimmed);
}

export function parseBlindLevelInput(
	input: HTMLInputElement
): number | null | undefined {
	if (!isValidBlindLevelInput(input.value)) {
		input.setCustomValidity(BLIND_LEVEL_INPUT_ERROR);
		input.setAttribute("aria-invalid", "true");
		input.reportValidity();
		return undefined;
	}
	input.setCustomValidity("");
	input.removeAttribute("aria-invalid");
	return parseIntOrNull(input.value);
}

export function deriveAutoBlind2(
	blind1: number,
	blind2Cell: string
): string | null {
	return blind2Cell ? null : String(blind1 * 2);
}

export function deriveAutoAnte(
	sourceCell: string,
	anteCell: string
): string | null {
	return anteCell ? null : sourceCell;
}

export function getEffectiveLastMinutes(
	lastMinutes: number | null,
	levels: BlindLevelRow[]
): number | null {
	if (lastMinutes != null) {
		return lastMinutes;
	}
	for (let i = levels.length - 1; i >= 0; i--) {
		const level = levels[i];
		if (level?.minutes != null) {
			return level.minutes;
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

export function nextLevelNumber(
	levels: Pick<BlindLevelRow, "level">[]
): number {
	return levels.reduce((max, l) => Math.max(max, l.level), 0) + 1;
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
			level: nextLevelNumber(levels),
			isBreak,
			blind1: null,
			blind2: null,
			blind3: null,
			ante: null,
			minutes: effectiveLastMinutes,
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

export type GameSetAmountField = "ante" | "blind1" | "blind2" | "blind3";

export interface GameSetCellPatch {
	field: GameSetAmountField;
	index: number;
	value: number | null;
}

export function applyGameSetCell(
	games: LevelGameGroup[] | null | undefined,
	patch: GameSetCellPatch
): LevelGameGroup[] | null {
	if (!games || patch.index < 0 || patch.index >= games.length) {
		return null;
	}
	return games.map((set, i) =>
		i === patch.index ? { ...set, [patch.field]: patch.value } : set
	);
}

export function updateLevel(
	levels: BlindLevelRow[],
	id: string,
	updates: BlindLevelPatch
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
			level: nextLevelNumber(levels),
			isBreak: false,
			blind1: vals.blind1,
			blind2: vals.blind2,
			blind3: vals.blind3 ?? null,
			ante: vals.ante,
			minutes,
			games: vals.games ?? null,
		},
	];
}
