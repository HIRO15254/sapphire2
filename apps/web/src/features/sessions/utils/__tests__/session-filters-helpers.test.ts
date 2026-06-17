import { describe, expect, it } from "vitest";
import {
	SESSION_PERIOD_LABEL,
	SESSION_PERIODS,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
} from "@/features/sessions/utils/session-filters-helpers";
import { STATS_PERIOD_LABEL } from "@/features/statistics/utils/labels";
import { STATS_PERIODS } from "@/features/statistics/utils/stats-filters";

describe("SESSION_TYPE_LABEL", () => {
	it("labels every type value", () => {
		expect(SESSION_TYPE_VALUES).toEqual(["all", "cash_game", "tournament"]);
		expect(SESSION_TYPE_LABEL.all).toBe("All");
		expect(SESSION_TYPE_LABEL.cash_game).toBe("Cash");
		expect(SESSION_TYPE_LABEL.tournament).toBe("Tournament");
	});
});

describe("session Period domain", () => {
	it("reuses the statistics period presets and labels verbatim", () => {
		expect(SESSION_PERIODS).toBe(STATS_PERIODS);
		expect(SESSION_PERIOD_LABEL).toBe(STATS_PERIOD_LABEL);
	});

	it("exposes a label for every preset", () => {
		for (const period of SESSION_PERIODS) {
			expect(SESSION_PERIOD_LABEL[period]).toBeTruthy();
		}
	});
});
