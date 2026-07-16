import { describe, expect, it } from "vitest";
import {
	FILTER_PRESET_SCREEN_KEYS,
	filterPresetScreenKeySchema,
	payloadSchemaForScreenKey,
	presetNameSchema,
	sessionsFilterPresetPayloadSchema,
	statisticsFilterPresetPayloadSchema,
} from "../schemas/filter-preset";

describe("filterPresetScreenKeySchema", () => {
	it("accepts every key in FILTER_PRESET_SCREEN_KEYS", () => {
		for (const key of FILTER_PRESET_SCREEN_KEYS) {
			expect(filterPresetScreenKeySchema.safeParse(key).success).toBe(true);
		}
	});

	it("rejects an unknown screen key", () => {
		expect(filterPresetScreenKeySchema.safeParse("dashboard").success).toBe(
			false
		);
	});
});

describe("presetNameSchema", () => {
	it("rejects an empty string", () => {
		expect(presetNameSchema.safeParse("").success).toBe(false);
	});

	it("rejects a 51-character string", () => {
		expect(presetNameSchema.safeParse("a".repeat(51)).success).toBe(false);
	});

	it("accepts a 1-character string", () => {
		expect(presetNameSchema.safeParse("a").success).toBe(true);
	});

	it("accepts a 50-character string", () => {
		expect(presetNameSchema.safeParse("a".repeat(50)).success).toBe(true);
	});

	it("trims surrounding whitespace", () => {
		const parsed = presetNameSchema.safeParse(" Foo ");
		expect(parsed.success).toBe(true);
		expect(parsed.success && parsed.data).toBe("Foo");
	});

	it("rejects a whitespace-only string (trims to empty)", () => {
		expect(presetNameSchema.safeParse("   ").success).toBe(false);
	});
});

describe("sessionsFilterPresetPayloadSchema", () => {
	it("accepts an empty object (all fields optional)", () => {
		expect(sessionsFilterPresetPayloadSchema.safeParse({}).success).toBe(true);
	});

	it("accepts a valid period alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ period: "this_month" })
				.success
		).toBe(true);
	});

	it("rejects an empty-string period", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ period: "" }).success
		).toBe(false);
	});

	it("rejects a period longer than 30 characters", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ period: "a".repeat(31) })
				.success
		).toBe(false);
	});

	it("accepts a period at the 30-character boundary", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ period: "a".repeat(30) })
				.success
		).toBe(true);
	});

	it("accepts a valid from alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ from: 1_700_000_000 })
				.success
		).toBe(true);
	});

	it("rejects a non-integer from", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ from: 1.5 }).success
		).toBe(false);
	});

	it("accepts a valid to alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ to: 1_700_000_000 }).success
		).toBe(true);
	});

	it("rejects a non-integer to", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ to: 2.2 }).success
		).toBe(false);
	});

	it("accepts a valid type alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ type: "cash_game" }).success
		).toBe(true);
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ type: "tournament" })
				.success
		).toBe(true);
	});

	it("rejects an invalid type value", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ type: "all" }).success
		).toBe(false);
	});

	it("accepts a valid roomId alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ roomId: "room-1" }).success
		).toBe(true);
	});

	it("rejects an empty-string roomId", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ roomId: "" }).success
		).toBe(false);
	});

	it("accepts a valid currencyId alone", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ currencyId: "cur-1" })
				.success
		).toBe(true);
	});

	it("rejects an empty-string currencyId", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ currencyId: "" }).success
		).toBe(false);
	});

	it("rejects an unknown key (proves .strict())", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ unknownField: "x" }).success
		).toBe(false);
	});
});

describe("statisticsFilterPresetPayloadSchema", () => {
	it("accepts an empty object (all fields optional)", () => {
		expect(statisticsFilterPresetPayloadSchema.safeParse({}).success).toBe(
			true
		);
	});

	it("accepts a valid period alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ period: "this_year" })
				.success
		).toBe(true);
	});

	it("rejects an empty-string period", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ period: "" }).success
		).toBe(false);
	});

	it("rejects a period longer than 30 characters", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ period: "a".repeat(31) })
				.success
		).toBe(false);
	});

	it("accepts a valid from alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ from: 1_700_000_000 })
				.success
		).toBe(true);
	});

	it("rejects a non-integer from", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ from: 1.5 }).success
		).toBe(false);
	});

	it("accepts a valid to alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ to: 1_700_000_000 })
				.success
		).toBe(true);
	});

	it("rejects a non-integer to", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ to: 2.2 }).success
		).toBe(false);
	});

	it("accepts a valid currency alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ currency: "cur-1" })
				.success
		).toBe(true);
	});

	it("rejects an empty-string currency", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ currency: "" }).success
		).toBe(false);
	});

	it("accepts a valid norm alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ norm: "off" }).success
		).toBe(true);
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ norm: "normalized" })
				.success
		).toBe(true);
	});

	it("rejects an invalid norm value", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ norm: "raw" }).success
		).toBe(false);
	});

	it("accepts a valid type alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ type: "all" }).success
		).toBe(true);
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ type: "cash_game" })
				.success
		).toBe(true);
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ type: "tournament" })
				.success
		).toBe(true);
	});

	it("rejects an invalid type value", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ type: "unknown" }).success
		).toBe(false);
	});

	it("accepts a valid room alone", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ room: "room-1" }).success
		).toBe(true);
	});

	it("rejects an empty-string room", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ room: "" }).success
		).toBe(false);
	});

	it("rejects an unknown key (proves .strict())", () => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ unknownField: "x" })
				.success
		).toBe(false);
	});
});

describe("payloadSchemaForScreenKey", () => {
	it("returns sessionsFilterPresetPayloadSchema by reference for 'sessions'", () => {
		expect(payloadSchemaForScreenKey("sessions")).toBe(
			sessionsFilterPresetPayloadSchema
		);
	});

	it("returns statisticsFilterPresetPayloadSchema by reference for 'statistics'", () => {
		expect(payloadSchemaForScreenKey("statistics")).toBe(
			statisticsFilterPresetPayloadSchema
		);
	});
});
