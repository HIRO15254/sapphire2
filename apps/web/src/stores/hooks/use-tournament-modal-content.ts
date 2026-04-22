import { useState } from "react";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";

interface UseTournamentModalContentOptions {
	initialBlindLevels: BlindLevelRow[];
}

export function useTournamentModalContent({
	initialBlindLevels,
}: UseTournamentModalContentOptions) {
	const [localBlindLevels, setLocalBlindLevels] =
		useState<BlindLevelRow[]>(initialBlindLevels);

	return {
		localBlindLevels,
		setLocalBlindLevels,
	};
}
