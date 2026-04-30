import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
	GLOBAL_FILTER_TYPE_LABELS,
	parseGlobalFilterWidgetConfig,
	useGlobalFilterWidget,
} from "@/features/dashboard/widgets/global-filter-widget/use-global-filter-widget";

describe("parseGlobalFilterWidgetConfig", () => {
	it("returns defaults when raw is empty", () => {
		expect(parseGlobalFilterWidgetConfig({})).toEqual({
			type: "all",
			dateRangeDays: null,
		});
	});

	it("preserves cash_game type", () => {
		expect(parseGlobalFilterWidgetConfig({ type: "cash_game" }).type).toBe(
			"cash_game"
		);
	});

	it("preserves tournament type", () => {
		expect(parseGlobalFilterWidgetConfig({ type: "tournament" }).type).toBe(
			"tournament"
		);
	});

	it("coerces unknown type to 'all'", () => {
		expect(parseGlobalFilterWidgetConfig({ type: "weird" }).type).toBe("all");
	});

	it("preserves numeric dateRangeDays", () => {
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: 30 }).dateRangeDays
		).toBe(30);
	});

	it("coerces non-number dateRangeDays to null", () => {
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: "30" }).dateRangeDays
		).toBeNull();
	});

	it("coerces dateRangeDays < 1 to null", () => {
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: 0 }).dateRangeDays
		).toBeNull();
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: -1 }).dateRangeDays
		).toBeNull();
	});

	it("coerces NaN dateRangeDays to null", () => {
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: Number.NaN }).dateRangeDays
		).toBeNull();
	});

	it("coerces Infinity dateRangeDays to null", () => {
		expect(
			parseGlobalFilterWidgetConfig({
				dateRangeDays: Number.POSITIVE_INFINITY,
			}).dateRangeDays
		).toBeNull();
	});

	it("floors fractional dateRangeDays", () => {
		expect(
			parseGlobalFilterWidgetConfig({ dateRangeDays: 7.9 }).dateRangeDays
		).toBe(7);
	});
});

describe("useGlobalFilterWidget", () => {
	it("reports hasActiveFilter=false when both are defaults", () => {
		const { result } = renderHook(() => useGlobalFilterWidget({}));
		expect(result.current.hasActiveFilter).toBe(false);
		expect(result.current.type).toBe("all");
		expect(result.current.typeLabel).toBe("All");
		expect(result.current.dateRangeDays).toBeNull();
	});

	it("reports hasActiveFilter=true when type is set", () => {
		const { result } = renderHook(() =>
			useGlobalFilterWidget({ type: "cash_game" })
		);
		expect(result.current.hasActiveFilter).toBe(true);
		expect(result.current.type).toBe("cash_game");
		expect(result.current.typeLabel).toBe("Cash Game");
	});

	it("reports hasActiveFilter=true when dateRangeDays is set", () => {
		const { result } = renderHook(() =>
			useGlobalFilterWidget({ dateRangeDays: 7 })
		);
		expect(result.current.hasActiveFilter).toBe(true);
		expect(result.current.dateRangeDays).toBe(7);
	});

	it("uses friendly labels from GLOBAL_FILTER_TYPE_LABELS", () => {
		expect(GLOBAL_FILTER_TYPE_LABELS).toEqual({
			all: "All",
			cash_game: "Cash Game",
			tournament: "Tournament",
		});
	});
});
