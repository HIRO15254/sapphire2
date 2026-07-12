import { useEffect, useState } from "react";
import {
	fromLevelGames,
	type MixGameGroupRow,
	type ResolveGroup,
	reseedFromLabels,
	toLevelGames,
} from "@/shared/lib/mix-games";
import type { LevelGamesValue } from "./level-patterns-sheet";

interface UseLevelPatternsSheetArgs {
	/**
	 * Variant label → the games it stands for: a mix master label expands to
	 * its composition, anything else assigns that single game (from the
	 * wrapper's master data).
	 */
	compositionFor: (variantLabel: string) => string[];
	/** The level's current groups; re-seeds the editor when the sheet opens. */
	games: LevelGamesValue;
	/** Composition the structure is locked to (mode "locked"). */
	lockedLabels?: string[];
	/**
	 * "locked": the tournament-wide mix master dictates the level's games —
	 * the sheet edits amounts only, re-deriving stored games to the current
	 * composition (a level can also revert to a single flat blind set).
	 * "assign": each level gets its own variant, picked in the sheet.
	 */
	mode: "assign" | "locked";
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
	/** variant label → owning group (master mapping, from useGameGroups). */
	resolveGroup: ResolveGroup;
}

/**
 * Local edit buffer for a level's game groups: edits stay in the sheet
 * until Done applies them in one shot (a per-keystroke onSave would spam
 * blindLevel.update in the API-backed editor).
 */
export function useLevelPatternsSheet({
	compositionFor,
	games,
	lockedLabels,
	mode,
	onSave,
	open,
	resolveGroup,
}: UseLevelPatternsSheetArgs) {
	const seed = () => {
		const stored = fromLevelGames(games, resolveGroup);
		// Locked structure heals to the current master composition (amounts of
		// surviving groups carry over; a blank level starts from the mix).
		return mode === "locked"
			? reseedFromLabels(stored, lockedLabels ?? [], resolveGroup)
			: stored;
	};

	const [rows, setRows] = useState<MixGameGroupRow[]>(seed);
	// The variant picked for THIS open session (assign mode) — display only;
	// the level stores the resulting games, not the picked label.
	const [assignedVariant, setAssignedVariant] = useState("");

	// Re-seed whenever the sheet (re)opens for a possibly different level.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `games` is intentionally read only at open-transition time — the buffer must not reset on parent re-renders while editing.
	useEffect(() => {
		if (open) {
			setRows(seed());
			setAssignedVariant("");
		}
	}, [open]);

	// Assigning a variant re-derives the level's sets from what it stands
	// for; amounts of groups that survive the change are kept. A single-game
	// assignment names the set after the variant so the timer reads e.g.
	// "Razz 400/800" instead of the group label.
	const onAssignVariant = (variantLabel: string) => {
		const composition = compositionFor(variantLabel);
		let next = reseedFromLabels(rows, composition, resolveGroup);
		if (composition.length === 1) {
			next = next.map((row) => ({ ...row, name: variantLabel }));
		}
		setRows(next);
		setAssignedVariant(variantLabel);
	};

	const handleDone = () => {
		onSave(toLevelGames(rows));
	};

	// Locked mode only: drop the per-game sets — the level goes back to the
	// flat single blind set stored on the level row itself.
	const handleUseSingleSet = () => {
		onSave(null);
	};

	return {
		assignedVariant,
		handleDone,
		handleUseSingleSet,
		onAssignVariant,
		rows,
		setRows,
	};
}
