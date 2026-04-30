import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
	configToInitialValues,
	DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG,
	DEFAULT_GLOBAL_FILTER_VALUES,
	findGlobalFilterWidget,
	GlobalFilterProvider,
	isoDateToEpochSeconds,
	parseGlobalFilterConfig,
	resolveDateFromEpoch,
	resolveDateToEpoch,
	resolveGlobalFilterFromWidgets,
	resolveSessionType,
	useGlobalFilter,
	useGlobalFilterControl,
} from "@/features/dashboard/hooks/use-global-filter";

describe("DEFAULT_GLOBAL_FILTER_VALUES", () => {
	it("is a no-op filter (every key null)", () => {
		expect(DEFAULT_GLOBAL_FILTER_VALUES).toEqual({
			type: null,
			storeId: null,
			currencyId: null,
			dateFrom: null,
			dateTo: null,
			dateRangeDays: null,
		});
	});
});

describe("DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG", () => {
	it("marks every field visible with null initialValue", () => {
		for (const key of [
			"type",
			"storeId",
			"currencyId",
			"dateFrom",
			"dateTo",
			"dateRangeDays",
		] as const) {
			expect(DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG[key]).toEqual({
				initialValue: null,
				visible: true,
			});
		}
	});
});

describe("useGlobalFilter / useGlobalFilterControl", () => {
	it("useGlobalFilter returns DEFAULT values without provider", () => {
		const { result } = renderHook(() => useGlobalFilter());
		expect(result.current).toEqual(DEFAULT_GLOBAL_FILTER_VALUES);
	});

	it("useGlobalFilterControl returns no-op handlers without provider", () => {
		const { result } = renderHook(() => useGlobalFilterControl());
		expect(result.current.values).toEqual(DEFAULT_GLOBAL_FILTER_VALUES);
		expect(typeof result.current.setValue).toBe("function");
		expect(typeof result.current.reset).toBe("function");
		expect(() => result.current.setValue("type", "cash_game")).not.toThrow();
		expect(() => result.current.reset()).not.toThrow();
	});

	it("useGlobalFilter reads provided values", () => {
		const setValue = vi.fn();
		const reset = vi.fn();
		const values = {
			...DEFAULT_GLOBAL_FILTER_VALUES,
			type: "tournament" as const,
			dateRangeDays: 30,
		};
		function wrapper({ children }: { children: ReactNode }) {
			return createElement(
				GlobalFilterProvider,
				{ value: { values, setValue, reset } },
				children
			);
		}
		const { result } = renderHook(() => useGlobalFilter(), { wrapper });
		expect(result.current).toBe(values);
	});

	it("useGlobalFilterControl exposes provided handlers", () => {
		const setValue = vi.fn();
		const reset = vi.fn();
		const values = DEFAULT_GLOBAL_FILTER_VALUES;
		function wrapper({ children }: { children: ReactNode }) {
			return createElement(
				GlobalFilterProvider,
				{ value: { values, setValue, reset } },
				children
			);
		}
		const { result } = renderHook(() => useGlobalFilterControl(), {
			wrapper,
		});
		result.current.setValue("storeId", "store-1");
		result.current.reset();
		expect(setValue).toHaveBeenCalledTimes(1);
		expect(setValue).toHaveBeenCalledWith("storeId", "store-1");
		expect(reset).toHaveBeenCalledTimes(1);
	});
});

