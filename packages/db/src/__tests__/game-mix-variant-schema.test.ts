import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { gameMixVariant } from "../schema/game-mix";

const config = getTableConfig(gameMixVariant);
const columns = getTableColumns(gameMixVariant);

describe("GameMixVariant schema — columns", () => {
	it("stores only the ordered owner-scoped association", () => {
		expect(Object.keys(columns)).toEqual([
			"mixId",
			"variantId",
			"userId",
			"position",
		]);
	});

	it.each([
		"mixId",
		"variantId",
		"userId",
		"position",
	] as const)("requires %s", (column) => {
		expect(columns[column].notNull).toBe(true);
	});

	it("stores ids as strings and position as a number", () => {
		expect(columns.mixId.dataType).toBe("string");
		expect(columns.variantId.dataType).toBe("string");
		expect(columns.userId.dataType).toBe("string");
		expect(columns.position.dataType).toBe("number");
	});
});

describe("GameMixVariant schema — identity and ordering", () => {
	it("uses (mixId, variantId) as its composite primary key", () => {
		expect(config.primaryKeys).toHaveLength(1);
		expect(config.primaryKeys[0]?.columns.map((column) => column.name)).toEqual(
			["mix_id", "variant_id"]
		);
	});

	it("allows each position only once within a mix", () => {
		const index = config.indexes.find(
			(candidate) =>
				candidate.config.name === "game_mix_variant_mix_position_unique"
		);
		expect(index).toBeDefined();
		expect((index?.config as unknown as { unique: boolean }).unique).toBe(true);
		expect(index?.config.columns.map((column) => column.name)).toEqual([
			"mix_id",
			"position",
		]);
	});

	it("indexes variantId for reverse-reference checks", () => {
		const index = config.indexes.find(
			(candidate) =>
				candidate.config.name === "game_mix_variant_variant_user_idx"
		);
		expect(index?.config.columns.map((column) => column.name)).toEqual([
			"variant_id",
			"user_id",
		]);
	});

	it("indexes owner-scoped list hydration in mix and position order", () => {
		const index = config.indexes.find(
			(candidate) =>
				candidate.config.name === "game_mix_variant_user_mix_position_idx"
		);
		expect(index?.config.columns.map((column) => column.name)).toEqual([
			"user_id",
			"mix_id",
			"position",
		]);
	});

	it("rejects negative positions", () => {
		expect(
			config.checks.find(
				(check) => check.name === "game_mix_variant_position_nonnegative"
			)
		).toBeDefined();
	});
});

describe("GameMixVariant schema — owner-safe foreign keys", () => {
	it("has exactly the mix-owner and variant-owner foreign keys", () => {
		expect(config.foreignKeys).toHaveLength(2);
	});

	it("cascades association deletion with its owning mix", () => {
		const foreignKey = config.foreignKeys.find((candidate) =>
			candidate
				.reference()
				.columns.map((column) => column.name)
				.every((name, index) => ["mix_id", "user_id"][index] === name)
		);
		const reference = foreignKey?.reference();

		expect(reference?.columns.map((column) => column.name)).toEqual([
			"mix_id",
			"user_id",
		]);
		expect(reference?.foreignColumns.map((column) => column.name)).toEqual([
			"id",
			"user_id",
		]);
		expect(getTableConfig(reference?.foreignTable as never).name).toBe(
			"game_mix"
		);
		expect(foreignKey?.onDelete).toBe("cascade");
	});

	it("prevents direct deletion of a referenced owner-matched variant", () => {
		const foreignKey = config.foreignKeys.find((candidate) =>
			candidate
				.reference()
				.columns.map((column) => column.name)
				.every((name, index) => ["variant_id", "user_id"][index] === name)
		);
		const reference = foreignKey?.reference();

		expect(reference?.columns.map((column) => column.name)).toEqual([
			"variant_id",
			"user_id",
		]);
		expect(reference?.foreignColumns.map((column) => column.name)).toEqual([
			"id",
			"user_id",
		]);
		expect(getTableConfig(reference?.foreignTable as never).name).toBe(
			"game_variant"
		);
		expect(foreignKey?.onDelete).toBe("no action");
	});
});

describe("GameMixVariant schema — table name", () => {
	it("is named game_mix_variant", () => {
		expect(config.name).toBe("game_mix_variant");
	});
});
