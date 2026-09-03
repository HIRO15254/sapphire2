import { describe, expect, it } from "vitest";
import { gameMixVariant } from "../schema/game-mix";
import { checksOf, fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("GameMixVariant — owner-safe foreign keys", () => {
	it("mix owner FK (mixId, userId) cascades association deletion with its owning mix", () => {
		expect(fkByColumn(gameMixVariant, "mix_id")).toEqual({
			columns: ["mix_id", "user_id"],
			foreignColumns: ["id", "user_id"],
			foreignTable: "game_mix",
			onDelete: "cascade",
		});
	});

	it("variant owner FK (variantId, userId) takes no action so a referenced owner-matched variant cannot be deleted directly", () => {
		expect(fkByColumn(gameMixVariant, "variant_id")).toEqual({
			columns: ["variant_id", "user_id"],
			foreignColumns: ["id", "user_id"],
			foreignTable: "game_variant",
			onDelete: "no action",
		});
	});
});

describe("GameMixVariant — indexes", () => {
	it("indexes owner-scoped list hydration and reverse variant references alongside the per-mix position guard", () => {
		expect(indexesOf(gameMixVariant)).toEqual([
			{
				columns: ["mix_id", "position"],
				name: "game_mix_variant_mix_position_unique",
				unique: true,
				where: null,
			},
			{
				columns: ["user_id", "mix_id", "position"],
				name: "game_mix_variant_user_mix_position_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["variant_id", "user_id"],
				name: "game_mix_variant_variant_user_idx",
				unique: false,
				where: null,
			},
		]);
	});

	it("allows each position only once within a mix", () => {
		expect(
			indexByName(gameMixVariant, "game_mix_variant_mix_position_unique")
		).toEqual({
			columns: ["mix_id", "position"],
			name: "game_mix_variant_mix_position_unique",
			unique: true,
			where: null,
		});
	});
});

describe("GameMixVariant — CHECK constraints", () => {
	it("rejects negative positions", () => {
		expect(checksOf(gameMixVariant)).toEqual([
			{
				name: "game_mix_variant_position_nonnegative",
				sql: '"game_mix_variant"."position" >= 0',
			},
		]);
	});
});
