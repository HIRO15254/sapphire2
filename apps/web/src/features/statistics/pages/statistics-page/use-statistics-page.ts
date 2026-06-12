import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import { useStatsReferenceData } from "@/features/statistics/hooks/use-stats-reference-data";
import type { StatsSectionContext } from "@/features/statistics/types";

export interface UseStatisticsPageResult {
	ctx: StatsSectionContext;
	isScopeValid: boolean;
}

/**
 * Owns the shared section context for the statistics page: it reads the global
 * URL filters and resolves the selected currency's unit, then hands every
 * section a single {@link StatsSectionContext}. Sections run their own queries.
 */
export function useStatisticsPage(): UseStatisticsPageResult {
	const { filters, statsInput, normalized, normalizationUnit, isScopeValid } =
		useStatsFilters();
	const { currencies } = useStatsReferenceData();

	const currencyUnit = normalized
		? null
		: (currencies.find((c) => c.id === filters.currency)?.unit ?? null);

	return {
		ctx: {
			statsInput,
			enabled: isScopeValid,
			normalized,
			normalizationUnit,
			currencyUnit,
			type: filters.type,
		},
		isScopeValid,
	};
}
