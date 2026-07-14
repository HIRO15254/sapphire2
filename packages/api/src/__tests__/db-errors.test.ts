import { describe, expect, it } from "vitest";
import { isLabelConflictError } from "../lib/db-errors";

describe("isLabelConflictError", () => {
	it("returns true for a D1-style UNIQUE constraint error (index backstop)", () => {
		const error = new Error(
			"D1_ERROR: UNIQUE constraint failed: game_group.user_id, game_group.label: SQLITE_CONSTRAINT"
		);
		expect(isLabelConflictError(error)).toBe(true);
	});

	it("returns true for the 0041 variant/mix label trigger abort message", () => {
		// game_variant_label_unique_insert / game_mix_label_unique_insert raise
		// this before the unique index is ever evaluated.
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
		// The mix-reference trigger is NOT a label collision — must not be
		// swallowed as one.
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
