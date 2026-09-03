import { formatProfitLoss } from "@/utils/format-profit-loss";

export function formatMinutes(totalMinutes: number | null | undefined): string {
	if (totalMinutes == null || totalMinutes <= 0) {
		return "0h";
	}
	return `${trimZeros((totalMinutes / 60).toFixed(1))}h`;
}

export function formatPercent(
	value: number | null | undefined,
	digits = 1
): string {
	if (value == null) {
		return "—";
	}
	return `${value.toFixed(digits)}%`;
}

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

export function trendDirection(
	value: number | null | undefined
): TrendDirection {
	if (value == null || value === 0) {
		return null;
	}
	return value > 0 ? "up" : "down";
}

const TRAILING_ZEROS_RE = /\.?0+$/;

function intDigits(abs: number): number {
	return abs < 1 ? 1 : Math.floor(Math.log10(abs)) + 1;
}

function trimZeros(value: string): string {
	return value.includes(".") ? value.replace(TRAILING_ZEROS_RE, "") : value;
}

function clampDecimals(abs: number, maxDecimals: number): number {
	return Math.max(0, Math.min(maxDecimals, 4 - intDigits(abs)));
}

function scaled(value: number, divisor: number, suffix: string): string {
	const x = value / divisor;
	return trimZeros(x.toFixed(clampDecimals(Math.abs(x), 2))) + suffix;
}

export function decimalsForUnit(unit: string | null | undefined): number {
	if (unit === "bb") {
		return 1;
	}
	if (unit === "bi") {
		return 2;
	}
	return 0;
}

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

export function formatScopedProfitLoss(
	value: number | null | undefined,
	options: { normalized: boolean; unit: string | null }
): string {
	return options.normalized
		? formatStatAmount(value, options.unit)
		: formatProfitLoss(value, { currencyUnit: options.unit });
}
