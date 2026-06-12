import type {
	StatsNormalization,
	StatsPeriod,
	StatsType,
} from "@/features/statistics/utils/stats-filters";

export const STATS_PERIOD_LABEL: Record<StatsPeriod, string> = {
	"7d": "7 days",
	"30d": "30 days",
	"90d": "90 days",
	ytd: "YTD",
	all: "All time",
	custom: "Custom",
};

export const STATS_NORMALIZATION_LABEL: Record<StatsNormalization, string> = {
	off: "Currency",
	bb: "BB",
	bi: "BI",
};

export const STATS_TYPE_LABEL: Record<StatsType, string> = {
	all: "All",
	cash_game: "Cash",
	tournament: "Tournament",
};
