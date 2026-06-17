import { describe, expect, it } from "vitest";
import {
	formatDateRangeLabel,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
} from "@/features/sessions/utils/session-filters-helpers";

describe("SESSION_TYPE_LABEL", () => {
	it("labels every type value", () => {
		expect(SESSION_TYPE_VALUES).toEqual(["all", "cash_game", "tournament"]);
		expect(SESSION_TYPE_LABEL.all).toBe("All");
		expect(SESSION_TYPE_LABEL.cash_game).toBe("Cash");
		expect(SESSION_TYPE_LABEL.tournament).toBe("Tournament");
	});
});

describe("formatDateRangeLabel", () => {
	it("joins both bounds with a tilde", () => {
		expect(formatDateRangeLabel("2026-04-01", "2026-04-30")).toBe(
			"2026-04-01 ~ 2026-04-30"
		);
	});

	it("renders an open-ended upper bound when only `from` is set", () => {
		expect(formatDateRangeLabel("2026-04-01", undefined)).toBe("2026-04-01 ~");
	});

	it("renders an open-ended lower bound when only `to` is set", () => {
		expect(formatDateRangeLabel(undefined, "2026-04-30")).toBe("~ 2026-04-30");
	});

	it("falls back to `All dates` when neither bound is set", () => {
		expect(formatDateRangeLabel(undefined, undefined)).toBe("All dates");
	});

	it("treats empty strings as unset", () => {
		expect(formatDateRangeLabel("", "")).toBe("All dates");
	});
});
