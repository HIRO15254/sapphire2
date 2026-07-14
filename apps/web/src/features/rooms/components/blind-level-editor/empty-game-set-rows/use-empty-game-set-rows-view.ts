import type { LevelGameGroup } from "@sapphire2/db/schemas/game";
import { useRef } from "react";
import {
	deriveAutoAnte,
	deriveAutoBlind2,
	type NewLevelValues,
	parseBlindLevelInput,
	parseIntOrNull,
} from "@/features/rooms/utils/blind-level-helpers";

type EmptyGameSetField = "ante" | "blind1" | "blind2" | "blind3";

interface UseEmptyGameSetRowsViewOptions {
	onCreateLevel: (values: NewLevelValues) => void;
	seeds: LevelGameGroup[];
}

export function useEmptyGameSetRowsView({
	seeds,
	onCreateLevel,
}: UseEmptyGameSetRowsViewOptions) {
	const cellsRef = useRef(new Map<string, HTMLInputElement>());
	const minutesRef = useRef<HTMLInputElement>(null);

	const cellKey = (index: number, field: EmptyGameSetField) =>
		`${index}:${field}`;
	const cell = (index: number, field: EmptyGameSetField) =>
		cellsRef.current.get(cellKey(index, field));
	const registerCell =
		(index: number, field: EmptyGameSetField) =>
		(el: HTMLInputElement | null) => {
			if (el) {
				cellsRef.current.set(cellKey(index, field), el);
			} else {
				cellsRef.current.delete(cellKey(index, field));
			}
		};

	const resetRows = () => {
		for (const input of cellsRef.current.values()) {
			input.value = "";
		}
		if (minutesRef.current) {
			minutesRef.current.value = "";
		}
	};

	const tryCreate = (relatedTarget: EventTarget | null) => {
		const inputs = [...cellsRef.current.values(), minutesRef.current];
		if (inputs.includes(relatedTarget as HTMLInputElement)) {
			return;
		}

		let hasInvalidCell = false;
		const parseCell = (index: number, field: EmptyGameSetField) => {
			const input = cell(index, field);
			const value = input ? parseBlindLevelInput(input) : null;
			if (value === undefined) {
				hasInvalidCell = true;
				return null;
			}
			return value;
		};
		const games = seeds.map((seed, index) => ({
			...seed,
			blind1: parseCell(index, "blind1"),
			blind2: parseCell(index, "blind2"),
			blind3: parseCell(index, "blind3"),
			ante: parseCell(index, "ante"),
		}));
		const minutes = minutesRef.current
			? parseBlindLevelInput(minutesRef.current)
			: null;
		if (
			hasInvalidCell ||
			minutes === undefined ||
			!games.some((set) => set.blind1 != null)
		) {
			return;
		}
		onCreateLevel({ blind1: null, blind2: null, ante: null, minutes, games });
		resetRows();
	};

	const fillCell = (
		input: HTMLInputElement | undefined,
		derive: (current: string) => string | null
	) => {
		const text = input ? derive(input.value) : null;
		if (text != null && input) {
			input.value = text;
		}
	};

	const autoFill = (index: number, field: EmptyGameSetField, value: string) => {
		const parsed = parseIntOrNull(value);
		if (parsed == null || field === "ante" || field === "blind3") {
			return;
		}
		const ante = cell(index, "ante");
		if (field === "blind2") {
			fillCell(ante, (current) => deriveAutoAnte(value, current));
			return;
		}
		const blind2 = cell(index, "blind2");
		fillCell(blind2, (current) => deriveAutoBlind2(parsed, current));
		fillCell(ante, (current) =>
			deriveAutoAnte(blind2?.value ?? value, current)
		);
	};

	const handleCellBlur =
		(index: number, field: EmptyGameSetField) =>
		(e: React.FocusEvent<HTMLInputElement>) => {
			parseBlindLevelInput(e.target);
			autoFill(index, field, e.target.value);
			tryCreate(e.relatedTarget);
		};
	const handleMinutesBlur = (e: React.FocusEvent<HTMLInputElement>) => {
		parseBlindLevelInput(e.target);
		tryCreate(e.relatedTarget);
	};

	return { registerCell, minutesRef, handleCellBlur, handleMinutesBlur };
}
