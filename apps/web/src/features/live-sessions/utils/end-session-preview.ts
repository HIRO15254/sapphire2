export interface CashEndPreview {
	evResult: number | null;
	result: number;
	totalBuyIn: number;
	totalWithdrawn: number;
}

interface ComputeCashEndPreviewInput {
	cashOut: number | null;
	chipRemoveTotal: number;
	evDiff: number | null;
	totalBuyIn: number;
}

export function computeCashEndPreview({
	cashOut,
	chipRemoveTotal,
	evDiff,
	totalBuyIn,
}: ComputeCashEndPreviewInput): CashEndPreview | null {
	if (cashOut === null || Number.isNaN(cashOut)) {
		return null;
	}

	const result = cashOut + chipRemoveTotal - totalBuyIn;

	return {
		result,
		evResult: evDiff === null ? null : result + evDiff,
		totalBuyIn,
		totalWithdrawn: chipRemoveTotal,
	};
}
