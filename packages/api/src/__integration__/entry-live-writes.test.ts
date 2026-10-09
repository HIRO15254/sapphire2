import type { Database } from "@sapphire2/db";
import {
	entry,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { listEntryPlayEvents } from "../services/entry-live-reads";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	type LiveEntryStart,
	updateEntryHeroSeat,
} from "../services/entry-live-writes";
import { type ApiFixture, test } from "./test-fixture";

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

	test("deleting the only session_end reopens a settled entry", async ({
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
		expect(only(await api.db.select().from(entry)).status).toBe("settled");

		await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "delete", id: eventIds[0] as string },
			minutes(31)
		);

		expect(only(await api.db.select().from(entry)).status).toBe("open");
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "active",
			endState: null,
			endStack: null,
		});
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
		});
	});

	test("an append whose projection fails writes neither the event nor the projection", async ({
		api,
	}) => {
		await startLive(api);
		const before = await everyRow(api.db);
		await forceFailure(api, "BEFORE UPDATE ON entry");

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

	test("an entry with 50 chip purchases stays within the 100-parameter limit on append, update and delete", async ({
		api,
	}) => {
		await startLive(api);
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
						payload: { cashOutAmount: 7000 },
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
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "ended",
			endStack: 7000,
		});
	});
});
