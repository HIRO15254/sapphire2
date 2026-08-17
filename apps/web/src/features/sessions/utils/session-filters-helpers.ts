import type { SessionsFilterPresetPayload } from "@sapphire2/db/schemas/filter-preset";
import { PERIOD_LABEL, PERIODS, type Period } from "@/shared/lib/period-filter";

export type SessionPeriod = Period;
export const SESSION_PERIODS = PERIODS;
export const SESSION_PERIOD_LABEL = PERIOD_LABEL;

export interface SessionFilterValues {
	currencyId?: string;
	from?: number;
	period?: SessionPeriod;
	roomId?: string;
	to?: number;
	type?: "cash_game" | "tournament";
}

export const SESSION_TYPE_VALUES = ["all", "cash_game", "tournament"] as const;
export type SessionTypeValue = (typeof SESSION_TYPE_VALUES)[number];

export const SESSION_TYPE_LABEL: Record<SessionTypeValue, string> = {
	all: "All",
	cash_game: "Cash",
	tournament: "Tournament",
};

export const SESSION_DISPLAY_VALUES = ["currency", "normalized"] as const;
export type SessionDisplayValue = (typeof SESSION_DISPLAY_VALUES)[number];

export const SESSION_DISPLAY_LABEL: Record<SessionDisplayValue, string> = {
	currency: "Currency",
	normalized: "BB / BI",
};

export function buildSessionsPresetPayload(
	filters: SessionFilterValues,
	bbBiMode: boolean
): SessionsFilterPresetPayload {
	return { ...filters, display: bbBiMode ? "normalized" : "currency" };
}

export function splitSessionsPresetPayload(
	payload: SessionsFilterPresetPayload
): { display: SessionDisplayValue | undefined; filters: SessionFilterValues } {
	const { display, ...filters } = payload;
	return {
		display,
		filters: filters as SessionFilterValues,
	};
}
