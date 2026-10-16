import type { Database } from "@sapphire2/db";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import {
	entry,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { chunkForInsert } from "../lib/batch";
import { listEntryPlayEvents } from "../services/entry-live-reads";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	type LiveEntryStart,
	updateEntryHeroSeat,
} from "../services/entry-live-writes";
import { type ApiFixture, requireCreatedRow, test } from "./test-fixture";

const START = new Date("2026-09-05T10:00:00.000Z");
const LOCAL_DATE = "2026-09-05";

function minutes(count: number): Date {
	return new Date(START.getTime() + count * 60_000);
}

function cashStart(overrides: Partial<LiveEntryStart> = {}): LiveEntryStart {
	return {
		id: "live-1",
		userId: "alice",
		detail: { kind: "cash", ringGameId: null },
		assetId: null,
		roomId: null,
		title: "Cash Game",
		memo: null,
		localDate: LOCAL_DATE,
		now: START,
		startEvent: { occurredAt: START, payload: { buyInAmount: 1000 } },
		...overrides,
	};
}

async function startLive(api: ApiFixture, start = cashStart()) {
	await api.db.batch(
		buildLiveEntryStartStatements(api.db, start) as [never, ...never[]]
	);
	return start.id;
}

async function everyRow(db: Database) {
	return {
		anchors: await db.select().from(gameSession),
		entries: await db.select().from(entry),
		tournaments: await db.select().from(entryTournament),
		plays: await db.select().from(playSession),
		events: await db.select().from(playEvent).orderBy(asc(playEvent.sortOrder)),
		cashMoney: await db.select().from(sessionCashDetail),
		tournamentMoney: await db.select().from(sessionTournamentDetail),
		chipResults: await db.select().from(sessionChipPurchaseResult),
		transactions: await db.select().from(currencyTransaction),
	};
}

async function forceFailure(api: ApiFixture, trigger: string) {
	await api.d1
		.prepare(
			`CREATE TRIGGER test_fail ${trigger} BEGIN SELECT RAISE(ABORT, 'test forced failure'); END;`
		)
		.run();
}

function errorMessages(error: unknown): string {
	const messages: string[] = [];
	for (
		let cause: unknown = error;
		cause instanceof Error;
		cause = cause.cause
	) {
		messages.push(cause.message);
	}
	return messages.join("\n");
}

function only<T>(rows: readonly T[]): T {
	expect(rows).toHaveLength(1);
	return rows[0] as T;
}

async function onlyPlay(db: Database, entryId: string) {
	const plays = await db
		.select()
		.from(playSession)
		.where(eq(playSession.entryId, entryId));
	return only(plays);
}

