import { describe, expect, it } from "vitest";
import {
	type SeatLayoutPoint,
	seatLayout,
} from "@/features/live-sessions/utils/seat-layout";

const ALLOWED_Y_BANDS = [14.2, 35, 63, 85.8];
const MIN_X_RAIL = 14.5;
const MAX_X_RAIL = 85.5;
const MIRROR_CENTER = 100;

function assertMirroredWithinBands(points: SeatLayoutPoint[]) {
	const byBand = new Map<number, number[]>();
	for (const point of points) {
		const bucket = byBand.get(point.topPct) ?? [];
		bucket.push(point.leftPct);
		byBand.set(point.topPct, bucket);
	}
	for (const leftValues of byBand.values()) {
		for (const left of leftValues) {
			expect(leftValues).toContain(MIRROR_CENTER - left);
		}
	}
}

describe("seatLayout", () => {
	it("returns the demo's exact 9-max seat array in demo order", () => {
		expect(seatLayout(9)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 14.5, topPct: 63 },
			{ leftPct: 14.5, topPct: 35 },
			{ leftPct: 31, topPct: 14.2 },
			{ leftPct: 50, topPct: 14.2 },
			{ leftPct: 69, topPct: 14.2 },
			{ leftPct: 85.5, topPct: 35 },
			{ leftPct: 85.5, topPct: 63 },
			{ leftPct: 74, topPct: 85.8 },
		]);
	});

	it("returns the 2-max seat array (bottom pair only)", () => {
		expect(seatLayout(2)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 74, topPct: 85.8 },
		]);
	});

	it("returns the 4-max seat array (bottom + top pairs)", () => {
		expect(seatLayout(4)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 31, topPct: 14.2 },
			{ leftPct: 69, topPct: 14.2 },
			{ leftPct: 74, topPct: 85.8 },
		]);
	});

	it("returns the 6-max seat array (bottom + top + lower-side pairs)", () => {
		expect(seatLayout(6)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 14.5, topPct: 63 },
			{ leftPct: 31, topPct: 14.2 },
			{ leftPct: 69, topPct: 14.2 },
			{ leftPct: 85.5, topPct: 63 },
			{ leftPct: 74, topPct: 85.8 },
		]);
	});

	it("returns the 8-max seat array (all four pairs, no center seat)", () => {
		expect(seatLayout(8)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 14.5, topPct: 63 },
			{ leftPct: 14.5, topPct: 35 },
			{ leftPct: 31, topPct: 14.2 },
			{ leftPct: 69, topPct: 14.2 },
			{ leftPct: 85.5, topPct: 35 },
			{ leftPct: 85.5, topPct: 63 },
			{ leftPct: 74, topPct: 85.8 },
		]);
	});

	it("returns the 10-max seat array (9-max plus a mirrored bottom-center seat)", () => {
		expect(seatLayout(10)).toEqual([
			{ leftPct: 26, topPct: 85.8 },
			{ leftPct: 14.5, topPct: 63 },
			{ leftPct: 14.5, topPct: 35 },
			{ leftPct: 31, topPct: 14.2 },
			{ leftPct: 50, topPct: 14.2 },
			{ leftPct: 69, topPct: 14.2 },
			{ leftPct: 85.5, topPct: 35 },
			{ leftPct: 85.5, topPct: 63 },
			{ leftPct: 74, topPct: 85.8 },
			{ leftPct: 50, topPct: 85.8 },
		]);
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("returns %i points for count=%i", (count) => {
		expect(seatLayout(count)).toHaveLength(count);
	});

	it("clamps a count below the minimum up to 2 seats", () => {
		expect(seatLayout(1)).toHaveLength(2);
	});

	it("clamps a count of 0 up to 2 seats", () => {
		expect(seatLayout(0)).toHaveLength(2);
	});

	it("clamps a negative count up to 2 seats", () => {
		expect(seatLayout(-5)).toHaveLength(2);
	});

	it("clamps a count above the maximum down to 10 seats", () => {
		expect(seatLayout(11)).toHaveLength(10);
	});

	it("clamps a very large count down to 10 seats", () => {
		expect(seatLayout(20)).toHaveLength(10);
	});

	it("does not clamp the minimum boundary value of 2", () => {
		expect(seatLayout(2)).toHaveLength(2);
	});

	it("does not clamp the maximum boundary value of 10", () => {
		expect(seatLayout(10)).toHaveLength(10);
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("only ever places seats on one of the four fixed y-bands for count=%i", (count) => {
		for (const point of seatLayout(count)) {
			expect(ALLOWED_Y_BANDS).toContain(point.topPct);
		}
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("keeps every leftPct within the demo's x rail range for count=%i", (count) => {
		for (const point of seatLayout(count)) {
			expect(point.leftPct).toBeGreaterThanOrEqual(MIN_X_RAIL);
			expect(point.leftPct).toBeLessThanOrEqual(MAX_X_RAIL);
		}
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("mirrors every seat's leftPct within its own y-band for count=%i", (count) => {
		assertMirroredWithinBands(seatLayout(count));
	});

	it.each([
		2, 3, 4, 5, 6, 7, 8, 9, 10,
	])("always starts the ring at the bottom-left seat for count=%i", (count) => {
		const [first] = seatLayout(count);
		expect(first).toEqual({ leftPct: 26, topPct: 85.8 });
	});

	it("places seat 4 at the top-center for a 9-seat table", () => {
		const points = seatLayout(9);
		expect(points[4]).toEqual({ leftPct: 50, topPct: 14.2 });
	});

	it("never distributes seats on an even ellipse (side-band leftPct stays pinned to the rails)", () => {
		for (const point of seatLayout(9)) {
			const isSideBand = point.topPct === 35 || point.topPct === 63;
			if (isSideBand) {
				expect([MIN_X_RAIL, MAX_X_RAIL]).toContain(point.leftPct);
			}
		}
	});
});
