import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";

const mocks = vi.hoisted(() => ({
	filters: {
		period: "all",
		norm: "off",
		type: "all",
	} as StatsFilters,
	setFilters: vi.fn(),
	isScopeValid: true,
	currencies: [
		{ id: "c1", name: "USD", unit: "$" },
		{ id: "c2", name: "Euro", unit: null },
	] as { id: string; name: string; unit: string | null }[],
	rooms: [
		{ id: "r1", name: "Aria" },
		{ id: "r2", name: "Bellagio" },
	] as { id: string; name: string }[],
	isLoading: false,
}));

vi.mock("@/features/statistics/hooks/use-stats-filters", () => ({
	useStatsFilters: () => ({
		filters: mocks.filters,
		setFilters: mocks.setFilters,
		isScopeValid: mocks.isScopeValid,
		normalized: mocks.filters.norm !== "off",
		statsInput: {},
	}),
}));

vi.mock("@/features/statistics/hooks/use-stats-reference-data", () => ({
	useStatsReferenceData: () => ({
		currencies: mocks.currencies,
		rooms: mocks.rooms,
		isLoading: mocks.isLoading,
	}),
}));

import { useStatsFilterBar } from "@/features/statistics/components/stats-filter-bar/use-stats-filter-bar";

describe("useStatsFilterBar", () => {
	beforeEach(() => {
		mocks.setFilters.mockReset();
		mocks.filters = { period: "all", norm: "off", type: "all" } as StatsFilters;
		mocks.isScopeValid = true;
		mocks.currencies = [
			{ id: "c1", name: "USD", unit: "$" },
			{ id: "c2", name: "Euro", unit: null },
		];
		mocks.rooms = [
			{ id: "r1", name: "Aria" },
			{ id: "r2", name: "Bellagio" },
		];
		mocks.isLoading = false;
	});

	describe("currencyChipLabel", () => {
		it("shows the selected currency name", () => {
			mocks.filters = {
				period: "all",
				norm: "normalized",
				type: "all",
				currency: "c1",
			} as StatsFilters;
			mocks.isScopeValid = true;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currencyChipLabel).toBe("USD");
		});

		it('shows "All currencies" when no currency is selected and the scope is valid (normalized)', () => {
			mocks.filters = {
				period: "all",
				norm: "normalized",
				type: "all",
			} as StatsFilters;
			mocks.isScopeValid = true;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currencyChipLabel).toBe("All currencies");
		});

		it('shows "Select" when no currency is selected and the scope is invalid (normalization off)', () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
			} as StatsFilters;
			mocks.isScopeValid = false;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currencyChipLabel).toBe("Select");
		});
	});

	describe("sheet open/close", () => {
		it("starts with no active sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.activeSheet).toBeNull();
		});

		it("openSheet sets the active sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("type");
			});
			expect(result.current.activeSheet).toBe("type");
		});

		it("openSheet switches between sheets", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("type");
			});
			act(() => {
				result.current.openSheet("room");
			});
			expect(result.current.activeSheet).toBe("room");
		});

		it("closeSheet clears the active sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("period");
			});
			act(() => {
				result.current.closeSheet();
			});
			expect(result.current.activeSheet).toBeNull();
		});
	});

	describe("onPeriodChange", () => {
		it("patches the period and closes the sheet for a non-custom value", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("period");
			});
			act(() => {
				result.current.onPeriodChange("30d");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ period: "30d" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("patches custom but keeps the sheet open for date entry", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("period");
			});
			act(() => {
				result.current.onPeriodChange("custom");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ period: "custom" });
			expect(result.current.activeSheet).toBe("period");
		});

		it("ignores an empty value", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("period");
			});
			act(() => {
				result.current.onPeriodChange("");
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
			expect(result.current.activeSheet).toBe("period");
		});
	});

	describe("onNormChange", () => {
		it("patches norm and closes the sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("norm");
			});
			act(() => {
				result.current.onNormChange("normalized");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ norm: "normalized" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("ignores an empty value", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.onNormChange("");
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
		});
	});

	describe("onTypeChange", () => {
		it("patches type and closes the sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("type");
			});
			act(() => {
				result.current.onTypeChange("cash_game");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ type: "cash_game" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("ignores an empty value", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.onTypeChange("");
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
		});
	});

	describe("onCurrencyChange", () => {
		it("patches currency and closes the sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("currency");
			});
			act(() => {
				result.current.onCurrencyChange("c2");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ currency: "c2" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("clears to all currencies (undefined) and closes the sheet when normalization is on", () => {
			mocks.filters = {
				period: "all",
				norm: "normalized",
				type: "all",
				currency: "c1",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("currency");
			});
			act(() => {
				result.current.onCurrencyChange(undefined);
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ currency: undefined });
			expect(result.current.activeSheet).toBeNull();
		});

		it("clears currency and switches normalization on when clearing while norm is off", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "c1",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("currency");
			});
			act(() => {
				result.current.onCurrencyChange(undefined);
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({
				currency: undefined,
				norm: "normalized",
			});
			expect(result.current.activeSheet).toBeNull();
		});

		it("ignores a genuinely invalid empty-string value and keeps the sheet open", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("currency");
			});
			act(() => {
				result.current.onCurrencyChange("");
			});
			expect(mocks.setFilters).not.toHaveBeenCalled();
			expect(result.current.activeSheet).toBe("currency");
		});
	});

	describe("onRoomChange", () => {
		it("patches room and closes the sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("room");
			});
			act(() => {
				result.current.onRoomChange("r1");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ room: "r1" });
			expect(result.current.activeSheet).toBeNull();
		});

		it("clears room to undefined and closes the sheet", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("room");
			});
			act(() => {
				result.current.onRoomChange(undefined);
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ room: undefined });
			expect(result.current.activeSheet).toBeNull();
		});
	});

	describe("onFromChange / onToChange", () => {
		it("converts a valid from date to epoch seconds (start of day)", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.onFromChange("2026-01-15");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({
				from: Math.floor(Date.UTC(2026, 0, 15, 0, 0, 0) / 1000),
			});
		});

		it("converts a valid to date to epoch seconds (end of day)", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.onToChange("2026-01-15");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({
				to: Math.floor(Date.UTC(2026, 0, 15, 23, 59, 59) / 1000),
			});
		});

		it("clears the bound for an empty / malformed value", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.onFromChange("");
			});
			expect(mocks.setFilters).toHaveBeenCalledTimes(1);
			expect(mocks.setFilters).toHaveBeenCalledWith({ from: undefined });
		});

		it("does not close the sheet when a date changes", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			act(() => {
				result.current.openSheet("period");
			});
			act(() => {
				result.current.onFromChange("2026-01-15");
			});
			expect(result.current.activeSheet).toBe("period");
		});
	});

	describe("currentCurrencyName", () => {
		it("resolves the selected currency's name", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "c1",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentCurrencyName).toBe("USD");
		});

		it("is null when no currency is selected", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentCurrencyName).toBeNull();
		});

		it("is null when the selected currency id is not found", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "missing",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentCurrencyName).toBeNull();
		});
	});

	describe("currentRoomName", () => {
		it("resolves the selected room's name", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				room: "r2",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentRoomName).toBe("Bellagio");
		});

		it("is null when no room is selected", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentRoomName).toBeNull();
		});

		it("is null when the selected room id is not found", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				room: "missing",
			} as StatsFilters;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currentRoomName).toBeNull();
		});
	});

	describe("passthroughs", () => {
		it("passes isScopeValid through (valid)", () => {
			mocks.isScopeValid = true;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.isScopeValid).toBe(true);
		});

		it("passes isScopeValid through (invalid)", () => {
			mocks.isScopeValid = false;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.isScopeValid).toBe(false);
		});

		it("exposes the currency and room option lists", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.currencies).toEqual(mocks.currencies);
			expect(result.current.rooms).toEqual(mocks.rooms);
		});

		it("forwards the reference loading flag", () => {
			mocks.isLoading = true;
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.isReferenceLoading).toBe(true);
		});

		it("exposes the current filters", () => {
			const { result } = renderHook(() => useStatsFilterBar());
			expect(result.current.filters).toBe(mocks.filters);
		});
	});
});
