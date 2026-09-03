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
	compositionFor: (variantLabel: string) => string[];
	games: LevelGamesValue;
	onSave: (games: LevelGamesValue) => void;
	open: boolean;
	resolveGroup: ResolveGroup;
}

export function useLevelPatternsSheet({
	compositionFor,
	games,
	onSave,
	open,
	resolveGroup,
}: UseLevelPatternsSheetArgs) {
	const seed = () => fromLevelGames(games, resolveGroup);

	const [rows, setRows] = useState<MixGameGroupRow[]>(seed);
	const [assignedVariant, setAssignedVariant] = useState("");

	// biome-ignore lint/correctness/useExhaustiveDependencies: `games` is intentionally read only at open-transition time — the buffer must not reset on parent re-renders while editing.
	useEffect(() => {
		if (open) {
			setRows(seed());
			setAssignedVariant("");
		}
	}, [open]);

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

	return {
		assignedVariant,
		handleDone,
		onAssignVariant,
		rows,
		setRows,
	};
}
