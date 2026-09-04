import { describe, expect, it } from "vitest";
import { t } from "../index";
import { appRouter } from "../routers";
import { createChainableMockDb } from "./test-utils";

const createCaller = t.createCallerFactory(appRouter);

function callerFor(db: unknown, userId: string) {
	return createCaller({
		session: { user: { id: userId } },
		db,
	} as never);
}

const OWNER = "user-1";

function flatRows<T>(bucket: unknown[] | undefined): T[] {
	return (bucket ?? []).flatMap((value) =>
		Array.isArray(value) ? value : [value]
	) as T[];
}

const ownedSession = {
	id: "s1",
	userId: OWNER,
	kind: "tournament",
	status: "active",
	source: "live",
	roomId: null,
	currencyId: null,
};

describe("liveTournamentSession.getById update_stack payload handling", () => {
	it("ignores an update_stack event whose payload fails schema validation", async () => {
		const { db } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [],
				session_event: [
					{
						eventType: "update_stack",
						payload: JSON.stringify({ nope: 1 }),
					},
				],
				session_blind_level: [],
				session_chip_purchase: [],
			},
		});

		const result = await callerFor(db, OWNER).liveTournamentSession.getById({
			id: "s1",
		});

		expect(result.summary).toMatchObject({
			currentStack: null,
			maxStack: null,
			minStack: null,
		});
	});

	it("computes averageStack from startingStack, totalEntries, remainingPlayers and chip purchase totals", async () => {
		const { db } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [{ sessionId: "s1", startingStack: 20_000 }],
				session_event: [
					{
						eventType: "update_stack",
						payload: JSON.stringify({
							stackAmount: 5000,
							remainingPlayers: 4,
							totalEntries: 2,
							chipPurchaseCounts: [
								{ name: "Chips", count: 2, chipsPerUnit: 100 },
							],
						}),
					},
				],
				session_blind_level: [],
				session_chip_purchase: [],
			},
		});

		const result = await callerFor(db, OWNER).liveTournamentSession.getById({
			id: "s1",
		});

		expect(result.summary.averageStack).toBe(10_050);
	});

	it("keeps the earlier chipPurchaseCounts when a later update_stack sends an empty list", async () => {
		const { db } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [{ sessionId: "s1", startingStack: 20_000 }],
				session_event: [
					{
						eventType: "update_stack",
						payload: JSON.stringify({
							stackAmount: 5000,
							remainingPlayers: 4,
							totalEntries: 2,
							chipPurchaseCounts: [
								{ name: "Chips", count: 2, chipsPerUnit: 100 },
							],
						}),
					},
					{
						eventType: "update_stack",
						payload: JSON.stringify({
							stackAmount: 6000,
							remainingPlayers: 4,
							totalEntries: 2,
							chipPurchaseCounts: [],
						}),
					},
				],
				session_blind_level: [],
				session_chip_purchase: [],
			},
		});

		const result = await callerFor(db, OWNER).liveTournamentSession.getById({
			id: "s1",
		});

		expect(result.summary.averageStack).toBe(10_050);
	});
});

describe("liveTournamentSession.update timerStartedAt on session_tournament_detail", () => {
	it.each([
		[1_700_000_000, new Date(1_700_000_000 * 1000)],
		[null, null],
	])("converts timerStartedAt=%s to the stored detail value", async (input, expected) => {
		const { db, updated } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [{ sessionId: "s1", tournamentId: null }],
				session_event: [],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			timerStartedAt: input,
		});

		expect(updated.session_tournament_detail?.[0]).toMatchObject({
			timerStartedAt: expected,
		});
	});

	it("inserts a new session_tournament_detail row when none exists yet", async () => {
		const { db, inserted } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [],
				session_event: [],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			timerStartedAt: 100,
		});

		expect(inserted.session_tournament_detail?.[0]).toMatchObject({
			sessionId: "s1",
			timerStartedAt: new Date(100_000),
		});
	});
});

describe("liveTournamentSession.update session_start event sync", () => {
	it("does not touch session_event when no session_start event exists yet", async () => {
		const { db, updated } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [{ sessionId: "s1", tournamentId: null }],
				session_event: [],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			timerStartedAt: 100,
		});

		expect(updated.session_event).toBeUndefined();
	});

	it.each([
		[100_000, 100_000],
		[null, null],
	])("writes timerStartedAt=%s into the existing session_start payload", async (input, expected) => {
		const { db, updated } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [{ sessionId: "s1", tournamentId: null }],
				session_event: [
					{
						id: "ev-1",
						eventType: "session_start",
						payload: "{}",
					},
				],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			timerStartedAt: input,
		});

		const row = updated.session_event?.[0] as { payload: string };
		expect(JSON.parse(row.payload).timerStartedAt).toBe(expected);
	});
});

