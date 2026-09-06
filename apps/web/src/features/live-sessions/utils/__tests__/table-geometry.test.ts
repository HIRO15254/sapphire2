import { describe, expect, it } from "vitest";
import {
	FELT_INSET_X_PERCENT,
	FELT_INSET_Y_PERCENT,
	SEAT_LAYOUT_MAX_SEATS,
	SEAT_LAYOUT_MIN_SEATS,
	seatLayout,
	seatLayoutCounts,
} from "@/features/live-sessions/utils/table-geometry";

const COUNTS = seatLayoutCounts();

describe("seatLayout", () => {
	it("covers every supported seat count with no gaps", () => {
		const expected: number[] = [];
		for (let n = SEAT_LAYOUT_MIN_SEATS; n <= SEAT_LAYOUT_MAX_SEATS; n++) {
			expected.push(n);
		}
		expect(COUNTS).toEqual(expected);
	});

	it.each(COUNTS)("places exactly %i markers", (count) => {
		expect(seatLayout(count)).toHaveLength(count);
	});

	it.each(
		COUNTS
	)("is mirror-symmetric about the table's axis (%i)", (count) => {
		const xs = seatLayout(count)
			.map((p) => p.x)
			.sort((a, b) => a - b);
		const mirrored = seatLayout(count)
			.map((p) => 100 - p.x)
			.sort((a, b) => a - b);
		expect(xs).toEqual(mirrored);
	});

	it.each(COUNTS)("keeps every marker on the felt (%i)", (count) => {
		for (const p of seatLayout(count)) {
			expect(p.x).toBeGreaterThanOrEqual(FELT_INSET_X_PERCENT);
			expect(p.x).toBeLessThanOrEqual(100 - FELT_INSET_X_PERCENT);
			expect(p.y).toBeGreaterThanOrEqual(FELT_INSET_Y_PERCENT);
			expect(p.y).toBeLessThanOrEqual(100 - FELT_INSET_Y_PERCENT);
		}
	});

	it.each(
		COUNTS.filter((n) => n > 2)
	)("leaves the bottom centre clear so the stack input stays readable (%i)", (count) => {
		const blocking = seatLayout(count).filter(
			(p) => p.y > 70 && Math.abs(p.x - 50) < 10
		);
		expect(blocking).toEqual([]);
	});

	it("seats heads-up across the table rather than around the rim", () => {
		expect(seatLayout(2)).toEqual([
			{ x: 50, y: 85.8 },
			{ x: 50, y: 14.2 },
		]);
	});

	it("reproduces the nine-seat reference layout from the design", () => {
		expect(seatLayout(9)).toEqual([
			{ x: 26, y: 85.8 },
			{ x: 14.5, y: 63 },
			{ x: 14.5, y: 35 },
			{ x: 31, y: 14.2 },
			{ x: 50, y: 14.2 },
			{ x: 69, y: 14.2 },
			{ x: 85.5, y: 35 },
			{ x: 85.5, y: 63 },
			{ x: 74, y: 85.8 },
		]);
	});

	it("falls back to the nine-seat layout for an unsupported count", () => {
		expect(seatLayout(11)).toEqual(seatLayout(9));
	});

	it("starts at the bottom left and runs up the left rail", () => {
		const [first, second] = seatLayout(9);
		expect(first?.y).toBeGreaterThan(second?.y ?? 0);
		expect(first?.x).toBeLessThan(50);
	});
});
