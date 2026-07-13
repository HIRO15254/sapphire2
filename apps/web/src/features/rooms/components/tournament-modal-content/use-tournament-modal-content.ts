import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import { useGameGroups } from "@/shared/hooks/use-game-groups";

interface UseTournamentModalContentOptions {
	initialBlindLevels: BlindLevelRow[];
	initialVariant?: string;
}

export type TournamentModalTab = "details" | "structure";

export function useTournamentModalContent({
	initialBlindLevels,
	initialVariant,
}: UseTournamentModalContentOptions) {
	const { isMixValue } = useGameGroups();
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

	const handleStructureVariantChange = (variant: string) => {
		setStructureVariant(variant);
		// Switching to a plain variant strips per-level game sets — otherwise
		// they linger invisibly on local levels and get saved as ghost games.
		// Mix→mix keeps stored games (the header re-derives from the new
		// composition; mismatches fall back to the generic header).
		if (!isMixValue(variant)) {
			setLocalBlindLevels((levels) =>
				levels.some((l) => l.games != null)
					? levels.map((l) => (l.games == null ? l : { ...l, games: null }))
					: levels
			);
		}
	};

	return {
		localBlindLevels,
		setLocalBlindLevels,
		activeTab,
		setActiveTab,
		structureVariant,
		handleStructureVariantChange,
	};
}
