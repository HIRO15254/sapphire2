import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import { useStatsReferenceData } from "@/features/statistics/hooks/use-stats-reference-data";
import type { StatsSectionContext } from "@/features/statistics/types";

export interface UseStatisticsPageResult {
	ctx: StatsSectionContext;
	isScopeValid: boolean;
	showCashBlock: boolean;
	showTournamentBlock: boolean;
}

/**
 * Owns the shared section context for the statistics page: it reads the global
 * URL filters and resolves the selected currency's unit, then hands every
 * section a single {@link StatsSectionContext}. Sections run their own queries.
 */
export function useStatisticsPage(): UseStatisticsPageResult {
	const { filters, statsInput, normalized, isScopeValid } = useStatsFilters();
	const { currencies } = useStatsReferenceData();

	// Always resolve the selected currency's unit; normalized values pick bb / bi
	// via `unitForType`, but currency-only figures (e.g. total prize) still need
	// the real unit even while normalization is on.
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
		// The game-specific blocks show for their type or when "all" is selected.
		showCashBlock: filters.type !== "tournament",
		showTournamentBlock: filters.type !== "cash_game",
	};
}
