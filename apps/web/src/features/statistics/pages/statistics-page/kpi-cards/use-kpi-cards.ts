import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	statsValueUnit,
} from "@/features/statistics/types";
import {
	formatFixed,
	formatMinutes,
	formatPercent,
	type TrendDirection,
	trendDirection,
} from "@/features/statistics/utils/format-stats";
import { formatProfitLoss } from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

export interface KpiCard {
	key: string;
	label: string;
	trend: TrendDirection;
	value: string;
}

export interface UseKpiCardsResult {
	cards: KpiCard[];
	isError: boolean;
	isPending: boolean;
}

function formatRate(value: number | null, unit: string | null): string {
	if (value == null) {
		return "—";
	}
	return `${formatProfitLoss(value, { currencyUnit: unit })}/h`;
}

/**
 * Builds the headline KPI card set from `stats.summary`. The card set depends
 * on the game-type filter: "all" shows only the metrics shared by cash and
 * tournaments; cash adds EV diff + hourly; tournaments add ROI / ITM / placing.
 * Normalized mode swaps monetary units to bb / bi and hourly to bb/hr.
 */
export function useKpiCards(ctx: StatsSectionContext): UseKpiCardsResult {
	const query = useQuery(
		trpc.stats.summary.queryOptions(ctx.statsInput, { enabled: ctx.enabled })
	);

	const summary = query.data;
	if (!summary) {
		return {
			cards: [],
			isPending: ctx.enabled && query.isPending,
			isError: query.isError,
		};
	}

	const unit = statsValueUnit(ctx);
	const net = ctx.normalized
		? summary.normalizedProfitLoss
		: summary.totalProfitLoss;

	const cards: KpiCard[] = [
		{
			key: "net",
			label: "Net P&L",
			value: formatProfitLoss(net, { currencyUnit: unit }),
			trend: trendDirection(net),
		},
		{
			key: "sessions",
			label: "Sessions",
			value: String(summary.totalSessions),
			trend: null,
		},
		{
			key: "playTime",
			label: "Play time",
			value: formatMinutes(summary.totalPlayMinutes),
			trend: null,
		},
		{
			key: "winRate",
			label: "Win rate",
			value: formatPercent(summary.winRate),
			trend: null,
		},
	];

	if (ctx.type === "cash_game") {
		cards.push({
			key: "evDiff",
			label: "EV diff",
			value: formatProfitLoss(summary.totalEvDiff, {
				currencyUnit: ctx.currencyUnit,
			}),
			trend: trendDirection(summary.totalEvDiff),
		});
		cards.push(
			ctx.normalized
				? {
						key: "bbPerHour",
						label: "BB / hr",
						value: formatRate(summary.bbPerHour, "bb"),
						trend: trendDirection(summary.bbPerHour),
					}
				: {
						key: "hourly",
						label: "Hourly",
						value: formatRate(summary.hourlyRate, ctx.currencyUnit),
						trend: trendDirection(summary.hourlyRate),
					}
		);
	}

	if (ctx.type === "tournament") {
		cards.push(
			{
				key: "roi",
				label: "ROI",
				value: formatPercent(summary.roi),
				trend: trendDirection(summary.roi),
			},
			{
				key: "itm",
				label: "ITM",
				value: formatPercent(summary.itmRate),
				trend: null,
			},
			{
				key: "placement",
				label: "Avg place",
				value: formatFixed(summary.avgPlacement),
				trend: null,
			}
		);
	}

	return { cards, isPending: false, isError: query.isError };
}
