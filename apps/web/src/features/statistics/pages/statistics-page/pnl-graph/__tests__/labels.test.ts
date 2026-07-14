import { describe, expect, it } from "vitest";
import { formatPnlAxisValue } from "@/features/statistics/pages/statistics-page/pnl-graph/labels";

describe("formatPnlAxisValue", () => {
	it("uses fixed-locale formatting below the compact threshold", () => {
		expect(formatPnlAxisValue(9999)).toBe("9,999");
	});

	it("uses shared compact notation at the 10k boundary", () => {
		expect(formatPnlAxisValue(10_000)).toBe("10k");
	});

	it("preserves the sign for negative compact values", () => {
		expect(formatPnlAxisValue(-12_500_000)).toBe("-12.5M");
	});
});
