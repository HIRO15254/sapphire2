import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import type { GameGroupLike } from "@/features/live-sessions/utils/game-scene-formatters";
import type { TournamentBlindLevel } from "@/features/live-sessions/utils/tournament-timer";
import { mixCellError } from "@/shared/lib/mix-games";

export interface BlindLevelRow {
	ante: string;
	blind1: string;
	blind2: string;
	blind3: string;
	games: LevelGameGroup[] | null;
	isBreak: boolean;
	minutes: string;
	uid: string;
}

export interface BlindLevelInput {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	games: LevelGameGroup[] | null;
	isBreak: boolean;
	minutes: number | null;
}

export const DEFAULT_LEVEL_MINUTES = "20";
const BREAK_MINUTES = "10";
const FIRST_SMALL_BLIND = 100;
const BLIND_STEP = 100;
const BLIND_GROWTH = 1.25;

const AMOUNT_CELLS = ["blind1", "blind2", "blind3", "ante", "minutes"] as const;

function textOf(value: number | null | undefined): string {
	return value == null ? "" : String(value);
}

function intOf(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "" || mixCellError(trimmed) !== undefined) {
		return null;
	}
	return Number(trimmed);
}

function toLevelGames(
	games: GameGroupLike[] | null | undefined
): LevelGameGroup[] | null {
	if (!games || games.length === 0) {
		return null;
	}
	return games.map((group) => ({
		ante: group.ante ?? null,
		blind1: group.blind1 ?? null,
		blind2: group.blind2 ?? null,
		blind3: group.blind3 ?? null,
		name: group.name ?? null,
		variants: [...group.variants],
	}));
}

export function toBlindLevelRows(
	levels: readonly TournamentBlindLevel[]
): BlindLevelRow[] {
	return [...levels]
		.sort((a, b) => a.level - b.level)
		.map((level) => ({
			ante: textOf(level.ante),
			blind1: textOf(level.blind1),
			blind2: textOf(level.blind2),
			blind3: textOf(level.blind3),
			games: level.isBreak ? null : toLevelGames(level.games),
			isBreak: level.isBreak,
			minutes: textOf(level.minutes),
			uid: level.id,
		}));
}

export function toBlindLevelInputs(
	rows: readonly BlindLevelRow[]
): BlindLevelInput[] {
	return rows.map((row) =>
		row.isBreak
			? {
					ante: null,
					blind1: null,
					blind2: null,
					blind3: null,
					games: null,
					isBreak: true,
					minutes: intOf(row.minutes),
				}
			: {
					ante: intOf(row.ante),
					blind1: intOf(row.blind1),
					blind2: intOf(row.blind2),
					blind3: intOf(row.blind3),
					games: row.games && row.games.length > 0 ? row.games : null,
					isBreak: false,
					minutes: intOf(row.minutes),
				}
	);
}

export function sameBlindStructure(
	left: readonly BlindLevelRow[],
	right: readonly BlindLevelRow[]
): boolean {
	return (
		JSON.stringify(toBlindLevelInputs(left)) ===
		JSON.stringify(toBlindLevelInputs(right))
	);
}

export function blindCellError(
	row: BlindLevelRow,
	cell: (typeof AMOUNT_CELLS)[number]
): string | undefined {
	if (row.isBreak && cell !== "minutes") {
		return undefined;
	}
	return mixCellError(row[cell]);
}

export function hasBlindRowErrors(rows: readonly BlindLevelRow[]): boolean {
	return rows.some((row) =>
		AMOUNT_CELLS.some((cell) => blindCellError(row, cell) !== undefined)
	);
}

function nextSmallBlind(rows: readonly BlindLevelRow[]): number {
	const previous = rows
		.filter((row) => !row.isBreak)
		.map((row) => intOf(row.blind1))
		.at(-1);
	if (previous == null) {
		return FIRST_SMALL_BLIND;
	}
	const grown = Math.round((previous * BLIND_GROWTH) / BLIND_STEP) * BLIND_STEP;
	if (grown > previous) {
		return grown;
	}
	return (Math.floor(previous / BLIND_STEP) + 1) * BLIND_STEP;
}

export function nextLevelRow(
	rows: readonly BlindLevelRow[],
	minutes: string,
	uid: string
): BlindLevelRow {
	const smallBlind = nextSmallBlind(rows);
	const bigBlind = String(smallBlind * 2);
	return {
		ante: bigBlind,
		blind1: String(smallBlind),
		blind2: bigBlind,
		blind3: "",
		games: null,
		isBreak: false,
		minutes,
		uid,
	};
}

export function breakRow(uid: string): BlindLevelRow {
	return {
		ante: "",
		blind1: "",
		blind2: "",
		blind3: "",
		games: null,
		isBreak: true,
		minutes: BREAK_MINUTES,
		uid,
	};
}

export function labelBlindRows(
	rows: readonly BlindLevelRow[]
): { label: string; levelNumber: number | null }[] {
	let levelNumber = 0;
	return rows.map((row) => {
		if (row.isBreak) {
			return { label: "BR", levelNumber: null };
		}
		levelNumber += 1;
		return { label: `L${levelNumber}`, levelNumber };
	});
}

export function summarizeBlindRows(rows: readonly BlindLevelRow[]): {
	levelCount: number;
	totalMinutes: number;
} {
	return {
		levelCount: rows.filter((row) => !row.isBreak).length,
		totalMinutes: rows.reduce(
			(total, row) => total + (intOf(row.minutes) ?? 0),
			0
		),
	};
}

export function defaultLevelMinutes(rows: readonly BlindLevelRow[]): string {
	const last = rows
		.filter((row) => !row.isBreak)
		.map((row) => intOf(row.minutes))
		.at(-1);
	return last == null || last === 0 ? DEFAULT_LEVEL_MINUTES : String(last);
}
