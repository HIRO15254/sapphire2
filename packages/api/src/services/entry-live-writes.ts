import type { Database } from "@sapphire2/db";
import {
	type EntryKind,
	type EntrySource,
	endStatesForKind,
	type PlaySessionStatus,
} from "@sapphire2/db/constants/entry";
import {
	dayEndPayload,
	PLAY_EVENT_SCHEMA_VERSION,
	playEventPayloadSchema,
} from "@sapphire2/db/constants/play-event-payloads";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { type BatchStatement, runBatch } from "../lib/batch";
import {
	isEndedPlayAppendError,
	isPlayEventOrderConflictError,
	isUnfinishedPlaySessionConflictError,
} from "../lib/db-errors";
import {
	buildProjectionLineStatements,
	buildProjectionStatements,
	compareEvents,
	type EntryProjection,
	type ProjectorEvent,
	projectEntry,
} from "./entry-projector";

const ENTRY_FORBIDDEN_MESSAGE = "Entry unavailable";
const EVENT_FORBIDDEN_MESSAGE = "You do not own this event";
const PLAY_FORBIDDEN_MESSAGE = "This play session does not belong to the entry";

export interface NewPlayEvent {
	id?: string;
	occurredAt: Date;
	payload: unknown;
	playSessionId?: string;
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
		| { kind: "cash"; cashRuleId: string; ringGameId: string | null }
		| {
				kind: "tournament";
				tournamentId: string | null;
				tournamentRuleId: string;
		  };
	followUps?: readonly Pick<NewPlayEvent, "occurredAt" | "payload" | "type">[];
	id: string;
	label?: string | null;
	localDate: string;
	memo: string | null;
	now: Date;
	roomId: string | null;
	startEvent: Pick<NewPlayEvent, "occurredAt" | "payload">;
	title: string | null;
	userId: string;
}

export interface StoredPlayEvent extends ProjectorEvent {
	createdAt: Date;
	entryId: string;
	schemaVersion: number;
	updatedAt: Date;
}

export interface EntryEventState {
	events: StoredPlayEvent[];
	kind: EntryKind;
	playSessions: {
		id: string;
		localDate: string;
		seq: number;
		status: PlaySessionStatus;
	}[];
	source: EntrySource;
}

interface EntryScope {
	entryId: string;
	userId: string;
}

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

function canonicalPayload(
	kind: EntryKind,
	type: string,
	payload: unknown
): string {
	const schema = playEventPayloadSchema(kind, type);
	if (!schema) {
		badRequest(`A ${kind} entry has no ${type} event`);
	}
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		badRequest(`Invalid ${type} payload: ${parsed.error.issues[0]?.message}`);
	}
	return JSON.stringify(parsed.data);
}

function playEventRow(
	scope: EntryScope,
	kind: EntryKind,
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
		schemaVersion: PLAY_EVENT_SCHEMA_VERSION,
		occurredAt: event.occurredAt,
		sortOrder,
		payload: canonicalPayload(kind, event.type, event.payload),
		createdAt: now,
		updatedAt: now,
	};
}

function nextSortOrderSql(entryId: string) {
	return sql<number>`(SELECT COALESCE(MAX(${playEvent.sortOrder}), -1) + 1 FROM ${playEvent} WHERE ${playEvent.entryId} = ${entryId})`;
}

type PlayStreamState = PlaySessionStatus | "none";

const LIFECYCLE_TRANSITIONS: Record<
	string,
	{ from: readonly PlayStreamState[]; message: string; to: PlayStreamState }
> = {
	session_start: {
		from: ["none"],
		to: "active",
		message: "A play session starts once, with its first event",
	},
	session_pause: {
		from: ["active"],
		to: "paused",
		message: "Only an active play session can be paused",
	},
	session_resume: {
		from: ["paused"],
		to: "active",
		message: "Only a paused play session can be resumed",
	},
	day_end: {
		from: ["active", "paused"],
		to: "ended",
		message: "Only a play session in progress can end",
	},
	session_end: {
		from: ["active", "paused"],
		to: "ended",
		message: "Only a play session in progress can end",
	},
};

