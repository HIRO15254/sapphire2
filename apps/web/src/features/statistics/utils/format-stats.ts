import { formatProfitLoss } from "@/utils/format-profit-loss";

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

// ── Compact number formatting (≤4 significant figures) ───────────────────────

const TRAILING_ZEROS_RE = /\.?0+$/;

function intDigits(abs: number): number {
	return abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1;
}

/** Drop trailing zeros (and a dangling decimal point) from a fixed string. */
function trimZeros(value: string): string {
	return value.includes(".") ? value.replace(TRAILING_ZEROS_RE, "") : value;
}

/** Decimals that keep a value < 1000 within ~4 significant figures. */
function clampDecimals(abs: number, maxDecimals: number): number {
	return Math.max(0, Math.min(maxDecimals, 4 - intDigits(abs)));
}

function scaled(value: number, divisor: number, suffix: string): string {
	const x = value / divisor;
	return trimZeros(x.toFixed(clampDecimals(Math.abs(x), 2))) + suffix;
}

/** The minimum-granularity decimals for a normalized unit (bb = 1, bi = 2). */
export function decimalsForUnit(unit: string | null | undefined): number {
	if (unit === "bb") {
		return 1;
	}
	if (unit === "bi") {
		return 2;
	}
	return 0;
}

/**
 * Format a number for stats display: at most `maxDecimals` decimal places, with
 * k / M / B compaction for large magnitudes, kept to ~4 significant figures so
 * normalized (bb / bi) values never render a long decimal tail.
 */
export function formatStatNumber(value: number, maxDecimals: number): string {
	const abs = Math.abs(value);
	if (abs >= 1e9) {
		return scaled(value, 1e9, "B");
	}
	if (abs >= 1e6) {
		return scaled(value, 1e6, "M");
	}
	if (abs >= 1e4) {
		return scaled(value, 1e3, "k");
	}
	return trimZeros(value.toFixed(clampDecimals(abs, maxDecimals)));
}

/**
 * Format a normalized (bb / bi) amount with a sign, the unit suffix, and the
 * unit's minimum-granularity decimals. Returns "—" for null/undefined.
 */
export function formatStatAmount(
	value: number | null | undefined,
	unit: string | null,
	options?: { decimals?: number; nullDisplay?: string; signed?: boolean }
): string {
	if (value == null) {
		return options?.nullDisplay ?? "—";
	}
	const decimals = options?.decimals ?? decimalsForUnit(unit);
	const body = formatStatNumber(value, decimals);
	const signed = options?.signed === false || value < 0 ? body : `+${body}`;
	return unit ? `${signed} ${unit}` : signed;
}

/**
 * Format a profit/loss in the active scope: currency amounts (with thousands
 * separators) when not normalized, otherwise a bb / bi normalized amount.
 */
export function formatScopedProfitLoss(
	value: number | null | undefined,
	options: { normalized: boolean; unit: string | null }
): string {
	return options.normalized
		? formatStatAmount(value, options.unit)
		: formatProfitLoss(value, { currencyUnit: options.unit });
}
