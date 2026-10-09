import type { Database } from "@sapphire2/db";
import type { EntryKind } from "@sapphire2/db/constants/entry";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { gameSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { type BatchStatement, runBatch } from "../lib/batch";
import { floorToMinute } from "../utils/session-event-time";
import {
	buildProjectionStatements,
	type EntryProjection,
	type ProjectorEvent,
	projectEntry,
} from "./entry-projector";
import { MINIMAL_GAME_SESSION_DATE } from "./entry-session";
import { computeHeroSeatPositionFromEvents } from "./live-session-pl";

const SESSION_FORBIDDEN_MESSAGE = "You do not own this session";
const EVENT_FORBIDDEN_MESSAGE = "You do not own this event";

export interface NewPlayEvent {
	id?: string;
	occurredAt: Date;
	payload: unknown;
	playSessionId?: string;
	schemaVersion?: number;
	type: string;
}

export type EntryEventChange =
	| { op: "append"; events: readonly NewPlayEvent[] }
	| {
			op: "update";
			id: string;
			occurredAt?: Date;
			payload?: unknown;
	  }
	| { op: "delete"; id: string };

export interface LiveEntryStart {
	assetId: string | null;
	detail:
		| { kind: "cash"; ringGameId: string | null }
		| { kind: "tournament"; tournamentId: string | null };
	id: string;
	localDate: string;
	memo: string | null;
	now: Date;
	roomId: string | null;
	startEvent: Pick<NewPlayEvent, "occurredAt" | "payload" | "schemaVersion">;
	title: string | null;
	userId: string;
}

interface StoredPlayEvent extends ProjectorEvent {
	entryId: string;
}

interface EntryEventState {
	events: StoredPlayEvent[];
	kind: EntryKind;
	playSessions: { id: string; seq: number; localDate: string }[];
}

function playEventRow(
	scope: { entryId: string; userId: string },
	playSessionId: string,
	sortOrder: number,
	event: NewPlayEvent,
	now: Date
) {
	return {
		id: event.id ?? crypto.randomUUID(),
		userId: scope.userId,
		entryId: scope.entryId,
		playSessionId,
		type: event.type,
		schemaVersion: event.schemaVersion ?? 1,
		occurredAt: event.occurredAt,
		sortOrder,
		payload: JSON.stringify(event.payload),
		updatedAt: now,
	};
}

export function buildLiveEntryStartStatements(
	db: Database,
	start: LiveEntryStart
): BatchStatement[] {
	const kind: EntryKind = start.detail.kind;
	const scope = { entryId: start.id, userId: start.userId };
	const playSessionId = crypto.randomUUID();
	const startRow = playEventRow(
		scope,
		playSessionId,
		0,
		{ ...start.startEvent, type: "session_start" },
		start.now
	);
	const projection = projectEntry([startRow], {
		kind,
		playSessions: [{ id: playSessionId, seq: 1, localDate: start.localDate }],
	});

	return [
		db.insert(gameSession).values({
			id: start.id,
			userId: start.userId,
			kind: kind === "cash" ? "cash_game" : "tournament",
			status: "completed",
			source: "live",
			sessionDate: MINIMAL_GAME_SESSION_DATE,
			updatedAt: start.now,
		}),
		db.insert(entry).values({
			id: start.id,
			userId: start.userId,
			kind,
			source: "live",
			status: "open",
			roomId: start.roomId,
			assetId: start.assetId,
			title: start.title,
			playedOn: start.localDate,
			memo: start.memo,
			updatedAt: start.now,
		}),
		start.detail.kind === "cash"
			? db.insert(entryCash).values({
					entryId: start.id,
					userId: start.userId,
					ringGameId: start.detail.ringGameId,
				})
			: db.insert(entryTournament).values({
					entryId: start.id,
					userId: start.userId,
					tournamentId: start.detail.tournamentId,
				}),
		db.insert(playSession).values({
			id: playSessionId,
			userId: start.userId,
			entryId: start.id,
			kind,
			seq: 1,
			localDate: start.localDate,
			status: "active",
			updatedAt: start.now,
		}),
		db.insert(playEvent).values(startRow),
		...buildProjectionStatements(db, scope, projection),
	];
}

async function loadEntryEventState(
	db: Database,
	userId: string,
	entryId: string
): Promise<EntryEventState> {
	const [owned] = await db
		.select({ kind: entry.kind })
		.from(entry)
		.where(and(eq(entry.id, entryId), eq(entry.userId, userId)));
	if (!owned) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const playSessions = await db
		.select({
			id: playSession.id,
			seq: playSession.seq,
			localDate: playSession.localDate,
		})
		.from(playSession)
		.where(
			and(eq(playSession.entryId, entryId), eq(playSession.userId, userId))
		)
		.orderBy(asc(playSession.seq));
	const events = await db
		.select({
			id: playEvent.id,
			entryId: playEvent.entryId,
			playSessionId: playEvent.playSessionId,
			type: playEvent.type,
			schemaVersion: playEvent.schemaVersion,
			occurredAt: playEvent.occurredAt,
			sortOrder: playEvent.sortOrder,
			payload: playEvent.payload,
		})
		.from(playEvent)
		.where(and(eq(playEvent.entryId, entryId), eq(playEvent.userId, userId)));
	return { kind: owned.kind, playSessions, events };
}

function findStoredEvent(state: EntryEventState, id: string): StoredPlayEvent {
	const found = state.events.find((event) => event.id === id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: EVENT_FORBIDDEN_MESSAGE,
		});
	}
	return found;
}

