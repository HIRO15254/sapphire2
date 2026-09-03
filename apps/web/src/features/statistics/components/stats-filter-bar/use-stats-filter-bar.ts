import type { StatisticsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useState } from "react";
import { useStatsFilters } from "@/features/statistics/hooks/use-stats-filters";
import {
	type StatsCurrencyOption,
	type StatsRoomOption,
	useStatsReferenceData,
} from "@/features/statistics/hooks/use-stats-reference-data";
import type {
	StatsFilters,
	StatsNormalization,
	StatsType,
} from "@/features/statistics/utils/stats-filters";
import { dateInputToEpochSec, type Period } from "@/shared/lib/period-filter";

export type StatsFilterSheet =
	| "currency"
	| "norm"
	| "period"
	| "presets"
	| "room"
	| "type";

export interface UseStatsFilterBarResult {
	activeSheet: StatsFilterSheet | null;
	closeSheet: () => void;
	currencies: StatsCurrencyOption[];
	currencyChipLabel: string;
	currentCurrencyName: string | null;
	currentPresetPayload: StatisticsFilterPresetPayload;
	currentRoomName: string | null;
	filters: StatsFilters;
	isReferenceLoading: boolean;
	isScopeValid: boolean;
	onApplyPreset: (payload: StatisticsFilterPresetPayload) => void;
	onCurrencyChange: (value: string | undefined) => void;
	onFromChange: (value: string) => void;
	onNormChange: (value: string) => void;
	onPeriodChange: (value: string) => void;
	onRoomChange: (value: string | undefined) => void;
	onToChange: (value: string) => void;
	onTypeChange: (value: string) => void;
	openSheet: (key: StatsFilterSheet) => void;
	rooms: StatsRoomOption[];
}

export function useStatsFilterBar(): UseStatsFilterBarResult {
	const { filters, setFilters, replaceFilters, isScopeValid } =
		useStatsFilters();
	const { currencies, rooms, isLoading } = useStatsReferenceData();
	const [activeSheet, setActiveSheet] = useState<StatsFilterSheet | null>(null);

	const closeSheet = () => setActiveSheet(null);
	const openSheet = (key: StatsFilterSheet) => setActiveSheet(key);

	const currentCurrencyName =
		currencies.find((c) => c.id === filters.currency)?.name ?? null;
	const currentRoomName =
		rooms.find((r) => r.id === filters.room)?.name ?? null;
	const currencyChipLabel =
		currentCurrencyName ?? (isScopeValid ? "All currencies" : "Select");

	const currentPresetPayload: StatisticsFilterPresetPayload = {
		...filters,
		currency: filters.currency || undefined,
		room: filters.room || undefined,
	};

	return {
		activeSheet,
		closeSheet,
		openSheet,
		filters,
		currencies,
		rooms,
		isReferenceLoading: isLoading,
		isScopeValid,
		currencyChipLabel,
		currentCurrencyName,
		currentPresetPayload,
		currentRoomName,
		onPeriodChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ period: value as Period });
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
			if (value === "") {
				return;
			}
			if (value === undefined) {
				setFilters(
					filters.norm === "off"
						? { currency: undefined, norm: "normalized" }
						: { currency: undefined }
				);
			} else {
				setFilters({ currency: value });
			}
			closeSheet();
		},
		onRoomChange: (value) => {
			setFilters({ room: value });
			closeSheet();
		},
		onFromChange: (value) => setFilters({ from: dateInputToEpochSec(value) }),
		onToChange: (value) => setFilters({ to: dateInputToEpochSec(value, true) }),
		onApplyPreset: (payload) => {
			replaceFilters(payload as Partial<StatsFilters>);
		},
	};
}
