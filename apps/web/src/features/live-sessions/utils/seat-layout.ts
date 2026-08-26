const MIN_SEAT_COUNT = 2;
const MAX_SEAT_COUNT = 10;
const CENTER_PCT = 50;
const X_RADIUS_PCT = 35.5;
const Y_RADIUS_PCT = 35.8;
const DEGREES_PER_CIRCLE = 360;
const START_OFFSET_DEGREES = 90;

export interface SeatLayoutPoint {
	leftPct: number;
	topPct: number;
}

function clampSeatCount(count: number): number {
	if (count < MIN_SEAT_COUNT) {
		return MIN_SEAT_COUNT;
	}
	if (count > MAX_SEAT_COUNT) {
		return MAX_SEAT_COUNT;
	}
	return count;
}

function roundTo1Decimal(value: number): number {
	const rounded = Math.round(value * 10) / 10;
	return rounded === 0 ? 0 : rounded;
}

export function seatLayout(count: number): SeatLayoutPoint[] {
	const seatCount = clampSeatCount(count);
	const points: SeatLayoutPoint[] = [];

	for (let i = 0; i < seatCount; i++) {
		const angleDegrees =
			START_OFFSET_DEGREES + (i + 0.5) * (DEGREES_PER_CIRCLE / seatCount);
		const angleRadians = (angleDegrees * Math.PI) / 180;

		points.push({
			leftPct: roundTo1Decimal(
				CENTER_PCT + X_RADIUS_PCT * Math.cos(angleRadians)
			),
			topPct: roundTo1Decimal(
				CENTER_PCT + Y_RADIUS_PCT * Math.sin(angleRadians)
			),
		});
	}

	return points;
}