function planAppend(
	db: Database,
	scope: { entryId: string; userId: string },
	state: EntryEventState,
	events: readonly NewPlayEvent[],
	now: Date
) {
	const latest = state.playSessions.at(-1);
	if (!latest) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const knownSessions = new Set(state.playSessions.map(({ id }) => id));
	let nextSortOrder =
		state.events.reduce((max, event) => Math.max(max, event.sortOrder), -1) + 1;
	const rows = events.map((event) => {
		const playSessionId = event.playSessionId ?? latest.id;
		if (!knownSessions.has(playSessionId)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "The play session does not belong to this session",
			});
		}
		const row = playEventRow(scope, playSessionId, nextSortOrder, event, now);
		nextSortOrder += 1;
		return row;
	});
	return {
		statements: rows.map((row) => db.insert(playEvent).values(row)),
		events: [...state.events, ...rows],
		eventIds: rows.map((row) => row.id),
	};
}

function planChange(
	db: Database,
	scope: { entryId: string; userId: string },
	state: EntryEventState,
	change: EntryEventChange,
	now: Date
): {
	eventIds: string[];
	events: StoredPlayEvent[];
	statements: BatchStatement[];
} {
	if (change.op === "append") {
		return planAppend(db, scope, state, change.events, now);
	}
	const target = findStoredEvent(state, change.id);
	const owned = and(
		eq(playEvent.id, target.id),
		eq(playEvent.entryId, scope.entryId),
		eq(playEvent.userId, scope.userId)
	);
	if (change.op === "delete") {
		return {
			statements: [db.delete(playEvent).where(owned)],
			events: state.events.filter((event) => event.id !== target.id),
			eventIds: [target.id],
		};
	}
	const payload =
		change.payload === undefined
			? target.payload
			: JSON.stringify(change.payload);
	const occurredAt = change.occurredAt ?? target.occurredAt;
	return {
		statements: [
			db
				.update(playEvent)
				.set({ occurredAt, payload, updatedAt: now })
				.where(owned),
		],
		events: state.events.map((event) =>
			event.id === target.id ? { ...event, occurredAt, payload } : event
		),
		eventIds: [target.id],
	};
}

export async function applyEntryEventChange(
	db: Database,
	userId: string,
	entryId: string,
	change: EntryEventChange,
	now: Date
): Promise<{ eventIds: string[]; projection: EntryProjection }> {
	const scope = { entryId, userId };
	const state = await loadEntryEventState(db, userId, entryId);
	const planned = planChange(db, scope, state, change, now);
	const projection = projectEntry(planned.events, {
		kind: state.kind,
		playSessions: state.playSessions,
	});
	await runBatch(db, [
		...planned.statements,
		...buildProjectionStatements(db, scope, projection),
	]);
	return { eventIds: planned.eventIds, projection };
}

export async function updateEntryHeroSeat(
	db: Database,
	userId: string,
	entryId: string,
	heroSeatPosition: number | null,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, entryId);
	const ordered = [...state.events].sort(
		(a, b) =>
			a.occurredAt.getTime() - b.occurredAt.getTime() ||
			a.sortOrder - b.sortOrder ||
			a.id.localeCompare(b.id)
	);
	const previous = computeHeroSeatPositionFromEvents(
		ordered.map((event) => ({
			eventType: event.type,
			payload: event.payload,
		}))
	);
	if (previous === heroSeatPosition) {
		return;
	}
	const occurredAt = floorToMinute(now);
	const events: NewPlayEvent[] = [];
	if (previous !== null) {
		events.push({
			type: "player_leave",
			occurredAt,
			payload: { isHero: true },
		});
	}
	if (heroSeatPosition !== null) {
		events.push({
			type: "player_join",
			occurredAt,
			payload: { isHero: true, seatPosition: heroSeatPosition },
		});
	}
	await applyEntryEventChange(
		db,
		userId,
		entryId,
		{ op: "append", events },
		now
	);
}
