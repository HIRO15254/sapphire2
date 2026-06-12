import { describe, expect, it } from "vitest";
import {
	dateInputToEpochSec,
	epochSecToDateInput,
	filtersToStatsInput,
	isCurrencyScopeValid,
	normalizationUnit,
	parseStatsSearch,
	resolveDateRange,
	type StatsFilters,
	statsDisplayUnit,
} from "@/features/statistics/utils/stats-filters";

function filters(overrides: Partial<StatsFilters> = {}): StatsFilters {
	return {
		period: "all",
		norm: "off",
		type: "all",
		...overrides,
	};
}

// 2026-06-12T08:30:00Z
const NOW_SEC = Math.floor(Date.UTC(2026, 5, 12, 8, 30, 0) / 1000);
const START_OF_DAY = Math.floor(Date.UTC(2026, 5, 12) / 1000);
const DAY = 86_400;

describe("parseStatsSearch", () => {
	it("applies defaults for an empty search object", () => {
		expect(parseStatsSearch({})).toEqual({
			period: "all",
			norm: "off",
			type: "all",
		});
	});

	it("preserves all provided values", () => {
		expect(
			parseStatsSearch({
				period: "30d",
				norm: "bb",
				type: "cash_game",
				currency: "c1",
				room: "r1",
			})
		).toEqual({
			period: "30d",
			norm: "bb",
			type: "cash_game",
			currency: "c1",
			room: "r1",
		});
	});

	it("coerces string custom-range bounds to numbers (shared-link round-trip)", () => {
		const parsed = parseStatsSearch({
			period: "custom",
			from: "100",
			to: "200",
		});
		expect(parsed.from).toBe(100);
		expect(parsed.to).toBe(200);
	});

	it("rejects an unknown period", () => {
		expect(() => parseStatsSearch({ period: "decade" })).toThrow();
	});

	it("rejects an unknown normalization mode", () => {
		expect(() => parseStatsSearch({ norm: "sats" })).toThrow();
	});

	it("rejects an unknown type", () => {
		expect(() => parseStatsSearch({ type: "spin" })).toThrow();
	});
});

describe("resolveDateRange", () => {
	it("returns an empty window for the 'all' period", () => {
		expect(resolveDateRange(filters({ period: "all" }), NOW_SEC)).toEqual({});
	});

	it("snaps the 7d lower bound to start of UTC day minus 7 days", () => {
		expect(resolveDateRange(filters({ period: "7d" }), NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 7 * DAY,
		});
	});

	it("snaps the 30d lower bound to start of UTC day minus 30 days", () => {
		expect(resolveDateRange(filters({ period: "30d" }), NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 30 * DAY,
		});
	});

	it("snaps the 90d lower bound to start of UTC day minus 90 days", () => {
		expect(resolveDateRange(filters({ period: "90d" }), NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 90 * DAY,
		});
	});

	it("uses Jan 1 (UTC) of the current year for ytd", () => {
		expect(resolveDateRange(filters({ period: "ytd" }), NOW_SEC)).toEqual({
			dateFrom: Math.floor(Date.UTC(2026, 0, 1) / 1000),
		});
	});

	it("passes through both custom bounds when present", () => {
		expect(
			resolveDateRange(
				filters({ period: "custom", from: 111, to: 222 }),
				NOW_SEC
			)
		).toEqual({ dateFrom: 111, dateTo: 222 });
	});

	it("omits a missing custom bound", () => {
		expect(
			resolveDateRange(filters({ period: "custom", from: 111 }), NOW_SEC)
		).toEqual({ dateFrom: 111 });
		expect(
			resolveDateRange(filters({ period: "custom", to: 222 }), NOW_SEC)
		).toEqual({ dateTo: 222 });
	});

	it("returns an empty window for a custom period with no bounds", () => {
		expect(resolveDateRange(filters({ period: "custom" }), NOW_SEC)).toEqual(
			{}
		);
	});
});

