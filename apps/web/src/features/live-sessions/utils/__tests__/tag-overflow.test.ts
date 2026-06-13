import { describe, expect, it } from "vitest";
import { computeVisibleTagCount } from "@/features/live-sessions/utils/tag-overflow";

describe("computeVisibleTagCount", () => {
	it("returns 0 when there are no tags", () => {
		expect(
			computeVisibleTagCount({
				availableWidth: 100,
				gap: 4,
				plusWidth: 20,
				tagWidths: [],
			})
		).toBe(0);
	});

	it("shows every tag when they all fit without a +N badge", () => {
		expect(
			computeVisibleTagCount({
				availableWidth: 100,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30, 30],
			})
		).toBe(3);
	});

	it("counts the gaps when deciding the full-fit case", () => {
		// 30 + 4 + 30 + 4 + 30 = 98 <= 100 → all fit
		expect(
			computeVisibleTagCount({
				availableWidth: 98,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30, 30],
			})
		).toBe(3);
		// One px tighter and the +N path engages.
		expect(
			computeVisibleTagCount({
				availableWidth: 97,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30, 30],
			})
		).toBeLessThan(3);
	});

	it("reserves room for the +N badge when overflowing", () => {
		// available 100, plus 20, gap 4.
		// tag0: 30 ; 30 + 4 + 20 = 54 <= 100 → fits
		// tag1: 30+4+30=64 ; 64 + 4 + 20 = 88 <= 100 → fits
		// tag2: 64+4+30=98 ; 98 + 4 + 20 = 122 > 100 → stop
		expect(
			computeVisibleTagCount({
				availableWidth: 100,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30, 30, 30],
			})
		).toBe(2);
	});

	it("shows zero tags (all collapse) when not even one fits beside +N", () => {
		expect(
			computeVisibleTagCount({
				availableWidth: 40,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30],
			})
		).toBe(0);
	});

	it("treats a zero available width as nothing fitting beside +N", () => {
		expect(
			computeVisibleTagCount({
				availableWidth: 0,
				gap: 4,
				plusWidth: 20,
				tagWidths: [10, 10],
			})
		).toBe(0);
	});
});
