import type { SessionBlindLevelInput } from "@/features/sessions/utils/session-form-helpers";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";

/**
 * Adapt the wizard's blind-level snapshot to the `BlindLevelRow` shape
 * the shared store editor (`LocalBlindStructureContent`) expects. The
 * editor needs a stable `id` per row for drag-and-drop reordering, so
 * each row gets a fresh uuid; `level` is the 1-based position and
 * `tournamentId` is irrelevant for the local (uncommitted) editor.
 */
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
	}));
}

/** Strip the editor-only fields back down to the submit payload shape. */
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
	}));
}
