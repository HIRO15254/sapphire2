import type { StatisticsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useEffect, useRef } from "react";
import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import { useStatsReferenceData } from "@/features/statistics/hooks/use-stats-reference-data";
import type { StatsSectionContext } from "@/features/statistics/types";
import type { StatsFilters } from "@/features/statistics/utils/stats-filters";
import type {
	CreateFilterPresetValues,
	FilterPresetItem,
} from "@/shared/hooks/use-filter-presets";
import { useFilterPresets } from "@/shared/hooks/use-filter-presets";

export interface UseStatisticsPageResult {
	clearDefaultPreset: (id: string) => Promise<unknown>;
	createPreset: (values: CreateFilterPresetValues) => Promise<unknown>;
	ctx: StatsSectionContext;
	defaultPreset: FilterPresetItem | null;
	isCreatePresetPending: boolean;
	isDeletePresetPending: boolean;
	isPresetsLoading: boolean;
	isScopeValid: boolean;
	isSetDefaultPresetPending: boolean;
	presets: FilterPresetItem[];
	removePreset: (id: string) => Promise<unknown>;
	setDefaultPreset: (id: string) => Promise<unknown>;
	showCashBlock: boolean;
	showTournamentBlock: boolean;
}

/**
 * Owns the shared section context for the statistics page: it reads the global
 * URL filters and resolves the selected currency's unit, then hands every
 * section a single {@link StatsSectionContext}. Sections run their own queries.
 *
 * Also owns the statistics-screen filter presets (for `StatsFilterBar`'s
 * presets sheet) and the "auto-apply the default preset on first load" effect:
 * on a genuinely bare `/statistics` load (`isUrlEmpty`, read from the raw
 * router search — see `useStatsFilters`), once the presets query resolves, the
 * default preset (if any) is applied via a full URL replace. A `useRef` guard
 * makes this fire at most once per mount, mirroring the Sessions screen's
 * analogous effect — it never re-fires later just because the default preset
 * changes while the user is already on the page.
 */
export function useStatisticsPage(): UseStatisticsPageResult {
	const {
		filters,
		statsInput,
		normalized,
		isScopeValid,
		isUrlEmpty,
		replaceFilters,
	} = useStatsFilters();
	const { currencies } = useStatsReferenceData();
	const {
		presets,
		defaultPreset,
		isLoading: isPresetsLoading,
		isCreatePending: isCreatePresetPending,
		isDeletePending: isDeletePresetPending,
		isSetDefaultPending: isSetDefaultPresetPending,
		create: createPreset,
		remove: removePreset,
		setDefault: setDefaultPreset,
		clearDefault: clearDefaultPreset,
	} = useFilterPresets("statistics");

	const hasAutoAppliedRef = useRef(false);

	useEffect(() => {
		if (hasAutoAppliedRef.current || isPresetsLoading) {
			return;
		}
		hasAutoAppliedRef.current = true;
		if (isUrlEmpty && defaultPreset) {
			replaceFilters(
				defaultPreset.payload as StatisticsFilterPresetPayload as Partial<StatsFilters>
			);
		}
	}, [isPresetsLoading, isUrlEmpty, defaultPreset, replaceFilters]);

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
		presets,
		defaultPreset,
		isPresetsLoading,
		isCreatePresetPending,
		isDeletePresetPending,
		isSetDefaultPresetPending,
		createPreset,
		removePreset,
		setDefaultPreset,
		clearDefaultPreset,
	};
}
