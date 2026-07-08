export const DEFAULT_GAME_VARIANTS = [
	{
		name: "NLH",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
	},
	{ name: "LHE", blindLabel1: "SB", blindLabel2: "BB", blindLabel3: null },
	{
		name: "PLO",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
	},
	{
		name: "PLO5",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
	},
	{
		name: "PLO8",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: "Straddle",
	},
	{
		name: "Short Deck",
		blindLabel1: "Button blind",
		blindLabel2: null,
		blindLabel3: null,
	},
	{
		name: "Stud",
		blindLabel1: "Bring-in",
		blindLabel2: null,
		blindLabel3: null,
	},
	{
		name: "Razz",
		blindLabel1: "Bring-in",
		blindLabel2: null,
		blindLabel3: null,
	},
	{
		name: "2-7 Triple Draw",
		blindLabel1: "SB",
		blindLabel2: "BB",
		blindLabel3: null,
	},
	{ name: "Badugi", blindLabel1: "SB", blindLabel2: "BB", blindLabel3: null },
	{ name: "Mixed", blindLabel1: "SB", blindLabel2: "BB", blindLabel3: null },
] as const;

export const DEFAULT_TRANSACTION_TYPES = [
	"Purchase",
	"Bonus",
	"Session Result",
	"Other",
] as const;
