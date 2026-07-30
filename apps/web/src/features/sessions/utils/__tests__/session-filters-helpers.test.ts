import { describe, expect, it } from "vitest";
import {
	buildSessionsPresetPayload,
	SESSION_DISPLAY_LABEL,
	SESSION_DISPLAY_VALUES,
	SESSION_PERIOD_LABEL,
	SESSION_PERIODS,
	SESSION_TYPE_LABEL,
	SESSION_TYPE_VALUES,
	type SessionFilterValues,
	splitSessionsPresetPayload,
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

const fullFilters: SessionFilterValues = {
	period: "custom",
	from: 1_700_000_000,
	to: 1_700_086_399,
	type: "cash_game",
	roomId: "r1",
	currencyId: "c1",
};

describe("buildSessionsPresetPayload", () => {
	it("records the currency view for bbBiMode off", () => {
		expect(buildSessionsPresetPayload({}, false)).toEqual({
			display: "currency",
		});
	});

	it("records the normalized view for bbBiMode on", () => {
		expect(buildSessionsPresetPayload({}, true)).toEqual({
			display: "normalized",
		});
	});

	it("carries every filter field alongside the display mode", () => {
		expect(buildSessionsPresetPayload(fullFilters, true)).toEqual({
			period: "custom",
			from: 1_700_000_000,
			to: 1_700_086_399,
			type: "cash_game",
			roomId: "r1",
			currencyId: "c1",
			display: "normalized",
		});
	});

	it("keeps a cleared key that the filter bar left behind as undefined", () => {
		// `patch` in use-session-filter-bar.ts writes `{ type: undefined }` when
		// the user picks "All", so the key survives in the filter object. It must
		// round-trip as an absent value, not become a bogus filter.
		const payload = buildSessionsPresetPayload({ type: undefined }, false);
		expect(payload.type).toBeUndefined();
		expect(payload.display).toBe("currency");
	});

	it("does not mutate the filters it was given", () => {
		const filters: SessionFilterValues = { roomId: "r1" };
		buildSessionsPresetPayload(filters, true);
		expect(filters).toEqual({ roomId: "r1" });
	});

	it("preserves a zero epoch bound instead of dropping it", () => {
		expect(
			buildSessionsPresetPayload({ period: "custom", from: 0 }, false)
		).toEqual({ period: "custom", from: 0, display: "currency" });
	});
});

describe("splitSessionsPresetPayload", () => {
	it("splits the normalized display mode out of the filter fields", () => {
		expect(
			splitSessionsPresetPayload({ type: "tournament", display: "normalized" })
		).toEqual({ display: "normalized", filters: { type: "tournament" } });
	});

	it("splits the currency display mode out of the filter fields", () => {
		expect(
			splitSessionsPresetPayload({ roomId: "r1", display: "currency" })
		).toEqual({ display: "currency", filters: { roomId: "r1" } });
	});

	it("reports no display mode for a preset saved before the field existed", () => {
		expect(splitSessionsPresetPayload({ type: "cash_game" })).toEqual({
			display: undefined,
			filters: { type: "cash_game" },
		});
	});

	it("never leaves a display key on the filter half", () => {
		const { filters } = splitSessionsPresetPayload({
			roomId: "r1",
			display: "normalized",
		});
		expect("display" in filters).toBe(false);
	});

	it("handles an empty payload", () => {
		expect(splitSessionsPresetPayload({})).toEqual({
			display: undefined,
			filters: {},
		});
	});

	it("carries every filter field through", () => {
		const { filters } = splitSessionsPresetPayload({
			...fullFilters,
			display: "currency",
		});
		expect(filters).toEqual(fullFilters);
	});

	it("does not mutate the payload it was given", () => {
		const payload = { roomId: "r1", display: "normalized" as const };
		splitSessionsPresetPayload(payload);
		expect(payload).toEqual({ roomId: "r1", display: "normalized" });
	});

	it("round-trips through buildSessionsPresetPayload", () => {
		expect(
			splitSessionsPresetPayload(buildSessionsPresetPayload(fullFilters, true))
		).toEqual({ display: "normalized", filters: fullFilters });
		expect(
			splitSessionsPresetPayload(buildSessionsPresetPayload(fullFilters, false))
		).toEqual({ display: "currency", filters: fullFilters });
	});
});
