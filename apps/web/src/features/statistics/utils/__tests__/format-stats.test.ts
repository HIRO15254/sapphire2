import { describe, expect, it } from "vitest";
import {
	formatFixed,
	formatMinutes,
	formatPercent,
	trendDirection,
} from "@/features/statistics/utils/format-stats";

describe("formatMinutes", () => {
	it("formats hours and minutes together", () => {
		expect(formatMinutes(90)).toBe("1h 30m");
	});

	it("omits minutes when the total is a whole hour", () => {
		expect(formatMinutes(120)).toBe("2h");
	});

	it("omits hours when under an hour", () => {
		expect(formatMinutes(45)).toBe("45m");
	});

	it("rounds fractional minutes", () => {
		expect(formatMinutes(90.6)).toBe("1h 31m");
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
