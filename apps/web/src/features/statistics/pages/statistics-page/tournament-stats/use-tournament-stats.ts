import { useQuery } from "@tanstack/react-query";
import type { StatRow } from "@/features/statistics/pages/statistics-page/stat-table";
import {
	type StatsSectionContext,
	unitForType,
} from "@/features/statistics/types";
import {
	formatFixed,
	formatMinutes,
	formatPercent,
	formatScopedProfitLoss,
} from "@/features/statistics/utils/format-stats";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

export interface UseTournamentStatsResult {
	isEmpty: boolean;
	isPending: boolean;
	rows: StatRow[];
}

function ratio(value: number | null, count: number): number | null {
	return value === null || count === 0 ? null : value / count;
}

/**
 * Tournament-specific stat table. Always queries with the type forced to
 * `tournament` so it stays game-specific even when the global type filter is
 * "all". Prize money is always a currency amount, so it stays in currency units
 * even when normalized.
 */
export function useTournamentStats(
	ctx: StatsSectionContext
): UseTournamentStatsResult {
	const input = { ...ctx.statsInput, type: "tournament" as const };
	const summaryQuery = useQuery(
		trpc.stats.summary.queryOptions(input, { enabled: ctx.enabled })
	);

	const summary = summaryQuery.data;
	if (!summary) {
		return {
			isPending: ctx.enabled && summaryQuery.isPending,
			isEmpty: false,
			rows: [],
		};
	}

	if (summary.totalSessions === 0) {
		return { isPending: false, isEmpty: true, rows: [] };
	}

	const { normalized } = ctx;
	const unit = unitForType(ctx, "tournament");
	const net = normalized
		? summary.tournamentNormalizedProfitLoss
		: summary.totalProfitLoss;
	const avg = ratio(net, summary.totalSessions);
	const scoped = (value: number | null): string =>
		formatScopedProfitLoss(value, { normalized, unit });

	const rows: StatRow[] = [
		{
			key: "sessions",
			label: "Sessions",
			value: String(summary.totalSessions),
			valueColor: "",
		},
		{
			key: "net",
			label: "Net P&L",
			value: scoped(net),
			valueColor: profitLossColorClass(net),
		},
		{
			key: "avg",
			label: "Avg P&L",
			value: scoped(avg),
			valueColor: profitLossColorClass(avg),
		},
		{
			key: "winRate",
			label: "Win rate",
			value: formatPercent(summary.winRate),
			valueColor: "",
		},
		{
			key: "playTime",
			label: "Play time",
			value: formatMinutes(summary.totalPlayMinutes),
			valueColor: "",
		},
		{
			key: "roi",
			label: "ROI",
			value: formatPercent(summary.roi),
			valueColor: profitLossColorClass(summary.roi),
		},
		{
			key: "itm",
			label: "ITM rate",
			value: formatPercent(summary.itmRate),
			valueColor: "",
		},
		{
			key: "placement",
			label: "Avg placement",
			value: formatFixed(summary.avgPlacement),
			valueColor: "",
		},
		{
			key: "prize",
			label: "Total prize",
			value: formatProfitLoss(summary.totalPrizeMoney, {
				currencyUnit: ctx.currencyUnit,
			}),
			valueColor: "",
		},
	];

	return { isPending: false, isEmpty: false, rows };
}
