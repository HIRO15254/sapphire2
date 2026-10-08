import { describe, expect } from "vitest";
import {
	getLiveCashGameSessionFromEntry,
	listLiveCashGameSessionsFromEntries,
} from "../routers/live-cash-game-session";
import {
	getLiveTournamentSessionFromEntry,
	listLiveTournamentSessionsFromEntries,
} from "../routers/live-tournament-session";
import { listSessionEventsFromPlayEvents } from "../routers/session-event";
import {
	backfillEntryTables,
	retireMovedLegacyColumns,
} from "./entry-cutover-fixture";
import { requireCreatedRow, test } from "./test-fixture";

const LIST_INPUTS = [
	{ limit: 20 },
	{ status: "active", limit: 20 },
	{ status: "paused", limit: 20 },
	{ status: "completed", limit: 20 },
] as const;

const MAX_PAGES = 10;

function rejectionOf(read: Promise<unknown>) {
	return read.then(
		() => null,
		(error: { code?: string; message?: string }) => ({
			code: error.code,
			message: error.message,
		})
	);
}

async function readEach<Input, Output>(
	inputs: readonly Input[],
	read: (input: Input) => Promise<Output>
): Promise<Output[]> {
	const results: Output[] = [];
	for (const input of inputs) {
		results.push(await read(input));
	}
	return results;
}

async function readAllPages<Page extends { nextCursor?: string }>(
	read: (cursor: string | undefined) => Promise<Page>
): Promise<Page[]> {
	const pages: Page[] = [];
	let cursor: string | undefined;
	do {
		const page = await read(cursor);
		pages.push(page);
		cursor = page.nextCursor;
	} while (cursor && pages.length < MAX_PAGES);
	return pages;
}

function withFirstPlayStartAsSessionDate<
	Row extends { sessionDate: Date; startedAt: Date | null; status: string },
>(row: Row): Row {
	if (row.status === "completed" || row.startedAt === null) {
		return row;
	}
	return { ...row, sessionDate: row.startedAt };
}

function withFirstPlayStartInPage<
	Page extends {
		items: { sessionDate: Date; startedAt: Date | null; status: string }[];
	},
>(page: Page): Page {
	return { ...page, items: page.items.map(withFirstPlayStartAsSessionDate) };
}

