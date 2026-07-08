import type { GameVariant } from "@/features/game-variants/hooks/use-game-variants";

export interface BlindLabels {
	blind1: string | null;
	blind2: string | null;
	blind3: string | null;
}

export const DEFAULT_BLIND_LABELS: BlindLabels = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

/**
 * Resolve the blind-slot labels to display for a given variant name. Matches
 * case-insensitively against the user's game variants (variant names are
 * user-entered free text, so casing can drift between where a session's
 * variant text was captured and where the variant list is read). Falls back
 * to the NLH-shaped SB/BB/Straddle defaults when there is no name, no
 * variants, or no match — the same shape the app hardcoded before
 * user-defined variants existed.
 */
export function resolveBlindLabels(
	variantName: string | null | undefined,
	variants: readonly Pick<
		GameVariant,
		"blindLabel1" | "blindLabel2" | "blindLabel3" | "name"
	>[]
): BlindLabels {
	if (!variantName) {
		return DEFAULT_BLIND_LABELS;
	}

	const normalized = variantName.toLowerCase();
	const match = variants.find((v) => v.name.toLowerCase() === normalized);

	if (!match) {
		return DEFAULT_BLIND_LABELS;
	}

	return {
		blind1: match.blindLabel1,
		blind2: match.blindLabel2,
		blind3: match.blindLabel3,
	};
}
