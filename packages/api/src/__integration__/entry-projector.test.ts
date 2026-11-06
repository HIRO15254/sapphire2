import type { Database } from "@sapphire2/db";
import { asset } from "@sapphire2/db/schema/asset";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameLineup } from "@sapphire2/db/schema/game-lineup";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import {
	cashRule,
	tournamentRule,
	tournamentRulePrice,
} from "@sapphire2/db/schema/rule";
import { asc, eq } from "drizzle-orm";
import { describe, expect } from "vitest";
import { runBatch } from "../lib/batch";
import {
	buildProjectionLineStatements,
	buildProjectionStatements,
	projectEntry,
} from "../services/entry-projector";
import { test } from "./test-fixture";

const START = new Date("2026-09-05T10:00:00.000Z");
const userId = "alice";

function at(minute: number): Date {
	return new Date(START.getTime() + minute * 60_000);
}

async function addEvent(
	db: Database,
	entryId: string,
	playSessionId: string,
	sortOrder: number,
	event: {
		type: string;
		minute: number;
		payload: Record<string, unknown>;
	}
) {
	await db.insert(playEvent).values({
		entryId,
		id: `${entryId}-event-${sortOrder}`,
		occurredAt: at(event.minute),
		payload: JSON.stringify(event.payload),
		playSessionId,
		schemaVersion: 2,
		sortOrder,
		type: event.type,
		updatedAt: START,
		userId,
	});
}

async function reproject(db: Database, entryId: string) {
	const [owner] = await db
		.select({ kind: entry.kind })
		.from(entry)
		.where(eq(entry.id, entryId));
	const sessions = await db
		.select({
			id: playSession.id,
			localDate: playSession.localDate,
			seq: playSession.seq,
		})
		.from(playSession)
		.where(eq(playSession.entryId, entryId));
	const events = await db
		.select()
		.from(playEvent)
		.where(eq(playEvent.entryId, entryId));
	if (!owner) {
		throw new Error(`Entry ${entryId} was not seeded`);
	}
	const projection = projectEntry(events, {
		kind: owner.kind,
		playSessions: sessions,
	});
	await runBatch(
		db,
		buildProjectionStatements(db, { entryId, userId }, projection)
	);
	await runBatch(
		db,
		buildProjectionLineStatements(
			db,
			{ entryId, userId },
			projection.lines,
			START
		)
	);
}

async function readPlaySessions(db: Database, entryId: string) {
	return await db
		.select({
			breakMinutes: playSession.breakMinutes,
			clockStartLevel: playSession.clockStartLevel,
			endedAt: playSession.endedAt,
			endStack: playSession.endStack,
			endState: playSession.endState,
			id: playSession.id,
			startedAt: playSession.startedAt,
			status: playSession.status,
		})
		.from(playSession)
		.where(eq(playSession.entryId, entryId))
		.orderBy(asc(playSession.seq));
}

async function readEntry(db: Database, entryId: string) {
	const [row] = await db
		.select({ playedOn: entry.playedOn, status: entry.status })
		.from(entry)
		.where(eq(entry.id, entryId));
	return row;
}

