import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	statsValueUnit,
} from "@/features/statistics/types";
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

function formatRate(value: number | null, unit: string | null): string {
	if (value == null) {
		return "—";
	}
	return `${formatProfitLoss(value, { currencyUnit: unit })}/h`;
}

function buildSessionRow(
	session: HighlightSession | null,
	ctx: StatsSectionContext
): CashGameSessionRow | null {
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

	const unit = statsValueUnit(ctx);
	const net = ctx.normalized
		? summary.normalizedProfitLoss
		: summary.totalProfitLoss;

	const hourly: CashGameMetric = ctx.normalized
		? {
				key: "hourly",
				label: "BB / hr",
				value: formatRate(summary.bbPerHour, "bb"),
				amount: summary.bbPerHour,
				isProfitLoss: true,
			}
		: {
				key: "hourly",
				label: "Hourly rate",
				value: formatRate(summary.hourlyRate, ctx.currencyUnit),
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
