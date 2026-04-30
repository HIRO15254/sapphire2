export type PnlGraphXAxis = "date" | "sessionCount" | "playTime";
export type PnlGraphUnit = "currency" | "normalized";
export type PnlGraphSessionType = "all" | "cash_game" | "tournament";

export interface PnlSeriesPoint {
	bigBlind: number | null;
	buyInTotal: number | null;
	evProfitLoss: number | null;
	id: string;
	playMinutes: number | null;
	profitLoss: number;
	sessionDate: number;
	type: "cash_game" | "tournament";
}

export interface AggregatedPoint {
	cashCumulative?: number;
	cumulative?: number;
	evCashCumulative?: number;
	tournamentCumulative?: number;
	x: number;
}

export interface AggregateResult {
	points: AggregatedPoint[];
	skippedCount: number;
}

export interface AggregateOptions {
	rawPoints: PnlSeriesPoint[];
	sessionType: PnlGraphSessionType;
	showEvCash: boolean;
	unit: PnlGraphUnit;
	xAxis: PnlGraphXAxis;
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

function evCashValue(point: PnlSeriesPoint, unit: PnlGraphUnit): number | null {
	if (point.type !== "cash_game" || point.evProfitLoss === null) {
		return null;
	}
	if (unit === "currency") {
		return point.evProfitLoss;
	}
	if (point.bigBlind === null || point.bigBlind <= 0) {
		return null;
	}
	return point.evProfitLoss / point.bigBlind;
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

function originX(
	xAxis: PnlGraphXAxis,
	firstSessionDateSec: number | null
): number {
	if (xAxis === "date") {
		if (firstSessionDateSec === null) {
			return 0;
		}
		return startOfDayMs(firstSessionDateSec) - 86_400_000;
	}
	return 0;
}

function sortPoints(points: PnlSeriesPoint[]): PnlSeriesPoint[] {
	return [...points].sort(
		(a, b) => a.sessionDate - b.sessionDate || a.id.localeCompare(b.id)
	);
}

interface SingleAccumulator {
	cumulative: number;
	cumulativeMinutes: number;
	evCashCumulative: number;
	sessionIndex: number;
}

interface DualAccumulator {
	cashCumulative: number;
	cumulativeMinutes: number;
	evCashCumulative: number;
	sessionIndex: number;
	tournamentCumulative: number;
}

function pickXValue(
	xAxis: PnlGraphXAxis,
	sessionDateSec: number,
	sessionIndex: number,
	cumulativeMinutes: number
): number {
	if (xAxis === "sessionCount") {
		return sessionIndex;
	}
	if (xAxis === "playTime") {
		return cumulativeMinutes / 60;
	}
	return startOfDayMs(sessionDateSec);
}

function makeSinglePoint(
	x: number,
	cumulative: number,
	evCashCumulative: number,
	showEvCash: boolean
): AggregatedPoint {
	if (showEvCash) {
		return { x, cumulative, evCashCumulative };
	}
	return { x, cumulative };
}

function makeDualPoint(
	x: number,
	cashCumulative: number,
	tournamentCumulative: number,
	evCashCumulative: number,
	showEvCash: boolean
): AggregatedPoint {
	if (showEvCash) {
		return { x, cashCumulative, tournamentCumulative, evCashCumulative };
	}
	return { x, cashCumulative, tournamentCumulative };
}

function aggregateSingle(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis,
	series: SingleSeries,
	showEvCash: boolean,
	unit: PnlGraphUnit
): AggregateResult {
	const sorted = sortPoints(rawPoints);
	const acc: SingleAccumulator = {
		cumulative: 0,
		cumulativeMinutes: 0,
		evCashCumulative: 0,
		sessionIndex: 0,
	};
	const dayBuckets = new Map<number, AggregatedPoint>();
	const result: AggregatedPoint[] = [];
	let skippedCount = 0;

	for (const p of sorted) {
		const value = singleSeriesValue(p, series);
		const evDelta = showEvCash ? evCashValue(p, unit) : null;
		if (value === null && evDelta === null) {
			skippedCount++;
			continue;
		}
		if (value !== null) {
			acc.cumulative += value;
		}
		if (evDelta !== null) {
			acc.evCashCumulative += evDelta;
		}
		acc.sessionIndex++;
		acc.cumulativeMinutes += p.playMinutes ?? 0;
		const x = pickXValue(
			xAxis,
			p.sessionDate,
			acc.sessionIndex,
			acc.cumulativeMinutes
		);
		const point = makeSinglePoint(
			x,
			acc.cumulative,
			acc.evCashCumulative,
			showEvCash
		);
		if (xAxis === "date") {
			dayBuckets.set(x, point);
		} else {
			result.push(point);
		}
	}

	if (xAxis === "date") {
		const sortedDays = [...dayBuckets.entries()].sort((a, b) => a[0] - b[0]);
		for (const [, value] of sortedDays) {
			result.push(value);
		}
	}

	if (result.length > 0) {
		const firstDate = sorted[0]?.sessionDate ?? null;
		const oX = originX(xAxis, firstDate);
		result.unshift(makeSinglePoint(oX, 0, 0, showEvCash));
	}
	return { points: result, skippedCount };
}

interface DualDeltas {
	cashDelta: number | null;
	evDelta: number | null;
	tournamentDelta: number | null;
}

function dualDeltas(p: PnlSeriesPoint, showEvCash: boolean): DualDeltas {
	return {
		cashDelta: p.type === "cash_game" ? bbValue(p) : null,
		tournamentDelta: p.type === "tournament" ? biValue(p) : null,
		evDelta: showEvCash ? evCashValue(p, "normalized") : null,
	};
}

function applyDualDeltas(acc: DualAccumulator, deltas: DualDeltas) {
	if (deltas.cashDelta !== null) {
		acc.cashCumulative += deltas.cashDelta;
	}
	if (deltas.tournamentDelta !== null) {
		acc.tournamentCumulative += deltas.tournamentDelta;
	}
	if (deltas.evDelta !== null) {
		acc.evCashCumulative += deltas.evDelta;
	}
}

function aggregateDual(
	rawPoints: PnlSeriesPoint[],
	xAxis: PnlGraphXAxis,
	showEvCash: boolean
): AggregateResult {
	const sorted = sortPoints(rawPoints);
	const acc: DualAccumulator = {
		cashCumulative: 0,
		cumulativeMinutes: 0,
		evCashCumulative: 0,
		sessionIndex: 0,
		tournamentCumulative: 0,
	};
	const dayBuckets = new Map<number, AggregatedPoint>();
	const result: AggregatedPoint[] = [];
	let skippedCount = 0;

	for (const p of sorted) {
		const deltas = dualDeltas(p, showEvCash);
		if (
			deltas.cashDelta === null &&
			deltas.tournamentDelta === null &&
			deltas.evDelta === null
		) {
			skippedCount++;
			continue;
		}
		applyDualDeltas(acc, deltas);
		acc.sessionIndex++;
		acc.cumulativeMinutes += p.playMinutes ?? 0;
		const x = pickXValue(
			xAxis,
			p.sessionDate,
			acc.sessionIndex,
			acc.cumulativeMinutes
		);
		const point = makeDualPoint(
			x,
			acc.cashCumulative,
			acc.tournamentCumulative,
			acc.evCashCumulative,
			showEvCash
		);
		if (xAxis === "date") {
			dayBuckets.set(x, point);
		} else {
			result.push(point);
		}
	}

	if (xAxis === "date") {
		const sortedDays = [...dayBuckets.entries()].sort((a, b) => a[0] - b[0]);
		for (const [, value] of sortedDays) {
			result.push(value);
		}
	}

	if (result.length > 0) {
		const firstDate = sorted[0]?.sessionDate ?? null;
		const oX = originX(xAxis, firstDate);
		result.unshift(makeDualPoint(oX, 0, 0, 0, showEvCash));
	}
	return { points: result, skippedCount };
}

export function aggregatePnlPoints(options: AggregateOptions): AggregateResult {
	const { rawPoints, xAxis, unit, sessionType, showEvCash } = options;
	const evApplies =
		showEvCash && (unit === "currency" || sessionType !== "tournament");
	if (unit === "currency") {
		return aggregateSingle(rawPoints, xAxis, "currency", evApplies, "currency");
	}
	if (sessionType === "cash_game") {
		return aggregateSingle(rawPoints, xAxis, "bb", evApplies, "normalized");
	}
	if (sessionType === "tournament") {
		return aggregateSingle(rawPoints, xAxis, "bi", false, "normalized");
	}
	return aggregateDual(rawPoints, xAxis, evApplies);
}
