import {
	type StatsQueryInput,
	type StatsType,
	statsUnitFor,
} from "@/features/statistics/utils/stats-filters";

export type {
	StatsNormalization,
	StatsType,
} from "@/features/statistics/utils/stats-filters";

/**
 * Everything a statistics section needs to run its query and render values in
 * the right unit. Built once by the page hook and threaded to every section so
 * the global filter bar drives the whole page.
 */
export interface StatsSectionContext {
	/** The selected currency's unit (e.g. "USD"), or null when normalized. */
	currencyUnit: string | null;
	/** Whether the currency scope is valid — queries stay disabled otherwise. */
	enabled: boolean;
	normalized: boolean;
	statsInput: StatsQueryInput;
	type: StatsType;
}

/**
 * The unit suffix for a value aggregating a single game type: the currency unit
 * when not normalized, otherwise "bb" (cash) / "bi" (tournament). Mixed-type
 * aggregates must never share a unit — callers render cash and tournament
 * figures separately instead.
 */
export function unitForType(
	ctx: StatsSectionContext,
	type: "cash_game" | "tournament"
): string | null {
	return ctx.normalized
		? statsUnitFor("normalized", type, ctx.currencyUnit)
		: ctx.currencyUnit;
}
