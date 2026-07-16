import type { PnlGraphXAxis } from "@/features/statistics/utils/aggregate-pnl-points";
import { formatCompactNumber } from "@/utils/format-number";

export function formatPnlAxisValue(value: number): string {
	return formatCompactNumber(value);
}

export const X_AXIS_LABEL: Record<PnlGraphXAxis, string> = {
	date: "Date",
	sessionCount: "Session #",
	playTime: "Play time (h)",
};

export const X_AXIS_VALUES: PnlGraphXAxis[] = [
	"date",
	"sessionCount",
	"playTime",
];
