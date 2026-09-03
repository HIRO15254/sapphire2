import { describe, expect, it } from "vitest";
import { TZ_EAST, TZ_WEST, withTz } from "@/__tests__/tz";
import { formatLocalYmdSlash, formatYmdSlash } from "@/utils/format-number";

describe("formatYmdSlash across time zones", () => {
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

describe("formatLocalYmdSlash across time zones", () => {
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
