import type { GlobalFilterSessionType } from "@/features/dashboard/hooks/use-global-filter";

export type GlobalFilterWidgetSessionType = GlobalFilterSessionType;

interface ParsedConfig {
	dateRangeDays: number | null;
	type: GlobalFilterWidgetSessionType;
}

export function parseGlobalFilterWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const type: GlobalFilterWidgetSessionType =
		raw.type === "cash_game" || raw.type === "tournament" ? raw.type : "all";
	const dateRangeDays =
		typeof raw.dateRangeDays === "number" &&
		Number.isFinite(raw.dateRangeDays) &&
		raw.dateRangeDays >= 1
			? Math.floor(raw.dateRangeDays)
			: null;
	return { type, dateRangeDays };
}

export const GLOBAL_FILTER_TYPE_LABELS: Record<
	GlobalFilterWidgetSessionType,
	string
> = {
	all: "All",
	cash_game: "Cash Game",
	tournament: "Tournament",
};

interface UseGlobalFilterWidgetResult {
	dateRangeDays: number | null;
	hasActiveFilter: boolean;
	type: GlobalFilterWidgetSessionType;
	typeLabel: string;
}

export function useGlobalFilterWidget(
	config: Record<string, unknown>
): UseGlobalFilterWidgetResult {
	const parsed = parseGlobalFilterWidgetConfig(config);
	const hasActiveFilter =
		parsed.type !== "all" || parsed.dateRangeDays !== null;
	return {
		type: parsed.type,
		typeLabel: GLOBAL_FILTER_TYPE_LABELS[parsed.type],
		dateRangeDays: parsed.dateRangeDays,
		hasActiveFilter,
	};
}
