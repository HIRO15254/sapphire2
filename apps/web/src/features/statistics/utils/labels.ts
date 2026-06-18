import type {
	StatsNormalization,
	StatsType,
} from "@/features/statistics/utils/stats-filters";

export const STATS_NORMALIZATION_LABEL: Record<StatsNormalization, string> = {
	off: "Currency",
	normalized: "BB / BI",
};

export const STATS_TYPE_LABEL: Record<StatsType, string> = {
	all: "All",
	cash_game: "Cash",
	tournament: "Tournament",
};