function nextPlayState(
	kind: EntryKind,
	state: PlayStreamState,
	event: ProjectorEvent
): PlayStreamState {
	canonicalPayload(kind, event.type, JSON.parse(event.payload));
	if (state === "ended") {
		badRequest("No event can follow the end of its play session");
	}
	const transition = LIFECYCLE_TRANSITIONS[event.type];
	if (!transition) {
		if (state === "none") {
			badRequest("A play session begins with its session_start");
		}
		return state;
	}
	if (!transition.from.includes(state)) {
		badRequest(transition.message);
	}
	if (
		event.type === "day_end" &&
		!(endStatesForKind(kind) as readonly string[]).includes(
			dayEndPayload.parse(JSON.parse(event.payload)).endState
		)
	) {
		badRequest(`A ${kind} day cannot end with this state`);
	}
	return transition.to;
}

export function validateEventStream(
	kind: EntryKind,
	playSessions: readonly { id: string; seq: number }[],
	events: readonly ProjectorEvent[]
): void {
	const ordered = [...playSessions].sort((a, b) => a.seq - b.seq);
	const buckets = new Map<string, ProjectorEvent[]>(
		ordered.map((play) => [play.id, []])
	);
	for (const event of [...events].sort(compareEvents)) {
		buckets.get(event.playSessionId)?.push(event);
	}
	for (const [index, play] of ordered.entries()) {
		const state = (buckets.get(play.id) ?? []).reduce<PlayStreamState>(
			(current, event) => nextPlayState(kind, current, event),
			"none"
		);
		if (state === "none") {
			badRequest("A play session begins with its session_start");
		}
		if (index < ordered.length - 1 && state !== "ended") {
			badRequest("Every play session before the last must have ended");
		}
	}
}

export function buildLiveEntryStartStatements(
	db: Database,
	start: LiveEntryStart
): BatchStatement[] {
	const kind: EntryKind = start.detail.kind;
	const scope = { entryId: start.id, userId: start.userId };
	const playSessionId = crypto.randomUUID();
	const rows = [
		{ ...start.startEvent, type: "session_start" },
		...(start.followUps ?? []),
	].map((event, sortOrder) =>
		playEventRow(scope, kind, playSessionId, sortOrder, event, start.now)
	);
	const playSessions = [
		{ id: playSessionId, seq: 1, localDate: start.localDate },
	];
	validateEventStream(kind, playSessions, rows);
	const projection = projectEntry(rows, { kind, playSessions });

	return [
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
			createdAt: start.now,
			updatedAt: start.now,
		}),
		start.detail.kind === "cash"
			? db.insert(entryCash).values({
					entryId: start.id,
					userId: start.userId,
					ringGameId: start.detail.ringGameId,
					cashRuleId: start.detail.cashRuleId,
				})
			: db.insert(entryTournament).values({
					entryId: start.id,
					userId: start.userId,
					tournamentId: start.detail.tournamentId,
					tournamentRuleId: start.detail.tournamentRuleId,
				}),
		db.insert(playSession).values({
			id: playSessionId,
			userId: start.userId,
			entryId: start.id,
			kind,
			seq: 1,
			label: start.label ?? null,
			localDate: start.localDate,
			status: "active",
			createdAt: start.now,
			updatedAt: start.now,
		}),
		...rows.map((row) => db.insert(playEvent).values(row)),
		...buildProjectionStatements(db, scope, projection),
		...buildProjectionLineStatements(db, scope, projection.lines, start.now),
	];
}

export async function loadEntryEventState(
	db: Database,
	userId: string,
	entryId: string
): Promise<EntryEventState> {
	const [owned] = await db
		.select({ kind: entry.kind, source: entry.source })
		.from(entry)
		.where(and(eq(entry.id, entryId), eq(entry.userId, userId)));
	if (!owned) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: ENTRY_FORBIDDEN_MESSAGE,
		});
	}
	const playSessions = await db
		.select({
			id: playSession.id,
			seq: playSession.seq,
			localDate: playSession.localDate,
			status: playSession.status,
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
			occurredAt: playEvent.occurredAt,
			sortOrder: playEvent.sortOrder,
			payload: playEvent.payload,
			schemaVersion: playEvent.schemaVersion,
			createdAt: playEvent.createdAt,
			updatedAt: playEvent.updatedAt,
		})
		.from(playEvent)
		.where(and(eq(playEvent.entryId, entryId), eq(playEvent.userId, userId)));
	events.sort(compareEvents);
	return { kind: owned.kind, source: owned.source, playSessions, events };
}

export function findStoredEvent(
	state: EntryEventState,
	id: string
): StoredPlayEvent {
	const found = state.events.find((event) => event.id === id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: EVENT_FORBIDDEN_MESSAGE,
		});
	}
	return found;
}

