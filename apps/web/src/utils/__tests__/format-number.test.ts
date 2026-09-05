import { describe, expect, it } from "vitest";
import { TZ_EAST, TZ_WEST, withTz } from "@/__tests__/tz";
import {
	createGroupFormatter,
	formatCompactNumber,
	formatLocalYmdSlash,
	formatNumber,
	formatYmdSlash,
} from "@/utils/format-number";

const B_SUFFIX = /B$/;

describe("formatCompactNumber", () => {
	describe("below the 10k threshold", () => {
		it("formats 0 as locale string", () => {
			expect(formatCompactNumber(0)).toBe("0");
		});

		it("formats small positive integers with separators", () => {
			expect(formatCompactNumber(1)).toBe("1");
			expect(formatCompactNumber(999)).toBe("999");
			expect(formatCompactNumber(1000)).toBe("1,000");
			expect(formatCompactNumber(9999)).toBe("9,999");
		});

		it("uses the fixed en-US locale for unabridged values", () => {
			expect(formatCompactNumber(1234.5)).toBe("1,234.5");
		});

		it("formats full values through the fixed en-US formatter", () => {
			expect(formatNumber(1234.5)).toBe("1,234.5");
		});

		it("formats small negative integers with separators", () => {
			expect(formatCompactNumber(-9999)).toBe("-9,999");
		});
	});

	describe("k tier (>= 10_000, < 10_000_000)", () => {
		it("formats exactly 10_000 as '10k'", () => {
			expect(formatCompactNumber(10_000)).toBe("10k");
		});

		it("keeps one decimal when non-zero", () => {
			expect(formatCompactNumber(12_500)).toBe("12.5k");
		});

		it("strips trailing .0", () => {
			expect(formatCompactNumber(20_000)).toBe("20k");
		});

		it("rounds the last digit via toFixed(1)", () => {
			expect(formatCompactNumber(12_345)).toBe("12.3k");
			expect(formatCompactNumber(12_400)).toBe("12.4k");
		});

		it("rounds half-even via IEEE754 imprecision", () => {
			expect(formatCompactNumber(12_350)).toBe("12.3k");
		});

		it("applies to negative values via Math.abs threshold", () => {
			expect(formatCompactNumber(-10_000)).toBe("-10k");
			expect(formatCompactNumber(-12_500)).toBe("-12.5k");
		});

		it("caps at just below 10M", () => {
			expect(formatCompactNumber(9_999_999)).toBe("10000k");
		});
	});

	describe("M tier (>= 10_000_000, < 10_000_000_000)", () => {
		it("formats exactly 10_000_000 as '10M'", () => {
			expect(formatCompactNumber(10_000_000)).toBe("10M");
		});

		it("keeps one decimal when non-zero", () => {
			expect(formatCompactNumber(12_500_000)).toBe("12.5M");
		});

		it("applies to negative values", () => {
			expect(formatCompactNumber(-15_000_000)).toBe("-15M");
		});
	});

	describe("B tier (>= 10_000_000_000)", () => {
		it("formats exactly 10_000_000_000 as '10B'", () => {
			expect(formatCompactNumber(10_000_000_000)).toBe("10B");
		});

		it("keeps one decimal when non-zero", () => {
			expect(formatCompactNumber(12_500_000_000)).toBe("12.5B");
		});

		it("applies to negative values", () => {
			expect(formatCompactNumber(-12_500_000_000)).toBe("-12.5B");
		});

		it("handles very large numbers without clamping", () => {
			expect(formatCompactNumber(1_234_567_890_123)).toBe("1234.6B");
		});
	});

	describe("edge cases", () => {
		it("handles Number.MAX_SAFE_INTEGER", () => {
			expect(formatCompactNumber(Number.MAX_SAFE_INTEGER)).toMatch(B_SUFFIX);
		});

		it("preserves the sign of -0 via toLocaleString", () => {
			expect(formatCompactNumber(-0)).toBe("-0");
		});

		it("Infinity falls into the B tier", () => {
			expect(formatCompactNumber(Number.POSITIVE_INFINITY)).toBe("InfinityB");
		});
	});
});

