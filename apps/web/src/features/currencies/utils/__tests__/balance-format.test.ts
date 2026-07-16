import { describe, expect, it, vi } from "vitest";
import {
	getBalanceColorClass,
	getBalanceDisplay,
} from "@/features/currencies/utils/balance-format";

describe("getBalanceDisplay", () => {
	it("returns no exact line for a small positive value (not abbreviated)", () => {
		expect(getBalanceDisplay(1234)).toEqual({ compact: "1,234", exact: null });
	});

	it("returns no exact line at the abbreviation boundary minus one (9999)", () => {
		expect(getBalanceDisplay(9999)).toEqual({ compact: "9,999", exact: null });
	});

	it("returns both compact and exact at the abbreviation boundary (10000)", () => {
		expect(getBalanceDisplay(10_000)).toEqual({
			compact: "10k",
			exact: "10,000",
		});
	});

	it("uses the fixed shared locale for the exact value", () => {
		const localeSpy = vi
			.spyOn(Number.prototype, "toLocaleString")
			.mockReturnValue("10.000");

		try {
			expect(getBalanceDisplay(10_000)).toEqual({
				compact: "10k",
				exact: "10,000",
			});
			expect(localeSpy).not.toHaveBeenCalled();
		} finally {
			localeSpy.mockRestore();
		}
	});
	it("returns both compact and exact for a large abbreviated value", () => {
		expect(getBalanceDisplay(100_000)).toEqual({
			compact: "100k",
			exact: "100,000",
		});
	});

	it("abbreviates and keeps the sign for a large negative value", () => {
		expect(getBalanceDisplay(-100_000)).toEqual({
			compact: "-100k",
			exact: "-100,000",
		});
	});

	it("returns no exact line for a small negative value", () => {
		expect(getBalanceDisplay(-100)).toEqual({ compact: "-100", exact: null });
	});

	it("returns no exact line for zero", () => {
		expect(getBalanceDisplay(0)).toEqual({ compact: "0", exact: null });
	});
});

describe("getBalanceColorClass", () => {
	it("flags a negative balance with the destructive token", () => {
		expect(getBalanceColorClass(-1)).toBe("text-destructive");
	});

	it("leaves a positive balance neutral", () => {
		expect(getBalanceColorClass(1)).toBe("");
	});

	it("leaves a zero balance neutral", () => {
		expect(getBalanceColorClass(0)).toBe("");
	});
});