export function resolveAppendTarget(
	state: EntryEventState,
	playSessionId: string | undefined
): string {
	if (playSessionId !== undefined) {
		const play = state.playSessions.find(({ id }) => id === playSessionId);
		if (!play) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: PLAY_FORBIDDEN_MESSAGE,
			});
		}
		if (play.status === "ended") {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "No event can be added to an ended play session",
			});
		}
		return play.id;
	}
	const open = state.playSessions.find(({ status }) => status !== "ended");
	if (!open) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "The entry has no play session in progress",
		});
	}
	return open.id;
}

function planAppend(
	db: Database,
	scope: EntryScope,
	state: EntryEventState,
	events: readonly NewPlayEvent[],
	now: Date
) {
	let nextSortOrder =
		state.events.reduce((max, event) => Math.max(max, event.sortOrder), -1) + 1;
	const rows = events.map((event) => {
		const row = playEventRow(
			scope,
			state.kind,
			resolveAppendTarget(state, event.playSessionId),
			nextSortOrder,
			event,
			now
		);
		nextSortOrder += 1;
		return row;
	});
	return {
		statements: rows.map((row) =>
			db
				.insert(playEvent)
				.values({ ...row, sortOrder: nextSortOrderSql(scope.entryId) })
		),
		events: [...state.events, ...rows],
		eventIds: rows.map((row) => row.id),
	};
}

function planChange(
	db: Database,
	scope: EntryScope,
	state: EntryEventState,
	change: EntryEventChange,
	now: Date
): {
	eventIds: string[];
	events: ProjectorEvent[];
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
			: canonicalPayload(state.kind, target.type, change.payload);
	const occurredAt = change.occurredAt ?? target.occurredAt;
	return {
		statements: [
			db
				.update(playEvent)
				.set({
					occurredAt,
					payload,
					schemaVersion: PLAY_EVENT_SCHEMA_VERSION,
					updatedAt: now,
				})
				.where(owned),
		],
		events: state.events.map((event) =>
			event.id === target.id ? { ...event, occurredAt, payload } : event
		),
		eventIds: [target.id],
	};
}

export function mapLiveWriteConflict(error: unknown): unknown {
	if (isUnfinishedPlaySessionConflictError(error)) {
		return new TRPCError({
			code: "CONFLICT",
			message: "Another play session is already in progress",
			cause: error,
		});
	}
	if (isPlayEventOrderConflictError(error)) {
		return new TRPCError({
			code: "CONFLICT",
			message: "Another change to this entry was saved at the same time",
			cause: error,
		});
	}
	if (isEndedPlayAppendError(error)) {
		return new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "No event can be added to an ended play session",
			cause: error,
		});
	}
	return error;
}

export async function commitEntryEventChange(
	db: Database,
	options: {
		before?: BatchStatement[];
		change: EntryEventChange;
		entryId: string;
		now: Date;
		state: EntryEventState;
		userId: string;
	}
): Promise<{ eventIds: string[]; projection: EntryProjection }> {
	const { change, now, state } = options;
	if (state.source !== "live") {
		badRequest("Only a live entry records events");
	}
	const scope = { entryId: options.entryId, userId: options.userId };
	const planned = planChange(db, scope, state, change, now);
	validateEventStream(state.kind, state.playSessions, planned.events);
	const projection = projectEntry(planned.events, state);
	const appendTargets =
		change.op === "append"
			? new Set(
					planned.events
						.filter((event) => planned.eventIds.includes(event.id))
						.map((event) => event.playSessionId)
				)
			: new Set<string>();
	await runBatch(db, [
		...[...appendTargets].map((playSessionId) =>
			db
				.update(playSession)
				.set({
					status: sql`CASE WHEN ${playSession.status} = 'ended' THEN NULL ELSE ${playSession.status} END`,
				})
				.where(
					and(
						eq(playSession.id, playSessionId),
						eq(playSession.userId, scope.userId)
					)
				)
		),
		...(options.before ?? []),
		...planned.statements,
		...buildProjectionStatements(db, scope, projection),
		...buildProjectionLineStatements(db, scope, projection.lines, now),
	]).catch((error: unknown) => {
		throw mapLiveWriteConflict(error);
	});
	return { eventIds: planned.eventIds, projection };
}

export async function applyEntryEventChange(
	db: Database,
	userId: string,
	entryId: string,
	change: EntryEventChange,
	now: Date
): Promise<{ eventIds: string[]; projection: EntryProjection }> {
	const state = await loadEntryEventState(db, userId, entryId);
	return await commitEntryEventChange(db, {
		change,
		entryId,
		now,
		state,
		userId,
	});
}
