import { describe, expect, it } from "vitest";
import { filterPreset } from "../schema/filter-preset";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("FilterPreset — FK cascade policies", () => {
	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn(filterPreset, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});
});

describe("FilterPreset — indexes", () => {
	it("has plain userId and (userId, screenKey) lookup indexes alongside the two uniqueness guards", () => {
		expect(indexesOf(filterPreset)).toEqual([
			{
				columns: ["user_id"],
				name: "filterPreset_userId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id", "screen_key"],
				name: "filterPreset_userId_screenKey_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id", "screen_key", "name"],
				name: "filterPreset_userId_screenKey_name_idx",
				unique: true,
				where: null,
			},
			{
				columns: ["user_id", "screen_key"],
				name: "filterPreset_userId_screenKey_defaultUnique_idx",
				unique: true,
				where: '"filter_preset"."is_default" = 1',
			},
		]);
	});

	it("allows only one default preset per (userId, screenKey)", () => {
		const index = indexByName(
			filterPreset,
			"filterPreset_userId_screenKey_defaultUnique_idx"
		);
		expect(index).toMatchObject({
			columns: ["user_id", "screen_key"],
			unique: true,
		});
		expect(index?.where).toContain('"filter_preset"."is_default" = 1');
	});
});
