import type { EntryKind } from "@sapphire2/db/constants/entry";
import { currency } from "@sapphire2/db/schema/currency";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import type { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { and, asc, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { protectedProcedure } from "../index";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";
import {
	firstPlaySession,
	firstPlaySessionJoin,
	legacyBreakMinutesSql,
	legacyKindSql,
	legacySessionDateSql,
	legacySessionStatusSql,
} from "./entry-session";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

export type LegacyGameSessionRow = typeof gameSession.$inferSelect;
export type LegacySessionEventRow = typeof sessionEvent.$inferSelect;

export interface LiveEntryListParams {
	keyset: SQL | undefined;
	limit: number;
	status?: "active" | "paused" | "completed";
}

const ENTRY_IDS_PER_EVENT_QUERY = D1_MAX_BOUND_PARAMS - 1;

const nullableTimestamp = {
	mapFromDriverValue: (value: number): Date | null => new Date(value * 1000),
};

function latestPlaySessionValue(expression: SQL) {
	return sql`(SELECT ${expression} FROM ${playSession} WHERE ${playSession.entryId} = ${entry.id} AND ${playSession.userId} = ${entry.userId} ORDER BY ${playSession.seq} DESC LIMIT 1)`;
}

function legacyLiveSessionColumns() {
	return {
		id: entry.id,
		userId: entry.userId,
		status: legacySessionStatusSql(),
		roomId: entry.roomId,
		currencyId: entry.assetId,
		startedAt: firstPlaySession.startedAt,
		sessionDate: legacySessionDateSql(),
		endedAt: latestPlaySessionValue(
			sql`CASE WHEN ${playSession.status} = 'ended' THEN ${playSession.endedAt} END`
		).mapWith(nullableTimestamp),
		memo: entry.memo,
		createdAt: entry.createdAt,
		updatedAt: entry.updatedAt,
	};
}

function legacyGameSessionColumns() {
	return {
		...legacyLiveSessionColumns(),
		kind: legacyKindSql(),
		source: entry.source,
		breakMinutes: legacyBreakMinutesSql(),
		handCount: gameSession.handCount,
		dealerSeat: gameSession.dealerSeat,
	};
}

function liveEntryCondition(userId: string, kind: EntryKind) {
	return and(
		eq(entry.userId, userId),
		eq(entry.kind, kind),
		eq(entry.source, "live")
	);
}

function liveEntryListCondition(
	userId: string,
	kind: EntryKind,
	params: LiveEntryListParams
) {
	return and(
		liveEntryCondition(userId, kind),
		params.status
			? sql`${legacySessionStatusSql()} = ${params.status}`
			: undefined,
		params.keyset
	);
}

export function listLiveCashEntryRows(
	db: DbInstance,
	userId: string,
	params: LiveEntryListParams
) {
	return db
		.select({
			...legacyLiveSessionColumns(),
			roomName: room.name,
			ringGameId: entryCash.ringGameId,
			ringGameName: sessionCashDetail.ruleName,
			currencyName: currency.name,
			currencyUnit: currency.unit,
		})
		.from(entry)
		.leftJoin(firstPlaySession, firstPlaySessionJoin())
		.leftJoin(
			entryCash,
			and(eq(entryCash.entryId, entry.id), eq(entryCash.userId, userId))
		)
		.leftJoin(sessionCashDetail, eq(sessionCashDetail.sessionId, entry.id))
		.leftJoin(room, and(eq(room.id, entry.roomId), eq(room.userId, userId)))
		.leftJoin(
			currency,
			and(eq(currency.id, entry.assetId), eq(currency.userId, userId))
		)
		.where(liveEntryListCondition(userId, "cash", params))
		.orderBy(desc(legacySessionDateSql()), desc(entry.id))
		.limit(params.limit);
}

export function listLiveTournamentEntryRows(
	db: DbInstance,
	userId: string,
	params: LiveEntryListParams
) {
	return db
		.select({
			...legacyLiveSessionColumns(),
			roomName: room.name,
			tournamentId: entryTournament.tournamentId,
			tournamentName: sessionTournamentDetail.ruleName,
			startingStack: sessionTournamentDetail.startingStack,
			currencyName: currency.name,
			currencyUnit: currency.unit,
		})
		.from(entry)
		.leftJoin(firstPlaySession, firstPlaySessionJoin())
		.leftJoin(
			entryTournament,
			and(
				eq(entryTournament.entryId, entry.id),
				eq(entryTournament.userId, userId)
			)
		)
		.leftJoin(
			sessionTournamentDetail,
			eq(sessionTournamentDetail.sessionId, entry.id)
		)
		.leftJoin(room, and(eq(room.id, entry.roomId), eq(room.userId, userId)))
		.leftJoin(
			currency,
			and(eq(currency.id, entry.assetId), eq(currency.userId, userId))
		)
		.where(liveEntryListCondition(userId, "tournament", params))
		.orderBy(desc(legacySessionDateSql()), desc(entry.id))
		.limit(params.limit);
}

export async function findLiveCashEntrySession(
	db: DbInstance,
	userId: string,
	id: string
): Promise<
	{ ringGameId: string | null; session: LegacyGameSessionRow } | undefined
> {
	const [row] = await db
		.select({
			...legacyGameSessionColumns(),
			ringGameId: entryCash.ringGameId,
		})
		.from(entry)
		.leftJoin(firstPlaySession, firstPlaySessionJoin())
		.leftJoin(
			gameSession,
			and(eq(gameSession.id, entry.id), eq(gameSession.userId, userId))
		)
		.leftJoin(
			entryCash,
			and(eq(entryCash.entryId, entry.id), eq(entryCash.userId, userId))
		)
		.where(and(eq(entry.id, id), liveEntryCondition(userId, "cash")));
	if (!row) {
		return undefined;
	}
	const { ringGameId, ...session } = row;
	return { session, ringGameId };
}

export async function findLiveTournamentEntrySession(
	db: DbInstance,
	userId: string,
	id: string
): Promise<
	| {
			session: LegacyGameSessionRow;
			timerStartedAt: Date | null;
			tournamentId: string | null;
	  }
	| undefined
> {
	const [row] = await db
		.select({
			...legacyGameSessionColumns(),
			tournamentId: entryTournament.tournamentId,
			timerStartedAt: latestPlaySessionValue(
				sql`${playSession.clockStartedAt}`
			).mapWith(nullableTimestamp),
		})
		.from(entry)
		.leftJoin(firstPlaySession, firstPlaySessionJoin())
		.leftJoin(
			gameSession,
			and(eq(gameSession.id, entry.id), eq(gameSession.userId, userId))
		)
		.leftJoin(
			entryTournament,
			and(
				eq(entryTournament.entryId, entry.id),
				eq(entryTournament.userId, userId)
			)
		)
		.where(and(eq(entry.id, id), liveEntryCondition(userId, "tournament")));
	if (!row) {
		return undefined;
	}
	const { tournamentId, timerStartedAt, ...session } = row;
	return { session, tournamentId, timerStartedAt };
}

export async function findOwnedEntryId(
	db: DbInstance,
	userId: string,
	id: string
): Promise<string | undefined> {
	const [row] = await db
		.select({ id: entry.id })
		.from(entry)
		.where(and(eq(entry.id, id), eq(entry.userId, userId)));
	return row?.id;
}

export function listEntryPlayEvents(
	db: DbInstance,
	userId: string,
	entryId: string
): Promise<LegacySessionEventRow[]> {
	return db
		.select({
			id: playEvent.id,
			sessionId: playEvent.entryId,
			eventType: playEvent.type,
			occurredAt: playEvent.occurredAt,
			sortOrder: playEvent.sortOrder,
			payload: playEvent.payload,
			createdAt: playEvent.createdAt,
			updatedAt: playEvent.updatedAt,
		})
		.from(playEvent)
		.where(and(eq(playEvent.entryId, entryId), eq(playEvent.userId, userId)))
		.orderBy(
			asc(playEvent.occurredAt),
			asc(playEvent.sortOrder),
			asc(playEvent.id)
		);
}

export async function getPlayEventMap(
	db: DbInstance,
	userId: string,
	entryIds: string[]
): Promise<Map<string, { eventType: string; payload: string }[]>> {
	const map = new Map<string, { eventType: string; payload: string }[]>();
	for (
		let index = 0;
		index < entryIds.length;
		index += ENTRY_IDS_PER_EVENT_QUERY
	) {
		const rows = await db
			.select({
				entryId: playEvent.entryId,
				eventType: playEvent.type,
				payload: playEvent.payload,
			})
			.from(playEvent)
			.where(
				and(
					eq(playEvent.userId, userId),
					inArray(
						playEvent.entryId,
						entryIds.slice(index, index + ENTRY_IDS_PER_EVENT_QUERY)
					)
				)
			)
			.orderBy(
				asc(playEvent.occurredAt),
				asc(playEvent.sortOrder),
				asc(playEvent.id)
			);
		for (const row of rows) {
			const event = { eventType: row.eventType, payload: row.payload };
			const existing = map.get(row.entryId);
			if (existing) {
				existing.push(event);
			} else {
				map.set(row.entryId, [event]);
			}
		}
	}
	return map;
}
