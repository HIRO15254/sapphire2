import { useRef } from "react";
import {
	type NewLevelValues,
	parseBlindLevelInput,
} from "@/features/rooms/utils/blind-level-helpers";

interface UseEmptyGamesRowOptions {
	onCreateLevel: (values: NewLevelValues) => void;
}

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
