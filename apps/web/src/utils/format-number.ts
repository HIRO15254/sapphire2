const TRAILING_ZERO = /\.0$/;

/**
 * Format a single number with compact notation (k, M, B).
 * Threshold: 10,000+
 */
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
	return value.toLocaleString();
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
		return value.toLocaleString();
	}
	return `${(value / tier.divisor).toFixed(1).replace(TRAILING_ZERO, "")}${tier.suffix}`;
}

/**
 * Create a formatter that applies a consistent unit tier across a group of numbers.
 * The tier is determined by the maximum absolute value in the group.
 *
 * Usage:
 *   const fmt = createGroupFormatter([100, 200, 10000]);
 *   fmt(100)   // "0.01k"  — because max is 10000 (k tier)
 *   fmt(200)   // "0.02k"
 *   fmt(10000) // "10k"
 *
 * If max < 10,000, all values are shown as plain numbers.
 */
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
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}/${m}/${day}`;
}
