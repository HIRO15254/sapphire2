import { createContext, useContext } from "react";

export type GlobalFilterSessionType = "all" | "cash_game" | "tournament";

export interface GlobalFilterValues {
	dateRangeDays: number | null;
	type: GlobalFilterSessionType;
}

export const DEFAULT_GLOBAL_FILTER: GlobalFilterValues = {
	type: "all",
	dateRangeDays: null,
};

const GlobalFilterContext = createContext<GlobalFilterValues>(
	DEFAULT_GLOBAL_FILTER
);

export const GlobalFilterProvider = GlobalFilterContext.Provider;

export function useGlobalFilter(): GlobalFilterValues {
	return useContext(GlobalFilterContext);
}

interface WidgetLike {
	config: Record<string, unknown>;
	type: string;
}

export function resolveGlobalFilterFromWidgets(
	widgets: readonly WidgetLike[]
): GlobalFilterValues {
	const widget = widgets.find((w) => w.type === "global_filter");
	if (!widget) {
		return DEFAULT_GLOBAL_FILTER;
	}
	const raw = widget.config;
	const type: GlobalFilterSessionType =
		raw.type === "cash_game" || raw.type === "tournament" ? raw.type : "all";
	const dateRangeDays =
		typeof raw.dateRangeDays === "number" &&
		Number.isFinite(raw.dateRangeDays) &&
		raw.dateRangeDays >= 1
			? Math.floor(raw.dateRangeDays)
			: null;
	return { type, dateRangeDays };
}

export function resolveSessionTypeFilter<T extends GlobalFilterSessionType>(
	local: T,
	global: GlobalFilterValues
): T {
	return global.type === "all" ? local : (global.type as T);
}

export function resolveDateRangeDaysFilter(
	local: number | null,
	global: GlobalFilterValues
): number | null {
	return global.dateRangeDays ?? local;
}
