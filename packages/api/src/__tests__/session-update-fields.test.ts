import { describe, expect, it } from "vitest";
import { createCaller } from "./caller";

const CALLER = "user-1";
const OTHER = "user-2";

function makeCaller(select: Record<string, Record<string, unknown>[]> = {}) {
	return createCaller({ select, userId: CALLER });
}

const BASE_CASH_SESSION = {
	id: "session-1",
	userId: CALLER,
	kind: "cash_game",
	source: "manual",
	currencyId: null,
	sessionDate: new Date(1_700_000_000_000),
};

const BASE_TOURNAMENT_SESSION = {
	...BASE_CASH_SESSION,
	kind: "tournament",
};

describe("session.update syncs currencyTransaction for the recalculated P/L (SA2-116)", () => {
	it("creates a currency_transaction when a currencyId is newly linked to an existing cash session", async () => {
		const { caller, inserted } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [
				{
					sessionId: "session-1",
					variant: "NL Hold'em",
					mixGames: null,
					buyIn: 500,
					cashOut: 800,
					evCashOut: null,
				},
			],
			session_tournament_detail: [],
			session_chip_purchase: [],
			currency: [{ id: "c1", userId: CALLER }],
			transaction_type: [{ id: "tt1" }],
		});

		await caller.session.update({ id: "session-1", currencyId: "c1" });

		expect(inserted.currency_transaction).toHaveLength(1);
		expect(inserted.currency_transaction?.[0]).toMatchObject({
			currencyId: "c1",
			amount: 300,
		});
	});
});

describe("session.update session-row field pass-through (buildSessionUpdateFields)", () => {
	it("writes sessionDate, roomId, currencyId, breakMinutes, startedAt and clears endedAt in one call", async () => {
		const { caller, updated } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [
				{
					sessionId: "session-1",
					variant: "NL Hold'em",
					mixGames: null,
					buyIn: 100,
					cashOut: 200,
					evCashOut: null,
				},
			],
			session_tournament_detail: [],
			session_chip_purchase: [],
			room: [{ id: "room-1", userId: CALLER }],
			currency: [{ id: "currency-1", userId: CALLER }],
			transaction_type: [{ id: "tt1" }],
		});

		await caller.session.update({
			id: "session-1",
			sessionDate: 1_700_100_000,
			roomId: "room-1",
			currencyId: "currency-1",
			breakMinutes: 15,
			startedAt: 1_700_000_000,
			endedAt: null,
		});

		expect(updated.game_session?.[0]).toMatchObject({
			sessionDate: new Date(1_700_100_000 * 1000),
			roomId: "room-1",
			currencyId: "currency-1",
			breakMinutes: 15,
			startedAt: new Date(1_700_000_000 * 1000),
			endedAt: null,
		});
	});
});

describe("session.update tournament placement integrity skips validation once already beforeDeadline (SA2-161)", () => {
	it("resolves a placement patch above any total entries when the existing row is beforeDeadline", async () => {
		const { caller } = makeCaller({
			game_session: [BASE_TOURNAMENT_SESSION],
			session_tournament_detail: [
				{
					sessionId: "session-1",
					beforeDeadline: true,
					placement: null,
					totalEntries: null,
				},
			],
			session_cash_detail: [],
			session_chip_purchase: [],
		});

		await expect(
			caller.session.update({ id: "session-1", placement: 999 })
		).resolves.toMatchObject({ id: "session-1" });
	});
});

describe("session.update cash detail scalar pass-through (no ringGameId)", () => {
	it("writes every scalar cash-detail field in one update", async () => {
		const { caller, updated } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [
				{
					sessionId: "session-1",
					variant: "NL Hold'em",
					mixGames: null,
					ringGameId: null,
					buyIn: 100,
					cashOut: 200,
					evCashOut: null,
				},
			],
			session_tournament_detail: [],
			session_chip_purchase: [],
		});

		await caller.session.update({
			id: "session-1",
			buyIn: 300,
			cashOut: 900,
			evCashOut: 850,
			ruleName: "Weekly NLH",
			blind1: 2,
			blind2: 5,
			blind3: null,
			ante: 5,
			anteType: "bb",
			tableSize: 9,
			minBuyIn: 200,
			maxBuyIn: 1000,
		});

		expect(updated.session_cash_detail?.[0]).toMatchObject({
			buyIn: 300,
			cashOut: 900,
			evCashOut: 850,
			ruleName: "Weekly NLH",
			blind1: 2,
			blind2: 5,
			blind3: null,
			ante: 5,
			anteType: "bb",
			tableSize: 9,
			minBuyIn: 200,
			maxBuyIn: 1000,
		});
	});
});

