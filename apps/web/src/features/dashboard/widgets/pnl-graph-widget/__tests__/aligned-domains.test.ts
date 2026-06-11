import { describe, expect, it } from "vitest";
import {
	alignedDualDomains,
	type ChartPoint,
	computeAlignedDomain,
} from "../aligned-domains";

describe("computeAlignedDomain", () => {
	describe("both-zero input", () => {
		it("returns the [-1, 1] placeholder when min and max are both 0", () => {
			expect(computeAlignedDomain(0, 0, 0)).toEqual([-1, 1]);
		});

		it("takes precedence over the negFrac branches", () => {
			expect(computeAlignedDomain(0, 0, 0.5)).toEqual([-1, 1]);
			expect(computeAlignedDomain(0, 0, 1)).toEqual([-1, 1]);
		});
	});

	describe("negFrac === 0 (all positive)", () => {
		it("anchors the domain at 0 and keeps max", () => {
			expect(computeAlignedDomain(0, 10, 0)).toEqual([0, 10]);
		});

		it("falls back to 1 when max is 0 (max || 1)", () => {
			expect(computeAlignedDomain(-5, 0, 0)).toEqual([0, 1]);
		});

		it("keeps a fractional max", () => {
			expect(computeAlignedDomain(0, 0.5, 0)).toEqual([0, 0.5]);
		});
	});

	describe("negFrac === 1 (all negative)", () => {
		it("anchors the domain at 0 and keeps min", () => {
			expect(computeAlignedDomain(-10, 0, 1)).toEqual([-10, 0]);
		});

		it("falls back to -1 when min is 0 (min || -1)", () => {
			expect(computeAlignedDomain(0, 10, 1)).toEqual([-1, 0]);
		});
	});

	describe("mixed sign (0 < negFrac < 1)", () => {
		it("extends min when the candidate reaches below it (candidateMin < min)", () => {
			// candidateMin = (-10 * 0.5) / 0.5 = -10 <= -5 → extend min.
			expect(computeAlignedDomain(-5, 10, 0.5)).toEqual([-10, 10]);
		});

		it("keeps the domain unchanged when the candidate equals min (boundary)", () => {
			// candidateMin = (-10 * 0.5) / 0.5 = -10 === min → keep as-is.
			expect(computeAlignedDomain(-10, 10, 0.5)).toEqual([-10, 10]);
		});

		it("extends max when the candidate min would clip data (else branch)", () => {
			// candidateMin = (-10 * 0.5) / 0.5 = -10 > -20 → extend max instead:
			// newMax = (20 * 0.5) / 0.5 = 20.
			expect(computeAlignedDomain(-20, 10, 0.5)).toEqual([-20, 20]);
		});

		it("honors an asymmetric negFrac when extending max", () => {
			// candidateMin = (-10 * 0.2) / 0.8 = -2.5 > -10 →
			// newMax = (10 * 0.8) / 0.2 = 40.
			expect(computeAlignedDomain(-10, 10, 0.2)).toEqual([-10, 40]);
		});
	});

	describe("non-finite negFrac (documented current behavior)", () => {
		it("propagates NaN into the max bound via the else branch", () => {
			// NaN fails every equality / comparison, so the else branch runs
			// and newMax = (5 * (1 - NaN)) / NaN = NaN.
			expect(computeAlignedDomain(-5, 10, Number.NaN)).toEqual([
				-5,
				Number.NaN,
			]);
		});
	});
});

describe("alignedDualDomains", () => {
	it("returns [-1, 1] placeholders for both axes on empty input", () => {
		expect(alignedDualDomains([])).toEqual({ bb: [-1, 1], bi: [-1, 1] });
	});

	it("returns [-1, 1] placeholders when no point carries numeric values", () => {
		const points: ChartPoint[] = [{ x: 0 }, { x: 1, cumulative: 5 }];
		// `cumulative` is not scanned — only cash / evCash / tournament are.
		expect(alignedDualDomains(points)).toEqual({ bb: [-1, 1], bi: [-1, 1] });
	});

	it("anchors both domains at 0 when all values are positive", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: 5, tournamentCumulative: 2 },
			{ x: 1, cashCumulative: 10, tournamentCumulative: 4 },
		];
		expect(alignedDualDomains(points)).toEqual({ bb: [0, 10], bi: [0, 4] });
	});

	it("anchors both domains at 0 when all values are negative", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: -10, tournamentCumulative: -4 },
		];
		expect(alignedDualDomains(points)).toEqual({ bb: [-10, 0], bi: [-4, 0] });
	});

	it("aligns the zero line by extending the all-positive axis below 0", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: -10, tournamentCumulative: 0 },
			{ x: 1, cashCumulative: 10, tournamentCumulative: 10 },
		];
		// bb negFrac = 0.5 drives both: bi gets pulled down to -10.
		expect(alignedDualDomains(points)).toEqual({
			bb: [-10, 10],
			bi: [-10, 10],
		});
	});

	it("includes evCashCumulative in the bb scan", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: 1, evCashCumulative: -3 },
			{ x: 1, cashCumulative: 6, evCashCumulative: 2 },
		];
		// bb min/max = -3/6 from the union of cash and evCash.
		expect(alignedDualDomains(points)).toEqual({ bb: [-3, 6], bi: [-1, 1] });
	});

	it("keeps the [-1, 1] placeholder for an axis with no data while the other has values", () => {
		const points: ChartPoint[] = [{ x: 0, tournamentCumulative: -4 }];
		expect(alignedDualDomains(points)).toEqual({ bb: [-1, 1], bi: [-4, 0] });
	});

	it("skips points whose value fields are undefined", () => {
		const points: ChartPoint[] = [
			{ x: 0 },
			{ x: 1, cashCumulative: 3 },
			{ x: 2 },
		];
		expect(alignedDualDomains(points)).toEqual({ bb: [0, 3], bi: [-1, 1] });
	});

	it("clips an all-positive axis to [-1, 0] when the other axis is fully negative (documented current behavior)", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: 10, tournamentCumulative: -5 },
		];
		// negFrac = max(0, 1) = 1, so the bb branch returns [min || -1, 0]
		// and the positive cash data falls outside its own domain.
		expect(alignedDualDomains(points)).toEqual({ bb: [-1, 0], bi: [-5, 0] });
	});

	it("propagates Infinity as an open-ended max", () => {
		const points: ChartPoint[] = [
			{ x: 0, cashCumulative: Number.POSITIVE_INFINITY },
		];
		// negFrac = -0 / Infinity = 0 → bb anchors at 0 with an Infinite max.
		expect(alignedDualDomains(points)).toEqual({
			bb: [0, Number.POSITIVE_INFINITY],
			bi: [-1, 1],
		});
	});

	it("propagates NaN values into the affected domain only (documented current behavior)", () => {
		const points: ChartPoint[] = [{ x: 0, cashCumulative: Number.NaN }];
		// typeof NaN === "number", so NaN poisons the bb scan; bi stays at
		// its both-zero placeholder.
		expect(alignedDualDomains(points)).toEqual({
			bb: [Number.NaN, Number.NaN],
			bi: [-1, 1],
		});
	});
});
