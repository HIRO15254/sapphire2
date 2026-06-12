import { describe, expect, it } from "vitest";
import {
	decimalsForUnit,
	formatFixed,
	formatMinutes,
	formatPercent,
	formatScopedProfitLoss,
	formatStatAmount,
	formatStatNumber,
	trendDirection,
} from "@/features/statistics/utils/format-stats";

describe("formatMinutes", () => {
	it("formats as decimal hours", () => {
		expect(formatMinutes(336)).toBe("5.6h");
	});

	it("trims the trailing .0 for whole hours", () => {
		expect(formatMinutes(120)).toBe("2h");
	});

	it("formats a sub-hour total as a decimal", () => {
		expect(formatMinutes(45)).toBe("0.8h");
	});

	it("rounds to one decimal place", () => {
		expect(formatMinutes(95)).toBe("1.6h");
	});

	it("returns 0h for zero, negative, null, and undefined", () => {
		expect(formatMinutes(0)).toBe("0h");
		expect(formatMinutes(-10)).toBe("0h");
		expect(formatMinutes(null)).toBe("0h");
		expect(formatMinutes(undefined)).toBe("0h");
	});
});

describe("formatPercent", () => {
	it("formats with one decimal by default", () => {
		expect(formatPercent(52.345)).toBe("52.3%");
	});

	it("honors a custom digit count", () => {
		expect(formatPercent(52.345, 0)).toBe("52%");
	});

	it("formats zero", () => {
		expect(formatPercent(0)).toBe("0.0%");
	});

	it("returns the em dash for null / undefined", () => {
		expect(formatPercent(null)).toBe("—");
		expect(formatPercent(undefined)).toBe("—");
	});
});

describe("formatFixed", () => {
	it("formats with one decimal by default", () => {
		expect(formatFixed(4.27)).toBe("4.3");
	});

	it("returns the em dash for null / undefined", () => {
		expect(formatFixed(null)).toBe("—");
		expect(formatFixed(undefined)).toBe("—");
	});
});

describe("trendDirection", () => {
	it("returns up for positive values", () => {
		expect(trendDirection(10)).toBe("up");
	});

	it("returns down for negative values", () => {
		expect(trendDirection(-10)).toBe("down");
	});

	it("returns null for zero, null, and undefined", () => {
		expect(trendDirection(0)).toBeNull();
		expect(trendDirection(null)).toBeNull();
		expect(trendDirection(undefined)).toBeNull();
	});
});

describe("decimalsForUnit", () => {
	it("uses 1 decimal for bb, 2 for bi, 0 otherwise", () => {
		expect(decimalsForUnit("bb")).toBe(1);
		expect(decimalsForUnit("bi")).toBe(2);
		expect(decimalsForUnit("USD")).toBe(0);
		expect(decimalsForUnit(null)).toBe(0);
	});
});

describe("formatStatNumber", () => {
	it("caps decimals at the requested maximum and trims trailing zeros", () => {
		expect(formatStatNumber(3.333_33, 1)).toBe("3.3");
		expect(formatStatNumber(12.345, 2)).toBe("12.35");
		expect(formatStatNumber(30, 1)).toBe("30");
	});

	it("keeps values within ~4 significant figures below the k threshold", () => {
		expect(formatStatNumber(123.45, 2)).toBe("123.5");
		expect(formatStatNumber(1234.5, 1)).toBe("1235");
	});

	it("compacts with k / M / B for large magnitudes", () => {
		expect(formatStatNumber(12_345, 1)).toBe("12.35k");
		expect(formatStatNumber(123_456, 1)).toBe("123.5k");
		expect(formatStatNumber(1_234_567, 2)).toBe("1.23M");
		expect(formatStatNumber(2_500_000_000, 2)).toBe("2.5B");
	});

	it("preserves the sign for negative values", () => {
		expect(formatStatNumber(-3.33, 1)).toBe("-3.3");
		expect(formatStatNumber(-12_345, 1)).toBe("-12.35k");
	});

	it("formats zero as 0", () => {
		expect(formatStatNumber(0, 2)).toBe("0");
	});
});

describe("formatStatAmount", () => {
	it("prefixes a plus sign for non-negative values and appends the unit", () => {
		expect(formatStatAmount(30, "bb")).toBe("+30 bb");
		expect(formatStatAmount(12.345, "bi")).toBe("+12.35 bi");
	});

	it("keeps the minus sign for negatives", () => {
		expect(formatStatAmount(-5.5, "bb")).toBe("-5.5 bb");
	});

	it("honors an explicit decimals override (e.g. bb/hr at 2 places)", () => {
		expect(formatStatAmount(3.1, "bb/h", { decimals: 2 })).toBe("+3.1 bb/h");
		expect(formatStatAmount(3.149, "bb/h", { decimals: 2 })).toBe("+3.15 bb/h");
	});

	it("renders the em dash for null/undefined", () => {
		expect(formatStatAmount(null, "bb")).toBe("—");
		expect(formatStatAmount(undefined, "bb")).toBe("—");
	});

	it("omits the sign when signed is false", () => {
		expect(formatStatAmount(30, "bb", { signed: false })).toBe("30 bb");
	});
});

describe("formatScopedProfitLoss", () => {
	it("formats currency amounts (with separators) when not normalized", () => {
		expect(
			formatScopedProfitLoss(1500, { normalized: false, unit: "USD" })
		).toBe("+1,500 USD");
	});

	it("formats bb / bi normalized amounts when normalized", () => {
		expect(formatScopedProfitLoss(30, { normalized: true, unit: "bb" })).toBe(
			"+30 bb"
		);
		expect(
			formatScopedProfitLoss(12.345, { normalized: true, unit: "bi" })
		).toBe("+12.35 bi");
	});

	it("renders the em dash for null in both modes", () => {
		expect(
			formatScopedProfitLoss(null, { normalized: false, unit: "USD" })
		).toBe("—");
		expect(formatScopedProfitLoss(null, { normalized: true, unit: "bb" })).toBe(
			"—"
		);
	});
});
