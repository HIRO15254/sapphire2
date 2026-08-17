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
	const [activeTab, setActiveTab] = useState<TournamentModalTab>("details");
	const [structureVariant, setStructureVariant] = useState(
		initialVariant ?? DEFAULT_VARIANT_LABEL
	);

	const handleStructureVariantChange = (variant: string) => {
		setStructureVariant(variant);
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
