import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import { useStatsReferenceData } from "@/features/statistics/hooks/use-stats-reference-data";
import type { StatsSectionContext } from "@/features/statistics/types";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";
import { useDefaultFilterPreset } from "@/shared/hooks/use-default-filter-preset";

export interface UseStatisticsPageResult {
	ctx: StatsSectionContext;
	isScopeValid: boolean;
	showCashBlock: boolean;
	showTournamentBlock: boolean;
}

export function useStatisticsPage(): UseStatisticsPageResult {
	const {
		filters,
		statsInput,
		normalized,
		isScopeValid,
		isFilterStateDefault,
		replaceFilters,
	} = useStatsFilters();
	const { currencies } = useStatsReferenceData();

	useDefaultFilterPreset<Partial<StatsFilters>>(
		"statistics",
		isFilterStateDefault,
		replaceFilters
	);

	const currencyUnit =
		currencies.find((c) => c.id === filters.currency)?.unit ?? null;

	return {
		ctx: {
			statsInput,
			enabled: isScopeValid,
			normalized,
			currencyUnit,
			type: filters.type,
		},
		isScopeValid,
		showCashBlock: filters.type !== "tournament",
		showTournamentBlock: filters.type !== "cash_game",
	};
}
