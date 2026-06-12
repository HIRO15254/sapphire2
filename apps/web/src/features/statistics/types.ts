import type {
	StatsQueryInput,
	StatsType,
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
	/** "bb" / "bi" when normalized, else null. */
	normalizationUnit: "bb" | "bi" | null;
	normalized: boolean;
	statsInput: StatsQueryInput;
	type: StatsType;
}

/** The unit suffix to render monetary values with for the current scope. */
export function statsValueUnit(ctx: StatsSectionContext): string | null {
	return ctx.normalized ? ctx.normalizationUnit : ctx.currencyUnit;
}
