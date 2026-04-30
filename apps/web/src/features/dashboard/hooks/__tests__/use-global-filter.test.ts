import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_GLOBAL_FILTER,
	GlobalFilterProvider,
	type GlobalFilterValues,
	resolveDateRangeDaysFilter,
	resolveGlobalFilterFromWidgets,
	resolveSessionTypeFilter,
	useGlobalFilter,
} from "@/features/dashboard/hooks/use-global-filter";

describe("DEFAULT_GLOBAL_FILTER", () => {
	it("is a no-op filter (type='all', dateRangeDays=null)", () => {
		expect(DEFAULT_GLOBAL_FILTER).toEqual({
			type: "all",
			dateRangeDays: null,
		});
	});
});

describe("useGlobalFilter", () => {
	it("returns DEFAULT_GLOBAL_FILTER when no provider wraps", () => {
		const { result } = renderHook(() => useGlobalFilter());
		expect(result.current).toEqual(DEFAULT_GLOBAL_FILTER);
	});

	it("returns the provided value through GlobalFilterProvider", () => {
		const value: GlobalFilterValues = { type: "cash_game", dateRangeDays: 7 };
		function wrapper({ children }: { children: ReactNode }) {
			return createElement(GlobalFilterProvider, { value }, children);
		}
		const { result } = renderHook(() => useGlobalFilter(), { wrapper });
		expect(result.current).toEqual(value);
	});
});

describe("resolveGlobalFilterFromWidgets", () => {
	it("returns defaults when no global_filter widget is present", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "summary_stats", config: { type: "cash_game" } },
			])
		).toEqual(DEFAULT_GLOBAL_FILTER);
	});

	it("returns defaults when widgets array is empty", () => {
		expect(resolveGlobalFilterFromWidgets([])).toEqual(DEFAULT_GLOBAL_FILTER);
	});

	it("returns the global_filter widget's parsed values", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{
					type: "global_filter",
					config: { type: "tournament", dateRangeDays: 30 },
				},
			])
		).toEqual({ type: "tournament", dateRangeDays: 30 });
	});

	it("uses the first global_filter widget when multiple exist", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{
					type: "global_filter",
					config: { type: "cash_game", dateRangeDays: 7 },
				},
				{
					type: "global_filter",
					config: { type: "tournament", dateRangeDays: 90 },
				},
			])
		).toEqual({ type: "cash_game", dateRangeDays: 7 });
	});

	it("coerces unknown type to 'all'", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { type: "weird" } },
			]).type
		).toBe("all");
	});

	it("coerces non-numeric dateRangeDays to null", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { dateRangeDays: "30" } },
			]).dateRangeDays
		).toBeNull();
	});

	it("coerces dateRangeDays < 1 to null", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { dateRangeDays: 0 } },
			]).dateRangeDays
		).toBeNull();
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { dateRangeDays: -10 } },
			]).dateRangeDays
		).toBeNull();
	});

	it("coerces NaN dateRangeDays to null", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { dateRangeDays: Number.NaN } },
			]).dateRangeDays
		).toBeNull();
	});

	it("coerces Infinity dateRangeDays to null", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{
					type: "global_filter",
					config: { dateRangeDays: Number.POSITIVE_INFINITY },
				},
			]).dateRangeDays
		).toBeNull();
	});

	it("floors fractional dateRangeDays", () => {
		expect(
			resolveGlobalFilterFromWidgets([
				{ type: "global_filter", config: { dateRangeDays: 7.9 } },
			]).dateRangeDays
		).toBe(7);
	});
});

describe("resolveSessionTypeFilter", () => {
	it("returns local when global type is 'all'", () => {
		expect(
			resolveSessionTypeFilter("cash_game", {
				type: "all",
				dateRangeDays: null,
			})
		).toBe("cash_game");
	});

	it("returns global when global type is 'cash_game'", () => {
		expect(
			resolveSessionTypeFilter("tournament", {
				type: "cash_game",
				dateRangeDays: null,
			})
		).toBe("cash_game");
	});

	it("returns global when global type is 'tournament'", () => {
		expect(
			resolveSessionTypeFilter("all", {
				type: "tournament",
				dateRangeDays: null,
			})
		).toBe("tournament");
	});
});

describe("resolveDateRangeDaysFilter", () => {
	it("returns local when global is null", () => {
		expect(
			resolveDateRangeDaysFilter(30, { type: "all", dateRangeDays: null })
		).toBe(30);
	});

	it("returns global when global is set", () => {
		expect(
			resolveDateRangeDaysFilter(30, { type: "all", dateRangeDays: 7 })
		).toBe(7);
	});

	it("returns null when both local and global are null", () => {
		expect(
			resolveDateRangeDaysFilter(null, { type: "all", dateRangeDays: null })
		).toBeNull();
	});

	it("returns global=1 (boundary) over local", () => {
		expect(
			resolveDateRangeDaysFilter(30, { type: "all", dateRangeDays: 1 })
		).toBe(1);
	});
});