describe("prep read assembly for live sessions (characterization until the T07 cutover makes it the only path)", () => {
	test("live cash list and getById built from entry tables equal today's output after the moved columns are retired", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Bankroll", unit: "JPY" })
		);
		const master = requireCreatedRow(
			await api.alice.ringGame.create({
				roomId: club.id,
				name: "NLH 1/2",
				blind1: 1,
				blind2: 2,
			})
		);

		const reopened = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				roomId: club.id,
				ringGameId: master.id,
				currencyId: wallet.id,
				memo: "Reopened table",
				initialBuyIn: 200,
			})
		);
		for (const [eventType, payload] of [
			["update_stack", { stackAmount: 260 }],
			["all_in", { potSize: 400, trials: 1, equity: 60, wins: 1 }],
			["chips_add_remove", { amount: 100 }],
			["chips_add_remove", { amount: -50 }],
			["session_pause", {}],
			["session_resume", {}],
		] as const) {
			await api.alice.sessionEvent.create({
				sessionId: reopened.id,
				eventType,
				payload,
			});
		}
		await api.alice.liveCashGameSession.complete({
			id: reopened.id,
			finalStack: 380,
		});
		await api.alice.liveCashGameSession.reopen({ id: reopened.id });
		await api.alice.liveCashGameSession.complete({
			id: reopened.id,
			finalStack: 420,
		});

		const settled = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 100 })
		);
		await api.alice.liveCashGameSession.complete({
			id: settled.id,
			finalStack: 0,
		});

		const running = requireCreatedRow(
			await api.alice.liveCashGameSession.create({
				currencyId: wallet.id,
				initialBuyIn: 300,
			})
		);
		await api.alice.sessionEvent.create({
			sessionId: running.id,
			eventType: "update_stack",
			payload: { stackAmount: 310 },
		});

		const bobPaused = requireCreatedRow(
			await api.bob.liveCashGameSession.create({ initialBuyIn: 50 })
		);
		await api.bob.sessionEvent.create({
			sessionId: bobPaused.id,
			eventType: "session_pause",
			payload: {},
		});

		const aliceIds = [reopened.id, settled.id, running.id];
		const todayLists = await readEach(LIST_INPUTS, (input) =>
			api.alice.liveCashGameSession.list(input)
		);
		const todayBobPaused = await api.bob.liveCashGameSession.list(
			LIST_INPUTS[2]
		);
		const todayPages = await readAllPages((cursor) =>
			api.alice.liveCashGameSession.list({ limit: 1, cursor })
		);
		const todayDetails = await readEach(aliceIds, (id) =>
			api.alice.liveCashGameSession.getById({ id })
		);
		const todayBobDetail = await api.bob.liveCashGameSession.getById({
			id: bobPaused.id,
		});
		const todayEvents = await readEach(aliceIds, (id) =>
			api.alice.sessionEvent.list({ sessionId: id })
		);
		const todayRejections = [
			await rejectionOf(
				api.bob.liveCashGameSession.getById({ id: reopened.id })
			),
			await rejectionOf(
				api.alice.liveCashGameSession.getById({ id: "missing-session" })
			),
			await rejectionOf(api.bob.sessionEvent.list({ sessionId: reopened.id })),
			await rejectionOf(api.alice.sessionEvent.list({})),
		];

		expect(todayLists[0]?.items.map(({ id, status }) => [id, status])).toEqual(
			expect.arrayContaining([
				[reopened.id, "completed"],
				[settled.id, "completed"],
				[running.id, "active"],
			])
		);
		expect(todayBobPaused.items.map(({ id }) => id)).toEqual([bobPaused.id]);
		expect(todayPages.map(({ items }) => items.map(({ id }) => id))).toEqual(
			(todayLists[0]?.items ?? []).map(({ id }) => [id])
		);
		expect(todayRejections.map((rejection) => rejection?.code)).toEqual([
			"FORBIDDEN",
			"FORBIDDEN",
			"FORBIDDEN",
			"BAD_REQUEST",
		]);

		await backfillEntryTables(api.d1);
		await retireMovedLegacyColumns(api.d1);

		const entryLists = await readEach(LIST_INPUTS, (input) =>
			listLiveCashGameSessionsFromEntries(api.db, "alice", input)
		);
		expect(entryLists).toEqual(todayLists.map(withFirstPlayStartInPage));
		expect(
			await listLiveCashGameSessionsFromEntries(api.db, "bob", LIST_INPUTS[2])
		).toEqual(withFirstPlayStartInPage(todayBobPaused));
		expect(
			await readAllPages((cursor) =>
				listLiveCashGameSessionsFromEntries(api.db, "alice", {
					limit: 1,
					cursor,
				})
			)
		).toEqual(todayPages.map(withFirstPlayStartInPage));

		const entryDetails = await readEach(aliceIds, (id) =>
			getLiveCashGameSessionFromEntry(api.db, "alice", { id })
		);
		expect(entryDetails).toEqual(
			todayDetails.map(withFirstPlayStartAsSessionDate)
		);
		expect(
			await getLiveCashGameSessionFromEntry(api.db, "bob", {
				id: bobPaused.id,
			})
		).toEqual(withFirstPlayStartAsSessionDate(todayBobDetail));

		const entryEvents = await readEach(aliceIds, (id) =>
			listSessionEventsFromPlayEvents(api.db, "alice", { sessionId: id })
		);
		expect(entryEvents).toEqual(todayEvents);

		expect([
			await rejectionOf(
				getLiveCashGameSessionFromEntry(api.db, "bob", { id: reopened.id })
			),
			await rejectionOf(
				getLiveCashGameSessionFromEntry(api.db, "alice", {
					id: "missing-session",
				})
			),
			await rejectionOf(
				listSessionEventsFromPlayEvents(api.db, "bob", {
					sessionId: reopened.id,
				})
			),
			await rejectionOf(listSessionEventsFromPlayEvents(api.db, "alice", {})),
		]).toEqual(todayRejections);
	});

	test("live tournament list and getById built from entry tables equal today's output after the moved columns are retired", async ({
		api,
	}) => {
		const club = requireCreatedRow(
			await api.alice.room.create({ name: "Club" })
		);
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Bankroll", unit: "JPY" })
		);
		const master = requireCreatedRow(
			await api.alice.tournament.createWithLevels({
				roomId: club.id,
				name: "Daily Deepstack",
				buyIn: 10_000,
				entryFee: 1000,
				startingStack: 30_000,
				chipPurchases: [{ name: "Add-on", cost: 5000, chips: 20_000 }],
				blindLevels: [
					{ isBreak: false, blind1: 100, blind2: 200, ante: 200, minutes: 20 },
					{ isBreak: true, minutes: 10 },
				],
			})
		);

		const cashSession = requireCreatedRow(
			await api.alice.liveCashGameSession.create({ initialBuyIn: 10 })
		);
		await api.alice.liveCashGameSession.complete({
			id: cashSession.id,
			finalStack: 10,
		});

		const placed = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				roomId: club.id,
				tournamentId: master.id,
				currencyId: wallet.id,
				memo: "Final table",
				timerStartedAt: 1_790_000_000,
			})
		);
		const placedBefore = await api.alice.liveTournamentSession.getById({
			id: placed.id,
		});
		const addOn = placedBefore.chipPurchases[0];
		if (!addOn) {
			throw new Error("Expected the tournament master's add-on to be copied");
		}
		for (const [eventType, payload] of [
			[
				"update_stack",
				{ stackAmount: 28_000, remainingPlayers: 40, totalEntries: 50 },
			],
			[
				"purchase_chips",
				{
					sessionChipPurchaseId: addOn.id,
					name: addOn.name,
					cost: addOn.cost,
					chips: addOn.chips,
				},
			],
			[
				"update_stack",
				{
					stackAmount: 52_000,
					remainingPlayers: 20,
					totalEntries: 55,
					chipPurchaseCounts: [
						{ name: "Add-on", count: 1, chipsPerUnit: 20_000 },
					],
				},
			],
		] as const) {
			await api.alice.sessionEvent.create({
				sessionId: placed.id,
				eventType,
				payload,
			});
		}
		await api.alice.liveTournamentSession.complete({
			id: placed.id,
			beforeDeadline: false,
			placement: 3,
			totalEntries: 55,
			prizeMoney: 40_000,
			bountyPrizes: 5000,
		});

		const earlyExit = requireCreatedRow(
			await api.alice.liveTournamentSession.create({ buyIn: 2000 })
		);
		await api.alice.liveTournamentSession.complete({
			id: earlyExit.id,
			beforeDeadline: true,
			prizeMoney: 0,
			bountyPrizes: 0,
		});

		const running = requireCreatedRow(
			await api.alice.liveTournamentSession.create({
				buyIn: 3000,
				timerStartedAt: 1_790_100_000,
			})
		);
		await api.alice.sessionEvent.create({
			sessionId: running.id,
			eventType: "update_stack",
			payload: { stackAmount: 9000, remainingPlayers: 12, totalEntries: 30 },
		});

		const bobPaused = requireCreatedRow(
			await api.bob.liveTournamentSession.create({ buyIn: 1000 })
		);
		await api.bob.sessionEvent.create({
			sessionId: bobPaused.id,
			eventType: "session_pause",
			payload: {},
		});

		const aliceIds = [placed.id, earlyExit.id, running.id];
		const todayLists = await readEach(LIST_INPUTS, (input) =>
			api.alice.liveTournamentSession.list(input)
		);
		const todayBobPaused = await api.bob.liveTournamentSession.list(
			LIST_INPUTS[2]
		);
		const todayPages = await readAllPages((cursor) =>
			api.alice.liveTournamentSession.list({ limit: 1, cursor })
		);
		const todayDetails = await readEach(aliceIds, (id) =>
			api.alice.liveTournamentSession.getById({ id })
		);
		const todayBobDetail = await api.bob.liveTournamentSession.getById({
			id: bobPaused.id,
		});
		const todayEvents = await readEach(aliceIds, (id) =>
			api.alice.sessionEvent.list({ liveTournamentSessionId: id })
		);
		const todayRejections = [
			await rejectionOf(
				api.bob.liveTournamentSession.getById({ id: placed.id })
			),
			await rejectionOf(
				api.alice.liveTournamentSession.getById({ id: "missing-session" })
			),
			await rejectionOf(
				api.alice.liveTournamentSession.getById({ id: cashSession.id })
			),
			await rejectionOf(
				api.bob.sessionEvent.list({ liveTournamentSessionId: placed.id })
			),
		];

		expect(todayLists[0]?.items.map(({ id, status }) => [id, status])).toEqual(
			expect.arrayContaining([
				[placed.id, "completed"],
				[earlyExit.id, "completed"],
				[running.id, "active"],
			])
		);
		expect(todayDetails[0]?.summary).toMatchObject({
			placement: 3,
			chipPurchaseCost: 5000,
		});
		expect(todayDetails[0]?.timerStartedAt).toEqual(
			new Date(1_790_000_000 * 1000)
		);
		expect(todayBobPaused.items.map(({ id }) => id)).toEqual([bobPaused.id]);
		expect(todayPages.map(({ items }) => items.map(({ id }) => id))).toEqual(
			(todayLists[0]?.items ?? []).map(({ id }) => [id])
		);
		expect(todayRejections.map((rejection) => rejection?.code)).toEqual([
			"FORBIDDEN",
			"FORBIDDEN",
			"FORBIDDEN",
			"FORBIDDEN",
		]);

		await backfillEntryTables(api.d1);
		await retireMovedLegacyColumns(api.d1);

		const entryLists = await readEach(LIST_INPUTS, (input) =>
			listLiveTournamentSessionsFromEntries(api.db, "alice", input)
		);
		expect(entryLists).toEqual(todayLists.map(withFirstPlayStartInPage));
		expect(
			await listLiveTournamentSessionsFromEntries(api.db, "bob", LIST_INPUTS[2])
		).toEqual(withFirstPlayStartInPage(todayBobPaused));
		expect(
			await readAllPages((cursor) =>
				listLiveTournamentSessionsFromEntries(api.db, "alice", {
					limit: 1,
					cursor,
				})
			)
		).toEqual(todayPages.map(withFirstPlayStartInPage));

		const entryDetails = await readEach(aliceIds, (id) =>
			getLiveTournamentSessionFromEntry(api.db, "alice", { id })
		);
		expect(entryDetails).toEqual(
			todayDetails.map(withFirstPlayStartAsSessionDate)
		);
		expect(
			await getLiveTournamentSessionFromEntry(api.db, "bob", {
				id: bobPaused.id,
			})
		).toEqual(withFirstPlayStartAsSessionDate(todayBobDetail));

		const entryEvents = await readEach(aliceIds, (id) =>
			listSessionEventsFromPlayEvents(api.db, "alice", {
				liveTournamentSessionId: id,
			})
		);
		expect(entryEvents).toEqual(todayEvents);

		expect([
			await rejectionOf(
				getLiveTournamentSessionFromEntry(api.db, "bob", { id: placed.id })
			),
			await rejectionOf(
				getLiveTournamentSessionFromEntry(api.db, "alice", {
					id: "missing-session",
				})
			),
			await rejectionOf(
				getLiveTournamentSessionFromEntry(api.db, "alice", {
					id: cashSession.id,
				})
			),
			await rejectionOf(
				listSessionEventsFromPlayEvents(api.db, "bob", {
					liveTournamentSessionId: placed.id,
				})
			),
		]).toEqual(todayRejections);
	});
});
