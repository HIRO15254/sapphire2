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

	it("uses compact notation for large values", () => {
		expect(formatProfitLoss(15_000)).toBe("+15k");
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
