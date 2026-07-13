import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useRef } from "react";
import {
	type NewLevelValues,
	parseIntOrNull,
} from "@/features/rooms/utils/blind-level-helpers";

export type EmptyGameSetField = "ante" | "blind1" | "blind2";

interface UseEmptyGameSetRowsOptions {
	onCreateLevel: (values: NewLevelValues) => void;
	/** Mix composition the new level's sets are shaped after (amounts blank). */
	seeds: LevelGameGroup[];
}

/**
 * The multi-row variant of useEmptyRow for mix-master tournaments: the
 * new-level block renders one row per game of the composition, and typing
 * amounts creates a level with per-game blind sets. Creation triggers when
 * focus leaves the block with at least one set's blind1 entered; auto-fill
 * (blind2 = 2x blind1, ante = blind2) stays within the blurred set's row.
 */
export function useEmptyGameSetRows({
	seeds,
	onCreateLevel,
}: UseEmptyGameSetRowsOptions) {
	const cellsRef = useRef(new Map<string, HTMLInputElement>());
	const minutesRef = useRef<HTMLInputElement>(null);

	const cellKey = (index: number, field: EmptyGameSetField) =>
		`${index}:${field}`;

	const registerCell =
		(index: number, field: EmptyGameSetField) =>
		(el: HTMLInputElement | null) => {
			if (el) {
				cellsRef.current.set(cellKey(index, field), el);
			} else {
				cellsRef.current.delete(cellKey(index, field));
			}
		};

	const cell = (index: number, field: EmptyGameSetField) =>
		cellsRef.current.get(cellKey(index, field));

	const resetRows = () => {
		for (const input of cellsRef.current.values()) {
			input.value = "";
		}
		if (minutesRef.current) {
			minutesRef.current.value = "";
		}
	};

	const tryCreate = (relatedTarget: EventTarget | null) => {
		const inputs: (HTMLInputElement | null)[] = [
			...cellsRef.current.values(),
			minutesRef.current,
		];
		if (inputs.includes(relatedTarget as HTMLInputElement)) {
			return;
		}
		const games = seeds.map((seed, index) => ({
			...seed,
			blind1: parseIntOrNull(cell(index, "blind1")?.value ?? ""),
			blind2: parseIntOrNull(cell(index, "blind2")?.value ?? ""),
			ante: parseIntOrNull(cell(index, "ante")?.value ?? ""),
		}));
		if (!games.some((set) => set.blind1 != null)) {
			return;
		}
		onCreateLevel({
			blind1: null,
			blind2: null,
			ante: null,
			minutes: parseIntOrNull(minutesRef.current?.value ?? ""),
			games,
		});
		resetRows();
	};

	// Same auto-fill as the flat empty row, scoped to the blurred set's row:
	// blind1 derives blind2 (x2) then ante (= blind2); blind2 derives ante.
	const autoFill = (index: number, field: EmptyGameSetField, value: string) => {
		const parsed = parseIntOrNull(value);
		if (parsed == null || field === "ante") {
			return;
		}
		const ante = cell(index, "ante");
		if (field === "blind2") {
			if (ante && !ante.value) {
				ante.value = value;
			}
			return;
		}
		const blind2 = cell(index, "blind2");
		if (blind2 && !blind2.value) {
			blind2.value = String(parsed * 2);
		}
		if (ante && !ante.value) {
			ante.value = blind2?.value ?? value;
		}
	};

	const handleCellBlur =
		(index: number, field: EmptyGameSetField) =>
		(e: React.FocusEvent<HTMLInputElement>) => {
			autoFill(index, field, e.target.value);
			tryCreate(e.relatedTarget);
		};

	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		tryCreate(e.relatedTarget);
	};

	return { registerCell, minutesRef, handleCellBlur, handleMinutesBlur };
}
