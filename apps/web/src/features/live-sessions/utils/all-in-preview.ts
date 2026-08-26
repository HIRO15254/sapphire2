export interface AllInPreview {
	evDelta: number;
	expectedValue: number;
	realizedValue: number;
}

interface ComputeAllInPreviewInput {
	equity: number;
	potSize: number;
	trials: number;
	wins: number;
}

export function computeAllInPreview({
	equity,
	potSize,
	trials,
	wins,
}: ComputeAllInPreviewInput): AllInPreview | null {
	if (
		!(
			Number.isFinite(equity) &&
			Number.isFinite(potSize) &&
			Number.isFinite(trials) &&
			Number.isFinite(wins)
		)
	) {
		return null;
	}
	if (
		trials <= 0 ||
		wins < 0 ||
		wins > trials ||
		equity < 0 ||
		equity > 100 ||
		potSize < 0
	) {
		return null;
	}

	const expectedValue = potSize * (equity / 100);
	const realizedValue = (potSize / trials) * wins;

	return {
		expectedValue,
		realizedValue,
		evDelta: expectedValue - realizedValue,
	};
}
