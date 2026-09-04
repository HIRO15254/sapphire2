import { describe, expect, it } from "vitest";
import { fetchStatsRows } from "../routers/stats";
import { createChainableMockDb } from "./test-utils";

function rawRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "s1",
		userId: "user-1",
		type: "cash_game",
		kind: "cash_game",
		sessionDate: new Date("2023-11-14T00:00:00Z"),
		startedAt: null,
		endedAt: null,
		breakMinutes: null,
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		chipRemoveTotal: null,
		blind1: null,
		blind2: null,
		cashVariant: null,
		tournamentVariant: null,
		tournamentBuyIn: null,
		entryFee: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		bountyPrizes: null,
		roomId: "room-1",
		roomName: "Aria",
		...overrides,
	};
}

describe("fetchStatsRows play minutes computation", () => {
	it.each([
		[
			"subtracts break minutes from the elapsed time",
			new Date("2023-11-14T10:00:00Z"),
			new Date("2023-11-14T11:00:00Z"),
			10,
			50,
		],
		[
			"clamps to 0 when the break exceeds the elapsed time",
			new Date("2023-11-14T10:00:00Z"),
			new Date("2023-11-14T10:10:00Z"),
			100,
			0,
		],
	])("%s", async (_case, startedAt, endedAt, breakMinutes, expected) => {
		const { db } = createChainableMockDb({
			select: {
				game_session: [rawRow({ startedAt, endedAt, breakMinutes })],
			},
		});

		const rows = await fetchStatsRows(db, "user-1", { normalized: false });

		expect(rows[0]?.playMinutes).toBe(expected);
	});

	it("returns null play minutes when endedAt is missing", async () => {
		const { db } = createChainableMockDb({
			select: {
				game_session: [
					rawRow({
						startedAt: new Date("2023-11-14T10:00:00Z"),
						endedAt: null,
					}),
				],
			},
		});

		const rows = await fetchStatsRows(db, "user-1", { normalized: false });

		expect(rows[0]?.playMinutes).toBeNull();
	});
});

describe("fetchStatsRows type and date range filtering", () => {
	it("returns only the row matching the type filter when evaluateWhere evaluates the WHERE clause", async () => {
		const { db } = createChainableMockDb({
			evaluateWhere: true,
			select: {
				game_session: [
					rawRow({ id: "cash-match", type: "cash_game", kind: "cash_game" }),
					rawRow({
						id: "tourney-outside",
						type: "tournament",
						kind: "tournament",
					}),
				],
			},
		});

		const rows = await fetchStatsRows(db, "user-1", {
			type: "cash_game",
			normalized: false,
		});

		expect(rows.map((r) => r.id)).toEqual(["cash-match"]);
	});

	it("binds the type filter and the date range bounds into the WHERE clause", async () => {
		const dateFrom = Math.floor(
			new Date("2024-01-01T00:00:00Z").getTime() / 1000
		);
		const dateTo = Math.floor(
			new Date("2024-01-31T00:00:00Z").getTime() / 1000
		);
		const { db, selectWhereParams } = createChainableMockDb({
			select: { game_session: [] },
		});

		await fetchStatsRows(db, "user-1", {
			type: "cash_game",
			dateFrom,
			dateTo,
			normalized: false,
		});

		expect(selectWhereParams).toHaveLength(1);
		expect(selectWhereParams[0]).toEqual([
			"user-1",
			"cash_game",
			dateFrom,
			dateTo,
		]);
	});
});
