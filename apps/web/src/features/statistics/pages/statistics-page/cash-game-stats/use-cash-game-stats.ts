import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	unitForType,
} from "@/features/statistics/types";
import {
	formatScopedProfitLoss,
	formatStatAmount,
} from "@/features/statistics/utils/format-stats";
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

export interface CashGameStatsView {
	metrics: CashGameMetric[];
}

export interface UseCashGameStatsResult {
	isEmpty: boolean;
	isPending: boolean;
	view: CashGameStatsView | null;
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

	const unit = unitForType(ctx, "cash_game");
	const net = ctx.normalized
		? summary.cashNormalizedProfitLoss
		: summary.totalProfitLoss;
	const evDiff = ctx.normalized
		? summary.cashEvDiffNormalized
		: summary.totalEvDiff;

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
			value: ctx.normalized
				? formatStatAmount(evDiff, "bb")
				: formatProfitLoss(evDiff, { currencyUnit: ctx.currencyUnit }),
			amount: evDiff,
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
