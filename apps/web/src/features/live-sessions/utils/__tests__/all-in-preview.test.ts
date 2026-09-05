import { describe, expect, it } from "vitest";
import { computeAllInPreview } from "@/features/live-sessions/utils/all-in-preview";

describe("computeAllInPreview", () => {
	it("computes expected, realized and evDelta for the demo case with 0 wins", () => {
		const result = computeAllInPreview({
			potSize: 12_400,
			equity: 78,
			trials: 1,
			wins: 0,
		});
		expect(result).toEqual({
			expectedValue: 9672,
			realizedValue: 0,
			evDelta: 9672,
		});
	});

	it("computes expected, realized and evDelta for the demo case with 1 win", () => {
		const result = computeAllInPreview({
			potSize: 12_400,
			equity: 78,
			trials: 1,
			wins: 1,
		});
		expect(result).toEqual({
			expectedValue: 9672,
			realizedValue: 12_400,
			evDelta: -2728,
		});
	});

	it("accepts equity at the lower boundary of 0", () => {
		const result = computeAllInPreview({
			potSize: 1000,
			equity: 0,
			trials: 2,
			wins: 1,
		});
		expect(result).toEqual({
			expectedValue: 0,
			realizedValue: 500,
			evDelta: -500,
		});
	});

	it("accepts equity at the upper boundary of 100", () => {
		const result = computeAllInPreview({
			potSize: 1000,
			equity: 100,
			trials: 2,
			wins: 1,
		});
		expect(result).toEqual({
			expectedValue: 1000,
			realizedValue: 500,
			evDelta: 500,
		});
	});

	it("accepts wins equal to trials (upper boundary)", () => {
		const result = computeAllInPreview({
			potSize: 900,
			equity: 40,
			trials: 3,
			wins: 3,
		});
		expect(result).toEqual({
			expectedValue: 360,
			realizedValue: 900,
			evDelta: -540,
		});
	});

	it("accepts fractional wins for a chopped pot", () => {
		const result = computeAllInPreview({
			potSize: 1000,
			equity: 50,
			trials: 2,
			wins: 0.5,
		});
		expect(result).toEqual({
			expectedValue: 500,
			realizedValue: 250,
			evDelta: 250,
		});
	});

	it("returns null when trials is 0", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: 50, trials: 0, wins: 0 })
		).toBeNull();
	});

	it("returns null when trials is negative", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: 50, trials: -1, wins: 0 })
		).toBeNull();
	});

	it("returns null when wins is negative", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: 50, trials: 2, wins: -1 })
		).toBeNull();
	});

	it("returns null when wins exceeds trials", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: 50, trials: 1, wins: 2 })
		).toBeNull();
	});

	it("returns null when equity is below 0", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: -1, trials: 1, wins: 0 })
		).toBeNull();
	});

	it("returns null when equity is above 100", () => {
		expect(
			computeAllInPreview({ potSize: 1000, equity: 101, trials: 1, wins: 0 })
		).toBeNull();
	});

	it("returns null when potSize is negative", () => {
		expect(
			computeAllInPreview({ potSize: -1, equity: 50, trials: 1, wins: 0 })
		).toBeNull();
	});

	it("returns null when potSize is NaN", () => {
		expect(
			computeAllInPreview({
				potSize: Number.NaN,
				equity: 50,
				trials: 1,
				wins: 0,
			})
		).toBeNull();
	});

	it("returns null when equity is NaN", () => {
		expect(
			computeAllInPreview({
				potSize: 1000,
				equity: Number.NaN,
				trials: 1,
				wins: 0,
			})
		).toBeNull();
	});

	it("returns null when trials is NaN", () => {
		expect(
			computeAllInPreview({
				potSize: 1000,
				equity: 50,
				trials: Number.NaN,
				wins: 0,
			})
		).toBeNull();
	});

	it("returns null when wins is NaN", () => {
		expect(
			computeAllInPreview({
				potSize: 1000,
				equity: 50,
				trials: 1,
				wins: Number.NaN,
			})
		).toBeNull();
	});

	it("returns null when potSize is Infinity", () => {
		expect(
			computeAllInPreview({
				potSize: Number.POSITIVE_INFINITY,
				equity: 50,
				trials: 1,
				wins: 0,
			})
		).toBeNull();
	});

	it("returns 0 evDelta when expected exactly matches realized", () => {
		const result = computeAllInPreview({
			potSize: 1000,
			equity: 50,
			trials: 1,
			wins: 0.5,
		});
		expect(result).toEqual({
			expectedValue: 500,
			realizedValue: 500,
			evDelta: 0,
		});
	});

	it("handles a large pot size", () => {
		const result = computeAllInPreview({
			potSize: 10_000_000,
			equity: 33,
			trials: 4,
			wins: 1,
		});
		expect(result).toEqual({
			expectedValue: 3_300_000,
			realizedValue: 2_500_000,
			evDelta: 800_000,
		});
	});
});
