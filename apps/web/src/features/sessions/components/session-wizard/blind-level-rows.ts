import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { SessionBlindLevelInput } from "@/features/sessions/utils/session-form-helpers";

export function toBlindLevelRows(
	levels: SessionBlindLevelInput[]
): BlindLevelRow[] {
	return levels.map((level, idx) => ({
		id: crypto.randomUUID(),
		tournamentId: "",
		level: idx + 1,
		isBreak: level.isBreak,
		blind1: level.blind1,
		blind2: level.blind2,
		blind3: level.blind3,
		ante: level.ante,
		minutes: level.minutes,
		games: level.games ?? null,
	}));
}

export function toSessionBlindLevels(
	rows: BlindLevelRow[]
): SessionBlindLevelInput[] {
	return rows.map((row) => ({
		isBreak: row.isBreak,
		blind1: row.blind1,
		blind2: row.blind2,
		blind3: row.blind3,
		ante: row.ante,
		minutes: row.minutes,
		games: row.games ?? null,
	}));
}
