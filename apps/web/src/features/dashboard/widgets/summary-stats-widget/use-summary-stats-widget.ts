import { useQuery } from "@tanstack/react-query";
import {
	resolveDateFromEpoch,
	resolveDateToEpoch,
	resolveSessionType,
	useGlobalFilter,
} from "@/features/dashboard/hooks/use-global-filter";
import { trpc } from "@/utils/trpc";

export type SummaryStatsWidgetType = "all" | "cash_game" | "tournament";

export type SummaryStatsMetricKey =
	| "totalSessions"
	| "totalProfitLoss"
	| "winRate"
	| "avgProfitLoss"
	| "totalEvProfitLoss"
	| "totalEvDiff";

export const SUMMARY_STATS_ALL_METRICS: Array<{
	key: SummaryStatsMetricKey;
	label: string;
}> = [
	{ key: "totalSessions", label: "Total Sessions" },
	{ key: "totalProfitLoss", label: "Total P&L" },
	{ key: "winRate", label: "Win Rate" },
	{ key: "avgProfitLoss", label: "Avg P&L" },
	{ key: "totalEvProfitLoss", label: "Total EV P&L" },
	{ key: "totalEvDiff", label: "Total EV Diff" },
];

export const SUMMARY_STATS_DEFAULT_METRICS: SummaryStatsMetricKey[] = [
	"totalSessions",
	"totalProfitLoss",
	"winRate",
	"avgProfitLoss",
];

interface ParsedConfig {
	dateRangeDays: number | null;
	metrics: SummaryStatsMetricKey[];
	type: SummaryStatsWidgetType;
}

export function parseSummaryStatsWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const metricsRaw = Array.isArray(raw.metrics) ? raw.metrics : [];
	const metrics = metricsRaw.filter((m): m is SummaryStatsMetricKey =>
		SUMMARY_STATS_ALL_METRICS.some((am) => am.key === m)
	);
	const type =
		raw.type === "cash_game" || raw.type === "tournament"
			? (raw.type as SummaryStatsWidgetType)
			: ("all" as SummaryStatsWidgetType);
	const dateRangeDays =
		typeof raw.dateRangeDays === "number" ? raw.dateRangeDays : null;
	return {
		metrics: metrics.length > 0 ? metrics : SUMMARY_STATS_DEFAULT_METRICS,
		type,
		dateRangeDays,
	};
}

export interface SummaryStatsSummary {
	avgProfitLoss: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalProfitLoss: number;
	totalSessions: number;
	winRate: number;
}

interface UseSummaryStatsWidgetResult {
	isLoading: boolean;
	metrics: SummaryStatsMetricKey[];
	summary: SummaryStatsSummary | undefined;
}

export function useSummaryStatsWidget(
	config: Record<string, unknown>
): UseSummaryStatsWidgetResult {
	const parsed = parseSummaryStatsWidgetConfig(config);
	const globalFilter = useGlobalFilter();
	const effectiveType = resolveSessionType(parsed.type, globalFilter);
	const dateFrom = resolveDateFromEpoch(globalFilter, parsed.dateRangeDays);
	const dateTo = resolveDateToEpoch(globalFilter);

	const query = useQuery(
		trpc.session.list.queryOptions({
			type: effectiveType === "all" ? undefined : effectiveType,
			storeId: globalFilter.storeId ?? undefined,
			currencyId: globalFilter.currencyId ?? undefined,
			dateFrom,
			dateTo,
		})
	);

	return {
		isLoading: query.isLoading,
		metrics: parsed.metrics,
		summary: query.data?.summary as SummaryStatsSummary | undefined,
	};
}
