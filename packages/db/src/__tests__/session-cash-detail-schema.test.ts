import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { sessionCashDetail } from "../schema/session-cash-detail";
import { fkByColumn, indexesOf } from "./test-utils";

describe("SessionCashDetail — snapshot defaults", () => {
	it("ruleName defaults to 'Untitled' so ADD COLUMN succeeds on existing rows", () => {
		expect(getTableColumns(sessionCashDetail).ruleName.default).toBe(
			"Untitled"
		);
	});

	it("variant defaults to DEFAULT_VARIANT_LABEL so ADD COLUMN succeeds on existing rows (c12: not the stale 'nlh' key)", () => {
		expect(getTableColumns(sessionCashDetail).variant.default).toBe(
			DEFAULT_VARIANT_LABEL
		);
	});
});

describe("SessionCashDetail — FK cascade policies", () => {
	it("sessionId FK cascades so the detail dies with its session", () => {
		expect(fkByColumn(sessionCashDetail, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});

	it("ringGameId FK uses set null so the detail survives ring game removal", () => {
		expect(fkByColumn(sessionCashDetail, "ring_game_id")).toEqual({
			columns: ["ring_game_id"],
			foreignColumns: ["id"],
			foreignTable: "ring_game",
			onDelete: "set null",
		});
	});
});

describe("SessionCashDetail — indexes", () => {
	it("indexes ringGameId for ring game lookups", () => {
		expect(indexesOf(sessionCashDetail)).toEqual([
			{
				columns: ["ring_game_id"],
				name: "session_cash_ring_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
