import { describe, expect, it } from "vitest";
import { computeCashEndPreview } from "@/features/live-sessions/utils/end-session-preview";

describe("computeCashEndPreview", () => {
	it("returns null when cashOut is null", () => {
		expect(
			computeCashEndPreview({
				cashOut: null,
				chipRemoveTotal: 0,
				evDiff: null,
				totalBuyIn: 0,
			})
		).toBeNull();
	});

	it("returns null when cashOut is NaN", () => {
		expect(
			computeCashEndPreview({
				cashOut: Number.NaN,
				chipRemoveTotal: 0,
				evDiff: null,
				totalBuyIn: 0,
			})
		).toBeNull();
	});

	it("computes a zero result when every input is zero", () => {
		expect(
			computeCashEndPreview({
				cashOut: 0,
				chipRemoveTotal: 0,
				evDiff: null,
				totalBuyIn: 0,
			})
		).toEqual({
			evResult: null,
			result: 0,
			totalBuyIn: 0,
			totalWithdrawn: 0,
		});
	});

	it("computes a positive result from the design reference values", () => {
		expect(
			computeCashEndPreview({
				cashOut: 51_800,
				chipRemoveTotal: 10_000,
				evDiff: -2728,
				totalBuyIn: 50_000,
			})
		).toEqual({
			evResult: 9072,
			result: 11_800,
			totalBuyIn: 50_000,
			totalWithdrawn: 10_000,
		});
	});

	it("computes a negative result when cash-out is less than total buy-in", () => {
		expect(
			computeCashEndPreview({
				cashOut: 5000,
				chipRemoveTotal: 0,
				evDiff: null,
				totalBuyIn: 20_000,
			})
		).toEqual({
			evResult: null,
			result: -15_000,
			totalBuyIn: 20_000,
			totalWithdrawn: 0,
		});
	});

	it("leaves evResult null when evDiff is null even with a non-zero result", () => {
		const preview = computeCashEndPreview({
			cashOut: 10_000,
			chipRemoveTotal: 500,
			evDiff: null,
			totalBuyIn: 8000,
		});
		expect(preview?.evResult).toBeNull();
	});

	it("computes a negative evResult when evDiff is negative enough to flip the sign", () => {
		expect(
			computeCashEndPreview({
				cashOut: 10_000,
				chipRemoveTotal: 0,
				evDiff: -12_000,
				totalBuyIn: 8000,
			})
		).toEqual({
			evResult: -10_000,
			result: 2000,
			totalBuyIn: 8000,
			totalWithdrawn: 0,
		});
	});

	it("computes a positive evResult when evDiff is positive", () => {
		expect(
			computeCashEndPreview({
				cashOut: 10_000,
				chipRemoveTotal: 0,
				evDiff: 500,
				totalBuyIn: 8000,
			})
		).toEqual({
			evResult: 2500,
			result: 2000,
			totalBuyIn: 8000,
			totalWithdrawn: 0,
		});
	});

	it("maps chipRemoveTotal directly to totalWithdrawn", () => {
		const preview = computeCashEndPreview({
			cashOut: 100,
			chipRemoveTotal: 4200,
			evDiff: null,
			totalBuyIn: 100,
		});
		expect(preview?.totalWithdrawn).toBe(4200);
	});

	it("handles a cashOut of exactly 0 as a valid value, not as missing", () => {
		expect(
			computeCashEndPreview({
				cashOut: 0,
				chipRemoveTotal: 0,
				evDiff: 0,
				totalBuyIn: 5000,
			})
		).toEqual({
			evResult: -5000,
			result: -5000,
			totalBuyIn: 5000,
			totalWithdrawn: 0,
		});
	});

	it("handles large values without overflow", () => {
		expect(
			computeCashEndPreview({
				cashOut: 10_000_000,
				chipRemoveTotal: 2_000_000,
				evDiff: -1_000_000,
				totalBuyIn: 8_000_000,
			})
		).toEqual({
			evResult: 3_000_000,
			result: 4_000_000,
			totalBuyIn: 8_000_000,
			totalWithdrawn: 2_000_000,
		});
	});
});
