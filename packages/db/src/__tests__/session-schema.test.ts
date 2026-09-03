import { describe, expect, it } from "vitest";
import { gameSession } from "../schema/session";
import { checksOf, fkByColumn, indexByName, indexesOf } from "./test-utils";

describe("GameSession — FK cascade policies", () => {
	it("userId FK cascades so sessions die with their owner", () => {
		expect(fkByColumn(gameSession, "user_id")).toEqual({
			columns: ["user_id"],
			foreignColumns: ["id"],
			foreignTable: "user",
			onDelete: "cascade",
		});
	});

	it("roomId FK uses set null so history survives room removal", () => {
		expect(fkByColumn(gameSession, "room_id")).toEqual({
			columns: ["room_id"],
			foreignColumns: ["id"],
			foreignTable: "room",
			onDelete: "set null",
		});
	});

	it("currencyId FK uses set null so history survives currency removal", () => {
		expect(fkByColumn(gameSession, "currency_id")).toEqual({
			columns: ["currency_id"],
			foreignColumns: ["id"],
			foreignTable: "currency",
			onDelete: "set null",
		});
	});
});

describe("GameSession — indexes", () => {
	it("indexes the user/kind/status, user/date, room and currency lookups", () => {
		expect(indexesOf(gameSession).filter((index) => !index.unique)).toEqual([
			{
				columns: ["user_id", "kind", "status"],
				name: "session_user_kind_status_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["user_id", "session_date"],
				name: "session_user_date_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["room_id"],
				name: "session_room_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["currency_id"],
				name: "session_currency_idx",
				unique: false,
				where: null,
			},
		]);
	});

	it("allows only one unfinished live session per user", () => {
		const index = indexByName(
			gameSession,
			"session_one_unfinished_live_per_user_idx"
		);
		expect(index).toMatchObject({ columns: ["user_id"], unique: true });
		expect(index?.where).toContain('"game_session"."source" = \'live\'');
		expect(index?.where).toContain('"game_session"."status" != \'completed\'');
	});
});

describe("GameSession — CHECK constraints", () => {
	it("session_manual_completed_check forces manual-source sessions to be completed", () => {
		const checks = checksOf(gameSession);
		expect(checks).toEqual([
			{
				name: "session_manual_completed_check",
				sql: expect.stringContaining("source != 'manual'"),
			},
		]);
		expect(checks[0]?.sql).toContain("status = 'completed'");
	});
});
