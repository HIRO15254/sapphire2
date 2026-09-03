import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { ringGame } from "../schema/ring-game";
import { fkByColumn, indexesOf } from "./test-utils";

describe("RingGame — defaults", () => {
	it("variant defaults to DEFAULT_VARIANT_LABEL (c12: not the stale 'nlh' key)", () => {
		expect(getTableColumns(ringGame).variant.default).toBe(
			DEFAULT_VARIANT_LABEL
		);
	});
});

describe("RingGame — FK cascade policies", () => {
	it("roomId FK cascades so ring games die with their room", () => {
		expect(fkByColumn(ringGame, "room_id")).toEqual({
			columns: ["room_id"],
			foreignColumns: ["id"],
			foreignTable: "room",
			onDelete: "cascade",
		});
	});

	it("currencyId FK sets null so ring games survive currency deletion", () => {
		expect(fkByColumn(ringGame, "currency_id")).toEqual({
			columns: ["currency_id"],
			foreignColumns: ["id"],
			foreignTable: "currency",
			onDelete: "set null",
		});
	});

	it("userId FK cascades so ring games die with their owner (SA2-181)", () => {
		expect(fkByColumn(ringGame, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});
});

describe("RingGame — indexes", () => {
	it("indexes roomId, userId (SA2-181) and currencyId for room, owner and reverse currency lookups", () => {
		expect(indexesOf(ringGame)).toEqual([
			{
				columns: ["room_id"],
				name: "ringGame_roomId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id"],
				name: "ringGame_userId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["currency_id"],
				name: "ringGame_currencyId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
