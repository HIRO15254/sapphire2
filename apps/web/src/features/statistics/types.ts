import {
	type StatsQueryInput,
	type StatsType,
	statsUnitFor,
} from "@/features/statistics/utils/stats-filters";

export type {
	StatsNormalization,
	StatsType,
} from "@/features/statistics/utils/stats-filters";

export interface StatsSectionContext {
	currencyUnit: string | null;
	enabled: boolean;
	normalized: boolean;
	statsInput: StatsQueryInput;
	type: StatsType;
}

export function unitForType(
	ctx: StatsSectionContext,
	type: "cash_game" | "tournament"
): string | null {
	return ctx.normalized
		? statsUnitFor("normalized", type, ctx.currencyUnit)
		: ctx.currencyUnit;
}
