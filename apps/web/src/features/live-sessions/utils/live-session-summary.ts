export interface CashGamePLInput {
	chipRemoveTotal: number;
	currentStack: number | null;
	evDiff: number;
	totalBuyIn: number;
}

export interface CashGamePL {
	displayPL: number | null;
	evPL: number | null;
	showEvPL: boolean;
}

export function computeCashGamePL(input: CashGamePLInput): CashGamePL {
	const displayPL =
		input.currentStack === null
			? null
			: input.currentStack + input.chipRemoveTotal - input.totalBuyIn;

	const evPL =
		input.currentStack !== null && input.evDiff !== 0
			? input.currentStack +
				input.chipRemoveTotal +
				input.evDiff -
				input.totalBuyIn
			: null;

	return { displayPL, evPL, showEvPL: evPL !== null && evPL !== displayPL };
}

export function computeBigBlinds(
	stack: number | null,
	bigBlind: number | null | undefined
): number | null {
	if (stack === null || !bigBlind || bigBlind <= 0) {
		return null;
	}
	return Math.round(stack / bigBlind);
}
