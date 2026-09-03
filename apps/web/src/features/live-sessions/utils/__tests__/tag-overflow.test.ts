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
		expect(
			computeVisibleTagCount({
				availableWidth: 98,
				gap: 4,
				plusWidth: 20,
				tagWidths: [30, 30, 30],
			})
		).toBe(3);
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