describe("createGroupFormatter", () => {
	describe("tier selection", () => {
		it("uses no tier (plain locale) when max abs < 10k", () => {
			const fmt = createGroupFormatter([100, 200, 9999]);
			expect(fmt(100)).toBe("100");
			expect(fmt(9999)).toBe("9,999");
		});

		it("selects k tier when max abs is between 10k and 10M", () => {
			const fmt = createGroupFormatter([100, 200, 10_000]);
			expect(fmt(100)).toBe("0.1k");
			expect(fmt(200)).toBe("0.2k");
			expect(fmt(10_000)).toBe("10k");
		});

		it("selects M tier when max abs is between 10M and 10B", () => {
			const fmt = createGroupFormatter([1, 10_000_000]);
			expect(fmt(1)).toBe("0M");
			expect(fmt(10_000_000)).toBe("10M");
		});

		it("selects B tier when max abs is >= 10B", () => {
			const fmt = createGroupFormatter([1, 10_000_000_000]);
			expect(fmt(1)).toBe("0B");
			expect(fmt(10_000_000_000)).toBe("10B");
		});
	});

	describe("null / undefined / zero handling", () => {
		it("skips null values in tier calculation", () => {
			const fmt = createGroupFormatter([null, null, 10_000]);
			expect(fmt(10_000)).toBe("10k");
		});

		it("skips undefined values in tier calculation", () => {
			const fmt = createGroupFormatter([undefined, undefined, 10_000]);
			expect(fmt(10_000)).toBe("10k");
		});

		it("skips zeros in tier calculation", () => {
			const fmt = createGroupFormatter([0, 0, 9999]);
			expect(fmt(9999)).toBe("9,999");
		});

		it("returns plain formatter when input is entirely empty", () => {
			const fmt = createGroupFormatter([]);
			expect(fmt(0)).toBe("0");
			expect(fmt(100)).toBe("100");
		});

		it("returns plain formatter when input is entirely null/zero", () => {
			const fmt = createGroupFormatter([null, 0, undefined]);
			expect(fmt(123)).toBe("123");
		});
	});

	describe("negative handling", () => {
		it("uses absolute max for tier selection", () => {
			const fmt = createGroupFormatter([-20_000_000, 1]);
			expect(fmt(1)).toBe("0M");
			expect(fmt(-20_000_000)).toBe("-20M");
		});
	});

	describe("trailing .0 stripping", () => {
		it("strips .0 but keeps other fraction digits", () => {
			const fmt = createGroupFormatter([10_000]);
			expect(fmt(20_000)).toBe("20k");
			expect(fmt(12_500)).toBe("12.5k");
		});
	});
});

describe("formatYmdSlash", () => {
	it("formats a UTC Date as Y/MM/DD", () => {
		expect(formatYmdSlash(new Date(Date.UTC(2026, 3, 5)))).toBe("2026/04/05");
	});

	it("zero-pads single-digit months and days", () => {
		expect(formatYmdSlash(new Date(Date.UTC(2026, 0, 1)))).toBe("2026/01/01");
		expect(formatYmdSlash(new Date(Date.UTC(2026, 8, 9)))).toBe("2026/09/09");
	});

	it("parses a UTC-midnight ISO string to its UTC calendar day", () => {
		expect(formatYmdSlash("2026-06-15T00:00:00Z")).toBe("2026/06/15");
	});

	it("formats December 31 without off-by-one", () => {
		expect(formatYmdSlash(new Date(Date.UTC(2026, 11, 31)))).toBe("2026/12/31");
	});

	it("handles a pre-epoch date", () => {
		expect(formatYmdSlash(new Date(Date.UTC(1969, 6, 20)))).toBe("1969/07/20");
	});

	it("keeps the UTC calendar day at the UTC-midnight boundary west of UTC", () => {
		expect(withTz(TZ_WEST, () => formatYmdSlash("2026-04-22T00:00:00Z"))).toBe(
			"2026/04/22"
		);
	});

	it("keeps the UTC calendar day at the UTC-midnight boundary east of UTC", () => {
		expect(withTz(TZ_EAST, () => formatYmdSlash("2026-04-22T00:00:00Z"))).toBe(
			"2026/04/22"
		);
	});

	it("renders the same day west-of-UTC, east-of-UTC, and in UTC", () => {
		const iso = "2026-01-01T00:00:00Z";
		expect(withTz(TZ_WEST, () => formatYmdSlash(iso))).toBe("2026/01/01");
		expect(withTz(TZ_EAST, () => formatYmdSlash(iso))).toBe("2026/01/01");
		expect(withTz("UTC", () => formatYmdSlash(iso))).toBe("2026/01/01");
	});
});

describe("formatLocalYmdSlash", () => {
	it("formats a timestamp as its local calendar day", () => {
		expect(formatLocalYmdSlash(new Date(2026, 3, 5, 12, 0))).toBe("2026/04/05");
	});

	it("zero-pads single-digit months and days", () => {
		expect(formatLocalYmdSlash(new Date(2026, 0, 1, 12, 0))).toBe("2026/01/01");
	});

	it("accepts an ISO string", () => {
		expect(
			formatLocalYmdSlash(new Date(2026, 5, 15, 9, 30).toISOString())
		).toBe("2026/06/15");
	});

	it("reads the local day west of UTC, where the UTC day is already tomorrow", () => {
		expect(
			withTz(TZ_WEST, () => formatLocalYmdSlash("2026-04-11T03:00:00Z"))
		).toBe("2026/04/10");
		expect(withTz(TZ_WEST, () => formatYmdSlash("2026-04-11T03:00:00Z"))).toBe(
			"2026/04/11"
		);
	});

	it("reads the local day east of UTC, where the UTC day is still yesterday", () => {
		expect(
			withTz(TZ_EAST, () => formatLocalYmdSlash("2026-04-09T22:00:00Z"))
		).toBe("2026/04/10");
		expect(withTz(TZ_EAST, () => formatYmdSlash("2026-04-09T22:00:00Z"))).toBe(
			"2026/04/09"
		);
	});
});
