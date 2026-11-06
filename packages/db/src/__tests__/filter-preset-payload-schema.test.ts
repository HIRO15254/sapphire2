import { describe, expect, it } from "vitest";
import {
	filterPresetScreenKeySchema,
	presetNameSchema,
	sessionsFilterPresetPayloadSchema,
	statisticsFilterPresetPayloadSchema,
} from "../schemas/filter-preset";

describe("filter presets", () => {
	it("validates screen keys and preset names", () => {
		expect(filterPresetScreenKeySchema.safeParse("sessions").success).toBe(
			true
		);
		expect(filterPresetScreenKeySchema.safeParse("statistics").success).toBe(
			true
		);
		expect(filterPresetScreenKeySchema.safeParse("other").success).toBe(false);
		expect(presetNameSchema.parse("  My filters  ")).toBe("My filters");
		expect(presetNameSchema.safeParse("   ").success).toBe(false);
		expect(presetNameSchema.safeParse("a".repeat(51)).success).toBe(false);
	});

	it("allows sessions without a mode but requires one for statistics", () => {
		expect(sessionsFilterPresetPayloadSchema.parse({})).toEqual({});
		expect(statisticsFilterPresetPayloadSchema.safeParse({}).success).toBe(
			false
		);
		expect(
			statisticsFilterPresetPayloadSchema.safeParse({ normalized: false })
				.success
		).toBe(false);
	});

	it.each([
		{ assetId: "asset-1", normalized: false },
		{ valuation: "real", baseAssetId: "asset-2" },
		{ valuation: "virtual" },
		{ normalized: true },
	])("accepts a single statistics mode: %o", (mode) => {
		expect(statisticsFilterPresetPayloadSchema.parse(mode)).toEqual(mode);
		expect(sessionsFilterPresetPayloadSchema.parse(mode)).toEqual(mode);
	});

	it.each([
		{ assetId: "asset-1", valuation: "real" },
		{ assetId: "asset-1", normalized: true },
		{ valuation: "virtual", normalized: true },
		{ baseAssetId: "asset-2", normalized: true },
	])("rejects incompatible modes or a base asset without valuation: %o", (mode) => {
		expect(sessionsFilterPresetPayloadSchema.safeParse(mode).success).toBe(
			false
		);
		expect(statisticsFilterPresetPayloadSchema.safeParse(mode).success).toBe(
			false
		);
	});

	it.each([
		sessionsFilterPresetPayloadSchema,
		statisticsFilterPresetPayloadSchema,
	])("preserves valid dates and tag filters and rejects invalid ones", (schema) => {
		const payload = {
			period: "this_month",
			kind: "cash",
			roomId: "room-1",
			dateFrom: "2024-02-01",
			dateTo: "2024-02-29",
			entryTagIds: ["entry-tag-1"],
			tournamentTagIds: ["tournament-tag-1"],
			valuation: "real",
			baseAssetId: "asset-1",
		};
		expect(schema.parse(payload)).toEqual(payload);
		expect(
			schema.safeParse({ ...payload, dateFrom: "2024-03-01" }).success
		).toBe(false);
		expect(schema.safeParse({ ...payload, dateTo: "2024-02-30" }).success).toBe(
			false
		);
		expect(
			schema.safeParse({ ...payload, entryTagIds: ["tag", "tag"] }).success
		).toBe(false);
		expect(
			schema.safeParse({ ...payload, tournamentTagIds: [""] }).success
		).toBe(false);
		expect(schema.safeParse({ ...payload, period: "" }).success).toBe(false);
		expect(
			schema.safeParse({ ...payload, period: "a".repeat(31) }).success
		).toBe(false);
	});

	it.each([
		sessionsFilterPresetPayloadSchema,
		statisticsFilterPresetPayloadSchema,
	])("rejects unknown and legacy keys rather than silently discarding them", (schema) => {
		for (const key of [
			"unknown",
			"from",
			"to",
			"type",
			"currency",
			"currencyId",
			"room",
			"display",
			"norm",
		]) {
			expect(
				schema.safeParse({ normalized: true, [key]: "legacy" }).success
			).toBe(false);
		}
	});
});
