import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import {
	type BlindLevelPatch,
	type GameSetAmountField,
	type GameSetCellPatch,
	parseBlindLevelInput,
} from "@/features/rooms/utils/blind-level-helpers";

interface FocusedCell {
	field: GameSetAmountField;
	index: number;
	/** Cell value frozen at focus time so the input key stays stable. */
	value: number | null;
}

interface UseGameSetRowsOptions {
	onUpdate: (id: string, updates: BlindLevelPatch) => void;
	onUpdateGameSet: (id: string, cell: GameSetCellPatch) => void;
	row: BlindLevelRow;
}

/**
 * Blur handlers for a level rendered as one inline table row per game set
 * (mix-master tournaments). Amount blurs emit a set-cell patch ({index,
 * field, value}) via onUpdateGameSet — the games array itself is derived
 * from the freshest cache value by use-blind-levels, never from this
 * render's row prop; minutes stays level-scoped through onUpdate. Unchanged
 * blurs are skipped (dirty check) so tabbing through cells fires nothing.
 *
 * Input keys: unfocused cells are keyed by value so external cache changes
 * remount them in sync; the focused cell's key is frozen at focus time so a
 * refetch landing mid-typing cannot remount the input under the user.
 */
export function useGameSetRows({
	row,
	onUpdate,
	onUpdateGameSet,
}: UseGameSetRowsOptions) {
	const games = row.games ?? [];
	const [focusedCell, setFocusedCell] = useState<FocusedCell | null>(null);

	const cellValue = (index: number, field: GameSetAmountField) =>
		games[index]?.[field] ?? null;

	const handleSetFieldFocus =
		(index: number, field: GameSetAmountField) => () => {
			setFocusedCell({ index, field, value: cellValue(index, field) });
		};

	const handleSetFieldBlur =
		(index: number, field: GameSetAmountField) =>
		(e: React.FocusEvent<HTMLInputElement>) => {
			setFocusedCell(null);
			const parsed = parseBlindLevelInput(e.target);
			if (parsed === undefined) {
				return;
			}
			if (parsed === cellValue(index, field)) {
				return;
			}
			onUpdateGameSet(row.id, { index, field, value: parsed });
		};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		const minutes = parseBlindLevelInput(e.target);
		if (minutes !== undefined) {
			onUpdate(row.id, { minutes });
		}
	};

	const setFieldKey = (index: number, field: GameSetAmountField) => {
		const isFocused =
			focusedCell?.index === index && focusedCell.field === field;
		const value = isFocused ? focusedCell.value : cellValue(index, field);
		const identity = games[index]?.variants.join("+") ?? "";
		return `${row.id}-${identity}-${field}-${value ?? ""}`;
	};

	return {
		games,
		handleSetFieldBlur,
		handleSetFieldFocus,
		handleMinutesBlur,
		setFieldKey,
	};
}
