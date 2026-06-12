import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import {
	type StatsCurrencyOption,
	type StatsRoomOption,
	useStatsReferenceData,
} from "@/features/statistics/hooks/use-stats-reference-data";
import {
	dateInputToEpochSec,
	type StatsFilters,
	type StatsNormalization,
	type StatsPeriod,
	type StatsType,
} from "@/features/statistics/utils/stats-filters";

export interface UseStatsFilterBarResult {
	currencies: StatsCurrencyOption[];
	filters: StatsFilters;
	isReferenceLoading: boolean;
	isScopeValid: boolean;
	onCurrencyChange: (value: string | undefined) => void;
	onFromChange: (value: string) => void;
	onNormChange: (value: string) => void;
	onPeriodChange: (value: string) => void;
	onRoomChange: (value: string | undefined) => void;
	onToChange: (value: string) => void;
	onTypeChange: (value: string) => void;
	rooms: StatsRoomOption[];
}

/**
 * Drives the sticky global filter bar: reads URL-synced filter state, supplies
 * the currency / room option lists, and exposes change handlers. Segmented
 * controls ignore empty deselection so period / normalization / type always
 * keep a value.
 */
export function useStatsFilterBar(): UseStatsFilterBarResult {
	const { filters, setFilters, isScopeValid } = useStatsFilters();
	const { currencies, rooms, isLoading } = useStatsReferenceData();

	return {
		filters,
		currencies,
		rooms,
		isReferenceLoading: isLoading,
		isScopeValid,
		onPeriodChange: (value) => {
			if (value) {
				setFilters({ period: value as StatsPeriod });
			}
		},
		onNormChange: (value) => {
			if (value) {
				setFilters({ norm: value as StatsNormalization });
			}
		},
		onTypeChange: (value) => {
			if (value) {
				setFilters({ type: value as StatsType });
			}
		},
		onCurrencyChange: (value) => setFilters({ currency: value }),
		onRoomChange: (value) => setFilters({ room: value }),
		onFromChange: (value) => setFilters({ from: dateInputToEpochSec(value) }),
		onToChange: (value) => setFilters({ to: dateInputToEpochSec(value, true) }),
	};
}
