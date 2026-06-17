import { useState } from "react";
import type { SessionFilterValues } from "@/features/sessions/utils/session-filters-helpers";

export type SessionFilterSheet =
	| "currency"
	| "date"
	| "display"
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

/**
 * Drives the sessions chip filter bar, mirroring `useStatsFilterBar`: owns which
 * bottom sheet is open and exposes change handlers that apply each pick
 * immediately (no draft / Apply step — the list refetches off the live filter
 * state). The type / room / currency handlers close the sheet on pick; the date
 * handlers keep it open so both bounds can be set before dismissing.
 */
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
		onDateFromChange: (value: string) =>
			patch({ dateFrom: value || undefined }),
		onDateToChange: (value: string) => patch({ dateTo: value || undefined }),
		onClearDates: () => {
			patch({ dateFrom: undefined, dateTo: undefined });
			closeSheet();
		},
		onDisplayChange: (value: string) => {
			onBbBiModeChange(value === "normalized");
			closeSheet();
		},
	};
}
