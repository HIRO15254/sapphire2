import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	type BlindLevelPatch,
	parseIntOrNull,
} from "@/features/rooms/utils/blind-level-helpers";

type GameSetAmountField = "ante" | "blind1" | "blind2" | "blind3";

interface UseGameSetRowsOptions {
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	row: BlindLevelRow;
}

/**
 * Blur handlers for a level rendered as one inline table row per game set
 * (mix-master tournaments). Each amount blur rewrites the level's `games`
 * array with only the touched set patched; minutes stays level-scoped.
 */
export function useGameSetRows({ row, onUpdate }: UseGameSetRowsOptions) {
	const games = row.games ?? [];

	const handleSetFieldBlur =
		(index: number, field: GameSetAmountField) =>
		(e: React.FocusEvent<HTMLInputElement>) => {
			const parsed = parseIntOrNull(e.target.value);
			onUpdate(row.id, {
				games: games.map((set, i) =>
					i === index ? { ...set, [field]: parsed } : set
				),
			});
		};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		onUpdate(row.id, { minutes: parseIntOrNull(e.target.value) });
	};

	return { games, handleSetFieldBlur, handleMinutesBlur };
}
