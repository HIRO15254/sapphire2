const TRAILING_ZERO = /\.0$/;

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

export const formatNumber = (value: number) => NUMBER_FORMATTER.format(value);

export function formatCompactNumber(value: number): string {
	if (Math.abs(value) >= 10_000_000_000) {
		return `${(value / 1_000_000_000).toFixed(1).replace(TRAILING_ZERO, "")}B`;
	}
	if (Math.abs(value) >= 10_000_000) {
		return `${(value / 1_000_000).toFixed(1).replace(TRAILING_ZERO, "")}M`;
	}
	if (Math.abs(value) >= 10_000) {
		return `${(value / 1000).toFixed(1).replace(TRAILING_ZERO, "")}k`;
	}
	return formatNumber(value);
}

interface UnitTier {
	divisor: number;
	suffix: string;
	threshold: number;
}

const TIERS: UnitTier[] = [
	{ threshold: 10_000_000_000, divisor: 1_000_000_000, suffix: "B" },
	{ threshold: 10_000_000, divisor: 1_000_000, suffix: "M" },
	{ threshold: 10_000, divisor: 1000, suffix: "k" },
];

function formatWithTier(value: number, tier: UnitTier | undefined): string {
	if (!tier) {
		return formatNumber(value);
	}
	return `${(value / tier.divisor).toFixed(1).replace(TRAILING_ZERO, "")}${tier.suffix}`;
}

export function createGroupFormatter(
	values: (number | null | undefined)[]
): (value: number) => string {
	const nums = values.filter((v): v is number => v != null && v !== 0);
	const maxAbs = nums.length > 0 ? Math.max(...nums.map(Math.abs)) : 0;
	const tier = TIERS.find((t) => maxAbs >= t.threshold);
	return (value: number) => formatWithTier(value, tier);
}

export function formatYmdSlash(input: string | Date): string {
	const d = typeof input === "string" ? new Date(input) : input;
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
}

export function formatLocalYmdSlash(input: string | Date): string {
	const d = typeof input === "string" ? new Date(input) : input;
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
}
