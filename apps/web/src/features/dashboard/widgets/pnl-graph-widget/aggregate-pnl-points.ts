export type PnlGraphXAxis = "date" | "sessionCount" | "playTime";
export type PnlGraphUnit = "currency" | "normalized";
export type PnlGraphSessionType = "all" | "cash_game" | "tournament";

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
	cashCumulative?: number;
	cumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

export interface AggregateResult {
	points: AggregatedPoint[];
	skippedCount: number;
}

type SingleSeries = "currency" | "bb" | "bi";

function bbValue(point: PnlSeriesPoint): number | null {
	if (
		point.type !== "cash_game" ||
		point.bigBlind === null ||
		point.bigBlind <= 0
	) {
		return null;
	}
	return point.profitLoss / point.bigBlind;
}

function biValue(point: PnlSeriesPoint): number | null {
	if (
		point.type !== "tournament" ||
		point.buyInTotal === null ||
		point.buyInTotal <= 0
	) {
		return null;
	}
	return point.profitLoss / point.buyInTotal;
}

function singleSeriesValue(
	point: PnlSeriesPoint,
	series: SingleSeries
): number | null {
	if (series === "currency") {
		return point.profitLoss;
	}
	if (series === "bb") {
		return bbValue(point);
	}
	return biValue(point);
}

function startOfDayMs(epochSec: number): number {
	const d = new Date(epochSec * 1000);
	d.setUTCHours(0, 0, 0, 0);
	return d.getTime();
}

function sortPoints(points: PnlSeriesPoint[]): PnlSeriesPoint[] {
	return [...points].sort(
		(a, b) => a.sessionDate - b.sessionDate || a.id.localeCompare(b.id)
	);
}

function aggregateSingle(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis,
	series: SingleSeries
): AggregateResult {
	const sorted = sortPoints(rawPoints);
	const result: AggregatedPoint[] = [];
	let cumulative = 0;
	let sessionIndex = 0;
	let cumulativeMinutes = 0;
	let skippedCount = 0;
	const dayBuckets = new Map<number, number>();

	for (const point of sorted) {
		const value = singleSeriesValue(point, series);
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
			result.push({ x: cumulativeMinutes / 60, cumulative });
			continue;
		}
		dayBuckets.set(startOfDayMs(point.sessionDate), cumulative);
	}

	if (xAxis === "date") {
		const sortedDays = [...dayBuckets.entries()].sort((a, b) => a[0] - b[0]);
		for (const [dayMs, value] of sortedDays) {
			result.push({ x: dayMs, cumulative: value });
		}
	}

	return { points: result, skippedCount };
}

function aggregateDual(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis
): AggregateResult {
	const sorted = sortPoints(rawPoints);
	const result: AggregatedPoint[] = [];
	let cashCumulative = 0;
	let tournamentCumulative = 0;
	let sessionIndex = 0;
	let cumulativeMinutes = 0;
	let skippedCount = 0;
	const dayBuckets = new Map<
		number,
		{ cashCumulative: number; tournamentCumulative: number }
	>();

	for (const point of sorted) {
		const cashDelta = point.type === "cash_game" ? bbValue(point) : null;
		const tournamentDelta = point.type === "tournament" ? biValue(point) : null;

		if (cashDelta === null && tournamentDelta === null) {
			skippedCount++;
			continue;
		}

		if (cashDelta !== null) {
			cashCumulative += cashDelta;
		}
		if (tournamentDelta !== null) {
			tournamentCumulative += tournamentDelta;
		}
		sessionIndex++;

		if (xAxis === "sessionCount") {
			result.push({
				x: sessionIndex,
				cashCumulative,
				tournamentCumulative,
			});
			continue;
		}
		if (xAxis === "playTime") {
			cumulativeMinutes += point.playMinutes ?? 0;
			result.push({
				x: cumulativeMinutes / 60,
				cashCumulative,
				tournamentCumulative,
			});
			continue;
		}
		dayBuckets.set(startOfDayMs(point.sessionDate), {
			cashCumulative,
			tournamentCumulative,
		});
	}

	if (xAxis === "date") {
		const sortedDays = [...dayBuckets.entries()].sort((a, b) => a[0] - b[0]);
		for (const [dayMs, value] of sortedDays) {
			result.push({
				x: dayMs,
				cashCumulative: value.cashCumulative,
				tournamentCumulative: value.tournamentCumulative,
			});
		}
	}

	return { points: result, skippedCount };
}

export function aggregatePnlPoints(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis,
	unit: PnlGraphUnit,
	sessionType: PnlGraphSessionType
): AggregateResult {
	if (unit === "currency") {
		return aggregateSingle(rawPoints, xAxis, "currency");
	}
	if (sessionType === "cash_game") {
		return aggregateSingle(rawPoints, xAxis, "bb");
	}
	if (sessionType === "tournament") {
		return aggregateSingle(rawPoints, xAxis, "bi");
	}
	return aggregateDual(rawPoints, xAxis);
}
