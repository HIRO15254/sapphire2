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

/**
 * Owns the shared section context for the statistics page: it reads the global
 * URL filters and resolves the selected currency's unit, then hands every
 * section a single {@link StatsSectionContext}. Sections run their own queries.
 *
 * The statistics-screen preset CRUD surface is NOT re-exported here: it is
 * self-contained in `StatsFilterBar` → `FilterPresetsSheet`, which mounts its
 * own `useFilterPresets`. This hook only wires the "auto-apply the default
 * preset on first load" behaviour, shared with the Sessions list through
 * {@link useDefaultFilterPreset}.
 */
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

	// Two statistics-specific choices the shared hook deliberately leaves to the
	// caller:
	//
	// - The "untouched" signal is `isFilterStateDefault`: no filter differs from
	//   its schema default. It deliberately is NOT read off the router's search
	//   object — `/statistics` has `validateSearch`, so TanStack Router bakes the
	//   schema defaults into `location.search` and rewrites the URL to match,
	//   making a bare load indistinguishable from a deep link there. Comparing
	//   against the defaults keeps `?type=tournament` (a real, bookmarked choice)
	//   safe from being clobbered.
	// - Applying is `replaceFilters` (full URL replace), not the merging
	//   `setFilters`: a preset that omits `room` must actually clear a
	//   previously-set room instead of inheriting it. `replaceFilters` also
	//   safeParses, so a stored payload this build no longer understands degrades
	//   to "keep the current filters" rather than throwing during mount.
	useDefaultFilterPreset<Partial<StatsFilters>>(
		"statistics",
		isFilterStateDefault,
		replaceFilters
	);

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
