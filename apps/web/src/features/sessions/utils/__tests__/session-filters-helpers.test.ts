import { describe, expect, it } from "vitest";
import {
	SESSION_DISPLAY_LABEL,
	SESSION_DISPLAY_VALUES,
	SESSION_PERIOD_LABEL,
	SESSION_PERIODS,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
} from "@/features/sessions/utils/session-filters-helpers";
import { PERIOD_LABEL, PERIODS } from "@/shared/lib/period-filter";

describe("SESSION_TYPE_LABEL", () => {
	it("labels every type value", () => {
		expect(SESSION_TYPE_VALUES).toEqual(["all", "cash_game", "tournament"]);
		expect(SESSION_TYPE_LABEL.all).toBe("All");
		expect(SESSION_TYPE_LABEL.cash_game).toBe("Cash");
		expect(SESSION_TYPE_LABEL.tournament).toBe("Tournament");
	});
});

describe("session Period domain", () => {
	it("reuses the shared period presets and labels verbatim", () => {
		expect(SESSION_PERIODS).toBe(PERIODS);
		expect(SESSION_PERIOD_LABEL).toBe(PERIOD_LABEL);
	});

	it("exposes a label for every preset", () => {
		for (const period of SESSION_PERIODS) {
			expect(SESSION_PERIOD_LABEL[period]).toBeTruthy();
		}
	});
});

describe("SESSION_DISPLAY_LABEL", () => {
	it("labels both display modes with the same wording the chip uses", () => {
		expect(SESSION_DISPLAY_VALUES).toEqual(["currency", "normalized"]);
		expect(SESSION_DISPLAY_LABEL.currency).toBe("Currency");
		expect(SESSION_DISPLAY_LABEL.normalized).toBe("BB / BI");
	});
});
