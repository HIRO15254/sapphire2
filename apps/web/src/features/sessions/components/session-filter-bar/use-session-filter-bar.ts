import type { SessionsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { useState } from "react";
import type {
	SessionFilterValues,
	SessionPeriod,
} from "@/features/sessions/utils/session-filters-helpers";
import {
	buildSessionsPresetPayload,
	splitSessionsPresetPayload,
} from "@/features/sessions/utils/session-filters-helpers";
import { dateInputToEpochSec } from "@/shared/lib/period-filter";

export type SessionFilterSheet =
	| "currency"
	| "display"
	| "period"
	| "presets"
	| "room"
	| "type";

export interface UseSessionFilterBarProps {
	bbBiMode: boolean;
	currencies: Array<{ id: string; name: string }>;
	filters: SessionFilterValues;
	onBbBiModeChange: (value: boolean) => void;
	onFiltersChange: (filters: SessionFilterValues) => void;
	rooms: Array<{ id: string; name: string }>;
}

export function useSessionFilterBar({
	bbBiMode,
	currencies,
	filters,
	onBbBiModeChange,
	onFiltersChange,
	rooms,
}: UseSessionFilterBarProps) {
	const [activeSheet, setActiveSheet] = useState<SessionFilterSheet | null>(
		null
	);

	const closeSheet = () => setActiveSheet(null);
	const openSheet = (key: SessionFilterSheet) => setActiveSheet(key);

	const patch = (next: Partial<SessionFilterValues>) =>
		onFiltersChange({ ...filters, ...next });

	const currentRoomName =
		rooms.find((r) => r.id === filters.roomId)?.name ?? null;
	const currentCurrencyName =
		currencies.find((c) => c.id === filters.currencyId)?.name ?? null;

	return {
		activeSheet,
		openSheet,
		closeSheet,
		filters,
		bbBiMode,
		rooms,
		currencies,
		currentRoomName,
		currentCurrencyName,
		currentPresetPayload: buildSessionsPresetPayload(filters, bbBiMode),
		onPeriodChange: (value: string) => {
			if (!value) {
				return;
			}
			patch({ period: value as SessionPeriod });
			if (value !== "custom") {
				closeSheet();
			}
		},
		onFromChange: (value: string) =>
			patch({ from: dateInputToEpochSec(value) }),
		onToChange: (value: string) =>
			patch({ to: dateInputToEpochSec(value, true) }),
		onTypeChange: (value: string) => {
			patch({
				type:
					value === "all" ? undefined : (value as "cash_game" | "tournament"),
			});
			closeSheet();
		},
		onRoomChange: (value: string | undefined) => {
			patch({ roomId: value || undefined });
			closeSheet();
		},
		onCurrencyChange: (value: string | undefined) => {
			patch({ currencyId: value || undefined });
			closeSheet();
		},
		onDisplayChange: (value: string) => {
			onBbBiModeChange(value === "normalized");
			closeSheet();
		},
		onApplyPreset: (payload: SessionsFilterPresetPayload) => {
			const { display, filters: presetFilters } =
				splitSessionsPresetPayload(payload);
			onFiltersChange(presetFilters);
			if (display !== undefined) {
				onBbBiModeChange(display === "normalized");
			}
		},
	};
}
