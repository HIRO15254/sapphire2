/** Format a minute total as "1h 30m" / "45m" / "2h". Non-positive → "0h". */
export function formatMinutes(totalMinutes: number | null | undefined): string {
	if (totalMinutes == null || totalMinutes <= 0) {
		return "0h";
	}
	const hours = Math.floor(totalMinutes / 60);
	const minutes = Math.round(totalMinutes % 60);
	if (hours === 0) {
		return `${minutes}m`;
	}
	if (minutes === 0) {
		return `${hours}h`;
	}
	return `${hours}h ${minutes}m`;
}

/** Format a percentage value (already 0–100), or "—" when null/undefined. */
export function formatPercent(
	value: number | null | undefined,
	digits = 1
): string {
	if (value == null) {
		return "—";
	}
	return `${value.toFixed(digits)}%`;
}

/** Format a count or "—" when null/undefined, with a fixed number of digits. */
export function formatFixed(
	value: number | null | undefined,
	digits = 1
): string {
	if (value == null) {
		return "—";
	}
	return value.toFixed(digits);
}

export type TrendDirection = "up" | "down" | null;

/** Sign-based trend: positive → "up", negative → "down", else null. */
export function trendDirection(
	value: number | null | undefined
): TrendDirection {
	if (value == null || value === 0) {
		return null;
	}
	return value > 0 ? "up" : "down";
}
