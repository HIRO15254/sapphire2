import { useRef } from "react";
import {
	type NewLevelValues,
	parseBlindLevelInput,
} from "@/features/rooms/utils/blind-level-helpers";

interface UseEmptyGamesRowOptions {
	onCreateLevel: (values: NewLevelValues) => void;
}

/**
 * Per-level ('mix') mode new-level affordance. Flat blind cells make no
 * sense here — their amounts would be invisible once the level renders as a
 * "Games" summary row — so the empty row is just a Min cell plus an explicit
 * add button; the level's games are assigned afterwards via the sheet.
 */
export function useEmptyGamesRow({ onCreateLevel }: UseEmptyGamesRowOptions) {
	const minutesRef = useRef<HTMLInputElement>(null);

	const handleAddLevel = () => {
		const minutes = minutesRef.current
			? parseBlindLevelInput(minutesRef.current)
			: null;
		if (minutes === undefined) {
			return;
		}
		onCreateLevel({
			blind1: null,
			blind2: null,
			ante: null,
			minutes,
			games: null,
		});
		if (minutesRef.current) {
			minutesRef.current.value = "";
		}
	};

	return { minutesRef, handleAddLevel };
}
