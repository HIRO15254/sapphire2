import type { Database } from "@sapphire2/db";
import type {
	EntryKind,
	PlaySessionEndState,
} from "@sapphire2/db/constants/entry";
import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { BatchStatement } from "../lib/batch";

export type LegacySessionKind = "cash_game" | "tournament";

export const MINIMAL_GAME_SESSION_DATE = new Date(0);

export const CASH_DETAIL_MOVED_COLUMNS = ["ringGameId", "evCashOut"] as const;

export const TOURNAMENT_DETAIL_MOVED_COLUMNS = [
	"tournamentId",
	"placement",
	"totalEntries",
	"beforeDeadline",
	"timerStartedAt",
] as const;

export interface EntryCashFacts {
	cashOut: number | null;
	evCashOut: number | null;
	ringGameId: string | null;
}

export interface EntryTournamentFacts {
	beforeDeadline: boolean | null;
	placement: number | null;
	totalEntries: number | null;
	tournamentId: string | null;
}

interface EntrySessionFactsBase {
	breakMinutes: number | null;
	currencyId: string | null;
	endedAt: Date | null;
	id: string;
	memo: string | null;
	roomId: string | null;
	ruleName: string | null;
	sessionDate: Date;
	source: string;
	startedAt: Date | null;
	userId: string;
}

export type EntrySessionFacts = EntrySessionFactsBase &
	(
		| { cash: EntryCashFacts; kind: "cash_game"; tournament?: undefined }
		| {
				cash?: undefined;
				kind: "tournament";
				tournament: EntryTournamentFacts;
		  }
	);

export function toEntryKind(legacyKind: LegacySessionKind): EntryKind {
	return legacyKind === "cash_game" ? "cash" : "tournament";
}

export function utcDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function legacyKindSql() {
	return sql<LegacySessionKind>`CASE ${entry.kind} WHEN 'cash' THEN 'cash_game' ELSE 'tournament' END`;
}

export function legacySessionDateSql() {
	return sql`CASE ${entry.source} WHEN 'live' THEN COALESCE((SELECT ${playSession.startedAt} FROM ${playSession} WHERE ${playSession.entryId} = ${entry.id} AND ${playSession.seq} = 1), ${entry.createdAt}) ELSE unixepoch(${entry.playedOn}) END`.mapWith(
		entry.createdAt
	);
}

export function legacySessionStatusSql() {
	return sql<string>`CASE WHEN ${entry.status} = 'settled' THEN 'completed' ELSE (SELECT CASE ${playSession.status} WHEN 'ended' THEN 'completed' ELSE ${playSession.status} END FROM ${playSession} WHERE ${playSession.entryId} = ${entry.id} ORDER BY ${playSession.seq} DESC LIMIT 1) END`;
}

export const firstPlaySession = alias(playSession, "first_play_session");

export function firstPlaySessionJoin() {
	return and(
		eq(firstPlaySession.entryId, entry.id),
		eq(firstPlaySession.seq, 1)
	);
}

export function legacyBreakMinutesSql() {
	return sql<
		number | null
	>`NULLIF((SELECT SUM(${playSession.breakMinutes}) FROM ${playSession} WHERE ${playSession.entryId} = ${entry.id}), 0)`;
}

function effectivePlacement(facts: EntryTournamentFacts): number | null {
	return facts.beforeDeadline ? null : facts.placement;
}

function manualEndState(facts: EntrySessionFacts): PlaySessionEndState {
	if (facts.kind === "cash_game") {
		return "cashed_out";
	}
	const placement = effectivePlacement(facts.tournament);
	return placement !== null && placement > 1 ? "busted" : "finished";
}

function entryTitle(facts: EntrySessionFacts): string | null {
	const linked =
		facts.kind === "cash_game"
			? facts.cash.ringGameId
			: facts.tournament.tournamentId;
	return linked ? null : facts.ruleName;
}

function orderedEndedAt(facts: EntrySessionFacts): Date | null {
	if (
		facts.startedAt &&
		facts.endedAt &&
		facts.endedAt.getTime() < facts.startedAt.getTime()
	) {
		return null;
	}
	return facts.endedAt;
}

function evDiff(cash: EntryCashFacts): number | null {
	if (cash.evCashOut === null) {
		return null;
	}
	return Math.round(cash.evCashOut - (cash.cashOut ?? 0));
}

function entryRow(facts: EntrySessionFacts, now: Date) {
	return {
		roomId: facts.roomId,
		assetId: facts.currencyId,
		title: entryTitle(facts),
		playedOn: utcDateString(facts.sessionDate),
		memo: facts.memo,
		updatedAt: now,
	};
}

function playSessionRow(facts: EntrySessionFacts, now: Date) {
	const playedOn = utcDateString(facts.sessionDate);
	return {
		localDate: playedOn,
		startedAt: facts.startedAt,
		endedAt: orderedEndedAt(facts),
		breakMinutes: facts.breakMinutes ?? 0,
		endState: manualEndState(facts),
		endStack: facts.kind === "cash_game" ? facts.cash.cashOut : null,
		updatedAt: now,
	};
}

function tournamentRow(facts: EntryTournamentFacts) {
	return {
		tournamentId: facts.tournamentId,
		placement: effectivePlacement(facts),
		totalEntries: facts.totalEntries,
		beforeDeadline: facts.beforeDeadline,
	};
}

