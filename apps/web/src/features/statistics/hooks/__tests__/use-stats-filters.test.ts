import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";

const mocks = vi.hoisted(() => ({
	filters: {
		period: "all",
		norm: "normalized",
		type: "all",
	} as StatsFilters,
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => mocks.filters,
	useNavigate: () => mocks.navigate,
}));

import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";

describe("useStatsFilters", () => {
	beforeEach(() => {
		mocks.filters = { period: "all", norm: "normalized", type: "all" };
		mocks.navigate.mockReset();
	});

	describe("filters / derived values", () => {
		it("returns the search-synced filters as-is", () => {
			mocks.filters = {
				period: "30d",
				norm: "off",
				type: "cash_game",
				currency: "c1",
			};
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.filters).toBe(mocks.filters);
		});

		it("derives statsInput from the filters", () => {
			mocks.filters = {
				period: "all",
				norm: "off",
				type: "all",
				currency: "c1",
			};
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.statsInput.currencyId).toBe("c1");
			expect(result.current.statsInput.normalized).toBe(false);
		});

		it("normalized is true unless norm is off", () => {
			mocks.filters = { period: "all", norm: "normalized", type: "all" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.normalized).toBe(true);
		});

		it("normalized is false when norm is off", () => {
			mocks.filters = { period: "all", norm: "off", type: "all" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.normalized).toBe(false);
		});

		it("isScopeValid reflects isCurrencyScopeValid", () => {
			mocks.filters = { period: "all", norm: "off", type: "all" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isScopeValid).toBe(false);
		});
	});

	// The verdict is derived from the FILTERS, not from the router's search
	// object: `/statistics` has `validateSearch`, so TanStack Router writes the
	// schema defaults into `location.search` and rewrites the URL — a bare load
	// is indistinguishable from a deep link there. The real-router proof lives in
	// apps/web/src/__tests__/statistics-raw-search.test.tsx; the branch logic
	// itself is unit-tested as `isDefaultStatsFilterState`.
	describe("isFilterStateDefault", () => {
		it("is true when every filter is still at its schema default", () => {
			mocks.filters = { period: "all", norm: "normalized", type: "all" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isFilterStateDefault).toBe(true);
		});

		it("is false when a filter differs from its default", () => {
			mocks.filters = { period: "all", norm: "normalized", type: "tournament" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isFilterStateDefault).toBe(false);
		});

		it("is false when an optional filter is set", () => {
			mocks.filters = {
				period: "all",
				norm: "normalized",
				type: "all",
				room: "room-1",
			};
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isFilterStateDefault).toBe(false);
		});
	});

	describe("setFilters", () => {
		it("navigates with a merge updater carrying the patch on top of prior search state", () => {
			const { result } = renderHook(() => useStatsFilters());
			act(() => {
				result.current.setFilters({ type: "tournament" });
			});
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			const arg = mocks.navigate.mock.calls[0][0] as {
				search: (prev: StatsFilters) => StatsFilters;
			};
			const prev: StatsFilters = {
				period: "all",
				norm: "off",
				type: "all",
				room: "r1",
			};
			expect(arg.search(prev)).toEqual({ ...prev, type: "tournament" });
		});
	});

	describe("replaceFilters", () => {
		it("navigates with an updater that fully replaces prior search state", () => {
			const { result } = renderHook(() => useStatsFilters());
			act(() => {
				result.current.replaceFilters({ type: "tournament" });
			});
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			const arg = mocks.navigate.mock.calls[0][0] as {
				search: (prev: StatsFilters) => StatsFilters;
			};
			const prev: StatsFilters = {
				period: "30d",
				norm: "off",
				type: "all",
				room: "r1",
				currency: "c1",
			};
			// Stale prior fields (room, currency, non-default period/norm) must not
			// survive — a preset meant to clear a filter must actually clear it.
			expect(arg.search(prev)).toEqual({
				period: "all",
				norm: "normalized",
				type: "tournament",
			});
		});

		it("fills schema defaults for fields the payload omits", () => {
			const { result } = renderHook(() => useStatsFilters());
			act(() => {
				result.current.replaceFilters({ room: "r9" });
			});
			const arg = mocks.navigate.mock.calls[0][0] as {
				search: () => StatsFilters;
			};
			expect(arg.search()).toEqual({
				period: "all",
				norm: "normalized",
				type: "all",
				room: "r9",
			});
		});

		it("navigates with the fully-defaulted object for a valid stored payload", () => {
			const { result } = renderHook(() => useStatsFilters());
			act(() => {
				result.current.replaceFilters({
					period: "90d",
					norm: "off",
					currency: "c1",
				});
			});
			expect(mocks.navigate).toHaveBeenCalledTimes(1);
			const arg = mocks.navigate.mock.calls[0][0] as {
				search: () => StatsFilters;
			};
			expect(arg.search()).toEqual({
				period: "90d",
				norm: "off",
				type: "all",
				currency: "c1",
			});
		});

		// A stored preset payload is validated server-side only as a bounded
		// string for `period` (packages/db can't import apps/web's PERIODS), so a
		// preset saved with a period this build no longer knows is reachable —
		// and `replaceFilters` runs during the default-preset auto-apply on mount.
		// Throwing there would take the whole /statistics page down.
		it("does not throw when the stored period is outside the current PERIODS vocabulary", () => {
			const { result } = renderHook(() => useStatsFilters());
			expect(() => {
				act(() => {
					result.current.replaceFilters({
						period: "last_month",
					} as unknown as Partial<StatsFilters>);
				});
			}).not.toThrow();
		});

		it("does not navigate when the stored period is outside the current PERIODS vocabulary", () => {
			const { result } = renderHook(() => useStatsFilters());
			act(() => {
				result.current.replaceFilters({
					period: "last_month",
				} as unknown as Partial<StatsFilters>);
			});
			// Keeping the current filters is the degradation: a stale preset must
			// not brick the page, and must not half-apply either.
			expect(mocks.navigate).not.toHaveBeenCalled();
		});

		it("does not throw or navigate when any other payload value is outside the schema's domain", () => {
			const { result } = renderHook(() => useStatsFilters());
			expect(() => {
				act(() => {
					result.current.replaceFilters({
						type: "spin",
					} as unknown as Partial<StatsFilters>);
				});
			}).not.toThrow();
			expect(mocks.navigate).not.toHaveBeenCalled();
		});
	});
});