describe("liveTournamentSession.update assigning a tournament", () => {
	it("adopts the tournament's room/currency and re-snapshots the detail and structure", async () => {
		const { db, updated, inserted } = createChainableMockDb({
			select: {
				game_session: [{ ...ownedSession, roomId: null, currencyId: null }],
				session_tournament_detail: [],
				tournament: [
					{
						id: "tn-1",
						roomId: "room-1",
						currencyId: "cur-1",
						name: "Main Event",
						variant: "nlh",
						buyIn: 10_000,
						entryFee: 1000,
						startingStack: 20_000,
						bountyAmount: null,
						tableSize: 9,
					},
				],
				room: [{ id: "room-1", userId: OWNER }],
				blind_level: [
					{ level: 1, isBreak: false, blind1: 100, blind2: 200, minutes: 15 },
				],
				tournament_chip_purchase: [
					{
						id: "tcp-1",
						name: "100 chips",
						cost: 500,
						chips: 100,
						sortOrder: 0,
					},
				],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			tournamentId: "tn-1",
		});

		expect(updated.game_session?.[0]).toMatchObject({
			roomId: "room-1",
			currencyId: "cur-1",
		});
		expect(inserted.session_tournament_detail?.[0]).toMatchObject({
			sessionId: "s1",
			tournamentId: "tn-1",
			ruleName: "Main Event",
			variant: "nlh",
			startingStack: 20_000,
			tableSize: 9,
			tournamentBuyIn: 10_000,
			entryFee: 1000,
		});
		expect(flatRows(inserted.session_blind_level)[0]).toMatchObject({
			sessionId: "s1",
			level: 1,
			blind1: 100,
			blind2: 200,
		});
		expect(flatRows(inserted.session_chip_purchase)[0]).toMatchObject({
			sessionId: "s1",
			name: "100 chips",
			cost: 500,
			chips: 100,
		});
	});
});

describe("liveTournamentSession.update recalculates a completed session on currency change", () => {
	it("writes the recomputed profit onto the existing currency_transaction row", async () => {
		const { db, updated } = createChainableMockDb({
			select: {
				game_session: [
					{ ...ownedSession, status: "completed", currencyId: "cur-a" },
				],
				currency: [{ id: "cur-b", userId: OWNER }],
				session_tournament_detail: [
					{
						sessionId: "s1",
						tournamentId: null,
						tournamentBuyIn: 100,
						entryFee: 10,
					},
				],
				session_event: [
					{
						eventType: "session_start",
						occurredAt: new Date(1000),
						payload: "{}",
					},
					{
						eventType: "session_end",
						occurredAt: new Date(2000),
						payload: JSON.stringify({
							beforeDeadline: true,
							prizeMoney: 500,
							bountyPrizes: 0,
						}),
					},
				],
				session_chip_purchase: [],
				currency_transaction: [{ id: "ctx-1", sessionId: "s1" }],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.update({
			id: "s1",
			currencyId: "cur-b",
		});

		expect(updated.currency_transaction?.[0]).toMatchObject({
			amount: 390,
			currencyId: "cur-a",
		});
	});
});

describe("liveTournamentSession.updateSnapshot writes", () => {
	it("writes every provided snapshot field onto session_tournament_detail", async () => {
		const { db, updated } = createChainableMockDb({
			select: { game_session: [ownedSession] },
		});

		await callerFor(db, OWNER).liveTournamentSession.updateSnapshot({
			id: "s1",
			ruleName: "Main Event",
			variant: "PLO",
			tournamentBuyIn: 5000,
			entryFee: 500,
			startingStack: 30_000,
			bountyAmount: 1000,
			tableSize: 8,
		});

		expect(updated.session_tournament_detail?.[0]).toMatchObject({
			ruleName: "Main Event",
			variant: "PLO",
			tournamentBuyIn: 5000,
			entryFee: 500,
			startingStack: 30_000,
			bountyAmount: 1000,
			tableSize: 8,
		});
	});

	it("writes nothing to session_tournament_detail when no snapshot field is provided", async () => {
		const { db, updated } = createChainableMockDb({
			select: { game_session: [ownedSession] },
		});

		await callerFor(db, OWNER).liveTournamentSession.updateSnapshot({
			id: "s1",
		});

		expect(updated.session_tournament_detail).toBeUndefined();
	});

	it("re-snapshots blind levels and chip purchases with counts reset to zero", async () => {
		const { db, inserted } = createChainableMockDb({
			select: { game_session: [ownedSession] },
		});

		await callerFor(db, OWNER).liveTournamentSession.updateSnapshot({
			id: "s1",
			blindLevels: [{ isBreak: false, blind1: 100, blind2: 200, minutes: 15 }],
			chipPurchases: [{ name: "100 chips", cost: 500, chips: 100 }],
		});

		expect(flatRows(inserted.session_blind_level)[0]).toMatchObject({
			sessionId: "s1",
			level: 1,
			blind1: 100,
			blind2: 200,
		});
		expect(flatRows(inserted.session_chip_purchase)[0]).toMatchObject({
			sessionId: "s1",
			name: "100 chips",
			cost: 500,
			chips: 100,
		});
		expect(flatRows(inserted.session_chip_purchase_result)[0]).toMatchObject({
			count: 0,
		});
	});
});

describe("liveTournamentSession.updateHeroSeat", () => {
	it("does not insert a session_event when clearing an already-empty hero seat", async () => {
		const { db, inserted } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [],
				session_event: [],
			},
		});

		await expect(
			callerFor(db, OWNER).liveTournamentSession.updateHeroSeat({
				id: "s1",
				heroSeatPosition: null,
			})
		).resolves.toEqual({ id: "s1" });
		expect(inserted.session_event).toBeUndefined();
	});

	it("inserts a player_leave event carrying the hero flag when clearing a seated hero", async () => {
		const { db, inserted } = createChainableMockDb({
			select: {
				game_session: [ownedSession],
				session_tournament_detail: [],
				session_event: [
					{
						eventType: "player_join",
						payload: JSON.stringify({ isHero: true, seatPosition: 3 }),
					},
				],
			},
		});

		await callerFor(db, OWNER).liveTournamentSession.updateHeroSeat({
			id: "s1",
			heroSeatPosition: null,
		});

		const rows = inserted.session_event as {
			eventType: string;
			payload: string;
		}[];
		expect(rows[0]?.eventType).toBe("player_leave");
		expect(JSON.parse(rows[0]?.payload ?? "{}")).toEqual({ isHero: true });
	});
});
