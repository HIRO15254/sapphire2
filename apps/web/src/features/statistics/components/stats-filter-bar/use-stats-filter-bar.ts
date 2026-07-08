import { useState } from "react";
import { useGameVariants } from "@/features/game-variants/hooks/use-game-variants";
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
	| "room"
	| "type"
	| "variant";

/**
 * A user-defined game variant option, as offered by the Variant filter sheet.
 * Deliberately narrower than `useGameVariants`' `GameVariant` (which types
 * `archivedAt` as `Date`, though the tRPC query actually serializes it to a
 * string over the wire) — the filter bar only ever needs `id` / `name`, so it
 * maps down to this shape instead of depending on that mismatched type.
 */
export interface StatsVariantOption {
	id: string;
	name: string;
}

export interface UseStatsFilterBarResult {
	activeSheet: StatsFilterSheet | null;
	closeSheet: () => void;
	currencies: StatsCurrencyOption[];
	/**
	 * Label for the currency chip. Shows the selected currency's name, or — when
	 * no currency is selected — "All currencies" while that state is valid
	 * (normalization on) and "Select" while it is not (normalization off, so a
	 * currency is required). Mirrors the room chip's "All rooms" so a valid
	 * all-currencies scope no longer reads as an unfinished "Select".
	 */
	currencyChipLabel: string;
	currentCurrencyName: string | null;
	currentRoomName: string | null;
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
	onVariantChange: (value: string | undefined) => void;
	openSheet: (key: StatsFilterSheet) => void;
	rooms: StatsRoomOption[];
	variants: StatsVariantOption[];
}

/**
 * Drives the Notion-style chip filter bar: reads URL-synced filter state,
 * supplies the currency / room option lists + resolved display names, owns which
 * bottom sheet is open, and exposes change handlers that patch the filter state
 * (URL-synced) and close the sheet. Segmented-style handlers ignore empty values
 * so period / normalization / type always keep a value; picking the "custom"
 * period keeps the sheet open so the user can pick dates. Currency is optional:
 * `onCurrencyChange(undefined)` clears back to "All currencies", auto-switching
 * normalization on when it was off so the combined scope stays valid.
 */
export function useStatsFilterBar(): UseStatsFilterBarResult {
	const { filters, setFilters, isScopeValid } = useStatsFilters();
	const { currencies, rooms, isLoading } = useStatsReferenceData();
	const { variants: gameVariants } = useGameVariants();
	const variants: StatsVariantOption[] = gameVariants.map((v) => ({
		id: v.id,
		name: v.name,
	}));
	const [activeSheet, setActiveSheet] = useState<StatsFilterSheet | null>(null);

	const closeSheet = () => setActiveSheet(null);
	const openSheet = (key: StatsFilterSheet) => setActiveSheet(key);

	const currentCurrencyName =
		currencies.find((c) => c.id === filters.currency)?.name ?? null;
	const currentRoomName =
		rooms.find((r) => r.id === filters.room)?.name ?? null;
	// "All currencies" only when a no-currency scope is actually valid (normalized);
	// otherwise keep prompting with "Select" (the chip is also flagged invalid).
	const currencyChipLabel =
		currentCurrencyName ?? (isScopeValid ? "All currencies" : "Select");

	return {
		activeSheet,
		closeSheet,
		openSheet,
		filters,
		currencies,
		rooms,
		variants,
		isReferenceLoading: isLoading,
		isScopeValid,
		currencyChipLabel,
		currentCurrencyName,
		currentRoomName,
		onPeriodChange: (value) => {
			if (!value) {
				return;
			}
			setFilters({ period: value as Period });
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
			// An empty string is never a real RadioGroup option — guard against it
			// so stats can't be scoped to a non-existent currency.
			if (value === "") {
				return;
			}
			if (value === undefined) {
				// Clearing to "All currencies". A combined multi-currency view can
				// only be shown normalized (raw amounts across currencies can't be
				// summed), so switch normalization on when it is currently off to keep
				// the currency scope valid (`isCurrencyScopeValid`).
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
		onVariantChange: (value) => {
			setFilters({ variant: value });
			closeSheet();
		},
		onFromChange: (value) => setFilters({ from: dateInputToEpochSec(value) }),
		onToChange: (value) => setFilters({ to: dateInputToEpochSec(value, true) }),
	};
}
