import { STATS_PERIOD_LABEL } from "@/features/statistics/utils/labels";
import {
	STATS_PERIODS,
	type StatsPeriod,
} from "@/features/statistics/utils/stats-filters";

// The sessions list reuses the statistics Period domain (preset windows +
// custom range) so the two filter headers behave identically (SA2-74).
export type SessionPeriod = StatsPeriod;
export const SESSION_PERIODS = STATS_PERIODS;
export const SESSION_PERIOD_LABEL = STATS_PERIOD_LABEL;

export interface SessionFilterValues {
	currencyId?: string;
	/** Custom-range lower bound, Unix seconds. Only used when `period` is `custom`. */
	from?: number;
	period?: SessionPeriod;
	roomId?: string;
	/** Custom-range upper bound, Unix seconds. Only used when `period` is `custom`. */
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
