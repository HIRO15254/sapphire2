import { useQuery } from "@tanstack/react-query";
import { useGlobalFilter } from "@/features/dashboard/hooks/use-global-filter";
import {
	parseSessionFilterWidgetConfig,
	resolveSessionListQueryInput,
	type SessionFilterWidgetConfig,
	type SessionTypeFilter,
} from "@/features/dashboard/utils/session-filter";
import { trpc } from "@/utils/trpc";

export type SummaryStatsWidgetType = SessionTypeFilter;

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

interface ParsedConfig extends SessionFilterWidgetConfig {
	metrics: SummaryStatsMetricKey[];
}

export function parseSummaryStatsWidgetConfig(
	raw: Record<string, unknown>
): ParsedConfig {
	const sessionFilter = parseSessionFilterWidgetConfig(raw);
	const metricsRaw = Array.isArray(raw.metrics) ? raw.metrics : [];
	const metrics = metricsRaw.filter((m): m is SummaryStatsMetricKey =>
		SUMMARY_STATS_ALL_METRICS.some((am) => am.key === m)
	);
	return {
		...sessionFilter,
		metrics: metrics.length > 0 ? metrics : SUMMARY_STATS_DEFAULT_METRICS,
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
	const queryInput = resolveSessionListQueryInput(parsed, globalFilter);

	const query = useQuery(trpc.session.list.queryOptions(queryInput));

	return {
		isLoading: query.isLoading,
		metrics: parsed.metrics,
		summary: query.data?.summary as SummaryStatsSummary | undefined,
	};
}
