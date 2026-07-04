import { describe, expect, it } from "vitest";
import {
	createGroupFormatter,
	formatCompactNumber,
	formatYmdSlash,
} from "@/utils/format-number";

const B_SUFFIX = /B$/;

// SA2-145: sessionDate is a UTC-midnight ISO string, so formatYmdSlash must
// read UTC calendar fields. Node/Bun re-reads process.env.TZ on every Date
// operation; restore the original TZ so this file (web-node, isolate:false)
// cannot leak a zone into sibling pure-util test files.
const ORIGINAL_TZ = process.env.TZ;
const TZ_WEST = "America/Los_Angeles"; // UTC-8/-7 — reproduces the bug
const TZ_EAST = "Asia/Tokyo"; // UTC+9
function withTz<T>(tz: string, fn: () => T): T {
	process.env.TZ = tz;
	try {
		return fn();
	} finally {
		if (ORIGINAL_TZ === undefined) {
			process.env.TZ = undefined;
		} else {
			process.env.TZ = ORIGINAL_TZ;
		}
	}
}

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

		it("formats small negative integers with separators", () => {
			expect(formatCompactNumber(-9999)).toBe("-9,999");
		});

		it("keeps decimals from the original number", () => {
			expect(formatCompactNumber(1234.5)).toBe("1,234.5");
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
			// 12_345 / 1000 = 12.345 → toFixed(1) → "12.3" (nearest down).
			expect(formatCompactNumber(12_345)).toBe("12.3k");
			// 12_400 / 1000 = 12.4 → toFixed(1) → "12.4".
			expect(formatCompactNumber(12_400)).toBe("12.4k");
		});

		it("rounds half-even via IEEE754 imprecision", () => {
			// 12_350 / 1000 stored as 12.34999… → toFixed(1) → "12.3".
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
			// Note: (-0).toLocaleString() === "-0" in V8.
			// Callers that do not want that should pre-normalize to 0.
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

	// SA2-145: the session-list card and detail meta row must show the UTC
	// calendar day the user saved, not the local rendering of UTC midnight.
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
