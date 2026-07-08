import { useState } from "react";
import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";
import { resolveBlindLabels } from "@/features/game-variants/utils/blind-labels";
import type { BlindLevelRow } from "@/features/rooms/hooks/use-blind-levels";
import type { TournamentPartialFormValues } from "./tournament-modal-content";

interface UseTournamentModalContentOptions {
	initialBlindLevels: BlindLevelRow[];
	initialFormValues?: TournamentPartialFormValues;
}

export type TournamentModalTab = "details" | "structure";

export function useTournamentModalContent({
	initialBlindLevels,
	initialFormValues,
}: UseTournamentModalContentOptions) {
	const [localBlindLevels, setLocalBlindLevels] =
		useState<BlindLevelRow[]>(initialBlindLevels);
	// Controlled so an invalid submit from the Structure tab can pull the user
	// back to Details, where the validation errors are shown (SA2-97 follow-up).
	const [activeTab, setActiveTab] = useState<TournamentModalTab>("details");

	const { variants } = useGameVariants();
	// Resolved once from the initial variant (not live), mirroring the prior
	// static-labels behavior this replaces — the Structure tab's headers don't
	// track Details-tab edits mid-session.
	const blindLabels = resolveBlindLabels(initialFormValues?.variant, variants);

	return {
		localBlindLevels,
		setLocalBlindLevels,
		activeTab,
		setActiveTab,
		blindLabels,
	};
}
