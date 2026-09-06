export interface SeatPoint {
	x: number;
	y: number;
}

const point = (x: number, y: number): SeatPoint => ({ x, y });

export const SEAT_LAYOUT_MIN_SEATS = 2;
export const SEAT_LAYOUT_MAX_SEATS = 10;

export const FELT_INSET_X_PERCENT = 14.5;
export const FELT_INSET_Y_PERCENT = 14.2;

const SEAT_LAYOUTS: Record<number, SeatPoint[]> = {
	2: [point(50, 85.8), point(50, 14.2)],
	3: [point(26, 85.8), point(50, 14.2), point(74, 85.8)],
	4: [point(26, 85.8), point(31, 14.2), point(69, 14.2), point(74, 85.8)],
	5: [
		point(26, 85.8),
		point(14.5, 49),
		point(50, 14.2),
		point(85.5, 49),
		point(74, 85.8),
	],
	6: [
		point(26, 85.8),
		point(14.5, 49),
		point(31, 14.2),
		point(69, 14.2),
		point(85.5, 49),
		point(74, 85.8),
	],
	7: [
		point(26, 85.8),
		point(14.5, 63),
		point(14.5, 35),
		point(50, 14.2),
		point(85.5, 35),
		point(85.5, 63),
		point(74, 85.8),
	],
	8: [
		point(26, 85.8),
		point(14.5, 63),
		point(14.5, 35),
		point(38, 14.2),
		point(62, 14.2),
		point(85.5, 35),
		point(85.5, 63),
		point(74, 85.8),
	],
	9: [
		point(26, 85.8),
		point(14.5, 63),
		point(14.5, 35),
		point(31, 14.2),
		point(50, 14.2),
		point(69, 14.2),
		point(85.5, 35),
		point(85.5, 63),
		point(74, 85.8),
	],
	10: [
		point(26, 85.8),
		point(14.5, 70),
		point(14.5, 49),
		point(20, 27),
		point(38, 14.2),
		point(62, 14.2),
		point(80, 27),
		point(85.5, 49),
		point(85.5, 70),
		point(74, 85.8),
	],
};

export function seatLayout(seatCount: number): SeatPoint[] {
	return SEAT_LAYOUTS[seatCount] ?? SEAT_LAYOUTS[9] ?? [];
}

export function seatLayoutCounts(): number[] {
	return Object.keys(SEAT_LAYOUTS)
		.map(Number)
		.sort((a, b) => a - b);
}
