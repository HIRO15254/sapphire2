import {
	type BlindSlotLabels as GroupBlindSlotLabels,
	useGameGroups,
} from "@/shared/hooks/use-game-groups";

export type { BlindSlotLabels } from "@/shared/hooks/use-game-groups";

/**
 * Blind-slot labels for a variant, resolved through the master data: the
 * variant row's owning group carries the labels. Unknown values (e.g. a
 * deleted variant frozen into an old session) fall back to SB/BB/Straddle.
 */
export function useVariantLabels(variant: string): GroupBlindSlotLabels {
	const { labelsFor } = useGameGroups();
	return labelsFor(variant);
}
