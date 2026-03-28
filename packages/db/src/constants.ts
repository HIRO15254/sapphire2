export const GAME_VARIANTS = {
	nlh: {
		label: "NL Hold'em",
		blindLabels: { blind1: "SB", blind2: "BB", blind3: "Straddle" },
	},
} as const;

export type GameVariant = keyof typeof GAME_VARIANTS;

export const DEFAULT_TRANSACTION_TYPES = [
	"Purchase",
	"Bonus",
	"Session Result",
	"Other",
] as const;