describe("filtersToStatsInput", () => {
	it("maps the 'all' type to undefined and off normalization to false", () => {
		expect(filtersToStatsInput(filters({ currency: "c1" }), NOW_SEC)).toEqual({
			currencyId: "c1",
			type: undefined,
			roomId: undefined,
			dateFrom: undefined,
			dateTo: undefined,
			normalized: false,
		});
	});

	it("passes through a concrete type and room", () => {
		const input = filtersToStatsInput(
			filters({ type: "tournament", room: "r1", currency: "c1" }),
			NOW_SEC
		);
		expect(input.type).toBe("tournament");
		expect(input.roomId).toBe("r1");
	});

	it("sets normalized true for bb and bi modes", () => {
		expect(
			filtersToStatsInput(filters({ norm: "bb" }), NOW_SEC).normalized
		).toBe(true);
		expect(
			filtersToStatsInput(filters({ norm: "bi" }), NOW_SEC).normalized
		).toBe(true);
	});

	it("treats an empty-string currency / room as undefined", () => {
		const input = filtersToStatsInput(
			filters({ currency: "", room: "", norm: "bb" }),
			NOW_SEC
		);
		expect(input.currencyId).toBeUndefined();
		expect(input.roomId).toBeUndefined();
	});

	it("includes the resolved date window", () => {
		const input = filtersToStatsInput(
			filters({ period: "7d", currency: "c1" }),
			NOW_SEC
		);
		expect(input.dateFrom).toBe(START_OF_DAY - 7 * DAY);
		expect(input.dateTo).toBeUndefined();
	});
});

describe("isCurrencyScopeValid", () => {
	it("is invalid when normalization is off and no currency is selected", () => {
		expect(isCurrencyScopeValid({ norm: "off", currency: undefined })).toBe(
			false
		);
		expect(isCurrencyScopeValid({ norm: "off", currency: "" })).toBe(false);
	});

	it("is valid when normalization is off but a currency is selected", () => {
		expect(isCurrencyScopeValid({ norm: "off", currency: "c1" })).toBe(true);
	});

	it("is valid when normalization is on regardless of currency", () => {
		expect(isCurrencyScopeValid({ norm: "bb", currency: undefined })).toBe(
			true
		);
		expect(isCurrencyScopeValid({ norm: "bi", currency: undefined })).toBe(
			true
		);
	});
});

describe("normalizationUnit", () => {
	it("maps bb / bi to their unit and off to null", () => {
		expect(normalizationUnit("bb")).toBe("bb");
		expect(normalizationUnit("bi")).toBe("bi");
		expect(normalizationUnit("off")).toBeNull();
	});
});

describe("statsDisplayUnit", () => {
	it("prefers the normalization unit over the currency unit", () => {
		expect(statsDisplayUnit("bb", "USD")).toBe("bb");
		expect(statsDisplayUnit("bi", "USD")).toBe("bi");
	});

	it("falls back to the currency unit when normalization is off", () => {
		expect(statsDisplayUnit("off", "USD")).toBe("USD");
	});

	it("returns null when off and no currency unit is available", () => {
		expect(statsDisplayUnit("off", null)).toBeNull();
		expect(statsDisplayUnit("off", undefined)).toBeNull();
	});
});

describe("dateInputToEpochSec", () => {
	it("converts a date string to start-of-day UTC seconds", () => {
		expect(dateInputToEpochSec("2026-06-12")).toBe(
			Math.floor(Date.UTC(2026, 5, 12, 0, 0, 0) / 1000)
		);
	});

	it("snaps to end-of-day UTC when endOfDay is set", () => {
		expect(dateInputToEpochSec("2026-06-12", true)).toBe(
			Math.floor(Date.UTC(2026, 5, 12, 23, 59, 59) / 1000)
		);
	});

	it("returns undefined for an empty or malformed value", () => {
		expect(dateInputToEpochSec("")).toBeUndefined();
		expect(dateInputToEpochSec("2026/06/12")).toBeUndefined();
		expect(dateInputToEpochSec("not-a-date")).toBeUndefined();
	});
});

describe("epochSecToDateInput", () => {
	it("formats seconds back to yyyy-mm-dd (UTC)", () => {
		expect(
			epochSecToDateInput(Math.floor(Date.UTC(2026, 5, 12, 8, 0, 0) / 1000))
		).toBe("2026-06-12");
	});

	it("round-trips with dateInputToEpochSec", () => {
		const sec = dateInputToEpochSec("2026-01-05");
		expect(epochSecToDateInput(sec)).toBe("2026-01-05");
	});

	it("returns an empty string for undefined", () => {
		expect(epochSecToDateInput(undefined)).toBe("");
	});
});
