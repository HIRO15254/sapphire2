import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

interface UseTournamentModalContentOptions {
	initialBlindLevels: BlindLevelRow[];
}

export type TournamentModalTab = "details" | "structure";

export function useTournamentModalContent({
	initialBlindLevels,
}: UseTournamentModalContentOptions) {
	const [localBlindLevels, setLocalBlindLevels] =
		useState<BlindLevelRow[]>(initialBlindLevels);
	// Controlled so an invalid submit from the Structure tab can pull the user
	// back to Details, where the validation errors are shown (SA2-97 follow-up).
	const [activeTab, setActiveTab] = useState<TournamentModalTab>("details");

	return {
		localBlindLevels,
		setLocalBlindLevels,
		activeTab,
		setActiveTab,
	};
}