describe("projection statements against D1", () => {
	test("persist a two-day tournament through bagging, day two and the final bust", async ({
		api: { db },
	}) => {
		await db
			.insert(asset)
			.values({ id: "jpy", name: "JPY", updatedAt: START, userId });
		await db.insert(gameLineup).values({ id: "lineup", userId });
		await db
			.insert(tournamentRule)
			.values({ id: "rule", lineupId: "lineup", userId });
		const entryId = "mtt";
		await db.insert(entry).values({
			id: entryId,
			kind: "tournament",
			playedOn: "2026-09-06",
			source: "live",
			status: "open",
			updatedAt: START,
			userId,
		});
		await db.insert(entryTournament).values({
			entryId,
			tournamentId: null,
			tournamentRuleId: "rule",
			userId,
		});
		await db.insert(playSession).values([
			{
				entryId,
				id: "mtt-day-1",
				kind: "tournament",
				localDate: "2026-09-05",
				seq: 1,
				status: "active",
				updatedAt: START,
				userId,
			},
			{
				endState: "finished",
				entryId,
				id: "mtt-day-2",
				kind: "tournament",
				localDate: "2026-09-06",
				seq: 2,
				status: "ended",
				updatedAt: START,
				userId,
			},
		]);
		await addEvent(db, entryId, "mtt-day-1", 0, {
			minute: 0,
			payload: { timerStartedAt: null },
			type: "session_start",
		});
		await addEvent(db, entryId, "mtt-day-1", 1, {
			minute: 120,
			payload: { stackAmount: 50_000, totalEntries: 200 },
			type: "update_stack",
		});
		await addEvent(db, entryId, "mtt-day-1", 2, {
			minute: 300,
			payload: { endState: "bagged", stackAmount: 61_000 },
			type: "day_end",
		});
		await addEvent(db, entryId, "mtt-day-2", 3, {
			minute: 1440,
			payload: { startLevel: 15 },
			type: "session_start",
		});
		await addEvent(db, entryId, "mtt-day-2", 4, {
			minute: 1500,
			payload: {},
			type: "session_pause",
		});
		await addEvent(db, entryId, "mtt-day-2", 5, {
			minute: 1520,
			payload: {},
			type: "session_resume",
		});

		await reproject(db, entryId);

		expect(await readPlaySessions(db, entryId)).toEqual([
			{
				breakMinutes: 0,
				clockStartLevel: null,
				endedAt: at(300),
				endStack: 61_000,
				endState: "bagged",
				id: "mtt-day-1",
				startedAt: at(0),
				status: "ended",
			},
			{
				breakMinutes: 20,
				clockStartLevel: 15,
				endedAt: null,
				endStack: null,
				endState: null,
				id: "mtt-day-2",
				startedAt: at(1440),
				status: "active",
			},
		]);
		expect(await readEntry(db, entryId)).toEqual({
			playedOn: "2026-09-05",
			status: "open",
		});

		await addEvent(db, entryId, "mtt-day-2", 6, {
			minute: 1700,
			payload: {
				beforeDeadline: false,
				payments: [{ assetId: "jpy", quantity: 40_000, role: "prize" }],
				placement: 9,
				totalEntries: 200,
			},
			type: "session_end",
		});
		await reproject(db, entryId);

		expect((await readPlaySessions(db, entryId))[1]).toMatchObject({
			endedAt: at(1700),
			endState: "busted",
			status: "ended",
		});
		expect(await readEntry(db, entryId)).toMatchObject({ status: "settled" });
		const [result] = await db
			.select({
				beforeDeadline: entryTournament.beforeDeadline,
				placement: entryTournament.placement,
				totalEntries: entryTournament.totalEntries,
			})
			.from(entryTournament)
			.where(eq(entryTournament.entryId, entryId));
		expect(result).toEqual({
			beforeDeadline: false,
			placement: 9,
			totalEntries: 200,
		});
	});

	test("persist a cash-out with its end stack and EV difference", async ({
		api: { db },
	}) => {
		await db
			.insert(asset)
			.values({ id: "jpy", name: "JPY", updatedAt: START, userId });
		await db.insert(gameLineup).values({ id: "lineup", userId });
		await db
			.insert(tournamentRule)
			.values({ id: "price-rule", lineupId: "lineup", userId });
		await db.insert(tournamentRulePrice).values({
			amount: 30_000,
			assetId: "jpy",
			id: "cash-price",
			kind: "entry",
			label: "Entry",
			ordinal: 0,
			ruleId: "price-rule",
			userId,
		});
		await db
			.insert(cashRule)
			.values({ id: "rule", lineupId: "lineup", userId });
		const entryId = "ring";
		await db.insert(entry).values({
			id: entryId,
			kind: "cash",
			playedOn: "2026-09-05",
			source: "live",
			status: "open",
			updatedAt: START,
			userId,
		});
		await db.insert(entryCash).values({
			cashRuleId: "rule",
			entryId,
			ringGameId: null,
			userId,
		});
		await db.insert(playSession).values({
			entryId,
			id: "ring-day-1",
			kind: "cash",
			localDate: "2026-09-05",
			seq: 1,
			status: "active",
			updatedAt: START,
			userId,
		});
		await addEvent(db, entryId, "ring-day-1", 0, {
			minute: 0,
			payload: {
				payments: [
					{
						assetId: "jpy",
						priceId: "cash-price",
						quantity: 30_000,
						role: "buy_in",
					},
				],
			},
			type: "session_start",
		});
		await addEvent(db, entryId, "ring-day-1", 1, {
			minute: 30,
			payload: { equity: 75, potSize: 10_000, trials: 1, wins: 0 },
			type: "all_in",
		});
		await addEvent(db, entryId, "ring-day-1", 2, {
			minute: 180,
			payload: {
				payments: [{ assetId: "jpy", quantity: 22_000, role: "cash_out" }],
			},
			type: "session_end",
		});

		await reproject(db, entryId);

		expect(await readPlaySessions(db, entryId)).toEqual([
			{
				breakMinutes: 0,
				clockStartLevel: null,
				endedAt: at(180),
				endStack: 22_000,
				endState: "cashed_out",
				id: "ring-day-1",
				startedAt: at(0),
				status: "ended",
			},
		]);
		expect(await readEntry(db, entryId)).toEqual({
			playedOn: "2026-09-05",
			status: "settled",
		});
		const [detail] = await db
			.select({ evDiff: entryCash.evDiff })
			.from(entryCash)
			.where(eq(entryCash.entryId, entryId));
		expect(detail).toEqual({ evDiff: 7500 });
		const lines = await db
			.select({
				priceId: ledgerLine.priceId,
				quantity: ledgerLine.quantity,
				role: ledgerLine.role,
			})
			.from(ledgerLine)
			.where(eq(ledgerLine.entryId, entryId))
			.orderBy(asc(ledgerLine.role));
		expect(lines).toEqual([
			{ priceId: "cash-price", quantity: -30_000, role: "buy_in" },
			{ priceId: null, quantity: 22_000, role: "cash_out" },
		]);
	});
});
