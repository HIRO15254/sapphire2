import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";

interface UseTournamentModalContentOptions {
	initialBlindLevels: BlindLevelRow[];
	initialVariant?: string;
}

export type TournamentModalTab = "details" | "structure";

export function useTournamentModalContent({
	initialBlindLevels,
	initialVariant,
}: UseTournamentModalContentOptions) {
	const [localBlindLevels, setLocalBlindLevels] =
		useState<BlindLevelRow[]>(initialBlindLevels);
	// Controlled so an invalid submit from the Structure tab can pull the user
	// back to Details, where the validation errors are shown (SA2-97 follow-up).
	const [activeTab, setActiveTab] = useState<TournamentModalTab>("details");
	// Mirrors the Details tab's variant picker so the Structure tab's blind
	// labels follow it live (the two tabs are separate component trees).
	const [structureVariant, setStructureVariant] = useState(
		initialVariant ?? DEFAULT_VARIANT_LABEL
	);

	return {
		localBlindLevels,
		setLocalBlindLevels,
		activeTab,
		setActiveTab,
		structureVariant,
		setStructureVariant,
	};
}
