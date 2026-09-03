import { describe, expect, it } from "vitest";
import { gameVariant } from "../schema/game-variant";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("GameVariant — FK cascade policies", () => {
	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn(gameVariant, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("groupId FK restricts deletion so a group in use cannot vanish under a variant", () => {
		expect(fkByColumn(gameVariant, "group_id")).toEqual({
			columns: ["group_id"],
			foreignColumns: ["id"],
			foreignTable: "game_group",
			onDelete: "restrict",
		});
	});
});

describe("GameVariant — indexes", () => {
	it("has gameVariant_userId_idx for owner-scoped queries and gameVariant_groupId_idx for reverse group lookups", () => {
		expect(indexesOf(gameVariant)).toEqual(
			expect.arrayContaining([
				{
					columns: ["user_id"],
					name: "gameVariant_userId_idx",
					unique: false,
					where: null,
				},
				{
					columns: ["group_id"],
					name: "gameVariant_groupId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});

	it("has a unique index on (userId, builtinKey) so a concurrent double-seed cannot duplicate a builtin row (c08)", () => {
		expect(
			indexByName(gameVariant, "gameVariant_userId_builtinKey_idx")
		).toEqual({
			columns: ["user_id", "builtin_key"],
			name: "gameVariant_userId_builtinKey_idx",
			unique: true,
			where: null,
		});
	});

	it("has a unique index on (userId, label) as an exact-case backstop for the app-level label check (c14)", () => {
		expect(indexByName(gameVariant, "gameVariant_userId_label_idx")).toEqual({
			columns: ["user_id", "label"],
			name: "gameVariant_userId_label_idx",
			unique: true,
			where: null,
		});
	});

	it("has a unique index on (id, userId) as the owner-safe composite reference target", () => {
		expect(indexByName(gameVariant, "game_variant_id_user_id_unique")).toEqual({
			columns: ["id", "user_id"],
			name: "game_variant_id_user_id_unique",
			unique: true,
			where: null,
		});
	});
});
