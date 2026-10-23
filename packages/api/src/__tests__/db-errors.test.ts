import { describe, expect, it } from "vitest";
import {
	isFilterPresetNameConflictError,
	isLabelConflictError,
} from "../lib/db-errors";

describe("isLabelConflictError", () => {
	it("returns true for a D1-style UNIQUE constraint error (index backstop)", () => {
		const error = new Error(
			"D1_ERROR: UNIQUE constraint failed: game_group.user_id, game_group.label: SQLITE_CONSTRAINT"
		);
		expect(isLabelConflictError(error)).toBe(true);
	});

	it("returns true for the 0041 variant/mix label trigger abort message", () => {
		expect(
			isLabelConflictError(new Error("game master label already exists"))
		).toBe(true);
	});

	it("returns true for the 0041 group label trigger abort message", () => {
		expect(
			isLabelConflictError(new Error("game_group label already exists"))
		).toBe(true);
	});

	it("is case-insensitive for both shapes", () => {
		expect(
			isLabelConflictError(
				new Error("unique constraint failed: game_mix.label")
			)
		).toBe(true);
		expect(
			isLabelConflictError(new Error("GAME MASTER LABEL ALREADY EXISTS"))
		).toBe(true);
	});

	it("returns false for an unrelated Error (a real failure must surface)", () => {
		expect(isLabelConflictError(new Error("network timeout"))).toBe(false);
		expect(
			isLabelConflictError(
				new Error("game_mix contains an unavailable variant")
			)
		).toBe(false);
		expect(
			isLabelConflictError(new Error("game_variant is referenced by a mix"))
		).toBe(false);
	});

	it("returns false for a non-Error value", () => {
		expect(isLabelConflictError("UNIQUE constraint failed")).toBe(false);
		expect(isLabelConflictError(undefined)).toBe(false);
		expect(isLabelConflictError(null)).toBe(false);
	});
});

describe("isFilterPresetNameConflictError", () => {
	it("returns true for the (user_id, screen_key, name) UNIQUE violation", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error(
					"D1_ERROR: UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name: SQLITE_CONSTRAINT"
				)
			)
		).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error(
					"unique constraint failed: FILTER_PRESET.USER_ID, FILTER_PRESET.SCREEN_KEY, FILTER_PRESET.NAME"
				)
			)
		).toBe(true);
	});

	it("returns false for an unrelated unique violation", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error(
					"UNIQUE constraint failed: game_group.user_id, game_group.label"
				)
			)
		).toBe(false);
	});

	it("returns false for the partial default-uniqueness index violation (user_id, screen_key)", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error(
					"D1_ERROR: UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key: SQLITE_CONSTRAINT"
				)
			)
		).toBe(false);
	});

	it("returns false for the primary-key violation (filter_preset.id)", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error("UNIQUE constraint failed: filter_preset.id")
			)
		).toBe(false);
	});

	it("returns false for an unrelated Error and non-Error values", () => {
		expect(isFilterPresetNameConflictError(new Error("network timeout"))).toBe(
			false
		);
		expect(isFilterPresetNameConflictError("UNIQUE constraint failed")).toBe(
			false
		);
		expect(isFilterPresetNameConflictError(undefined)).toBe(false);
		expect(isFilterPresetNameConflictError(null)).toBe(false);
	});
});
