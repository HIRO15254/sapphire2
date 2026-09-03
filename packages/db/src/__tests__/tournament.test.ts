import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEFAULT_VARIANT_LABEL } from "../constants/game-variants";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "../schema/tournament";
import { tournamentTag } from "../schema/tournament-tag";
import { fkByColumn, indexesOf } from "./test-utils";

describe("Tournament — FKs, indexes, and defaults", () => {
	it("roomId FK cascades so tournaments die with their room", () => {
		expect(fkByColumn(tournament, "room_id")).toEqual({
			columns: ["room_id"],
			foreignColumns: ["id"],
			foreignTable: "room",
			onDelete: "cascade",
		});
	});

	it("currencyId FK sets null so tournaments survive currency deletion", () => {
		expect(fkByColumn(tournament, "currency_id")).toEqual({
			columns: ["currency_id"],
			foreignColumns: ["id"],
			foreignTable: "currency",
			onDelete: "set null",
		});
	});

	it("indexes roomId and currencyId for room listing and reverse currency lookups", () => {
		expect(indexesOf(tournament)).toEqual([
			{
				columns: ["room_id"],
				name: "tournament_roomId_idx",
				unique: false,
				where: null,
			},
			{
				columns: ["currency_id"],
				name: "tournament_currencyId_idx",
				unique: false,
				where: null,
			},
		]);
	});

	it("variant defaults to DEFAULT_VARIANT_LABEL (c12: not the stale 'nlh' key)", () => {
		expect(getTableColumns(tournament).variant.default).toBe(
			DEFAULT_VARIANT_LABEL
		);
	});
});

describe("TournamentTag — FKs and indexes", () => {
	it("tournamentId FK cascades (tags die with their tournament)", () => {
		expect(fkByColumn(tournamentTag, "tournament_id")).toEqual({
			columns: ["tournament_id"],
			foreignColumns: ["id"],
			foreignTable: "tournament",
			onDelete: "cascade",
		});
	});

	it("indexes tournamentId for per-tournament tag lookups", () => {
		expect(indexesOf(tournamentTag)).toEqual([
			{
				columns: ["tournament_id"],
				name: "tournamentTag_tournamentId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

describe("BlindLevel — FKs and indexes", () => {
	it("tournamentId FK cascades (levels die with their tournament)", () => {
		expect(fkByColumn(blindLevel, "tournament_id")).toEqual({
			columns: ["tournament_id"],
			foreignColumns: ["id"],
			foreignTable: "tournament",
			onDelete: "cascade",
		});
	});

	it("indexes tournamentId for per-tournament level lookups", () => {
		expect(indexesOf(blindLevel)).toEqual([
			{
				columns: ["tournament_id"],
				name: "blindLevel_tournamentId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});

describe("TournamentChipPurchase — FKs and indexes", () => {
	it("tournamentId FK cascades so chip purchases die with their tournament", () => {
		expect(fkByColumn(tournamentChipPurchase, "tournament_id")).toEqual({
			columns: ["tournament_id"],
			foreignColumns: ["id"],
			foreignTable: "tournament",
			onDelete: "cascade",
		});
	});

	it("indexes tournamentId for per-tournament purchase lookups", () => {
		expect(indexesOf(tournamentChipPurchase)).toEqual([
			{
				columns: ["tournament_id"],
				name: "tournamentChipPurchase_tournamentId_idx",
				unique: false,
				where: null,
			},
		]);
	});
});
