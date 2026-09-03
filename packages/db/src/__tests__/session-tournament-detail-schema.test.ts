import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import { sessionTournamentDetail } from "../schema/session-tournament-detail";
import { fkByColumn, indexesOf } from "./test-utils";

describe("SessionTournamentDetail — snapshot defaults", () => {
	it("ruleName defaults to 'Untitled' so ADD COLUMN succeeds on existing rows", () => {
		expect(getTableColumns(sessionTournamentDetail).ruleName.default).toBe(
			"Untitled"
		);
	});

	it("variant defaults to DEFAULT_VARIANT_LABEL so ADD COLUMN succeeds on existing rows (c12: not the stale 'nlh' key)", () => {
		expect(getTableColumns(sessionTournamentDetail).variant.default).toBe(
			DEFAULT_VARIANT_LABEL
		);
	});
});

describe("SessionTournamentDetail — FK cascade policies", () => {
	it("sessionId FK cascades so the detail dies with its session", () => {
		expect(fkByColumn(sessionTournamentDetail, "session_id")).toEqual({
			columns: ["session_id"],
			foreignColumns: ["id"],
			foreignTable: "game_session",
			onDelete: "cascade",
		});
	});

	it("tournamentId FK uses set null so the detail survives tournament removal", () => {
		expect(fkByColumn(sessionTournamentDetail, "tournament_id")).toEqual({
			columns: ["tournament_id"],
			foreignColumns: ["id"],
			foreignTable: "tournament",
			onDelete: "set null",
		});
	});
});

describe("SessionTournamentDetail — indexes", () => {
	it("indexes tournamentId for tournament lookups", () => {
		expect(indexesOf(sessionTournamentDetail)).toEqual([
			{
				columns: ["tournament_id"],
				name: "session_tournament_tournament_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
