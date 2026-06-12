import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	statsValueUnit,
} from "@/features/statistics/types";
import {
	formatFixed,
	formatPercent,
} from "@/features/statistics/utils/format-stats";
import { formatYmdSlash } from "@/utils/format-number";
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

export interface TournamentSessionRow {
	amount: number | null;
	dateText: string;
	id: string;
	value: string;
}

export interface TournamentStatsView {
	bestSession: TournamentSessionRow | null;
	metrics: TournamentMetric[];
	worstSession: TournamentSessionRow | null;
}

export interface UseTournamentStatsResult {
	isEmpty: boolean;
	isPending: boolean;
	view: TournamentStatsView | null;
}

interface HighlightSession {
	date: number;
	id: string;
	normalizedProfitLoss: number | null;
	profitLoss: number;
	type: "cash_game" | "tournament";
}

function buildSessionRow(
	session: HighlightSession | null,
	ctx: StatsSectionContext
): TournamentSessionRow | null {
	if (!session) {
		return null;
	}
	const unit = statsValueUnit(ctx);
	const amount = ctx.normalized
		? session.normalizedProfitLoss
		: session.profitLoss;
	return {
		id: session.id,
		amount,
		value: formatProfitLoss(amount, { currencyUnit: unit }),
		dateText: formatYmdSlash(new Date(session.date * 1000)),
	};
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
	const highlightsQuery = useQuery(
		trpc.stats.highlights.queryOptions(input, { enabled: ctx.enabled })
	);

	const summary = summaryQuery.data;
	const highlights = highlightsQuery.data;
	const isPending =
		ctx.enabled && (summaryQuery.isPending || highlightsQuery.isPending);

	if (!(summary && highlights)) {
		return { isPending, isEmpty: false, view: null };
	}

	if (summary.totalSessions === 0) {
		return { isPending: false, isEmpty: true, view: null };
	}

	const unit = statsValueUnit(ctx);
	const net = ctx.normalized
		? summary.normalizedProfitLoss
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
			value: formatProfitLoss(net, { currencyUnit: unit }),
			amount: net,
			isProfitLoss: true,
		},
	];

	return {
		isPending: false,
		isEmpty: false,
		view: {
			metrics,
			bestSession: buildSessionRow(highlights.bestSession, ctx),
			worstSession: buildSessionRow(highlights.worstSession, ctx),
		},
	};
}
