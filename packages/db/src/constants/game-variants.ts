// Single source of truth for poker game-variant presets. Every place that
// used to hand-roll its own copy of this table (ring-game-form,
// blind-level-editor, tournament-form, game-scene-formatters) now imports
// from here instead, so a new variant or a relabeled blind only needs to be
// added once.

export interface BlindLabels {
	blind1: string;
	blind2: string;
	blind3: string | null; // null = this variant has no third blind slot
}

export interface GameVariantDef {
	blindLabels: BlindLabels;
	isMix: boolean;
	label: string;
	shortLabel: string;
}

// Most flop games use a straddle-capable SB/BB/Straddle blind structure.
const STRADDLE_LABELS: BlindLabels = {
	blind1: "SB",
	blind2: "BB",
	blind3: "Straddle",
};

// Limit games (fixed-limit betting, no straddle) have only two blind slots.
const LIMIT_LABELS: BlindLabels = {
	blind1: "Small Bet",
	blind2: "Big Bet",
	blind3: null,
};

// Stud games use a bring-in instead of a straddle for the third slot.
const STUD_LABELS: BlindLabels = {
	blind1: "Small Bet",
	blind2: "Big Bet",
	blind3: "Bring-in",
};

export const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		shortLabel: "NLH",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	plo: {
		label: "Pot Limit Omaha",
		shortLabel: "PLO",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	plo5: {
		label: "5 Card PLO",
		shortLabel: "PLO5",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	plo8: {
		label: "PLO Hi-Lo",
		shortLabel: "PLO8",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	bigo: {
		label: "Big O",
		shortLabel: "Big O",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	shortdeck: {
		label: "Short Deck",
		shortLabel: "6+",
		isMix: false,
		blindLabels: { blind1: "Ante", blind2: "Button", blind3: null },
	},
	"27sd": {
		label: "NL 2-7 Single Draw",
		shortLabel: "2-7SD",
		isMix: false,
		blindLabels: STRADDLE_LABELS,
	},
	lhe: {
		label: "Limit Hold'em",
		shortLabel: "LHE",
		isMix: false,
		blindLabels: LIMIT_LABELS,
	},
	o8: {
		label: "Omaha Hi-Lo",
		shortLabel: "O8",
		isMix: false,
		blindLabels: LIMIT_LABELS,
	},
	"27td": {
		label: "2-7 Triple Draw",
		shortLabel: "2-7TD",
		isMix: false,
		blindLabels: LIMIT_LABELS,
	},
	badugi: {
		label: "Badugi",
		shortLabel: "Badugi",
		isMix: false,
		blindLabels: LIMIT_LABELS,
	},
	stud: {
		label: "Seven Card Stud",
		shortLabel: "Stud",
		isMix: false,
		blindLabels: STUD_LABELS,
	},
	stud8: {
		label: "Stud Hi-Lo",
		shortLabel: "Stud8",
		isMix: false,
		blindLabels: STUD_LABELS,
	},
	razz: {
		label: "Razz",
		shortLabel: "Razz",
		isMix: false,
		blindLabels: STUD_LABELS,
	},
	mix: {
		label: "Mixed Game",
		shortLabel: "Mix",
		isMix: true,
		blindLabels: STRADDLE_LABELS,
	},
} as const satisfies Record<string, GameVariantDef>;

export type GameVariant = keyof typeof GAME_VARIANTS;

// Labels for a room's own custom (non-preset) variant, as stored on the room.
// A `null` field means "use the default" for blind1/blind2, or "no third
// blind slot" for blind3 (mirrors BlindLabels.blind3 semantics).
export interface CustomVariantLabels {
	blind1Label: string | null;
	blind2Label: string | null;
	blind3Label: string | null;
}

function isPresetVariant(variant: string): variant is GameVariant {
	return Object.hasOwn(GAME_VARIANTS, variant);
}

/**
 * Resolve the blind labels to display for a given variant.
 * - A known preset key always wins and returns its own labels.
 * - Otherwise, when `custom` labels are supplied, blind1/blind2 fall back to
 *   "SB"/"BB" when unset, and blind3 is passed through as-is (including
 *   null, meaning no third slot).
 * - Otherwise, falls back to the SB/BB/Straddle defaults.
 */
export function resolveBlindLabels(
	variant: string,
	custom?: CustomVariantLabels | null
): BlindLabels {
	if (isPresetVariant(variant)) {
		return GAME_VARIANTS[variant].blindLabels;
	}
	if (custom) {
		return {
			blind1: custom.blind1Label ?? "SB",
			blind2: custom.blind2Label ?? "BB",
			blind3: custom.blind3Label,
		};
	}
	return STRADDLE_LABELS;
}

/**
 * Short display label for a variant. Preset keys resolve to their
 * `shortLabel`; anything else is a custom variant that stores its display
 * label verbatim in the `variant` column, so it is passed through unchanged.
 */
export function variantShortLabel(variant: string): string {
	if (isPresetVariant(variant)) {
		return GAME_VARIANTS[variant].shortLabel;
	}
	return variant;
}

/** True only for preset keys flagged as a mixed-game rotation (`mix`). */
export function isMixVariant(variant: string): boolean {
	return isPresetVariant(variant) && GAME_VARIANTS[variant].isMix;
}
