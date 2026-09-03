import { describe, expect, it } from "vitest";
import { sessionBlindLevel } from "../schema/session-blind-level";
import { fkByColumn, indexesOf } from "./test-utils";

describe("SessionBlindLevel — FK cascade policies", () => {
	it("sessionId FK cascades so the frozen snapshot dies with its session", () => {
		expect(fkByColumn(sessionBlindLevel, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});
});

describe("SessionBlindLevel — indexes", () => {
	it("indexes sessionId for per-session level lookups", () => {
		expect(indexesOf(sessionBlindLevel)).toEqual([
			{
				columns: ["session_id"],
				name: "session_blind_level_session_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
