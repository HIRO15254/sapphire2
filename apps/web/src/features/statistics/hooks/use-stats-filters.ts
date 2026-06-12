import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	filtersToStatsInput,
	isCurrencyScopeValid,
	normalizationUnit,
	type StatsFilters,
	type StatsQueryInput,
	statsDisplayUnit,
} from "@/features/statistics/utils/stats-filters";

export interface UseStatsFiltersResult {
	filters: StatsFilters;
	isScopeValid: boolean;
	normalizationUnit: "bb" | "bi" | null;
	normalized: boolean;
	setFilters: (patch: Partial<StatsFilters>) => void;
	statsInput: StatsQueryInput;
	unitFor: (currencyUnit: string | null | undefined) => string | null;
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
		normalizationUnit: normalizationUnit(filters.norm),
		isScopeValid: isCurrencyScopeValid(filters),
		unitFor: (currencyUnit) => statsDisplayUnit(filters.norm, currencyUnit),
	};
}
