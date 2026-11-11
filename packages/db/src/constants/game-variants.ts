import type { ANTE_TYPES } from "./rule";

export type BuiltinGroupKey = "bigbet" | "limit" | "stud";

interface DefaultGameGroup {
	blind1Label: string;
	blind1Required: boolean;
	blind2Label: string;
	blind2Required: boolean;
	blind3Label: string | null;
	blind3Required: boolean;
	fixedAnteType: (typeof ANTE_TYPES)[number] | null;
	key: BuiltinGroupKey;
	label: string;
}

export const DEFAULT_GAME_GROUPS: DefaultGameGroup[] = [
	{
		blind1Label: "Small Bet",
		blind1Required: true,
		blind2Label: "Big Bet",
		blind2Required: true,
		blind3Label: null,
		blind3Required: false,
		fixedAnteType: null,
		key: "limit",
		label: "Limit",
	},
	{
		blind1Label: "Small Bet",
		blind1Required: true,
		blind2Label: "Big Bet",
		blind2Required: true,
		blind3Label: "Bring-in",
		blind3Required: false,
		fixedAnteType: "all",
		key: "stud",
		label: "Stud",
	},
	{
		blind1Label: "SB",
		blind1Required: true,
		blind2Label: "BB",
		blind2Required: true,
		blind3Label: null,
		blind3Required: false,
		fixedAnteType: null,
		key: "bigbet",
		label: "Big Bet",
	},
];

interface DefaultGameVariant {
	groupKey: BuiltinGroupKey;
	key: string;
	label: string;
	shortLabel: string;
}

export const DEFAULT_GAME_VARIANTS: DefaultGameVariant[] = [
	{ groupKey: "bigbet", key: "nlh", label: "NL Hold'em", shortLabel: "NLH" },
	{
		groupKey: "bigbet",
		key: "plhe",
		label: "Pot Limit Hold'em",
		shortLabel: "PLHE",
	},
	{
		groupKey: "bigbet",
		key: "plo",
		label: "Pot Limit Omaha",
		shortLabel: "PLO",
	},
	{
		groupKey: "bigbet",
		key: "plo5",
		label: "5 Card PLO",
		shortLabel: "PLO5",
	},
	{
		groupKey: "bigbet",
		key: "plo8",
		label: "Pot Limit Omaha Hi-Lo",
		shortLabel: "PLO8",
	},
	{ groupKey: "bigbet", key: "bigo", label: "Big O", shortLabel: "Big O" },
	{
		groupKey: "bigbet",
		key: "shortdeck",
		label: "Short Deck",
		shortLabel: "6+",
	},
	{
		groupKey: "bigbet",
		key: "27sd",
		label: "NL 2-7 Single Draw",
		shortLabel: "2-7SD",
	},
	{
		groupKey: "bigbet",
		key: "pl27td",
		label: "PL 2-7 Triple Draw",
		shortLabel: "PL 2-7TD",
	},
	{
		groupKey: "bigbet",
		key: "courchevel",
		label: "Courchevel",
		shortLabel: "Courchevel",
	},
	{
		groupKey: "limit",
		key: "lhe",
		label: "Limit Hold'em",
		shortLabel: "LHE",
	},
	{ groupKey: "limit", key: "lo", label: "Limit Omaha", shortLabel: "LO" },
	{
		groupKey: "limit",
		key: "o8",
		label: "Limit Omaha Hi-Lo",
		shortLabel: "O8",
	},
	{
		groupKey: "limit",
		key: "27td",
		label: "Limit 2-7 Triple Draw",
		shortLabel: "2-7TD",
	},
	{
		groupKey: "limit",
		key: "a5td",
		label: "A-5 Triple Draw",
		shortLabel: "A-5TD",
	},
	{ groupKey: "limit", key: "badugi", label: "Badugi", shortLabel: "Badugi" },
	{
		groupKey: "limit",
		key: "badeucy",
		label: "Badeucy",
		shortLabel: "Badeucy",
	},
	{ groupKey: "limit", key: "badacy", label: "Badacy", shortLabel: "Badacy" },
	{
		groupKey: "stud",
		key: "stud",
		label: "Seven Card Stud",
		shortLabel: "Stud",
	},
	{ groupKey: "stud", key: "stud8", label: "Stud Hi-Lo", shortLabel: "Stud8" },
	{ groupKey: "stud", key: "razz", label: "Razz", shortLabel: "Razz" },
];

interface DefaultGameMix {
	key: string;
	label: string;
	variantKeys: string[];
}

export const DEFAULT_GAME_MIXES: DefaultGameMix[] = [
	{
		key: "horse",
		label: "HORSE",
		variantKeys: ["lhe", "o8", "razz", "stud", "stud8"],
	},
	{
		key: "8game",
		label: "8-Game",
		variantKeys: ["27td", "lhe", "o8", "razz", "stud", "stud8", "nlh", "plo"],
	},
	{
		key: "10game",
		label: "10-Game",
		variantKeys: [
			"27td",
			"lhe",
			"o8",
			"badugi",
			"razz",
			"stud",
			"stud8",
			"nlh",
			"plo",
			"27sd",
		],
	},
];
