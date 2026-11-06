import { describe, expect, it } from "vitest";
import {
	isFilterPresetNameConflictError,
	isGameMasterLabelConflictError,
	isUniqueIndexConflictError,
} from "../lib/db-errors";

describe("isGameMasterLabelConflictError", () => {
	it("recognizes the requested unique index in a wrapped D1 error", () => {
		const error = new Error("D1_ERROR", {
			cause: new Error(
				"UNIQUE constraint failed: index 'game_variant_label_uq'"
			),
		});
		expect(isGameMasterLabelConflictError(error, "game_variant_label_uq")).toBe(
			true
		);
		expect(isGameMasterLabelConflictError(error, "game_mix_label_uq")).toBe(
			false
		);
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

	it("recognizes the name constraint inside a wrapped D1 error", () => {
		expect(
			isFilterPresetNameConflictError(
				new Error("query failed", {
					cause: new Error(
						"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name"
					),
				})
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

it("does not misclassify a different constraint or loop on cyclic causes", () => {
	expect(
		isFilterPresetNameConflictError(
			new Error(
				"UNIQUE constraint failed: filter_preset.user_id, filter_preset.screen_key, filter_preset.name_suffix"
			)
		)
	).toBe(false);
	expect(
		isUniqueIndexConflictError(
			new Error("UNIQUE constraint failed: index 'tagXname'"),
			"tag.name"
		)
	).toBe(false);
	const error = new Error("unrelated");
	error.cause = error;
	expect(isFilterPresetNameConflictError(error)).toBe(false);
});
