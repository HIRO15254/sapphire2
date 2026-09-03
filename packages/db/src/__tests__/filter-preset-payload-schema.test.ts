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
	it.each(FILTER_PRESET_SCREEN_KEYS)("accepts the %s screen key", (key) => {
		expect(filterPresetScreenKeySchema.parse(key)).toBe(key);
	});

	it("rejects an unknown screen key", () => {
		expect(filterPresetScreenKeySchema.safeParse("dashboard").success).toBe(
			false
		);
	});
});

describe("presetNameSchema", () => {
	it.each([
		["empty", ""],
		["51-character", "a".repeat(51)],
	])("rejects an %s name", (_, name) => {
		expect(presetNameSchema.safeParse(name).success).toBe(false);
	});

	it.each([
		["1-character", "a"],
		["50-character", "a".repeat(50)],
	])("accepts a %s name", (_, name) => {
		expect(presetNameSchema.parse(name)).toBe(name);
	});

	it("trims surrounding whitespace", () => {
		expect(presetNameSchema.parse(" Foo ")).toBe("Foo");
	});

	it("rejects a whitespace-only string (trims to empty)", () => {
		expect(presetNameSchema.safeParse("   ").success).toBe(false);
	});
});

describe("sessionsFilterPresetPayloadSchema", () => {
	const fullPayload = {
		period: "this_month",
		from: 1_700_000_000,
		to: 1_700_086_400,
		type: "cash_game",
		roomId: "room-1",
		currencyId: "cur-1",
		display: "normalized",
	} as const;

	it("accepts an empty object (all fields optional)", () => {
		expect(sessionsFilterPresetPayloadSchema.parse({})).toEqual({});
	});

	it("accepts the full payload and returns it unchanged", () => {
		expect(sessionsFilterPresetPayloadSchema.parse(fullPayload)).toEqual(
			fullPayload
		);
	});

	it("accepts a period at the 30-character boundary", () => {
		expect(
			sessionsFilterPresetPayloadSchema.parse({ period: "a".repeat(30) })
		).toEqual({ period: "a".repeat(30) });
	});

	it.each([
		["empty", ""],
		["31-character", "a".repeat(31)],
	])("rejects an %s period", (_, period) => {
		const result = sessionsFilterPresetPayloadSchema.safeParse({ period });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["period"]);
	});

	it.each(["from", "to"])("rejects a non-integer %s", (field) => {
		const result = sessionsFilterPresetPayloadSchema.safeParse({
			[field]: 1.5,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([field]);
	});

	it.each(["all", "cash", ""])("rejects the type value %j", (type) => {
		const result = sessionsFilterPresetPayloadSchema.safeParse({ type });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["type"]);
	});

	it.each(["bogus", "off", ""])("rejects the display value %j", (display) => {
		const result = sessionsFilterPresetPayloadSchema.safeParse({ display });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["display"]);
	});

	it.each(["roomId", "currencyId"])("rejects an empty-string %s", (field) => {
		const result = sessionsFilterPresetPayloadSchema.safeParse({
			[field]: "",
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([field]);
	});

	it("rejects an unknown key (proves .strict())", () => {
		expect(
			sessionsFilterPresetPayloadSchema.safeParse({ unknownField: "x" }).success
		).toBe(false);
	});
});

describe("statisticsFilterPresetPayloadSchema", () => {
	const fullPayload = {
		period: "this_year",
		from: 1_700_000_000,
		to: 1_700_086_400,
		currency: "cur-1",
		norm: "normalized",
		type: "all",
		room: "room-1",
	} as const;

	it("accepts an empty object (all fields optional)", () => {
		expect(statisticsFilterPresetPayloadSchema.parse({})).toEqual({});
	});

	it("accepts the full payload and returns it unchanged", () => {
		expect(statisticsFilterPresetPayloadSchema.parse(fullPayload)).toEqual(
			fullPayload
		);
	});

	it("accepts a period at the 30-character boundary", () => {
		expect(
			statisticsFilterPresetPayloadSchema.parse({ period: "a".repeat(30) })
		).toEqual({ period: "a".repeat(30) });
	});

	it.each([
		["empty", ""],
		["31-character", "a".repeat(31)],
	])("rejects an %s period", (_, period) => {
		const result = statisticsFilterPresetPayloadSchema.safeParse({ period });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["period"]);
	});

	it.each(["from", "to"])("rejects a non-integer %s", (field) => {
		const result = statisticsFilterPresetPayloadSchema.safeParse({
			[field]: 2.2,
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([field]);
	});

	it.each(["unknown", "cash", ""])("rejects the type value %j", (type) => {
		const result = statisticsFilterPresetPayloadSchema.safeParse({ type });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["type"]);
	});

	it.each(["raw", "currency", ""])("rejects the norm value %j", (norm) => {
		const result = statisticsFilterPresetPayloadSchema.safeParse({ norm });
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["norm"]);
	});

	it.each(["currency", "room"])("rejects an empty-string %s", (field) => {
		const result = statisticsFilterPresetPayloadSchema.safeParse({
			[field]: "",
		});
		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual([field]);
	});

	it.each([
		"unknownField",
		"display",
	])("rejects the unknown key %s (proves .strict())", (key) => {
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ [key]: "currency" })
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
