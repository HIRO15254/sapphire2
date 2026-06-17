import { PERIOD_LABEL, PERIODS, type Period } from "@/shared/lib/period-filter";

// The sessions list reuses the shared Period domain (preset windows + custom
// range) so its filter header behaves identically to statistics (SA2-74).
export type SessionPeriod = Period;
export const SESSION_PERIODS = PERIODS;
export const SESSION_PERIOD_LABEL = PERIOD_LABEL;

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

// Display mode = how a session's P&L is shown: raw currency vs BB/BI normalized.
// One label map drives both the chip and the sheet options so the wording can't
// drift (mirrors statistics' single STATS_NORMALIZATION_LABEL).
export const SESSION_DISPLAY_VALUES = ["currency", "normalized"] as const;
export type SessionDisplayValue = (typeof SESSION_DISPLAY_VALUES)[number];

export const SESSION_DISPLAY_LABEL: Record<SessionDisplayValue, string> = {
	currency: "Currency",
	normalized: "BB / BI",
};
