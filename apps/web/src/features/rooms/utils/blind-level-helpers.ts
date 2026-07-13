import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

export interface NewLevelValues {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	/** Present only when the variant exposes a named third blind slot. */
	blind3?: number | null;
	/** Per-game blind sets (mix-master empty block); null/absent = flat. */
	games?: LevelGameGroup[] | null;
	minutes: number | null;
}

export const BLIND_LEVEL_INPUT_ERROR = "Enter a non-negative whole number";

/** Empty cells may clear a value; non-empty cells must be safe unsigned ints. */
export function isValidBlindLevelInput(value: string): boolean {
	const trimmed = value.trim();
	if (trimmed === "") {
		return true;
	}
	const parsed = Number(trimmed);
	return Number.isSafeInteger(parsed) && parsed >= 0;
}

/** Parse a valid numeric cell; empty or invalid text maps to null. */
export function parseIntOrNull(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "" || !isValidBlindLevelInput(trimmed)) {
		return null;
	}
	return Number(trimmed);
}

/**
 * Parse a blind-table input while exposing invalid text to the browser's
 * accessible constraint UI. `undefined` means invalid/no write; `null` means
 * the user intentionally cleared the cell.
 */
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

/**
 * Blind auto-fill rule shared by every blind editor row (flat empty row,
 * flat sortable row, mix-master empty block): on blind1 blur, a blank
 * blind2 cell derives blind1 × 2. Returns the new cell text, or null to
 * leave a filled cell untouched.
 */
export function deriveAutoBlind2(
	blind1: number,
	blind2Cell: string
): string | null {
	return blind2Cell ? null : String(blind1 * 2);
}

/**
 * Second half of the auto-fill rule: a blank ante cell copies the source
 * cell's text (blind2 after a blind1 blur, the blurred value on a blind2
 * blur). Returns the new cell text, or null to leave a filled cell
 * untouched. Callers guard the source's parseability.
 */
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

export type GameSetAmountField = "ante" | "blind1" | "blind2" | "blind3";

/** One game-set cell edit: `games[index][field] = value` on a level. */
export interface GameSetCellPatch {
	field: GameSetAmountField;
	index: number;
	value: number | null;
}

/**
 * Apply one game-set cell edit to a level's games array. Returns a new array
 * with only the targeted set patched, or null when there is nothing to patch
 * (no games, or the index is out of range) so callers can skip the write.
 */
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
			level: levels.length + 1,
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
