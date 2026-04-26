import { describe, expect, it } from "vitest";
import { formatProfitLoss, profitLossColorClass } from "../format-profit-loss";

describe("formatProfitLoss", () => {
	it("formats positive values with + sign", () => {
		expect(formatProfitLoss(500)).toBe("+500");
	});

	it("formats zero with + sign", () => {
		expect(formatProfitLoss(0)).toBe("+0");
	});

	it("formats negative values with - sign intact", () => {
		expect(formatProfitLoss(-500)).toBe("-500");
	});

	it("returns em dash for null", () => {
		expect(formatProfitLoss(null)).toBe("—");
	});

	it("returns em dash for undefined", () => {
		expect(formatProfitLoss(undefined)).toBe("—");
	});

	it("uses custom nullDisplay", () => {
		expect(formatProfitLoss(null, { nullDisplay: "-" })).toBe("-");
	});

	it("appends currency unit", () => {
		expect(formatProfitLoss(-500, { currencyUnit: "JPY" })).toBe("-500 JPY");
	});

	it("does not append currency unit when null value", () => {
		expect(formatProfitLoss(null, { currencyUnit: "JPY" })).toBe("—");
	});

	it("uses compact notation for large values (k tier)", () => {
		expect(formatProfitLoss(15_000)).toBe("+15k");
	});

	it("uses compact notation for M tier", () => {
		expect(formatProfitLoss(-12_500_000)).toBe("-12.5M");
	});

	it("uses compact notation for B tier", () => {
		expect(formatProfitLoss(10_000_000_000)).toBe("+10B");
	});

	it("falls through to no unit when currencyUnit is null", () => {
		expect(formatProfitLoss(500, { currencyUnit: null })).toBe("+500");
	});

	it("falls through to no unit when currencyUnit is empty string", () => {
		expect(formatProfitLoss(500, { currencyUnit: "" })).toBe("+500");
	});

	it("keeps decimals for small non-integer values", () => {
		expect(formatProfitLoss(1.5)).toBe("+1.5");
	});

	it("prints the odd '+-0' when value is -0 (sign + underlying locale string)", () => {
		// -0 >= 0 is true, so sign is '+'.
		// (-0).toLocaleString() === '-0' → concatenation yields '+-0'.
		// This test pins the current behavior; callers that dislike it must pre-normalize.
		expect(formatProfitLoss(-0)).toBe("+-0");
	});

	it("combines currency unit with compact notation", () => {
		expect(formatProfitLoss(-12_500, { currencyUnit: "JPY" })).toBe(
			"-12.5k JPY"
		);
	});

	it("uses custom nullDisplay even when currencyUnit is supplied", () => {
		expect(
			formatProfitLoss(undefined, { currencyUnit: "JPY", nullDisplay: "N/A" })
		).toBe("N/A");
	});
});

describe("profitLossColorClass", () => {
	it("returns green for positive", () => {
		expect(profitLossColorClass(100)).toBe(
			"text-green-600 dark:text-green-400"
		);
	});

	it("returns red for negative", () => {
		expect(profitLossColorClass(-100)).toBe("text-red-600 dark:text-red-400");
	});

	it("returns empty for zero", () => {
		expect(profitLossColorClass(0)).toBe("");
	});

	it("returns empty for null", () => {
		expect(profitLossColorClass(null)).toBe("");
	});

	it("returns empty for undefined", () => {
		expect(profitLossColorClass(undefined)).toBe("");
	});
});
