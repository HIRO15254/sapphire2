import { describe, expect, it } from "vitest";
import {
	filtersToStatsInput,
	isCurrencyScopeValid,
	normalizedUnitForType,
	parseStatsSearch,
	type StatsFilters,
	statsUnitFor,
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
			norm: "normalized",
			type: "all",
		});
	});

	it("preserves all provided values", () => {
		expect(
			parseStatsSearch({
				period: "30d",
				norm: "normalized",
				type: "cash_game",
				currency: "c1",
				room: "r1",
			})
		).toEqual({
			period: "30d",
			norm: "normalized",
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
		expect(() => parseStatsSearch({ norm: "bb" })).toThrow();
	});

	it("rejects an unknown type", () => {
		expect(() => parseStatsSearch({ type: "spin" })).toThrow();
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

	it("sets normalized true for the normalized mode", () => {
		expect(
			filtersToStatsInput(filters({ norm: "normalized" }), NOW_SEC).normalized
		).toBe(true);
	});

	it("treats an empty-string currency / room as undefined", () => {
		const input = filtersToStatsInput(
			filters({ currency: "", room: "", norm: "normalized" }),
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
		expect(input.dateFrom).toBe(START_OF_DAY - 6 * DAY);
		expect(input.dateTo).toBe(START_OF_DAY + DAY - 1);
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
		expect(
			isCurrencyScopeValid({ norm: "normalized", currency: undefined })
		).toBe(true);
	});
});

describe("normalizedUnitForType", () => {
	it("maps cash to bb and tournament to bi", () => {
		expect(normalizedUnitForType("cash_game")).toBe("bb");
		expect(normalizedUnitForType("tournament")).toBe("bi");
	});
});

describe("statsUnitFor", () => {
	it("uses the currency unit when normalization is off", () => {
		expect(statsUnitFor("off", "cash_game", "USD")).toBe("USD");
		expect(statsUnitFor("off", "tournament", "USD")).toBe("USD");
	});

	it("returns null when off and no currency unit is available", () => {
		expect(statsUnitFor("off", "cash_game", null)).toBeNull();
		expect(statsUnitFor("off", "cash_game", undefined)).toBeNull();
	});

	it("uses the type's normalized unit when normalized", () => {
		expect(statsUnitFor("normalized", "cash_game", "USD")).toBe("bb");
		expect(statsUnitFor("normalized", "tournament", "USD")).toBe("bi");
	});
});