describe("session.update ringGameId resolves cash-detail fields from the ring game snapshot", () => {
	it("copies the parent ring game's ruleName, variant, blinds, and limits into the cash detail", async () => {
		const { caller, updated } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [
				{
					sessionId: "session-1",
					variant: "NL Hold'em",
					mixGames: null,
					ringGameId: null,
					buyIn: 100,
					cashOut: 200,
					evCashOut: null,
				},
			],
			session_tournament_detail: [],
			session_chip_purchase: [],
			ring_game: [
				{
					id: "rg-1",
					userId: CALLER,
					name: "Sunday NLH",
					variant: "NL Hold'em",
					mixGames: null,
					blind1: 5,
					blind2: 10,
					blind3: null,
					ante: null,
					anteType: null,
					minBuyIn: 500,
					maxBuyIn: 2000,
					tableSize: 9,
				},
			],
		});

		await caller.session.update({ id: "session-1", ringGameId: "rg-1" });

		expect(updated.session_cash_detail?.[0]).toMatchObject({
			ringGameId: "rg-1",
			ruleName: "Sunday NLH",
			variant: "NL Hold'em",
			blind1: 5,
			blind2: 10,
			minBuyIn: 500,
			maxBuyIn: 2000,
			tableSize: 9,
		});
	});
});

describe("session.update inserts a cash detail row when none exists yet", () => {
	it("inserts session_cash_detail instead of updating when no row exists for the session", async () => {
		const { caller, inserted } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [],
			session_tournament_detail: [],
			session_chip_purchase: [],
		});

		await caller.session.update({ id: "session-1", buyIn: 100 });

		expect(inserted.session_cash_detail?.[0]).toMatchObject({
			sessionId: "session-1",
			buyIn: 100,
		});
	});
});

describe("session.update tournament detail insert with snapshot + overrides", () => {
	it("inserts session_tournament_detail, blind levels, and chip purchases together", async () => {
		const { caller, inserted } = makeCaller({
			game_session: [BASE_TOURNAMENT_SESSION],
			session_tournament_detail: [],
			session_cash_detail: [],
			session_chip_purchase: [],
			session_blind_level: [],
			tournament: [
				{
					id: "t1",
					roomId: "room-1",
					name: "Sunday Major",
					variant: "NL Hold'em",
					buyIn: 100,
					entryFee: 20,
					startingStack: 20_000,
					bountyAmount: null,
					tableSize: 9,
				},
			],
			room: [{ id: "room-1", userId: CALLER }],
		});

		await caller.session.update({
			id: "session-1",
			tournamentId: "t1",
			ruleName: "Custom Name",
			variant: "PLO",
			startingStack: 30_000,
			bountyAmount: 50,
			tableSize: 8,
			placement: 2,
			totalEntries: 50,
			prizeMoney: 900,
			bountyPrizes: 100,
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200, minutes: 20 }],
			chipPurchases: [{ name: "Rebuy", cost: 50, chips: 1000, count: 1 }],
		});

		expect(inserted.session_tournament_detail?.[0]).toMatchObject({
			sessionId: "session-1",
			tournamentId: "t1",
			ruleName: "Custom Name",
			variant: "PLO",
			startingStack: 30_000,
			bountyAmount: 50,
			tableSize: 8,
			placement: 2,
			totalEntries: 50,
			prizeMoney: 900,
			bountyPrizes: 100,
			tournamentBuyIn: 100,
			entryFee: 20,
		});
		expect(inserted.session_blind_level?.[0]).toEqual([
			expect.objectContaining({
				sessionId: "session-1",
				isBreak: false,
				blind1: 100,
				blind2: 200,
			}),
		]);
		expect(inserted.session_chip_purchase?.[0]).toEqual([
			expect.objectContaining({
				sessionId: "session-1",
				name: "Rebuy",
				cost: 50,
				chips: 1000,
			}),
		]);
	});

	it("clears tournamentId on an existing session_tournament_detail without touching ruleName or variant", async () => {
		const { caller, updated } = makeCaller({
			game_session: [BASE_TOURNAMENT_SESSION],
			session_tournament_detail: [
				{
					sessionId: "session-1",
					tournamentId: "t1",
					ruleName: "Sunday Major",
					variant: "NL Hold'em",
					beforeDeadline: true,
					placement: null,
					totalEntries: null,
				},
			],
			session_cash_detail: [],
			session_chip_purchase: [],
		});

		await caller.session.update({ id: "session-1", tournamentId: null });

		expect(updated.session_tournament_detail?.[0]).toMatchObject({
			tournamentId: null,
		});
		expect(updated.session_tournament_detail?.[0]).not.toHaveProperty(
			"ruleName"
		);
		expect(updated.session_tournament_detail?.[0]).not.toHaveProperty(
			"variant"
		);
	});
});

