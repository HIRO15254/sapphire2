import type {
	StatsNormalization,
	StatsType,
} from "@/features/statistics/utils/stats-filters";

// Stryker disable next-line ObjectLiteral: label map UI copy has no domain behavior
export const STATS_NORMALIZATION_LABEL: Record<StatsNormalization, string> = {
	// Stryker disable next-line StringLiteral: label map UI copy has no domain behavior
	off: "Currency",
	// Stryker disable next-line StringLiteral: label map UI copy has no domain behavior
	normalized: "BB / BI",
};

// Stryker disable next-line ObjectLiteral: label map UI copy has no domain behavior
export const STATS_TYPE_LABEL: Record<StatsType, string> = {
	// Stryker disable next-line StringLiteral: label map UI copy has no domain behavior
	all: "All",
	// Stryker disable next-line StringLiteral: label map UI copy has no domain behavior
	cash_game: "Cash",
	// Stryker disable next-line StringLiteral: label map UI copy has no domain behavior
	tournament: "Tournament",
};
