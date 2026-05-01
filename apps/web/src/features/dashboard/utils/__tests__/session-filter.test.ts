import { describe, expect, it } from "vitest";
import { DEFAULT_GLOBAL_FILTER_VALUES } from "@/features/dashboard/hooks/use-global-filter";
import {
	parseDateRangeDays,
	parseSessionFilterWidgetConfig,
	parseSessionType,
	resolveSessionListQueryInput,
	SESSION_TYPE_OPTIONS,
	SESSION_TYPE_VALUES,
} from "@/features/dashboard/utils/session-filter";

describe("SESSION_TYPE_VALUES", () => {
	it("contains exactly 'all', 'cash_game', 'tournament'", () => {
		expect([...SESSION_TYPE_VALUES]).toEqual([
			"all",
			"cash_game",
			"tournament",
		]);
	});
});

describe("SESSION_TYPE_OPTIONS", () => {
	it("matches the canonical type values in order", () => {
		expect(SESSION_TYPE_OPTIONS.map((o) => o.value)).toEqual([
			"all",
			"cash_game",
			"tournament",
		]);
	});

	it("provides a label for every option", () => {
		expect(SESSION_TYPE_OPTIONS).toEqual([
			{ value: "all", label: "All" },
			{ value: "cash_game", label: "Cash Game" },
			{ value: "tournament", label: "Tournament" },
		]);
	});
});

describe("parseSessionType", () => {
	it("returns 'cash_game' / 'tournament' as-is", () => {
		expect(parseSessionType("cash_game")).toBe("cash_game");
		expect(parseSessionType("tournament")).toBe("tournament");
	});

	it("falls back to 'all' for any other value", () => {
		expect(parseSessionType("all")).toBe("all");
		expect(parseSessionType(undefined)).toBe("all");
		expect(parseSessionType(null)).toBe("all");
		expect(parseSessionType("")).toBe("all");
		expect(parseSessionType("garbage")).toBe("all");
		expect(parseSessionType(0)).toBe("all");
		expect(parseSessionType({})).toBe("all");
	});
});

describe("parseDateRangeDays", () => {
	it("keeps positive integers as-is", () => {
		expect(parseDateRangeDays(1)).toBe(1);
		expect(parseDateRangeDays(7)).toBe(7);
		expect(parseDateRangeDays(365)).toBe(365);
	});

	it("floors fractional positive numbers", () => {
		expect(parseDateRangeDays(7.9)).toBe(7);
		expect(parseDateRangeDays(1.0001)).toBe(1);
	});

	it("rejects values < 1", () => {
		expect(parseDateRangeDays(0)).toBeNull();
		expect(parseDateRangeDays(0.999)).toBeNull();
		expect(parseDateRangeDays(-1)).toBeNull();
	});

	it("rejects NaN / Infinity", () => {
		expect(parseDateRangeDays(Number.NaN)).toBeNull();
		expect(parseDateRangeDays(Number.POSITIVE_INFINITY)).toBeNull();
		expect(parseDateRangeDays(Number.NEGATIVE_INFINITY)).toBeNull();
	});

	it("rejects non-number values", () => {
		expect(parseDateRangeDays(undefined)).toBeNull();
		expect(parseDateRangeDays(null)).toBeNull();
		expect(parseDateRangeDays("7")).toBeNull();
		expect(parseDateRangeDays({})).toBeNull();
	});
});

describe("parseSessionFilterWidgetConfig", () => {
	it("returns canonical defaults for an empty object", () => {
		expect(parseSessionFilterWidgetConfig({})).toEqual({
			type: "all",
			dateRangeDays: null,
		});
	});

	it("parses type and dateRangeDays together", () => {
		expect(
			parseSessionFilterWidgetConfig({ type: "cash_game", dateRangeDays: 30 })
		).toEqual({ type: "cash_game", dateRangeDays: 30 });
	});

	it("ignores unknown keys", () => {
		expect(
			parseSessionFilterWidgetConfig({
				type: "tournament",
				something: "else",
			})
		).toEqual({ type: "tournament", dateRangeDays: null });
	});

	it("normalizes invalid type to 'all' and invalid dateRangeDays to null", () => {
		expect(
			parseSessionFilterWidgetConfig({ type: "weird", dateRangeDays: -3 })
		).toEqual({ type: "all", dateRangeDays: null });
	});
});

