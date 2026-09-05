import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	filtersToStatsInput,
	isCurrencyScopeValid,
	isDefaultStatsFilterState,
	type StatsFilters,
	type StatsQueryInput,
	statsSearchSchema,
} from "@/features/statistics/utils/stats-filters";

export interface UseStatsFiltersResult {
	filters: StatsFilters;
	isFilterStateDefault: boolean;
	isScopeValid: boolean;
	normalized: boolean;
	replaceFilters: (payload: Partial<StatsFilters>) => void;
	setFilters: (patch: Partial<StatsFilters>) => void;
	statsInput: StatsQueryInput;
}

export function useStatsFilters(): UseStatsFiltersResult {
	const filters = useSearch({ from: "/statistics" });
	const navigate = useNavigate({ from: "/statistics" });

	const setFilters = (patch: Partial<StatsFilters>) => {
		navigate({ search: (prev) => ({ ...prev, ...patch }) });
	};

	const replaceFilters = (payload: Partial<StatsFilters>) => {
		const parsed = statsSearchSchema.safeParse(payload);
		if (!parsed.success) {
			return;
		}
		navigate({ search: () => parsed.data });
	};

	return {
		filters,
		setFilters,
		replaceFilters,
		statsInput: filtersToStatsInput(filters),
		normalized: filters.norm !== "off",
		isScopeValid: isCurrencyScopeValid(filters),
		isFilterStateDefault: isDefaultStatsFilterState(filters),
	};
}
