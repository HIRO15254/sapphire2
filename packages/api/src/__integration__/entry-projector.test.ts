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
		id: `${entryId}-event-${sortOrder}`,
		userId,
		entryId,
		playSessionId,
		type: event.type,
		schemaVersion: 2,
		occurredAt: at(event.minute),
		sortOrder,
		payload: JSON.stringify(event.payload),
		updatedAt: START,
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
			seq: playSession.seq,
			localDate: playSession.localDate,
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
			id: playSession.id,
			startedAt: playSession.startedAt,
			endedAt: playSession.endedAt,
			breakMinutes: playSession.breakMinutes,
			status: playSession.status,
			endState: playSession.endState,
			endStack: playSession.endStack,
			clockStartLevel: playSession.clockStartLevel,
		})
		.from(playSession)
		.where(eq(playSession.entryId, entryId))
		.orderBy(asc(playSession.seq));
}

async function readEntry(db: Database, entryId: string) {
	const [row] = await db
		.select({ status: entry.status, playedOn: entry.playedOn })
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
			.values({ id: "jpy", userId, name: "JPY", updatedAt: START });
		await db.insert(gameLineup).values({ id: "lineup", userId });
		await db
			.insert(tournamentRule)
			.values({ id: "rule", userId, lineupId: "lineup" });
		const entryId = "mtt";
		await db.insert(entry).values({
			id: entryId,
			userId,
			kind: "tournament",
			source: "live",
			status: "open",
			playedOn: "2026-09-06",
			updatedAt: START,
		});
		await db.insert(entryTournament).values({
			entryId,
			userId,
			tournamentId: null,
			tournamentRuleId: "rule",
		});
		await db.insert(playSession).values([
			{
				id: "mtt-day-1",
				userId,
				entryId,
				kind: "tournament",
				seq: 1,
				localDate: "2026-09-05",
				status: "active",
				updatedAt: START,
			},
			{
				id: "mtt-day-2",
				userId,
				entryId,
				kind: "tournament",
				seq: 2,
				localDate: "2026-09-06",
				status: "ended",
				endState: "finished",
				updatedAt: START,
			},
		]);
		await addEvent(db, entryId, "mtt-day-1", 0, {
			type: "session_start",
			minute: 0,
			payload: { timerStartedAt: null },
		});
		await addEvent(db, entryId, "mtt-day-1", 1, {
			type: "update_stack",
			minute: 120,
			payload: { stackAmount: 50_000, totalEntries: 200 },
		});
		await addEvent(db, entryId, "mtt-day-1", 2, {
			type: "day_end",
			minute: 300,
			payload: { endState: "bagged", stackAmount: 61_000 },
		});
		await addEvent(db, entryId, "mtt-day-2", 3, {
			type: "session_start",
			minute: 1440,
			payload: { startLevel: 15 },
		});
		await addEvent(db, entryId, "mtt-day-2", 4, {
			type: "session_pause",
			minute: 1500,
			payload: {},
		});
		await addEvent(db, entryId, "mtt-day-2", 5, {
			type: "session_resume",
			minute: 1520,
			payload: {},
		});

		await reproject(db, entryId);

		expect(await readPlaySessions(db, entryId)).toEqual([
			{
				id: "mtt-day-1",
				startedAt: at(0),
				endedAt: at(300),
				breakMinutes: 0,
				status: "ended",
				endState: "bagged",
				endStack: 61_000,
				clockStartLevel: null,
			},
			{
				id: "mtt-day-2",
				startedAt: at(1440),
				endedAt: null,
				breakMinutes: 20,
				status: "active",
				endState: null,
				endStack: null,
				clockStartLevel: 15,
			},
		]);
		expect(await readEntry(db, entryId)).toEqual({
			status: "open",
			playedOn: "2026-09-05",
		});

		await addEvent(db, entryId, "mtt-day-2", 6, {
			type: "session_end",
			minute: 1700,
			payload: {
				beforeDeadline: false,
				placement: 9,
				totalEntries: 200,
				payments: [{ assetId: "jpy", quantity: 40_000, role: "prize" }],
			},
		});
		await reproject(db, entryId);

		expect((await readPlaySessions(db, entryId))[1]).toMatchObject({
			endedAt: at(1700),
			status: "ended",
			endState: "busted",
		});
		expect(await readEntry(db, entryId)).toMatchObject({ status: "settled" });
		const [result] = await db
			.select({
				placement: entryTournament.placement,
				totalEntries: entryTournament.totalEntries,
				beforeDeadline: entryTournament.beforeDeadline,
			})
			.from(entryTournament)
			.where(eq(entryTournament.entryId, entryId));
		expect(result).toEqual({
			placement: 9,
			totalEntries: 200,
			beforeDeadline: false,
		});
	});

	test("persist a cash-out with its end stack and EV difference", async ({
		api: { db },
	}) => {
		await db
			.insert(asset)
			.values({ id: "jpy", userId, name: "JPY", updatedAt: START });
		await db.insert(gameLineup).values({ id: "lineup", userId });
		await db
			.insert(tournamentRule)
			.values({ id: "price-rule", userId, lineupId: "lineup" });
		await db.insert(tournamentRulePrice).values({
			id: "cash-price",
			userId,
			ruleId: "price-rule",
			kind: "entry",
			label: "Entry",
			assetId: "jpy",
			amount: 30_000,
			ordinal: 0,
		});
		await db
			.insert(cashRule)
			.values({ id: "rule", userId, lineupId: "lineup" });
		const entryId = "ring";
		await db.insert(entry).values({
			id: entryId,
			userId,
			kind: "cash",
			source: "live",
			status: "open",
			playedOn: "2026-09-05",
			updatedAt: START,
		});
		await db.insert(entryCash).values({
			entryId,
			userId,
			ringGameId: null,
			cashRuleId: "rule",
		});
		await db.insert(playSession).values({
			id: "ring-day-1",
			userId,
			entryId,
			kind: "cash",
			seq: 1,
			localDate: "2026-09-05",
			status: "active",
			updatedAt: START,
		});
		await addEvent(db, entryId, "ring-day-1", 0, {
			type: "session_start",
			minute: 0,
			payload: {
				payments: [
					{
						assetId: "jpy",
						quantity: 30_000,
						role: "buy_in",
						priceId: "cash-price",
					},
				],
			},
		});
		await addEvent(db, entryId, "ring-day-1", 1, {
			type: "all_in",
			minute: 30,
			payload: { potSize: 10_000, trials: 1, equity: 75, wins: 0 },
		});
		await addEvent(db, entryId, "ring-day-1", 2, {
			type: "session_end",
			minute: 180,
			payload: {
				payments: [{ assetId: "jpy", quantity: 22_000, role: "cash_out" }],
			},
		});

		await reproject(db, entryId);

		expect(await readPlaySessions(db, entryId)).toEqual([
			{
				id: "ring-day-1",
				startedAt: at(0),
				endedAt: at(180),
				breakMinutes: 0,
				status: "ended",
				endState: "cashed_out",
				endStack: 22_000,
				clockStartLevel: null,
			},
		]);
		expect(await readEntry(db, entryId)).toEqual({
			status: "settled",
			playedOn: "2026-09-05",
		});
		const [detail] = await db
			.select({ evDiff: entryCash.evDiff })
			.from(entryCash)
			.where(eq(entryCash.entryId, entryId));
		expect(detail).toEqual({ evDiff: 7500 });
		const lines = await db
			.select({
				role: ledgerLine.role,
				quantity: ledgerLine.quantity,
				priceId: ledgerLine.priceId,
			})
			.from(ledgerLine)
			.where(eq(ledgerLine.entryId, entryId))
			.orderBy(asc(ledgerLine.role));
		expect(lines).toEqual([
			{ role: "buy_in", quantity: -30_000, priceId: "cash-price" },
			{ role: "cash_out", quantity: 22_000, priceId: null },
		]);
	});
});