describe("session.update inline entity ownership checks", () => {
	it.each([
		{ field: "roomId", table: "room", value: "room-1" },
		{ field: "currencyId", table: "currency", value: "currency-1" },
		{ field: "ringGameId", table: "ring_game", value: "ring-1" },
	] as const)("rejects a foreign $field with FORBIDDEN before writing", async ({
		field,
		table,
		value,
	}) => {
		const { caller, updateWhereParams } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [],
			session_tournament_detail: [],
			[table]: [{ id: value, userId: OTHER }],
		});

		await expect(
			caller.session.update({ id: "session-1", [field]: value } as never)
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(updateWhereParams).toHaveLength(0);
	});

	it.each([
		{ field: "roomId", table: "room", value: "room-1" },
		{ field: "currencyId", table: "currency", value: "currency-1" },
		{ field: "ringGameId", table: "ring_game", value: "ring-1" },
	] as const)("accepts an owned $field and continues to write the session", async ({
		field,
		table,
		value,
	}) => {
		const { caller } = makeCaller({
			game_session: [BASE_CASH_SESSION],
			session_cash_detail: [],
			session_tournament_detail: [],
			session_chip_purchase: [],
			transaction_type: [{ id: "tt1" }],
			[table]: [{ id: value, userId: CALLER }],
		});

		await expect(
			caller.session.update({ id: "session-1", [field]: value } as never)
		).resolves.toMatchObject({ id: "session-1" });
	});

	it("rejects a foreign tournamentId with FORBIDDEN before writing", async () => {
		const { caller, updateWhereParams } = makeCaller({
			game_session: [BASE_TOURNAMENT_SESSION],
			session_tournament_detail: [],
			session_cash_detail: [],
			tournament: [{ id: "t1", roomId: "room-1" }],
			room: [{ id: "room-1", userId: OTHER }],
		});

		await expect(
			caller.session.update({ id: "session-1", tournamentId: "t1" })
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(updateWhereParams).toHaveLength(0);
	});

	it("accepts an owned tournamentId and continues to write the session", async () => {
		const { caller } = makeCaller({
			game_session: [BASE_TOURNAMENT_SESSION],
			session_tournament_detail: [],
			session_cash_detail: [],
			session_chip_purchase: [],
			tournament: [
				{
					id: "t1",
					roomId: "room-1",
					name: "Major",
					variant: "NL Hold'em",
					buyIn: 100,
					entryFee: 0,
					startingStack: null,
					bountyAmount: null,
					tableSize: null,
				},
			],
			room: [{ id: "room-1", userId: CALLER }],
		});

		await expect(
			caller.session.update({ id: "session-1", tournamentId: "t1" })
		).resolves.toMatchObject({ id: "session-1" });
	});
});
