import { computeCashGamePL } from "@/features/live-sessions/utils/live-session-summary";
import { useElapsedTime } from "@/shared/hooks/use-elapsed-time";
import { formatCompactNumber } from "@/utils/format-number";
import {
	formatProfitLoss,
	profitLossColorClass,
} from "@/utils/format-profit-loss";

interface CashGameCompactSummaryInput {
	chipRemoveTotal: number;
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

	const { displayPL, evPL, showEvPL } = computeCashGamePL(summary);

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
