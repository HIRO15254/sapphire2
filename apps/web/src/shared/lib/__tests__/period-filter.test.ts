import { describe, expect, it } from "vitest";
import {
	dateInputToEpochSec,
	epochSecToDateInput,
	PERIOD_LABEL,
	PERIODS,
	resolveDateRange,
} from "@/shared/lib/period-filter";

// 2026-06-12T08:30:00Z
const NOW_SEC = Math.floor(Date.UTC(2026, 5, 12, 8, 30, 0) / 1000);
const START_OF_DAY = Math.floor(Date.UTC(2026, 5, 12) / 1000);
const DAY = 86_400;

describe("PERIODS / PERIOD_LABEL", () => {
	it("enumerates every preset window plus custom", () => {
		expect(PERIODS).toEqual(["7d", "30d", "90d", "ytd", "all", "custom"]);
	});

	it("exposes a non-empty label for every period", () => {
		for (const period of PERIODS) {
			expect(PERIOD_LABEL[period]).toBeTruthy();
		}
	});
});

describe("resolveDateRange", () => {
	it("returns an empty window for the 'all' period", () => {
		expect(resolveDateRange({ period: "all" }, NOW_SEC)).toEqual({});
	});

	it("snaps the 7d window to [start of UTC day minus 7 days, end of today]", () => {
		expect(resolveDateRange({ period: "7d" }, NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 7 * DAY,
			dateTo: START_OF_DAY + DAY,
		});
	});

	it("snaps the 30d window with an end-of-today upper bound", () => {
		expect(resolveDateRange({ period: "30d" }, NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 30 * DAY,
			dateTo: START_OF_DAY + DAY,
		});
	});

	it("snaps the 90d window with an end-of-today upper bound", () => {
		expect(resolveDateRange({ period: "90d" }, NOW_SEC)).toEqual({
			dateFrom: START_OF_DAY - 90 * DAY,
			dateTo: START_OF_DAY + DAY,
		});
	});

	it("uses Jan 1 (UTC) of the current year for ytd, capped at end of today", () => {
		expect(resolveDateRange({ period: "ytd" }, NOW_SEC)).toEqual({
			dateFrom: Math.floor(Date.UTC(2026, 0, 1) / 1000),
			dateTo: START_OF_DAY + DAY,
		});
	});

	it("passes through both custom bounds when present", () => {
		expect(
			resolveDateRange({ period: "custom", from: 111, to: 222 }, NOW_SEC)
		).toEqual({ dateFrom: 111, dateTo: 222 });
	});

	it("omits a missing custom bound", () => {
		expect(resolveDateRange({ period: "custom", from: 111 }, NOW_SEC)).toEqual({
			dateFrom: 111,
		});
		expect(resolveDateRange({ period: "custom", to: 222 }, NOW_SEC)).toEqual({
			dateTo: 222,
		});
	});

	it("returns an empty window for a custom period with no bounds", () => {
		expect(resolveDateRange({ period: "custom" }, NOW_SEC)).toEqual({});
	});
});

describe("dateInputToEpochSec", () => {
	it("converts a date string to start-of-day UTC seconds", () => {
		expect(dateInputToEpochSec("2026-06-12")).toBe(
			Math.floor(Date.UTC(2026, 5, 12, 0, 0, 0) / 1000)
		);
	});

	it("snaps to end-of-day UTC when endOfDay is set", () => {
		expect(dateInputToEpochSec("2026-06-12", true)).toBe(
			Math.floor(Date.UTC(2026, 5, 12, 23, 59, 59) / 1000)
		);
	});

	it("returns undefined for an empty or malformed value", () => {
		expect(dateInputToEpochSec("")).toBeUndefined();
		expect(dateInputToEpochSec("2026/06/12")).toBeUndefined();
		expect(dateInputToEpochSec("not-a-date")).toBeUndefined();
	});
});

describe("epochSecToDateInput", () => {
	it("formats seconds back to yyyy-mm-dd (UTC)", () => {
		expect(
			epochSecToDateInput(Math.floor(Date.UTC(2026, 5, 12, 8, 0, 0) / 1000))
		).toBe("2026-06-12");
	});

	it("round-trips with dateInputToEpochSec", () => {
		const sec = dateInputToEpochSec("2026-01-05");
		expect(epochSecToDateInput(sec)).toBe("2026-01-05");
	});

	it("returns an empty string for undefined", () => {
		expect(epochSecToDateInput(undefined)).toBe("");
	});
});
