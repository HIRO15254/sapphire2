import { describe, expect, it } from "vitest";
import { seatLayout } from "@/features/live-sessions/utils/seat-layout";

describe("seatLayout", () => {
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
		2, 3, 5, 7, 9, 10,
	])("keeps every point within [10, 90] for count=%i", (count) => {
		for (const point of seatLayout(count)) {
			expect(point.leftPct).toBeGreaterThanOrEqual(10);
			expect(point.leftPct).toBeLessThanOrEqual(90);
			expect(point.topPct).toBeGreaterThanOrEqual(10);
			expect(point.topPct).toBeLessThanOrEqual(90);
		}
	});

	it("places seat 0 in the bottom-left quadrant for a 9-seat table", () => {
		const [seat0] = seatLayout(9);
		expect(seat0.leftPct).toBeLessThan(50);
		expect(seat0.topPct).toBeGreaterThan(50);
	});

	it("places seat 4 near the top-center for a 9-seat table", () => {
		const points = seatLayout(9);
		const seat4 = points[4];
		expect(seat4.topPct).toBeLessThan(30);
		expect(seat4.leftPct).toBeGreaterThan(45);
		expect(seat4.leftPct).toBeLessThan(55);
	});

	it("mirrors leftPct across the vertical axis for a 9-seat table", () => {
		const points = seatLayout(9);
		for (let i = 0; i < points.length; i++) {
			const mirroredPoint = points.at(-(i + 1));
			const mirrored = points[i].leftPct + (mirroredPoint?.leftPct ?? 0);
			expect(mirrored).toBeGreaterThanOrEqual(99.7);
			expect(mirrored).toBeLessThanOrEqual(100.3);
		}
	});

	it("mirrors leftPct across the vertical axis for a 10-seat table", () => {
		const points = seatLayout(10);
		for (let i = 0; i < points.length; i++) {
			const mirroredPoint = points.at(-(i + 1));
			const mirrored = points[i].leftPct + (mirroredPoint?.leftPct ?? 0);
			expect(mirrored).toBeGreaterThanOrEqual(99.7);
			expect(mirrored).toBeLessThanOrEqual(100.3);
		}
	});

	it("rounds coordinates to 1 decimal place", () => {
		for (const point of seatLayout(7)) {
			expect(point.leftPct).toBe(Math.round(point.leftPct * 10) / 10);
			expect(point.topPct).toBe(Math.round(point.topPct * 10) / 10);
		}
	});
});
