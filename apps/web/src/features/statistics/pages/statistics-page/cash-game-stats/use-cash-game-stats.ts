import { useQuery } from "@tanstack/react-query";
import type { StatRow } from "@/features/statistics/pages/statistics-page/stat-table";
import {
	type StatsSectionContext,
	unitForType,
} from "@/features/statistics/types";
import {
	formatMinutes,
	formatPercent,
	formatScopedProfitLoss,
	formatStatAmount,
} from "@/features/statistics/utils/format-stats";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

export interface UseCashGameStatsResult {
	isEmpty: boolean;
	isError: boolean;
	isPending: boolean;
	retry: () => void;
	rows: StatRow[];
}

function ratio(value: number | null, count: number): number | null {
	return value === null || count === 0 ? null : value / count;
}

/**
 * Cash-game-specific stat table. The block always queries with the type forced
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
	const retry = () => {
		summaryQuery.refetch();
	};

	const summary = summaryQuery.data;
	if (!summary) {
		return {
			isError: ctx.enabled && summaryQuery.isError,
			retry,
			isPending: ctx.enabled && summaryQuery.isPending,
			isEmpty: false,
			rows: [],
		};
	}

	if (summary.totalSessions === 0) {
		return { isPending: false, isEmpty: true, rows: [], isError: false, retry };
	}

	const { normalized } = ctx;
	const unit = unitForType(ctx, "cash_game");
	const net = normalized
		? summary.cashNormalizedProfitLoss
		: summary.totalProfitLoss;
	const avg = ratio(
		net,
		normalized ? summary.cashBbCount : summary.totalSessions
	);
	const evDiff = normalized
		? summary.cashEvDiffNormalized
		: summary.totalEvDiff;

	const scoped = (value: number | null): string =>
		formatScopedProfitLoss(value, { normalized, unit });
	const hourly: { text: string; amount: number | null } = normalized
		? {
				text: formatStatAmount(summary.bbPerHour, "bb/h", { decimals: 2 }),
				amount: summary.bbPerHour,
			}
		: {
				text:
					summary.hourlyRate == null
						? "—"
						: `${formatProfitLoss(summary.hourlyRate, { currencyUnit: ctx.currencyUnit })}/h`,
				amount: summary.hourlyRate,
			};
	const evDiffText = normalized
		? formatStatAmount(evDiff, "bb")
		: formatProfitLoss(evDiff, { currencyUnit: ctx.currencyUnit });

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
		// Virtual net is a raw currency sum (real + item/virtual amounts), so it
		// only renders under a pinned currency — normalized mode shows a dash.
		{
			key: "virtualNet",
			label: "Virtual net P&L",
			value: normalized
				? "—"
				: formatProfitLoss(summary.virtualNetProfitLoss ?? null, {
						currencyUnit: ctx.currencyUnit,
					}),
			valueColor: normalized
				? ""
				: profitLossColorClass(summary.virtualNetProfitLoss),
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
			key: "virtualWinRate",
			label: "Virtual win rate",
			value: formatPercent(summary.virtualWinRate),
			valueColor: "",
		},
		{
			key: "playTime",
			label: "Play time",
			value: formatMinutes(summary.totalPlayMinutes),
			valueColor: "",
		},
		{
			key: "hourly",
			label: normalized ? "BB / hr" : "Hourly rate",
			value: hourly.text,
			valueColor: profitLossColorClass(hourly.amount),
		},
		{
			key: "evDiff",
			label: "EV diff",
			value: evDiffText,
			valueColor: profitLossColorClass(evDiff),
		},
	];

	return {
		isPending: false,
		isEmpty: false,
		rows,
		isError: ctx.enabled && summaryQuery.isError,
		retry,
	};
}
