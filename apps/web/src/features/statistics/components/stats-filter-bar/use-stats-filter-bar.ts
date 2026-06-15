import { useState } from "react";
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

export type StatsFilterSheet = "currency" | "norm" | "period" | "room" | "type";

export interface UseStatsFilterBarResult {
	activeSheet: StatsFilterSheet | null;
	closeSheet: () => void;
	currencies: StatsCurrencyOption[];
	currentCurrencyName: string | null;
	currentRoomName: string | null;
	filters: StatsFilters;
	isReferenceLoading: boolean;
	isScopeValid: boolean;
	onCurrencyChange: (value: string) => void;
	onFromChange: (value: string) => void;
	onNormChange: (value: string) => void;
	onPeriodChange: (value: string) => void;
	onRoomChange: (value: string | undefined) => void;
	onToChange: (value: string) => void;
	onTypeChange: (value: string) => void;
	openSheet: (key: StatsFilterSheet) => void;
	rooms: StatsRoomOption[];
}

/**
 * Drives the Notion-style chip filter bar: reads URL-synced filter state,
 * supplies the currency / room option lists + resolved display names, owns which
 * bottom sheet is open, and exposes change handlers that patch the filter state
 * (URL-synced) and close the sheet. Segmented-style handlers ignore empty values
 * so period / normalization / type always keep a value; picking the "custom"
 * period keeps the sheet open so the user can pick dates.
 */
export function useStatsFilterBar(): UseStatsFilterBarResult {
	const { filters, setFilters, isScopeValid } = useStatsFilters();
	const { currencies, rooms, isLoading } = useStatsReferenceData();
	const [activeSheet, setActiveSheet] = useState<StatsFilterSheet | null>(null);

	const closeSheet = () => setActiveSheet(null);
	const openSheet = (key: StatsFilterSheet) => setActiveSheet(key);

	const currentCurrencyName =
		currencies.find((c) => c.id === filters.currency)?.name ?? null;
	const currentRoomName =
		rooms.find((r) => r.id === filters.room)?.name ?? null;

	return {
		activeSheet,
		closeSheet,
		openSheet,
		filters,
		currencies,
		rooms,
		isReferenceLoading: isLoading,
		isScopeValid,
		currentCurrencyName,
		currentRoomName,
		onPeriodChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ period: value as StatsPeriod });
			// Keep the sheet open on "custom" so the date inputs can be used.
			if (value !== "custom") {
				closeSheet();
			}
		},
		onNormChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ norm: value as StatsNormalization });
			closeSheet();
		},
		onTypeChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ type: value as StatsType });
			closeSheet();
		},
		onCurrencyChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ currency: value });
			closeSheet();
		},
		onRoomChange: (value) => {
			setFilters({ room: value });
			closeSheet();
		},
		onFromChange: (value) => setFilters({ from: dateInputToEpochSec(value) }),
		onToChange: (value) => setFilters({ to: dateInputToEpochSec(value, true) }),
	};
}
