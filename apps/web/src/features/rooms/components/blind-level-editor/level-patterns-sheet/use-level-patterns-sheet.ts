import { useEffect, useState } from "react";
import {
	fromLevelGames,
	type MixGameGroupRow,
	toLevelGames,
} from "@/shared/lib/mix-games";
import type { LevelGamesValue } from "./level-patterns-sheet";

interface UseLevelPatternsSheetArgs {
	/** The level's current groups; re-seeds the editor when the sheet opens. */
	games: LevelGamesValue;
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
}

/**
 * Local edit buffer for a level's game groups: edits stay in the sheet
 * until Done applies them in one shot (a per-keystroke onSave would spam
 * blindLevel.update in the API-backed editor).
 */
export function useLevelPatternsSheet({
	games,
	onSave,
	open,
}: UseLevelPatternsSheetArgs) {
	const [rows, setRows] = useState<MixGameGroupRow[]>(() =>
		fromLevelGames(games)
	);

	// Re-seed whenever the sheet (re)opens for a possibly different level.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `games` is intentionally read only at open-transition time — the buffer must not reset on parent re-renders while editing.
	useEffect(() => {
		if (open) {
			setRows(fromLevelGames(games));
		}
	}, [open]);

	const handleDone = () => {
		onSave(toLevelGames(rows));
	};

	return { rows, setRows, handleDone };
}
