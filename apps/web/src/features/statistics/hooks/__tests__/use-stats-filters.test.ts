import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";

const mocks = vi.hoisted(() => ({
	filters: {
		period: "all",
		norm: "normalized",
		type: "all",
	} as StatsFilters,
	rawSearch: {} as Record<string, unknown>,
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useSearch: () => mocks.filters,
	useNavigate: () => mocks.navigate,
	useRouterState: (options: { select: (state: unknown) => unknown }) =>
		options.select({ location: { search: mocks.rawSearch } }),
}));

import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";

describe("useStatsFilters", () => {
	beforeEach(() => {
		mocks.filters = { period: "all", norm: "normalized", type: "all" };
		mocks.rawSearch = {};
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

	describe("isUrlEmpty", () => {
		it("is true when the raw router search object has no keys", () => {
			mocks.rawSearch = {};
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isUrlEmpty).toBe(true);
		});

		it("is false when the raw search carries a key equal to its own schema default", () => {
			// Proves this reads the RAW router state rather than comparing the
			// already-Zod-defaulted `filters` object against its own defaults —
			// {period:"all"} is indistinguishable from "absent" once defaults are
			// baked in, so this must come from the un-defaulted router location.
			mocks.rawSearch = { period: "all" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isUrlEmpty).toBe(false);
		});

		it("is false when the raw search carries any explicit non-default key", () => {
			mocks.rawSearch = { type: "tournament" };
			const { result } = renderHook(() => useStatsFilters());
			expect(result.current.isUrlEmpty).toBe(false);
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

		it("throws when the payload contains a value outside the schema's domain", () => {
			const { result } = renderHook(() => useStatsFilters());
			expect(() => {
				result.current.replaceFilters({
					type: "spin",
				} as unknown as Partial<StatsFilters>);
			}).toThrow();
		});
	});
});
