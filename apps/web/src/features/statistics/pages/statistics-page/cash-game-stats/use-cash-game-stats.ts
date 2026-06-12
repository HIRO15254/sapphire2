import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	unitForType,
} from "@/features/statistics/types";
import {
	formatScopedProfitLoss,
	formatStatAmount,
} from "@/features/statistics/utils/format-stats";
import { formatYmdSlash } from "@/utils/format-number";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

/**
 * One metric card in the cash-game block. `amount` carries the raw signed value
 * (or null for an em-dash card) so the component can pick the P&L color without
 * re-parsing the formatted string. `isProfitLoss` flags monetary cards whose
 * sign should be colored — non-monetary cards stay neutral.
 */
export interface CashGameMetric {
	amount: number | null;
	isProfitLoss: boolean;
	key: string;
	label: string;
	value: string;
}

export interface CashGameSessionRow {
	amount: number | null;
	dateText: string;
	id: string;
	value: string;
}

export interface CashGameStatsView {
	bestSession: CashGameSessionRow | null;
	metrics: CashGameMetric[];
	worstSession: CashGameSessionRow | null;
}

export interface UseCashGameStatsResult {
	isEmpty: boolean;
	isPending: boolean;
	view: CashGameStatsView | null;
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
): CashGameSessionRow | null {
	if (!session) {
		return null;
	}
	const unit = unitForType(ctx, "cash_game");
	const amount = ctx.normalized
		? session.normalizedProfitLoss
		: session.profitLoss;
	return {
		id: session.id,
		amount,
		value: formatScopedProfitLoss(amount, { normalized: ctx.normalized, unit }),
		dateText: formatYmdSlash(new Date(session.date * 1000)),
	};
}

/**
 * Cash-game-specific stat block. The block always queries with the type forced
 * to `cash_game` so it stays game-specific even when the global type filter is
 * "all". bb/100 is intentionally omitted — hands are not tracked.
 */
export function useCashGameStats(
	ctx: StatsSectionContext
): UseCashGameStatsResult {
	const input = { ...ctx.statsInput, type: "cash_game" as const };
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

	const unit = unitForType(ctx, "cash_game");
	const net = ctx.normalized
		? summary.cashNormalizedProfitLoss
		: summary.totalProfitLoss;

	const hourly: CashGameMetric = ctx.normalized
		? {
				key: "hourly",
				label: "BB / hr",
				value: formatStatAmount(summary.bbPerHour, "bb/h", { decimals: 2 }),
				amount: summary.bbPerHour,
				isProfitLoss: true,
			}
		: {
				key: "hourly",
				label: "Hourly rate",
				value:
					summary.hourlyRate == null
						? "—"
						: `${formatProfitLoss(summary.hourlyRate, { currencyUnit: ctx.currencyUnit })}/h`,
				amount: summary.hourlyRate,
				isProfitLoss: true,
			};

	const metrics: CashGameMetric[] = [
		hourly,
		{
			key: "evDiff",
			label: "EV diff",
			value: formatProfitLoss(summary.totalEvDiff, {
				currencyUnit: ctx.currencyUnit,
			}),
			amount: summary.totalEvDiff,
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
