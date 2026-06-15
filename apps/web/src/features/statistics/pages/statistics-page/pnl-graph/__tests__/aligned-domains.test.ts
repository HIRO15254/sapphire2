import { describe, expect, it } from "vitest";
import {
	alignedDualDomains,
	type ChartPoint,
	computeAlignedDomain,
} from "@/features/statistics/pages/statistics-page/pnl-graph/aligned-domains";

describe("computeAlignedDomain", () => {
	it("returns the symmetric fallback [-1, 1] when min and max are both zero", () => {
		expect(computeAlignedDomain(0, 0, 0)).toEqual([-1, 1]);
	});

	it("returns the symmetric fallback even when a non-zero negFrac is supplied for an all-zero range", () => {
		expect(computeAlignedDomain(0, 0, 0.5)).toEqual([-1, 1]);
	});

	it("pins the lower bound to zero when there is no negative fraction", () => {
		expect(computeAlignedDomain(0, 80, 0)).toEqual([0, 80]);
	});

	it("falls back the upper bound to 1 when negFrac is zero and max is zero", () => {
		expect(computeAlignedDomain(0, 0, 0)).toEqual([-1, 1]);
		expect(computeAlignedDomain(-5, 0, 0)).toEqual([0, 1]);
	});

	it("pins the upper bound to zero when the range is entirely negative (negFrac 1)", () => {
		expect(computeAlignedDomain(-40, 0, 1)).toEqual([-40, 0]);
	});

	it("falls back the lower bound to -1 when negFrac is one and min is zero", () => {
		expect(computeAlignedDomain(0, 0, 1)).toEqual([-1, 1]);
		expect(computeAlignedDomain(0, 10, 1)).toEqual([-1, 0]);
	});

	it("keeps the supplied min and extends the max when candidateMin is already below min", () => {
		// candidateMin = -(100 * 0.5) / 0.5 = -100, which is <= min (-20),
		// so the domain anchors on candidateMin and the provided max.
		expect(computeAlignedDomain(-20, 100, 0.5)).toEqual([-100, 100]);
	});

	it("computes candidateMin from negFrac and uses it when it sits at or below min", () => {
		// candidateMin ≈ -(50 * 0.8) / 0.2 = -200 (≈ min) -> [candidateMin, max].
		const [lo, hi] = computeAlignedDomain(-200, 50, 0.8);
		expect(lo).toBeCloseTo(-200, 5);
		expect(hi).toBe(50);
	});

	it("keeps the supplied min and shrinks toward a derived max when candidateMin exceeds min", () => {
		// candidateMin = -(100 * 0.2) / 0.8 = -25 > min (-50),
		// so newMax = -(-50 * 0.8) / 0.2 = 200 -> [min, newMax].
		expect(computeAlignedDomain(-50, 100, 0.2)).toEqual([-50, 200]);
	});
});

function chartPoint(
	overrides: Partial<ChartPoint> & { x: number }
): ChartPoint {
	return { ...overrides };
}

describe("alignedDualDomains", () => {
	it("returns symmetric unit domains for an empty point set", () => {
		expect(alignedDualDomains([])).toEqual({ bb: [-1, 1], bi: [-1, 1] });
	});

	it("scans the cash cumulative series for the bb axis bounds", () => {
		const points = [
			chartPoint({ x: 0, cashCumulative: 0 }),
			chartPoint({ x: 1, cashCumulative: 120 }),
			chartPoint({ x: 2, cashCumulative: 40 }),
		];
		const { bb } = alignedDualDomains(points);
		// All-positive cash -> negFrac 0 across both axes -> [0, max].
		expect(bb).toEqual([0, 120]);
	});

	it("includes the ev cash series when scanning the bb axis", () => {
		const points = [
			chartPoint({ x: 0, cashCumulative: 0, evCashCumulative: 0 }),
			chartPoint({ x: 1, cashCumulative: 50, evCashCumulative: -30 }),
		];
		const { bb } = alignedDualDomains(points);
		// bbMin = -30, bbMax = 50; bi has no data so negFrac comes from bb.
		expect(bb[0]).toBeLessThan(0);
		expect(bb[1]).toBe(50);
	});

	it("scans the tournament cumulative series for the bi axis bounds", () => {
		const points = [
			chartPoint({ x: 0, tournamentCumulative: 0 }),
			chartPoint({ x: 1, tournamentCumulative: -10 }),
			chartPoint({ x: 2, tournamentCumulative: 30 }),
		];
		const { bi } = alignedDualDomains(points);
		expect(bi[0]).toBeLessThanOrEqual(-10);
		expect(bi[1]).toBeGreaterThanOrEqual(30);
	});

	it("shares the larger negative fraction across both axes so zero lines align", () => {
		const points = [
			// cash: min -10, max 90 -> negFrac 0.1
			chartPoint({ x: 0, cashCumulative: -10, tournamentCumulative: -50 }),
			// tournament: min -50, max 50 -> negFrac 0.5 (the larger one)
			chartPoint({ x: 1, cashCumulative: 90, tournamentCumulative: 50 }),
		];
		const { bb, bi } = alignedDualDomains(points);
		// Shared negFrac 0.5: the zero line sits at the same relative height.
		const bbZeroFrac = -bb[0] / (bb[1] - bb[0]);
		const biZeroFrac = -bi[0] / (bi[1] - bi[0]);
		expect(bbZeroFrac).toBeCloseTo(biZeroFrac, 5);
		expect(biZeroFrac).toBeCloseTo(0.5, 5);
	});

	it("treats a flat all-zero series as the symmetric unit fallback", () => {
		// bbMin/bbMax and biMin/biMax all collapse to 0, so each axis hits the
		// both-zero branch and falls back to [-1, 1] rather than dividing by zero.
		const points = [
			chartPoint({ x: 0, cashCumulative: 0 }),
			chartPoint({ x: 1, cashCumulative: 0 }),
		];
		const { bb, bi } = alignedDualDomains(points);
		expect(bb).toEqual([-1, 1]);
		expect(bi).toEqual([-1, 1]);
	});

	it("ignores non-numeric series values when scanning", () => {
		const points = [
			chartPoint({ x: 0 }),
			chartPoint({ x: 1, cashCumulative: 75 }),
		];
		const { bb } = alignedDualDomains(points);
		expect(bb).toEqual([0, 75]);
	});
});
