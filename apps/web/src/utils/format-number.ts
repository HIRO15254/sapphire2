const TRAILING_ZERO = /\.0$/;

export function formatCompactNumber(value: number): string {
	if (Math.abs(value) >= 1_000_000_000) {
		return `${(value / 1_000_000_000).toFixed(1).replace(TRAILING_ZERO, "")}B`;
	}
	if (Math.abs(value) >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1).replace(TRAILING_ZERO, "")}M`;
	}
	if (Math.abs(value) >= 1000) {
		return `${(value / 1000).toFixed(1).replace(TRAILING_ZERO, "")}k`;
	}
	return value.toLocaleString();
}