export function buildManualEntryInsertStatements(
	db: Database,
	facts: EntrySessionFacts,
	now: Date
): BatchStatement[] {
	const kind = toEntryKind(facts.kind);
	const statements: BatchStatement[] = [
		db.insert(gameSession).values({
			id: facts.id,
			userId: facts.userId,
			kind: facts.kind,
			status: "completed",
			source: "manual",
			sessionDate: MINIMAL_GAME_SESSION_DATE,
			updatedAt: now,
		}),
		db.insert(entry).values({
			id: facts.id,
			userId: facts.userId,
			kind,
			source: "manual",
			status: "settled",
			...entryRow(facts, now),
		}),
		facts.kind === "cash_game"
			? db.insert(entryCash).values({
					entryId: facts.id,
					userId: facts.userId,
					ringGameId: facts.cash.ringGameId,
					evDiff: evDiff(facts.cash),
				})
			: db.insert(entryTournament).values({
					entryId: facts.id,
					userId: facts.userId,
					...tournamentRow(facts.tournament),
				}),
		db.insert(playSession).values({
			id: facts.id,
			userId: facts.userId,
			entryId: facts.id,
			kind,
			seq: 1,
			status: "ended",
			...playSessionRow(facts, now),
		}),
	];
	return statements;
}

export function buildEntryRewriteStatements(
	db: Database,
	facts: EntrySessionFacts,
	now: Date
): BatchStatement[] {
	const owned = and(eq(entry.id, facts.id), eq(entry.userId, facts.userId));
	if (facts.source !== "manual") {
		return [
			db
				.update(entry)
				.set({
					roomId: facts.roomId,
					assetId: facts.currencyId,
					memo: facts.memo,
					updatedAt: now,
				})
				.where(owned),
		];
	}
	return [
		db.update(entry).set(entryRow(facts, now)).where(owned),
		facts.kind === "cash_game"
			? db
					.update(entryCash)
					.set({
						ringGameId: facts.cash.ringGameId,
						evDiff: evDiff(facts.cash),
					})
					.where(
						and(
							eq(entryCash.entryId, facts.id),
							eq(entryCash.userId, facts.userId)
						)
					)
			: db
					.update(entryTournament)
					.set(tournamentRow(facts.tournament))
					.where(
						and(
							eq(entryTournament.entryId, facts.id),
							eq(entryTournament.userId, facts.userId)
						)
					),
		db
			.update(playSession)
			.set(playSessionRow(facts, now))
			.where(
				and(
					eq(playSession.entryId, facts.id),
					eq(playSession.userId, facts.userId),
					eq(playSession.seq, 1)
				)
			),
	];
}

export function buildEntryDeleteStatements(
	db: Database,
	id: string,
	userId: string
): BatchStatement[] {
	return [
		db.delete(entry).where(and(eq(entry.id, id), eq(entry.userId, userId))),
		db
			.delete(gameSession)
			.where(and(eq(gameSession.id, id), eq(gameSession.userId, userId))),
	];
}

export async function loadEntrySessionFacts(
	db: Database,
	id: string,
	userId: string
): Promise<EntrySessionFacts> {
	const [row] = await db
		.select({
			id: entry.id,
			userId: entry.userId,
			kind: legacyKindSql(),
			source: entry.source,
			sessionDate: legacySessionDateSql(),
			startedAt: firstPlaySession.startedAt,
			endedAt: firstPlaySession.endedAt,
			breakMinutes: firstPlaySession.breakMinutes,
			memo: entry.memo,
			roomId: entry.roomId,
			currencyId: entry.assetId,
			ringGameId: entryCash.ringGameId,
			evDiff: entryCash.evDiff,
			cashOut: sessionCashDetail.cashOut,
			cashRuleName: sessionCashDetail.ruleName,
			tournamentId: entryTournament.tournamentId,
			placement: entryTournament.placement,
			totalEntries: entryTournament.totalEntries,
			beforeDeadline: entryTournament.beforeDeadline,
			tournamentRuleName: sessionTournamentDetail.ruleName,
		})
		.from(entry)
		.leftJoin(firstPlaySession, firstPlaySessionJoin())
		.leftJoin(entryCash, eq(entryCash.entryId, entry.id))
		.leftJoin(entryTournament, eq(entryTournament.entryId, entry.id))
		.leftJoin(sessionCashDetail, eq(sessionCashDetail.sessionId, entry.id))
		.leftJoin(
			sessionTournamentDetail,
			eq(sessionTournamentDetail.sessionId, entry.id)
		)
		.where(and(eq(entry.id, id), eq(entry.userId, userId)));

	if (!row) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this session",
		});
	}

	const base = {
		id: row.id,
		userId: row.userId,
		source: row.source,
		sessionDate: row.sessionDate,
		startedAt: row.startedAt,
		endedAt: row.endedAt,
		breakMinutes: row.breakMinutes,
		memo: row.memo,
		roomId: row.roomId,
		currencyId: row.currencyId,
	};
	if (row.kind === "cash_game") {
		return {
			...base,
			kind: "cash_game",
			ruleName: row.cashRuleName,
			cash: {
				ringGameId: row.ringGameId,
				cashOut: row.cashOut,
				evCashOut: row.evDiff === null ? null : (row.cashOut ?? 0) + row.evDiff,
			},
		};
	}
	return {
		...base,
		kind: "tournament",
		ruleName: row.tournamentRuleName,
		tournament: {
			tournamentId: row.tournamentId,
			placement: row.placement,
			totalEntries: row.totalEntries,
			beforeDeadline: row.beforeDeadline,
		},
	};
}
