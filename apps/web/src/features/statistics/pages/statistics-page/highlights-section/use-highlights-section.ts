import { useQuery } from "@tanstack/react-query";
import {
	type StatsSectionContext,
	statsValueUnit,
} from "@/features/statistics/types";
import { formatMinutes } from "@/features/statistics/utils/format-stats";
import { formatYmdSlash } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";
import { trpc } from "@/utils/trpc";

export interface HighlightSessionCard {
	dateText: string;
	id: string;
	valueColor: string;
	valueText: string;
}

export interface LongestSessionCard {
	dateText: string;
	durationText: string;
	id: string;
}

export interface UseHighlightsSectionResult {
	best: HighlightSessionCard | null;
	currentLoseStreak: number;
	currentWinStreak: number;
	isEmpty: boolean;
	isPending: boolean;
	longest: LongestSessionCard | null;
	maxLoseStreak: number;
	maxWinStreak: number;
	worst: HighlightSessionCard | null;
}

/** Convert unix seconds to a `YYYY/MM/DD` label. */
function dateLabel(unixSeconds: number): string {
	return formatYmdSlash(new Date(unixSeconds * 1000));
}

/**
 * Drives the highlights / records section from `stats.highlights`. The best /
 * worst P&L is shown in the active scope's unit (currency, or bb / bi when
 * normalized); the longest session shows its play time and date. When the
 * scope has no sessions, `bestSession` is null and the whole section hides.
 */
export function useHighlightsSection(
	ctx: StatsSectionContext
): UseHighlightsSectionResult {
	const query = useQuery(
		trpc.stats.highlights.queryOptions(ctx.statsInput, { enabled: ctx.enabled })
	);

	const data = query.data;
	if (!data) {
		return {
			best: null,
			worst: null,
			longest: null,
			currentWinStreak: 0,
			currentLoseStreak: 0,
			maxWinStreak: 0,
			maxLoseStreak: 0,
			isEmpty: true,
			isPending: ctx.enabled && query.isPending,
		};
	}

	const unit = statsValueUnit(ctx);

	const toSessionCard = (
		session: {
			id: string;
			date: number;
			profitLoss: number;
			normalizedProfitLoss: number | null;
		} | null
	): HighlightSessionCard | null => {
		if (!session) {
			return null;
		}
		const value = ctx.normalized
			? session.normalizedProfitLoss
			: session.profitLoss;
		return {
			id: session.id,
			valueText: formatProfitLoss(value, { currencyUnit: unit }),
			valueColor: profitLossColorClass(value),
			dateText: dateLabel(session.date),
		};
	};

	const longest: LongestSessionCard | null = data.longestSession
		? {
				id: data.longestSession.id,
				durationText: formatMinutes(data.longestSession.playMinutes),
				dateText: dateLabel(data.longestSession.date),
			}
		: null;

	return {
		best: toSessionCard(data.bestSession),
		worst: toSessionCard(data.worstSession),
		longest,
		currentWinStreak: data.currentWinStreak,
		currentLoseStreak: data.currentLoseStreak,
		maxWinStreak: data.maxWinStreak,
		maxLoseStreak: data.maxLoseStreak,
		isEmpty: data.bestSession == null,
		isPending: false,
	};
}
