import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	filtersToStatsInput,
	isCurrencyScopeValid,
	type StatsFilters,
	type StatsQueryInput,
} from "@/features/statistics/utils/stats-filters";

export interface UseStatsFiltersResult {
	filters: StatsFilters;
	isScopeValid: boolean;
	normalized: boolean;
	setFilters: (patch: Partial<StatsFilters>) => void;
	statsInput: StatsQueryInput;
}

/**
 * Bridges the `/statistics` route search params to typed filter state. All
 * parsing / derivation lives in `utils/stats-filters.ts` (unit-tested there);
 * this hook only reads `useSearch` and writes back through `useNavigate`, so
 * reloads and shared URLs restore the exact filter state.
 */
export function useStatsFilters(): UseStatsFiltersResult {
	const filters = useSearch({ from: "/statistics" });
	const navigate = useNavigate({ from: "/statistics" });

	const setFilters = (patch: Partial<StatsFilters>) => {
		navigate({ search: (prev) => ({ ...prev, ...patch }) });
	};

	return {
		filters,
		setFilters,
		statsInput: filtersToStatsInput(filters),
		normalized: filters.norm !== "off",
		isScopeValid: isCurrencyScopeValid(filters),
	};
}