describe("live entry writes keep the event log and its projection in step", () => {
	test("a started cash entry is open with its first event and an active play session", async ({
		api,
	}) => {
		await startLive(api);

		const row = only(await api.db.select().from(entry));
		expect(row).toMatchObject({
			id: "live-1",
			kind: "cash",
			source: "live",
			status: "open",
			playedOn: LOCAL_DATE,
		});
		expect(await api.db.select().from(gameSession)).toHaveLength(1);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			seq: 1,
			status: "active",
			startedAt: START,
			endedAt: null,
		});
		const events = await listEntryPlayEvents(api.db, "alice", "live-1");
		expect(events.map((event) => event.eventType)).toEqual(["session_start"]);
		expect(JSON.parse(events[0]?.payload ?? "null")).toEqual({
			buyInAmount: 1000,
		});
	});

	test("pause, resume and session_end settle the entry with break minutes and the cash out", async ({
		api,
	}) => {
		await startLive(api);
		const now = minutes(60);
		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{ type: "session_pause", occurredAt: minutes(10), payload: {} },
					{ type: "session_resume", occurredAt: minutes(25), payload: {} },
				],
			},
			now
		);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "active",
			breakMinutes: 15,
		});

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(60),
						payload: { cashOutAmount: 3000 },
					},
				],
			},
			now
		);

		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "ended",
			endState: "cashed_out",
			endStack: 3000,
			endedAt: minutes(60),
			breakMinutes: 15,
		});
		const row = only(await api.db.select().from(entry));
		expect(row.status).toBe("settled");
	});

	test("deleting the pause and editing the end time re-project the entry", async ({
		api,
	}) => {
		await startLive(api);
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{ type: "session_pause", occurredAt: minutes(10), payload: {} },
					{ type: "session_resume", occurredAt: minutes(25), payload: {} },
					{
						type: "session_end",
						occurredAt: minutes(60),
						payload: { cashOutAmount: 3000 },
					},
				],
			},
			minutes(60)
		);
		expect((await onlyPlay(api.db, "live-1")).breakMinutes).toBe(15);

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "delete", id: eventIds[0] as string },
			minutes(61)
		);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			breakMinutes: 0,
			status: "ended",
		});

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "update",
				id: eventIds[2] as string,
				occurredAt: minutes(90),
				payload: { cashOutAmount: 500 },
			},
			minutes(62)
		);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			endedAt: minutes(90),
			endStack: 500,
		});
	});

	test("deleting the end and appending reopen events clears the ledger but preserves completed money", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Reopen bankroll" })
		);
		await startLive(api, cashStart({ assetId: wallet.id }));
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(30),
						payload: { cashOutAmount: 1200 },
					},
				],
			},
			minutes(30)
		);
		expect(only(await api.db.select().from(entry)).status).toBe("settled");
		expect(only(await api.db.select().from(currencyTransaction))).toMatchObject(
			{
				amount: 200,
				transactedAt: START,
			}
		);
		const money = await api.db.select().from(sessionCashDetail);

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			[
				{ op: "delete", id: eventIds[0] as string },
				{
					op: "append",
					events: [
						{
							type: "update_stack",
							occurredAt: minutes(30),
							payload: { stackAmount: 1200 },
						},
						{ type: "session_pause", occurredAt: minutes(30), payload: {} },
						{ type: "session_resume", occurredAt: minutes(31), payload: {} },
					],
				},
			],
			minutes(31)
		);

		expect(only(await api.db.select().from(entry)).status).toBe("open");
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "active",
			endState: null,
			endStack: null,
		});
		expect(await api.db.select().from(currencyTransaction)).toEqual([]);
		expect(await api.db.select().from(sessionCashDetail)).toEqual(money);
	});

	test("a tournament busted without a placement is projected onto entry_tournament", async ({
		api,
	}) => {
		await startLive(
			api,
			cashStart({
				detail: { kind: "tournament", tournamentId: null },
				startEvent: {
					occurredAt: START,
					payload: { buyInAmount: 1000, entryFee: 0 },
				},
			})
		);

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(120),
						payload: { beforeDeadline: true, prizeMoney: 0, bountyPrizes: 0 },
					},
				],
			},
			minutes(120)
		);

		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "ended",
			endState: "busted",
		});
		const detail = only(await api.db.select().from(entryTournament));
		expect(detail).toMatchObject({ placement: null, beforeDeadline: true });
		expect(only(await api.db.select().from(entry)).status).toBe("settled");
	});

	test("hero seat changes append a leave and a join, and an unchanged seat writes nothing", async ({
		api,
	}) => {
		await startLive(api);

		await updateEntryHeroSeat(api.db, "alice", "live-1", 3, minutes(1));
		await updateEntryHeroSeat(api.db, "alice", "live-1", 3, minutes(2));
		await updateEntryHeroSeat(api.db, "alice", "live-1", 5, minutes(3));
		await updateEntryHeroSeat(api.db, "alice", "live-1", null, minutes(4));

		const events = await listEntryPlayEvents(api.db, "alice", "live-1");
		expect(
			events.map((event) => [event.eventType, JSON.parse(event.payload)])
		).toEqual([
			["session_start", { buyInAmount: 1000 }],
			["player_join", { isHero: true, seatPosition: 3 }],
			["player_leave", { isHero: true }],
			["player_join", { isHero: true, seatPosition: 5 }],
			["player_leave", { isHero: true }],
		]);
	});

	test("an append racing another append to the same entry keeps both events", async ({
		api,
	}) => {
		await startLive(api);
		const racing = new Proxy(api.db, {
			get(target, property, receiver) {
				if (property !== "batch") {
					return Reflect.get(target, property, receiver);
				}
				return async (statements: Parameters<Database["batch"]>[0]) => {
					await applyEntryEventChange(
						target,
						"alice",
						"live-1",
						{
							op: "append",
							events: [
								{ type: "session_pause", occurredAt: minutes(5), payload: {} },
							],
						},
						minutes(5)
					);
					return target.batch(statements);
				};
			},
		});

		await applyEntryEventChange(
			racing,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{ type: "session_resume", occurredAt: minutes(6), payload: {} },
				],
			},
			minutes(6)
		);

		const events = await listEntryPlayEvents(api.db, "alice", "live-1");
		expect(events.map((event) => event.eventType)).toEqual([
			"session_start",
			"session_pause",
			"session_resume",
		]);
	});

	test("another user can neither append to nor edit nor delete an entry's events", async ({
		api,
	}) => {
		await startLive(api);
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{ type: "session_pause", occurredAt: minutes(5), payload: {} },
				],
			},
			minutes(5)
		);
		const before = await everyRow(api.db);

		for (const change of [
			{
				op: "append",
				events: [
					{ type: "session_resume", occurredAt: minutes(6), payload: {} },
				],
			},
			{ op: "update", id: eventIds[0] as string, payload: { x: 1 } },
			{ op: "delete", id: eventIds[0] as string },
		] as const) {
			const failure = await applyEntryEventChange(
				api.db,
				"bob",
				"live-1",
				change,
				minutes(7)
			).catch((error: unknown) => error);
			expect(failure).toMatchObject({ code: "FORBIDDEN" });
		}
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("an event for a play session outside the entry is rejected before anything is written", async ({
		api,
	}) => {
		await startLive(api);
		const before = await everyRow(api.db);

		const failure = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_pause",
						occurredAt: minutes(5),
						payload: {},
						playSessionId: "someone-elses-play",
					},
				],
			},
			minutes(5)
		).catch((error: unknown) => error);

		expect(failure).toMatchObject({ code: "BAD_REQUEST" });
		expect(await everyRow(api.db)).toEqual(before);
	});
});

