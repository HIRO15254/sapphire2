import {
	type GlobalFilterValues,
	resolveDateFromEpoch,
	resolveDateToEpoch,
	resolveSessionType,
} from "@/features/dashboard/hooks/use-global-filter";

export const SESSION_TYPE_VALUES = ["all", "cash_game", "tournament"] as const;
export type SessionTypeFilter = (typeof SESSION_TYPE_VALUES)[number];

export const SESSION_TYPE_OPTIONS: ReadonlyArray<{
	label: string;
	value: SessionTypeFilter;
}> = [
	{ value: "all", label: "All" },
	{ value: "cash_game", label: "Cash Game" },
	{ value: "tournament", label: "Tournament" },
];

export interface SessionFilterWidgetConfig {
	dateRangeDays: number | null;
	type: SessionTypeFilter;
}

export function parseSessionType(raw: unknown): SessionTypeFilter {
	return raw === "cash_game" || raw === "tournament" ? raw : "all";
}

export function parseDateRangeDays(raw: unknown): number | null {
	if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 1) {
		return null;
	}
	return Math.floor(raw);
}

export function parseSessionFilterWidgetConfig(
	raw: Record<string, unknown>
): SessionFilterWidgetConfig {
	return {
		type: parseSessionType(raw.type),
		dateRangeDays: parseDateRangeDays(raw.dateRangeDays),
	};
}

export interface SessionListQueryInput {
	currencyId: string | undefined;
	dateFrom: number | undefined;
	dateTo: number | undefined;
	storeId: string | undefined;
	type: "cash_game" | "tournament" | undefined;
}

export function resolveSessionListQueryInput(
	local: SessionFilterWidgetConfig,
	globalFilter: GlobalFilterValues
): SessionListQueryInput {
	const effectiveType = resolveSessionType(local.type, globalFilter);
	return {
		type: effectiveType === "all" ? undefined : effectiveType,
		storeId: globalFilter.storeId ?? undefined,
		currencyId: globalFilter.currencyId ?? undefined,
		dateFrom: resolveDateFromEpoch(globalFilter, local.dateRangeDays),
		dateTo: resolveDateToEpoch(globalFilter),
	};
}
