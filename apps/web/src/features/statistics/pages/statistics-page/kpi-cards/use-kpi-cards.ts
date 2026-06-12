import { useQuery } from "@tanstack/react-query";
import type { StatsSectionContext } from "@/features/statistics/types";
import {
	formatFixed,
	formatMinutes,
	formatPercent,
	formatScopedProfitLoss,
	formatStatAmount,
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

interface NetSummary {
	cashNormalizedProfitLoss: number | null;
	totalProfitLoss: number;
	tournamentNormalizedProfitLoss: number | null;
}

function netCard(
	key: string,
	label: string,
	value: number | null,
	unit: string | null,
	normalized: boolean
): KpiCard {
	return {
		key,
		label,
		value: formatScopedProfitLoss(value, { normalized, unit }),
		trend: trendDirection(value),
	};
}

/**
 * Net P&L cards. BB (cash) and BI (tournament) live on different scales and can
 * never be summed, so normalized mode shows a single typed card for a single
 * game type and TWO separate cards (BB + BI) when the type filter is "all".
 */
function buildNetCards(
	ctx: StatsSectionContext,
	summary: NetSummary
): KpiCard[] {
	if (!ctx.normalized) {
		return [
			netCard(
				"net",
				"Net P&L",
				summary.totalProfitLoss,
				ctx.currencyUnit,
				false
			),
		];
	}
	if (ctx.type === "cash_game") {
		return [
			netCard("net", "Net (BB)", summary.cashNormalizedProfitLoss, "bb", true),
		];
	}
	if (ctx.type === "tournament") {
		return [
			netCard(
				"net",
				"Net (BI)",
				summary.tournamentNormalizedProfitLoss,
				"bi",
				true
			),
		];
	}
	return [
		netCard(
			"netCash",
			"Net (BB)",
			summary.cashNormalizedProfitLoss,
			"bb",
			true
		),
		netCard(
			"netTournament",
			"Net (BI)",
			summary.tournamentNormalizedProfitLoss,
			"bi",
			true
		),
	];
}

/**
 * Builds the headline KPI card set from `stats.summary`. The card set depends
 * on the game-type filter: "all" shows only the metrics shared by cash and
 * tournaments; cash adds EV diff + hourly; tournaments add ROI / ITM / placing.
 * Normalized mode shows bb (cash) and bi (tournament) figures separately.
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

	const cards: KpiCard[] = [
		...buildNetCards(ctx, summary),
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
						value: formatStatAmount(summary.bbPerHour, "bb/h", { decimals: 2 }),
						trend: trendDirection(summary.bbPerHour),
					}
				: {
						key: "hourly",
						label: "Hourly",
						value:
							summary.hourlyRate == null
								? "—"
								: `${formatProfitLoss(summary.hourlyRate, { currencyUnit: ctx.currencyUnit })}/h`,
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