describe("live entry writes commit all of a write or none of it on D1", () => {
	test("a start whose last projection statement fails leaves no row in any table", async ({
		api,
	}) => {
		await forceFailure(api, "BEFORE UPDATE ON entry");

		const failure = await startLive(api).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual({
			anchors: [],
			entries: [],
			tournaments: [],
			plays: [],
			events: [],
			cashMoney: [],
			tournamentMoney: [],
			chipResults: [],
			transactions: [],
		});
	});

	test("a failed cash ledger insert rolls back the event, projection and cash money", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Cash bankroll" })
		);
		await startLive(api, cashStart({ assetId: wallet.id }));
		await api.db.insert(sessionCashDetail).values({
			sessionId: "live-1",
			buyIn: 1000,
			cashOut: null,
			chipRemoveTotal: null,
		});
		const before = await everyRow(api.db);
		await forceFailure(api, "BEFORE INSERT ON currency_transaction");

		const failure = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(30),
						payload: { cashOutAmount: 1200 },
					},
				],
			},
			minutes(30)
		).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("an update whose projection fails keeps the old event", async ({
		api,
	}) => {
		await startLive(api);
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(30),
						payload: { cashOutAmount: 1200 },
					},
				],
			},
			minutes(30)
		);
		const before = await everyRow(api.db);
		await forceFailure(api, "BEFORE UPDATE ON play_session");

		const failure = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "update",
				id: eventIds[0] as string,
				payload: { cashOutAmount: 9 },
			},
			minutes(31)
		).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("a failed ledger write rolls back events, projections, money and chip results together", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Bankroll" })
		);
		await startLive(
			api,
			cashStart({
				detail: { kind: "tournament", tournamentId: null },
				assetId: wallet.id,
				startEvent: { occurredAt: START, payload: {} },
			})
		);
		await api.db.insert(sessionTournamentDetail).values({
			sessionId: "live-1",
			tournamentBuyIn: 200,
			entryFee: 20,
		});
		await api.db.insert(sessionChipPurchase).values({
			id: "rebuy",
			sessionId: "live-1",
			name: "Rebuy",
			cost: 100,
			chips: 1000,
		});
		const purchase = {
			type: "purchase_chips",
			occurredAt: minutes(10),
			payload: {
				sessionChipPurchaseId: "rebuy",
				name: "Rebuy",
				cost: 100,
				chips: 1000,
			},
		};
		const end = {
			type: "session_end",
			occurredAt: minutes(60),
			payload: {
				beforeDeadline: false,
				placement: 1,
				totalEntries: 20,
				prizeMoney: 1000,
				bountyPrizes: 50,
			},
		};
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [purchase, end],
			},
			minutes(60)
		);
		expect(
			only(await api.db.select().from(sessionChipPurchaseResult)).count
		).toBe(1);
		expect(only(await api.db.select().from(currencyTransaction)).amount).toBe(
			730
		);
		const before = await everyRow(api.db);
		await forceFailure(api, "BEFORE UPDATE ON currency_transaction");
		const failure = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			[
				{ op: "append", events: [{ ...purchase, occurredAt: minutes(20) }] },
				{
					op: "update",
					id: eventIds[1] as string,
					payload: { ...end.payload, prizeMoney: 2000 },
				},
			],
			minutes(61)
		).catch((error: unknown) => error);
		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("replacing a settled tournament's chip snapshots resets new result counts without repricing old events", async ({
		api,
	}) => {
		const wallet = requireCreatedRow(
			await api.alice.currency.create({ name: "Snapshot bankroll" })
		);
		await startLive(
			api,
			cashStart({
				detail: { kind: "tournament", tournamentId: null },
				assetId: wallet.id,
				startEvent: { occurredAt: START, payload: {} },
			})
		);
		await api.db.insert(sessionTournamentDetail).values({
			sessionId: "live-1",
			tournamentBuyIn: 200,
			entryFee: 20,
		});
		await api.db.insert(sessionChipPurchase).values({
			id: "old-rebuy",
			sessionId: "live-1",
			name: "Rebuy",
			cost: 100,
			chips: 1000,
		});
		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "purchase_chips",
						occurredAt: minutes(10),
						payload: {
							sessionChipPurchaseId: "old-rebuy",
							name: "Rebuy",
							cost: 100,
							chips: 1000,
						},
					},
					{
						type: "session_end",
						occurredAt: minutes(60),
						payload: {
							beforeDeadline: false,
							placement: 1,
							totalEntries: 20,
							prizeMoney: 1000,
							bountyPrizes: 50,
						},
					},
				],
			},
			minutes(60)
		);
		const transaction = only(await api.db.select().from(currencyTransaction));
		expect(transaction.amount).toBe(730);
		await api.alice.liveTournamentSession.updateSnapshot({
			id: "live-1",
			chipPurchases: [{ name: "New rebuy", cost: 500, chips: 5000 }],
		});
		const snapshot = only(await api.db.select().from(sessionChipPurchase));
		expect(snapshot.id).not.toBe("old-rebuy");
		expect(only(await api.db.select().from(sessionChipPurchaseResult))).toEqual(
			{
				sessionChipPurchaseId: snapshot.id,
				count: 0,
			}
		);
		expect(await api.db.select().from(currencyTransaction)).toEqual([
			transaction,
		]);
	});

	test("an entry with 50 chip purchases stays within the 100-parameter limit on append, update and delete", async ({
		api,
	}) => {
		await startLive(
			api,
			cashStart({
				detail: { kind: "tournament", tournamentId: null },
				startEvent: { occurredAt: START, payload: {} },
			})
		);
		const rows = Array.from({ length: 50 }, (_, index) => ({
			id: `chip-${index}`,
			sessionId: "live-1",
			name: "Rebuy",
			cost: 100,
			chips: 1000,
			sortOrder: index,
		}));
		for (const chunk of chunkForInsert(
			rows,
			Object.keys(rows[0] as object).length
		)) {
			await api.db.insert(sessionChipPurchase).values(chunk);
		}
		const purchases = Array.from({ length: 50 }, (_, index) => ({
			type: "purchase_chips",
			occurredAt: minutes(index + 1),
			payload: {
				sessionChipPurchaseId: `chip-${index}`,
				name: "Rebuy",
				cost: 100,
				chips: 1000,
			},
		}));
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "append", events: purchases },
			minutes(51)
		);
		expect(eventIds).toHaveLength(50);

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_end",
						occurredAt: minutes(60),
						payload: {
							beforeDeadline: false,
							placement: 1,
							totalEntries: 50,
							prizeMoney: 7000,
							bountyPrizes: 0,
						},
					},
				],
			},
			minutes(60)
		);
		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "delete", id: eventIds[0] as string },
			minutes(61)
		);
		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "update", id: eventIds[1] as string, occurredAt: minutes(2) },
			minutes(62)
		);

		expect(await api.db.select().from(playEvent)).toHaveLength(51 + 1 - 1);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({ status: "ended" });
		const results = await api.db.select().from(sessionChipPurchaseResult);
		expect(results).toHaveLength(50);
		expect(
			results.find((row) => row.sessionChipPurchaseId === "chip-0")?.count
		).toBe(0);
		expect(
			results.find((row) => row.sessionChipPurchaseId === "chip-49")?.count
		).toBe(1);
		expect(
			only(await api.db.select().from(sessionTournamentDetail))
		).toMatchObject({
			prizeMoney: 7000,
			bountyPrizes: 0,
		});
	});
});
