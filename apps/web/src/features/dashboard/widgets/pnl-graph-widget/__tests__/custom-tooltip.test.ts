import { describe, expect, it } from "vitest";
import { formatTooltipLabel } from "../custom-tooltip/custom-tooltip";

describe("formatTooltipLabel", () => {
	describe("date axis", () => {
		it("formats an epoch-ms value as YYYY-MM-DD", () => {
			expect(formatTooltipLabel(Date.UTC(2026, 5, 11), "date")).toBe(
				"2026-06-11"
			);
		});

		it("formats 0 as the epoch date", () => {
			expect(formatTooltipLabel(0, "date")).toBe("1970-01-01");
		});

		it("formats a pre-epoch (negative) timestamp", () => {
			expect(formatTooltipLabel(-86_400_000, "date")).toBe("1969-12-31");
		});
	});

	describe("playTime axis", () => {
		it("formats hours with one decimal and an h suffix", () => {
			expect(formatTooltipLabel(2.5, "playTime")).toBe("2.5 h");
		});

		it("formats 0 as '0.0 h'", () => {
			expect(formatTooltipLabel(0, "playTime")).toBe("0.0 h");
		});

		it("rounds to one decimal", () => {
			expect(formatTooltipLabel(10.04, "playTime")).toBe("10.0 h");
			expect(formatTooltipLabel(10.06, "playTime")).toBe("10.1 h");
		});

		it("keeps the sign for negative hours", () => {
			expect(formatTooltipLabel(-1.5, "playTime")).toBe("-1.5 h");
		});
	});

	describe("sessionCount axis (fallback)", () => {
		it("labels the value as a session number", () => {
			expect(formatTooltipLabel(3, "sessionCount")).toBe("Session 3");
		});

		it("formats 0 without special-casing", () => {
			expect(formatTooltipLabel(0, "sessionCount")).toBe("Session 0");
		});
	});
});
