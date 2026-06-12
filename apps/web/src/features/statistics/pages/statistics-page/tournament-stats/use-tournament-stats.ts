import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	unitForType,
} from "@/features/statistics/types";
import {
	formatFixed,
	formatPercent,
	formatScopedProfitLoss,
} from "@/features/statistics/utils/format-stats";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

/**
 * One metric card in the tournament block. `amount` carries the raw signed
 * value (or null) so the component can color P&L cards without re-parsing the
 * formatted string. `isProfitLoss` flags monetary cards — ROI / ITM / placement
 * stay neutral.
 */
export interface TournamentMetric {
	amount: number | null;
	isProfitLoss: boolean;
	key: string;
	label: string;
	value: string;
}

export interface TournamentStatsView {
	metrics: TournamentMetric[];
}

export interface UseTournamentStatsResult {
	isEmpty: boolean;
	isPending: boolean;
	view: TournamentStatsView | null;
}

/**
 * Tournament-specific stat block. Always queries with the type forced to
 * `tournament` so it stays game-specific even when the global type filter is
 * "all". Avg-finish-%, final-table-rate, total-bounty and max-cash are omitted —
 * the stats router does not expose those fields yet. Prize money is always a
 * currency amount, so it stays in currency units even when normalized.
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
			view: null,
		};
	}

	if (summary.totalSessions === 0) {
		return { isPending: false, isEmpty: true, view: null };
	}

	const unit = unitForType(ctx, "tournament");
	const net = ctx.normalized
		? summary.tournamentNormalizedProfitLoss
		: summary.totalProfitLoss;

	const metrics: TournamentMetric[] = [
		{
			key: "roi",
			label: "ROI",
			value: formatPercent(summary.roi),
			amount: summary.roi,
			isProfitLoss: false,
		},
		{
			key: "itm",
			label: "ITM rate",
			value: formatPercent(summary.itmRate),
			amount: summary.itmRate,
			isProfitLoss: false,
		},
		{
			key: "placement",
			label: "Avg placement",
			value: formatFixed(summary.avgPlacement),
			amount: summary.avgPlacement,
			isProfitLoss: false,
		},
		{
			key: "prize",
			label: "Total prize",
			value: formatProfitLoss(summary.totalPrizeMoney, {
				currencyUnit: ctx.currencyUnit,
			}),
			amount: summary.totalPrizeMoney,
			isProfitLoss: true,
		},
		{
			key: "net",
			label: "Net",
			value: formatScopedProfitLoss(net, { normalized: ctx.normalized, unit }),
			amount: net,
			isProfitLoss: true,
		},
	];

	return { isPending: false, isEmpty: false, view: { metrics } };
}
