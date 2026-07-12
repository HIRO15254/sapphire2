// Seed data ONLY for the per-user game_group / game_variant tables. Mix-game
// rework: variant->group membership is now a per-user DB row (seeded at user
// creation by seedDefaultGameData), never a runtime fallback read straight
// from this file. `variant` columns elsewhere in the schema store the
// variant's display LABEL verbatim at write time (self-freezing) — the only
// exception is the mix pseudo-variant, stored as the fixed key "mix".

export type BuiltinGroupKey = "bigbet" | "limit" | "stud";

export interface DefaultGameGroup {
	blind1Label: string;
	blind2Label: string;
	blind3Label: string | null;
	key: BuiltinGroupKey;
	label: string;
}

// Canonical bucket order: limit → stud → bigbet (structure-sheet convention).
export const DEFAULT_GAME_GROUPS: DefaultGameGroup[] = [
	{
		key: "limit",
		label: "Limit",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: null,
	},
	{
		key: "stud",
		label: "Stud",
		blind1Label: "Small Bet",
		blind2Label: "Big Bet",
		blind3Label: "Bring-in",
	},
	{
		key: "bigbet",
		label: "Big Bet",
		blind1Label: "SB",
		blind2Label: "BB",
		blind3Label: "Straddle",
	},
];

export interface DefaultGameVariant {
	groupKey: BuiltinGroupKey;
	key: string;
	label: string;
	shortLabel: string;
}

// sortOrder = array index.
export const DEFAULT_GAME_VARIANTS: DefaultGameVariant[] = [
	{ key: "nlh", label: "NL Hold'em", shortLabel: "NLH", groupKey: "bigbet" },
	{
		key: "plhe",
		label: "Pot Limit Hold'em",
		shortLabel: "PLHE",
		groupKey: "bigbet",
	},
	{
		key: "plo",
		label: "Pot Limit Omaha",
		shortLabel: "PLO",
		groupKey: "bigbet",
	},
	{
		key: "plo5",
		label: "5 Card PLO",
		shortLabel: "PLO5",
		groupKey: "bigbet",
	},
	{
		key: "plo8",
		label: "Pot Limit Omaha Hi-Lo",
		shortLabel: "PLO8",
		groupKey: "bigbet",
	},
	{ key: "bigo", label: "Big O", shortLabel: "Big O", groupKey: "bigbet" },
	{
		key: "shortdeck",
		label: "Short Deck",
		shortLabel: "6+",
		groupKey: "bigbet",
	},
	{
		key: "27sd",
		label: "NL 2-7 Single Draw",
		shortLabel: "2-7SD",
		groupKey: "bigbet",
	},
	{
		key: "pl27td",
		label: "PL 2-7 Triple Draw",
		shortLabel: "PL 2-7TD",
		groupKey: "bigbet",
	},
	{
		key: "courchevel",
		label: "Courchevel",
		shortLabel: "Courchevel",
		groupKey: "bigbet",
	},
	{
		key: "lhe",
		label: "Limit Hold'em",
		shortLabel: "LHE",
		groupKey: "limit",
	},
	{ key: "lo", label: "Limit Omaha", shortLabel: "LO", groupKey: "limit" },
	{
		key: "o8",
		label: "Limit Omaha Hi-Lo",
		shortLabel: "O8",
		groupKey: "limit",
	},
	{
		key: "27td",
		label: "Limit 2-7 Triple Draw",
		shortLabel: "2-7TD",
		groupKey: "limit",
	},
	{
		key: "a5td",
		label: "A-5 Triple Draw",
		shortLabel: "A-5TD",
		groupKey: "limit",
	},
	{ key: "badugi", label: "Badugi", shortLabel: "Badugi", groupKey: "limit" },
	{
		key: "badeucy",
		label: "Badeucy",
		shortLabel: "Badeucy",
		groupKey: "limit",
	},
	{ key: "badacy", label: "Badacy", shortLabel: "Badacy", groupKey: "limit" },
	{
		key: "stud",
		label: "Seven Card Stud",
		shortLabel: "Stud",
		groupKey: "stud",
	},
	{ key: "stud8", label: "Stud Hi-Lo", shortLabel: "Stud8", groupKey: "stud" },
	{ key: "razz", label: "Razz", shortLabel: "Razz", groupKey: "stud" },
];

// Mix pseudo-variant constants (mix is a MODE, not a row).
export const MIX_VARIANT = "mix";
export const MIX_VARIANT_LABEL = "Mixed Game";

export function isMixVariant(variant: string): boolean {
	return variant === MIX_VARIANT;
}

// Stored variant values are display labels already; only "mix" needs mapping.
export function variantDisplayLabel(variant: string): string {
	return isMixVariant(variant) ? MIX_VARIANT_LABEL : variant;
}
