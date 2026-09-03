import { describe, expect, it } from "vitest";
import { gameMix } from "../schema/game-mix";
import { fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("GameMix — FK cascade policies", () => {
	it("userId FK cascades on user deletion", () => {
		expect(fkByColumn(gameMix, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});
});

describe("GameMix — indexes", () => {
	it("has gameMix_userId_idx for owner-scoped queries", () => {
		expect(indexesOf(gameMix)).toEqual(
			expect.arrayContaining([
				{
					columns: ["user_id"],
					name: "gameMix_userId_idx",
					unique: false,
					where: null,
				},
			])
		);
	});

	it("has a unique index on (userId, builtinKey) so a concurrent double-seed cannot duplicate a builtin row (c08)", () => {
		expect(indexByName(gameMix, "gameMix_userId_builtinKey_idx")).toEqual({
			columns: ["user_id", "builtin_key"],
			name: "gameMix_userId_builtinKey_idx",
			unique: true,
			where: null,
		});
	});

	it("has a unique index on (userId, label) as an exact-case backstop for the app-level label check (c14)", () => {
		expect(indexByName(gameMix, "gameMix_userId_label_idx")).toEqual({
			columns: ["user_id", "label"],
			name: "gameMix_userId_label_idx",
			unique: true,
			where: null,
		});
	});

	it("has a unique index on (id, userId) as the owner-safe composite reference target", () => {
		expect(indexByName(gameMix, "game_mix_id_user_id_unique")).toEqual({
			columns: ["id", "user_id"],
			name: "game_mix_id_user_id_unique",
			unique: true,
			where: null,
		});
	});
});
