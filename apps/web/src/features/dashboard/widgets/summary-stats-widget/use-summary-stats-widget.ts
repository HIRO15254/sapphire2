import { useQuery } from "@tanstack/react-query";
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

function computeSummaryFromItems(
	items: Array<{
		kind: string;
		cashBuyIn: number | null;
		cashOut: number | null;
		evCashOut: number | null;
		tournamentBuyIn: number | null;
		tournamentEntryFee: number | null;
		prizeMoney: number | null;
	}>
): SummaryStatsSummary {
	let totalProfitLoss = 0;
	let totalEvProfitLoss = 0;
	let hasEvData = false;
	let wins = 0;

	for (const item of items) {
		let pl: number;
		let evPl: number | null = null;

		if (item.kind === "tournament") {
			pl =
				(item.prizeMoney ?? 0) -
				(item.tournamentBuyIn ?? 0) -
				(item.tournamentEntryFee ?? 0);
		} else {
			pl = (item.cashOut ?? 0) - (item.cashBuyIn ?? 0);
			if (item.evCashOut !== null) {
				evPl = item.evCashOut - (item.cashBuyIn ?? 0);
				hasEvData = true;
			}
		}

		totalProfitLoss += pl;
		totalEvProfitLoss += evPl ?? pl;

		if (pl > 0) {
			wins += 1;
		}
	}

	const totalSessions = items.length;
	const winRate = totalSessions > 0 ? wins / totalSessions : 0;
	const avgProfitLoss =
		totalSessions > 0 ? totalProfitLoss / totalSessions : null;
	const totalEvDiff = hasEvData ? totalEvProfitLoss - totalProfitLoss : null;

	return {
		avgProfitLoss,
		totalEvDiff,
		totalEvProfitLoss: hasEvData ? totalEvProfitLoss : null,
		totalProfitLoss,
		totalSessions,
		winRate,
	};
}

export function useSummaryStatsWidget(
	config: Record<string, unknown>
): UseSummaryStatsWidgetResult {
	const parsed = parseSummaryStatsWidgetConfig(config);
	const dateFrom =
		parsed.dateRangeDays === null
			? undefined
			: Math.floor(Date.now() / 1000) - parsed.dateRangeDays * 86_400;

	const query = useQuery(
		trpc.session.list.queryOptions({
			type: parsed.type === "all" ? undefined : parsed.type,
			dateFrom,
		})
	);

	const summary: SummaryStatsSummary | undefined = query.data
		? computeSummaryFromItems(query.data.items)
		: undefined;

	return {
		isLoading: query.isLoading,
		metrics: parsed.metrics,
		summary,
	};
}