describe("parseGlobalFilterConfig", () => {
	it("returns defaults for an empty config", () => {
		expect(parseGlobalFilterConfig({})).toEqual(
			DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG
		);
	});

	it("parses type field with valid values", () => {
		expect(
			parseGlobalFilterConfig({
				type: { initialValue: "cash_game", visible: false },
			}).type
		).toEqual({ initialValue: "cash_game", visible: false });
		expect(
			parseGlobalFilterConfig({
				type: { initialValue: "tournament", visible: true },
			}).type
		).toEqual({ initialValue: "tournament", visible: true });
	});

	it("rejects unknown type initialValue", () => {
		expect(
			parseGlobalFilterConfig({
				type: { initialValue: "weird", visible: true },
			}).type.initialValue
		).toBeNull();
	});

	it("parses string fields (storeId / currencyId / dateFrom / dateTo)", () => {
		const parsed = parseGlobalFilterConfig({
			storeId: { initialValue: "store-1", visible: true },
			currencyId: { initialValue: "currency-1", visible: false },
			dateFrom: { initialValue: "2026-01-01", visible: true },
			dateTo: { initialValue: "2026-12-31", visible: true },
		});
		expect(parsed.storeId.initialValue).toBe("store-1");
		expect(parsed.currencyId).toEqual({
			initialValue: "currency-1",
			visible: false,
		});
		expect(parsed.dateFrom.initialValue).toBe("2026-01-01");
		expect(parsed.dateTo.initialValue).toBe("2026-12-31");
	});

	it("rejects non-string initialValue for string fields", () => {
		expect(
			parseGlobalFilterConfig({
				storeId: { initialValue: 123, visible: true },
			}).storeId.initialValue
		).toBeNull();
	});

	it("parses dateRangeDays as a positive integer", () => {
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: { initialValue: 30, visible: true },
			}).dateRangeDays.initialValue
		).toBe(30);
	});

	it("floors fractional dateRangeDays initialValue", () => {
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: { initialValue: 7.9, visible: true },
			}).dateRangeDays.initialValue
		).toBe(7);
	});

	it("rejects dateRangeDays < 1", () => {
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: { initialValue: 0, visible: true },
			}).dateRangeDays.initialValue
		).toBeNull();
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: { initialValue: -3, visible: true },
			}).dateRangeDays.initialValue
		).toBeNull();
	});

	it("rejects NaN / Infinity dateRangeDays", () => {
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: { initialValue: Number.NaN, visible: true },
			}).dateRangeDays.initialValue
		).toBeNull();
		expect(
			parseGlobalFilterConfig({
				dateRangeDays: {
					initialValue: Number.POSITIVE_INFINITY,
					visible: true,
				},
			}).dateRangeDays.initialValue
		).toBeNull();
	});

	it("defaults visible to true when not specified or non-boolean", () => {
		expect(
			parseGlobalFilterConfig({ type: { initialValue: "cash_game" } }).type
				.visible
		).toBe(true);
		expect(
			parseGlobalFilterConfig({
				type: { initialValue: "cash_game", visible: "yes" as unknown },
			}).type.visible
		).toBe(true);
	});

	it("respects visible: false explicitly", () => {
		expect(
			parseGlobalFilterConfig({
				storeId: { initialValue: "s1", visible: false },
			}).storeId.visible
		).toBe(false);
	});

	it("treats non-object raw fields as defaults", () => {
		expect(parseGlobalFilterConfig({ type: null }).type).toEqual({
			initialValue: null,
			visible: true,
		});
		expect(parseGlobalFilterConfig({ type: 123 }).type).toEqual({
			initialValue: null,
			visible: true,
		});
	});
});

describe("findGlobalFilterWidget / resolveGlobalFilterFromWidgets", () => {
	it("returns undefined when no global_filter widget exists", () => {
		expect(
			findGlobalFilterWidget([
				{ type: "summary_stats", config: {} },
				{ type: "recent_sessions", config: {} },
			])
		).toBeUndefined();
	});

	it("returns DEFAULT fields config when no global_filter widget exists", () => {
		expect(resolveGlobalFilterFromWidgets([])).toBe(
			DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG
		);
	});

	it("returns the first global_filter widget's parsed config", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{
					type: "global_filter",
					config: { type: { initialValue: "cash_game", visible: false } },
				},
				{
					type: "global_filter",
					config: { type: { initialValue: "tournament", visible: true } },
				},
			]).type
		).toEqual({ initialValue: "cash_game", visible: false });
	});
});

describe("configToInitialValues", () => {
	it("flattens fields config into runtime values", () => {
		const config = {
			...DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG,
			type: { initialValue: "cash_game" as const, visible: true },
			storeId: { initialValue: "store-1", visible: true },
			dateRangeDays: { initialValue: 7, visible: true },
		};
		expect(configToInitialValues(config)).toEqual({
			...DEFAULT_GLOBAL_FILTER_VALUES,
			type: "cash_game",
			storeId: "store-1",
			dateRangeDays: 7,
		});
	});

	it("returns all-null when config has only defaults", () => {
		expect(configToInitialValues(DEFAULT_GLOBAL_FILTER_FIELDS_CONFIG)).toEqual(
			DEFAULT_GLOBAL_FILTER_VALUES
		);
	});
});

