import type { Database } from "@sapphire2/db";
import {
	entry,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import {
	buildLiveEntryStartStatements,
	commitEntryEventChange,
	type EntryEventChange,
	type LiveEntryStart,
	loadEntryEventState,
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
		detail: { kind: "cash", ringGameId: null, cashRuleId: "cash-rule" },
		assetId: null,
		roomId: null,
		memo: null,
		localDate: LOCAL_DATE,
		now: START,
		startEvent: {
			occurredAt: START,
			payload: {
				payments: [{ assetId: "chips", quantity: 1000, role: "buy_in" }],
			},
		},
		...overrides,
	};
}

async function applyEntryEventChange(
	db: Database,
	userId: string,
	entryId: string,
	change: EntryEventChange,
	now: Date
) {
	const state = await loadEntryEventState(db, userId, entryId);
	return await commitEntryEventChange(db, {
		userId,
		entryId,
		change,
		now,
		state,
	});
}

async function startLive(api: ApiFixture, start = cashStart()) {
	await api.d1
		.prepare("INSERT INTO game_lineup (id, user_id) VALUES (?, ?)")
		.bind("lineup", "alice")
		.run();
	await api.d1
		.prepare(
			"INSERT INTO asset (id, user_id, name, updated_at) VALUES (?, ?, ?, 0)"
		)
		.bind("chips", "alice", "Chips")
		.run();
	if (start.detail.kind === "cash") {
		await api.d1
			.prepare(
				"INSERT INTO cash_rule (id, user_id, lineup_id) VALUES (?, ?, ?)"
			)
			.bind(start.detail.cashRuleId, "alice", "lineup")
			.run();
	} else {
		await api.d1
			.prepare(
				"INSERT INTO tournament_rule (id, user_id, lineup_id) VALUES (?, ?, ?)"
			)
			.bind(start.detail.tournamentRuleId, "alice", "lineup")
			.run();
	}
	await api.db.batch(
		buildLiveEntryStartStatements(api.db, start) as [never, ...never[]]
	);
	return start.id;
}

function listEntryPlayEvents(db: Database, userId: string, entryId: string) {
	return db
		.select({ eventType: playEvent.type, payload: playEvent.payload })
		.from(playEvent)
		.where(and(eq(playEvent.entryId, entryId), eq(playEvent.userId, userId)))
		.orderBy(
			asc(playEvent.occurredAt),
			asc(playEvent.sortOrder),
			asc(playEvent.id)
		);
}

async function everyRow(db: Database) {
	return {
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
	test("deleting the resume re-projects the entry", async ({ api }) => {
		await startLive(api);
		const { eventIds } = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{
				op: "append",
				events: [
					{
						type: "session_pause",
						occurredAt: minutes(10),
						payload: {},
					},
					{
						type: "session_resume",
						occurredAt: minutes(25),
						payload: {},
					},
					{
						type: "session_end",
						occurredAt: minutes(60),
						payload: {
							payments: [
								{ assetId: "chips", quantity: 3000, role: "cash_out" },
							],
						},
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
			{ op: "delete", id: eventIds[1] as string },
			minutes(61)
		);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			breakMinutes: 50,
			status: "ended",
		});
	});

	test("an edit that leaves the event stream invalid is rejected before anything is written", async ({
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
				],
			},
			minutes(30)
		);
		const before = await everyRow(api.db);

		const failure = await applyEntryEventChange(
			api.db,
			"alice",
			"live-1",
			{ op: "delete", id: eventIds[0] as string },
			minutes(31)
		).catch((error: unknown) => error);

		expect(failure).toMatchObject({ code: "BAD_REQUEST" });
		expect(await everyRow(api.db)).toEqual(before);
	});

	test("a tournament busted without a placement is projected onto entry_tournament", async ({
		api,
	}) => {
		await startLive(
			api,
			cashStart({
				detail: {
					kind: "tournament",
					tournamentId: null,
					tournamentRuleId: "tournament-rule",
				},
				startEvent: {
					occurredAt: START,
					payload: {
						payments: [{ assetId: "chips", quantity: 1000, role: "buy_in" }],
					},
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
						payload: { beforeDeadline: true, payments: [] },
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
								{
									type: "memo",
									occurredAt: minutes(5),
									payload: { text: "first" },
								},
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
					{
						type: "memo",
						occurredAt: minutes(6),
						payload: { text: "second" },
					},
				],
			},
			minutes(6)
		);

		const events = await listEntryPlayEvents(api.db, "alice", "live-1");
		expect(events.map((event) => event.eventType)).toEqual([
			"session_start",
			"memo",
			"memo",
		]);
	});

	test("an append racing a session_end that ended the play first is rejected and leaves one end", async ({
		api,
	}) => {
		await startLive(api);
		const end = (quantity: number) => ({
			op: "append" as const,
			events: [
				{
					type: "session_end",
					occurredAt: minutes(30),
					payload: {
						payments: [{ assetId: "chips", quantity, role: "cash_out" }],
					},
				},
			],
		});
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
						end(1200),
						minutes(30)
					);
					return target.batch(statements);
				};
			},
		});

		const failure = await applyEntryEventChange(
			racing,
			"alice",
			"live-1",
			end(900),
			minutes(30)
		).catch((error: unknown) => error);

		expect(failure).toMatchObject({ code: "PRECONDITION_FAILED" });
		const events = await listEntryPlayEvents(api.db, "alice", "live-1");
		expect(events.map((event) => event.eventType)).toEqual([
			"session_start",
			"session_end",
		]);
		expect(await onlyPlay(api.db, "live-1")).toMatchObject({
			status: "ended",
			endStack: 1200,
		});
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
						payload: {
							payments: [
								{ assetId: "chips", quantity: 1200, role: "cash_out" },
							],
						},
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
						payload: {
							payments: [
								{ assetId: "chips", quantity: 1200, role: "cash_out" },
							],
						},
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
				payload: {
					payments: [{ assetId: "chips", quantity: 9, role: "cash_out" }],
				},
			},
			minutes(31)
		).catch((error: unknown) => error);

		expect(errorMessages(failure)).toContain("test forced failure");
		expect(await everyRow(api.db)).toEqual(before);
	});
});
