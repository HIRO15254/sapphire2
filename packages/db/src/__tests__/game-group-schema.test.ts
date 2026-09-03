import { describe, expect, it } from "vitest";
import { gameGroup } from "../schema/game-group";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("GameGroup — FK cascade policies", () => {
	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn(gameGroup, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});
});

describe("GameGroup — indexes", () => {
	it("has gameGroup_userId_idx for owner-scoped queries", () => {
		expect(indexesOf(gameGroup)).toEqual(
			expect.arrayContaining([
				{
					columns: ["user_id"],
					name: "gameGroup_userId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});

	it("has a unique index on (userId, builtinKey) so a concurrent double-seed cannot duplicate a builtin row (c08)", () => {
		expect(indexByName(gameGroup, "gameGroup_userId_builtinKey_idx")).toEqual({
			columns: ["user_id", "builtin_key"],
			name: "gameGroup_userId_builtinKey_idx",
			unique: true,
			where: null,
		});
	});

	it("has a unique index on (userId, label) as an exact-case backstop for the app-level label check (c14)", () => {
		expect(indexByName(gameGroup, "gameGroup_userId_label_idx")).toEqual({
			columns: ["user_id", "label"],
			name: "gameGroup_userId_label_idx",
			unique: true,
			where: null,
		});
	});
});
