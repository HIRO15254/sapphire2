export type PnlGraphXAxis = "date" | "sessionCount" | "playTime";
export type PnlGraphUnit = "currency" | "bb" | "bi";

export interface PnlSeriesPoint {
	bigBlind: number | null;
	buyInTotal: number | null;
	id: string;
	playMinutes: number | null;
	profitLoss: number;
	sessionDate: number;
	type: "cash_game" | "tournament";
}

export interface AggregatedPoint {
	cumulative: number;
	x: number;
}

export interface AggregateResult {
	points: AggregatedPoint[];
	skippedCount: number;
}

function convertProfitLoss(
	point: PnlSeriesPoint,
	unit: PnlGraphUnit
): number | null {
	if (unit === "currency") {
		return point.profitLoss;
	}
	if (unit === "bb") {
		if (
			point.type !== "cash_game" ||
			point.bigBlind === null ||
			point.bigBlind <= 0
		) {
			return null;
		}
		return point.profitLoss / point.bigBlind;
	}
	if (
		point.type !== "tournament" ||
		point.buyInTotal === null ||
		point.buyInTotal <= 0
	) {
		return null;
	}
	return point.profitLoss / point.buyInTotal;
}

function startOfDayMs(epochSec: number): number {
	const d = new Date(epochSec * 1000);
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
}

export function aggregatePnlPoints(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis,
	unit: PnlGraphUnit
): AggregateResult {
	const sorted = [...rawPoints].sort(
		(a, b) => a.sessionDate - b.sessionDate || a.id.localeCompare(b.id)
	);

	const result: AggregatedPoint[] = [];
	let cumulative = 0;
	let sessionIndex = 0;
	let cumulativeMinutes = 0;
	let skippedCount = 0;

	const dayBuckets = new Map<number, number>();

	for (const point of sorted) {
		const value = convertProfitLoss(point, unit);
		if (value === null) {
			skippedCount++;
			continue;
		}
		cumulative += value;
		sessionIndex++;

		if (xAxis === "sessionCount") {
			result.push({ x: sessionIndex, cumulative });
			continue;
		}

		if (xAxis === "playTime") {
			cumulativeMinutes += point.playMinutes ?? 0;
			result.push({ x: cumulativeMinutes, cumulative });
			continue;
		}

		const dayMs = startOfDayMs(point.sessionDate);
		dayBuckets.set(dayMs, cumulative);
	}

	if (xAxis === "date") {
		const sortedDays = [...dayBuckets.entries()].sort((a, b) => a[0] - b[0]);
		for (const [dayMs, value] of sortedDays) {
			result.push({ x: dayMs, cumulative: value });
		}
	}

	return { points: result, skippedCount };
}
