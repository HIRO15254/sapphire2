import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";
import { formatCompactNumber } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";

interface CashGameCompactSummaryInput {
	currentStack: number | null;
	evDiff: number;
	startedAt: Date | string | number;
	totalBuyIn: number;
}

export interface CashGameCompactSummaryViewModel {
	displayPL: number | null;
	displayPLColorClass: string;
	displayPLFormatted: string;
	duration: string;
	evPL: number | null;
	evPLColorClass: string;
	evPLFormatted: string;
	showEvPL: boolean;
	totalBuyInFormatted: string;
}

export function useCashGameCompactSummary(
	summary: CashGameCompactSummaryInput
): CashGameCompactSummaryViewModel {
	const duration = useElapsedTime(summary.startedAt);

	const displayPL =
		summary.currentStack === null
			? null
			: summary.currentStack - summary.totalBuyIn;

	const evPL =
		summary.currentStack !== null && summary.evDiff !== 0
			? summary.currentStack + summary.evDiff - summary.totalBuyIn
			: null;
	const showEvPL = evPL !== null && evPL !== displayPL;

	return {
		duration,
		totalBuyInFormatted: formatCompactNumber(summary.totalBuyIn),
		displayPL,
		displayPLFormatted: displayPL === null ? "-" : formatProfitLoss(displayPL),
		displayPLColorClass:
			displayPL === null ? "" : profitLossColorClass(displayPL),
		evPL,
		showEvPL,
		evPLFormatted: evPL === null ? "" : formatProfitLoss(evPL),
		evPLColorClass: evPL === null ? "" : profitLossColorClass(evPL),
	};
}
