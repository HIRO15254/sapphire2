import {
	type BlindSlotLabels as GroupBlindSlotLabels,
	useGameGroups,
} from "@/shared/hooks/use-game-groups";

export type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";

export function useVariantLabels(variant: string): GroupBlindSlotLabels {
	const { labelsFor } = useGameGroups();
	return labelsFor(variant);
}
