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
	isError: boolean;
	isPending: boolean;
	retry: () => void;
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
	const unit = unitForType(ctx, "tournament");
	const net = normalized
		? summary.tournamentNormalizedProfitLoss
		: summary.totalProfitLoss;
	const avg = ratio(
		net,
		normalized ? summary.tournamentBiCount : summary.totalSessions
	);
	const scoped = (value: number | null): string =>
		formatScopedProfitLoss(value, { normalized, unit });
	// Aggregate ROI and Total prize sum raw currency amounts, so they are only
	// meaningful when a single currency is pinned. Without one (e.g. the default
	// normalized scope) they would blend currencies, so they are hidden and only
	// the currency-agnostic Avg ROI (mean of per-session ROI %) is shown.
	const currencySelected = Boolean(ctx.statsInput.currencyId);

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
			key: "avgRoi",
			label: "Avg ROI",
			value: formatPercent(summary.avgRoi),
			valueColor: profitLossColorClass(summary.avgRoi),
		},
	];

	if (currencySelected) {
		rows.push({
			key: "roi",
			label: "ROI",
			value: formatPercent(summary.roi),
			valueColor: profitLossColorClass(summary.roi),
		});
	}

	rows.push(
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
		}
	);

	if (currencySelected) {
		rows.push({
			key: "prize",
			label: "Total prize",
			value: formatProfitLoss(summary.totalPrizeMoney, {
				currencyUnit: ctx.currencyUnit,
			}),
			valueColor: "",
		});
	}

	return {
		isPending: false,
		isEmpty: false,
		rows,
		isError: ctx.enabled && summaryQuery.isError,
		retry,
	};
}