describe("resolveSessionListQueryInput", () => {
	const baseLocal = { type: "all", dateRangeDays: null } as const;

	it("returns all-undefined when local and global are defaults", () => {
		expect(
			resolveSessionListQueryInput(baseLocal, DEFAULT_GLOBAL_FILTER_VALUES)
		).toEqual({
			type: undefined,
			storeId: undefined,
			currencyId: undefined,
			dateFrom: undefined,
			dateTo: undefined,
		});
	});

	it("uses local type when global type is null", () => {
		expect(
			resolveSessionListQueryInput(
				{ type: "cash_game", dateRangeDays: null },
				DEFAULT_GLOBAL_FILTER_VALUES
			).type
		).toBe("cash_game");
	});

	it("global type overrides local type", () => {
		expect(
			resolveSessionListQueryInput(
				{ type: "cash_game", dateRangeDays: null },
				{ ...DEFAULT_GLOBAL_FILTER_VALUES, type: "tournament" }
			).type
		).toBe("tournament");
	});

	it("emits 'all' as undefined for the query", () => {
		expect(
			resolveSessionListQueryInput(baseLocal, DEFAULT_GLOBAL_FILTER_VALUES).type
		).toBeUndefined();
	});

	it("forwards global storeId / currencyId", () => {
		const out = resolveSessionListQueryInput(baseLocal, {
			...DEFAULT_GLOBAL_FILTER_VALUES,
			storeId: "store-1",
			currencyId: "currency-1",
		});
		expect(out.storeId).toBe("store-1");
		expect(out.currencyId).toBe("currency-1");
	});

	it("converts global dateFrom into start-of-day epoch seconds", () => {
		const out = resolveSessionListQueryInput(baseLocal, {
			...DEFAULT_GLOBAL_FILTER_VALUES,
			dateFrom: "2026-01-01",
		});
		expect(out.dateFrom).toBe(
			Math.floor(new Date("2026-01-01T00:00:00").getTime() / 1000)
		);
	});

	it("converts global dateTo into end-of-day epoch seconds", () => {
		const out = resolveSessionListQueryInput(baseLocal, {
			...DEFAULT_GLOBAL_FILTER_VALUES,
			dateTo: "2026-12-31",
		});
		expect(out.dateTo).toBe(
			Math.floor(new Date("2026-12-31T23:59:59").getTime() / 1000)
		);
	});

	it("global dateRangeDays takes precedence over local dateRangeDays", () => {
		const out = resolveSessionListQueryInput(
			{ type: "all", dateRangeDays: 30 },
			{ ...DEFAULT_GLOBAL_FILTER_VALUES, dateRangeDays: 3 }
		);
		const expected = Math.floor(Date.now() / 1000) - 3 * 86_400;
		expect(out.dateFrom).toBeGreaterThanOrEqual(expected - 5);
		expect(out.dateFrom).toBeLessThanOrEqual(expected + 5);
	});

	it("falls back to local dateRangeDays when global is fully default", () => {
		const out = resolveSessionListQueryInput(
			{ type: "all", dateRangeDays: 14 },
			DEFAULT_GLOBAL_FILTER_VALUES
		);
		const expected = Math.floor(Date.now() / 1000) - 14 * 86_400;
		expect(out.dateFrom).toBeGreaterThanOrEqual(expected - 5);
		expect(out.dateFrom).toBeLessThanOrEqual(expected + 5);
	});

	it("global dateFrom takes precedence over both dateRangeDays sources", () => {
		const out = resolveSessionListQueryInput(
			{ type: "all", dateRangeDays: 14 },
			{
				...DEFAULT_GLOBAL_FILTER_VALUES,
				dateFrom: "2026-01-01",
				dateRangeDays: 7,
			}
		);
		expect(out.dateFrom).toBe(
			Math.floor(new Date("2026-01-01T00:00:00").getTime() / 1000)
		);
	});
});