describe("isoDateToEpochSeconds", () => {
	it("returns undefined for null", () => {
		expect(isoDateToEpochSeconds(null)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(isoDateToEpochSeconds("")).toBeUndefined();
	});

	it("returns undefined for invalid date string", () => {
		expect(isoDateToEpochSeconds("not-a-date")).toBeUndefined();
	});

	it("returns start-of-day epoch by default", () => {
		const epoch = isoDateToEpochSeconds("2026-04-01");
		expect(typeof epoch).toBe("number");
		expect(epoch).toBe(
			Math.floor(new Date("2026-04-01T00:00:00").getTime() / 1000)
		);
	});

	it("returns end-of-day epoch when endOfDay=true", () => {
		const epoch = isoDateToEpochSeconds("2026-04-01", true);
		expect(epoch).toBe(
			Math.floor(new Date("2026-04-01T23:59:59").getTime() / 1000)
		);
	});
});

describe("resolveDateFromEpoch", () => {
	it("prefers values.dateFrom over dateRangeDays", () => {
		const epoch = resolveDateFromEpoch({
			...DEFAULT_GLOBAL_FILTER_VALUES,
			dateFrom: "2026-01-01",
			dateRangeDays: 30,
		});
		expect(epoch).toBe(
			Math.floor(new Date("2026-01-01T00:00:00").getTime() / 1000)
		);
	});

	it("uses dateRangeDays when dateFrom is null", () => {
		const before = Math.floor(Date.now() / 1000) - 7 * 86_400 - 5;
		const after = Math.floor(Date.now() / 1000) - 7 * 86_400 + 5;
		const epoch = resolveDateFromEpoch({
			...DEFAULT_GLOBAL_FILTER_VALUES,
			dateRangeDays: 7,
		}) as number;
		expect(epoch).toBeGreaterThanOrEqual(before);
		expect(epoch).toBeLessThanOrEqual(after);
	});

	it("falls back to localDateRangeDays when both global values are null", () => {
		const epoch = resolveDateFromEpoch(
			DEFAULT_GLOBAL_FILTER_VALUES,
			14
		) as number;
		const expected = Math.floor(Date.now() / 1000) - 14 * 86_400;
		expect(epoch).toBeGreaterThanOrEqual(expected - 5);
		expect(epoch).toBeLessThanOrEqual(expected + 5);
	});

	it("returns undefined when nothing is set", () => {
		expect(resolveDateFromEpoch(DEFAULT_GLOBAL_FILTER_VALUES)).toBeUndefined();
	});
});

describe("resolveDateToEpoch", () => {
	it("returns end-of-day epoch when dateTo is set", () => {
		const epoch = resolveDateToEpoch({
			...DEFAULT_GLOBAL_FILTER_VALUES,
			dateTo: "2026-04-30",
		});
		expect(epoch).toBe(
			Math.floor(new Date("2026-04-30T23:59:59").getTime() / 1000)
		);
	});

	it("returns undefined when dateTo is null", () => {
		expect(resolveDateToEpoch(DEFAULT_GLOBAL_FILTER_VALUES)).toBeUndefined();
	});
});

describe("resolveSessionType", () => {
	it("uses global type when set", () => {
		expect(
			resolveSessionType("all", {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				type: "cash_game",
			})
		).toBe("cash_game");
		expect(
			resolveSessionType("tournament", {
				...DEFAULT_GLOBAL_FILTER_VALUES,
				type: "cash_game",
			})
		).toBe("cash_game");
	});

	it("uses local when global type is null", () => {
		expect(resolveSessionType("cash_game", DEFAULT_GLOBAL_FILTER_VALUES)).toBe(
			"cash_game"
		);
		expect(resolveSessionType("all", DEFAULT_GLOBAL_FILTER_VALUES)).toBe("all");
	});
});
