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
	playerLeavePayload,
} from "@sapphire2/db/constants/play-event-payloads";
import { asset } from "@sapphire2/db/schema/asset";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { player } from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { activeReferencesGuard } from "../lib/active-reference-guard";
import type { BatchStatement } from "../lib/batch";
import {
	isDiscardedPlayDependentError,
	isEndedPlayAppendError,
	isPlayEventOrderConflictError,
	isPlaySeqConflictError,
	isUnfinishedPlaySessionConflictError,
} from "../lib/db-errors";
import { guardStatement, runGuardedBatch } from "../lib/write-guard";
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
	userId: string;
}

export interface StoredPlayEvent extends ProjectorEvent {
	createdAt: Date;
	entryId: string;
	handId: string | null;
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

function storedPayload(
	kind: EntryKind,
	type: string,
	payload: unknown
): { handId: string | null; payload: string } {
	const schema = playEventPayloadSchema(kind, type);
	if (!schema) {
		badRequest(`A ${kind} entry has no ${type} event`);
	}
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		badRequest(`Invalid ${type} payload: ${parsed.error.issues[0]?.message}`);
	}
	if (type !== "all_in") {
		return { handId: null, payload: JSON.stringify(parsed.data) };
	}
	const { handId, ...rest } = parsed.data as { handId?: string };
	return { handId: handId ?? null, payload: JSON.stringify(rest) };
}

function playEventRow(
	scope: EntryScope,
	kind: EntryKind,
	playSessionId: string,
	sortOrder: number,
	event: NewPlayEvent,
	now: Date
) {
	const stored = storedPayload(kind, event.type, event.payload);
	return {
		createdAt: now,
		entryId: scope.entryId,
		handId: stored.handId,
		id: event.id ?? crypto.randomUUID(),
		occurredAt: event.occurredAt,
		payload: stored.payload,
		playSessionId,
		schemaVersion: PLAY_EVENT_SCHEMA_VERSION,
		sortOrder,
		type: event.type,
		updatedAt: now,
		userId: scope.userId,
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
	day_end: {
		from: ["active", "paused"],
		message: "Only a play session in progress can end",
		to: "ended",
	},
	session_end: {
		from: ["active", "paused"],
		message: "Only a play session in progress can end",
		to: "ended",
	},
	session_pause: {
		from: ["active"],
		message: "Only an active play session can be paused",
		to: "paused",
	},
	session_resume: {
		from: ["paused"],
		message: "Only a paused play session can be resumed",
		to: "active",
	},
	session_start: {
		from: ["none"],
		message: "A play session starts once, with its first event",
		to: "active",
	},
};

function nextPlayState(
	kind: EntryKind,
	state: PlayStreamState,
	event: ProjectorEvent
): PlayStreamState {
	storedPayload(kind, event.type, JSON.parse(event.payload));
	if (state === "ended") {
		badRequest("No event can follow the end of its play session");
	}
	if (event.type === "reentry" && state !== "active") {
		badRequest("A re-entry requires an active play session");
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
		{ id: playSessionId, localDate: start.localDate, seq: 1 },
	];
	validateEventStream(kind, playSessions, rows);
	const projection = projectEntry(rows, { kind, playSessions });

	return [
		db.insert(entry).values({
			assetId: start.assetId,
			createdAt: start.now,
			id: start.id,
			kind,
			memo: start.memo,
			playedOn: start.localDate,
			roomId: start.roomId,
			source: "live",
			status: "open",
			title: null,
			updatedAt: start.now,
			userId: start.userId,
		}),
		start.detail.kind === "cash"
			? db.insert(entryCash).values({
					cashRuleId: start.detail.cashRuleId,
					entryId: start.id,
					ringGameId: start.detail.ringGameId,
					userId: start.userId,
				})
			: db.insert(entryTournament).values({
					entryId: start.id,
					tournamentId: start.detail.tournamentId,
					tournamentRuleId: start.detail.tournamentRuleId,
					userId: start.userId,
				}),
		db.insert(playSession).values({
			createdAt: start.now,
			entryId: start.id,
			id: playSessionId,
			kind,
			label: start.label ?? null,
			localDate: start.localDate,
			seq: 1,
			status: "active",
			updatedAt: start.now,
			userId: start.userId,
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
			localDate: playSession.localDate,
			seq: playSession.seq,
			status: playSession.status,
		})
		.from(playSession)
		.where(
			and(eq(playSession.entryId, entryId), eq(playSession.userId, userId))
		)
		.orderBy(asc(playSession.seq));
	const events = await db
		.select({
			createdAt: playEvent.createdAt,
			entryId: playEvent.entryId,
			handId: playEvent.handId,
			id: playEvent.id,
			occurredAt: playEvent.occurredAt,
			payload: playEvent.payload,
			playSessionId: playEvent.playSessionId,
			schemaVersion: playEvent.schemaVersion,
			sortOrder: playEvent.sortOrder,
			type: playEvent.type,
			updatedAt: playEvent.updatedAt,
		})
		.from(playEvent)
		.where(and(eq(playEvent.entryId, entryId), eq(playEvent.userId, userId)));
	events.sort(compareEvents);
	return { events, kind: owned.kind, playSessions, source: owned.source };
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
		eventIds: rows.map((row) => row.id),
		events: [...state.events, ...rows],
		statements: rows.map((row) =>
			db
				.insert(playEvent)
				.values({ ...row, sortOrder: nextSortOrderSql(scope.entryId) })
		),
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
			eventIds: [target.id],
			events: state.events.filter((event) => event.id !== target.id),
			statements: [db.delete(playEvent).where(owned)],
		};
	}
	const stored =
		change.payload === undefined
			? { handId: target.handId, payload: target.payload }
			: storedPayload(state.kind, target.type, change.payload);
	const { payload } = stored;
	const occurredAt = change.occurredAt ?? target.occurredAt;
	return {
		eventIds: [target.id],
		events: state.events.map((event) =>
			event.id === target.id ? { ...event, occurredAt, payload } : event
		),
		statements: [
			db
				.update(playEvent)
				.set({
					handId: stored.handId,
					occurredAt,
					payload,
					schemaVersion: PLAY_EVENT_SCHEMA_VERSION,
					updatedAt: now,
				})
				.where(owned),
		],
	};
}

export function mapLiveWriteConflict(error: unknown): unknown {
	if (isUnfinishedPlaySessionConflictError(error)) {
		return new TRPCError({
			cause: error,
			code: "CONFLICT",
			message: "Another play session is already in progress",
		});
	}
	if (isPlayEventOrderConflictError(error) || isPlaySeqConflictError(error)) {
		return new TRPCError({
			cause: error,
			code: "CONFLICT",
			message: "Another change to this entry was saved at the same time",
		});
	}
	if (isEndedPlayAppendError(error)) {
		return new TRPCError({
			cause: error,
			code: "PRECONDITION_FAILED",
			message: "No event can be added to an ended play session",
		});
	}
	if (isDiscardedPlayDependentError(error)) {
		return new TRPCError({
			cause: error,
			code: "CONFLICT",
			message:
				"The play session gained events or hands; it can no longer be discarded",
		});
	}
	return error;
}

export async function commitEntryEventChange(
	db: Database,
	options: {
		after?: BatchStatement[];
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
	const playSessionIds = new Set(state.playSessions.map((play) => play.id));
	const oldLines = projectEntry(
		state.events.filter((event) => playSessionIds.has(event.playSessionId)),
		state
	).lines;
	const remainingAssets = new Map<string, number>();
	for (const line of oldLines) {
		remainingAssets.set(
			line.assetId,
			(remainingAssets.get(line.assetId) ?? 0) + 1
		);
	}
	const newAssets = new Set<string>();
	for (const line of projection.lines) {
		const count = remainingAssets.get(line.assetId) ?? 0;
		if (count > 0) {
			remainingAssets.set(line.assetId, count - 1);
		} else {
			newAssets.add(line.assetId);
		}
	}
	const appendTargets =
		change.op === "append"
			? new Set(
					planned.events
						.filter((event) => planned.eventIds.includes(event.id))
						.map((event) => event.playSessionId)
				)
			: new Set<string>();
	const snapshot = JSON.stringify(
		state.events.map((event) => ({
			handId: event.handId,
			id: event.id,
			occurredAt: Math.floor(event.occurredAt.getTime() / 1000),
			payload: event.payload,
			playSessionId: event.playSessionId,
			schemaVersion: event.schemaVersion,
			sortOrder: event.sortOrder,
			type: event.type,
		}))
	);
	const playerIds = new Set(
		planned.events
			.filter(
				(event) =>
					change.op !== "delete" &&
					planned.eventIds.includes(event.id) &&
					(event.type === "player_join" || event.type === "player_leave")
			)
			.map(
				(event) => playerLeavePayload.parse(JSON.parse(event.payload)).playerId
			)
	);
	await runGuardedBatch(db, [
		activeReferencesGuard(db, asset, newAssets, scope.userId),
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
		guardStatement(
			db,
			"entry-event-stream",
			sql`
			(SELECT count(*) FROM ${playEvent}
			 WHERE ${playEvent.entryId} = ${scope.entryId} AND ${playEvent.userId} = ${scope.userId}) = ${state.events.length}
			AND NOT EXISTS (
				SELECT 1 FROM json_each(${snapshot}) AS expected
				WHERE NOT EXISTS (
					SELECT 1 FROM ${playEvent}
					WHERE ${playEvent.entryId} = ${scope.entryId}
						AND ${playEvent.userId} = ${scope.userId}
						AND ${playEvent.id} = json_extract(expected.value, '$.id')
						AND ${playEvent.playSessionId} = json_extract(expected.value, '$.playSessionId')
						AND ${playEvent.type} = json_extract(expected.value, '$.type')
						AND ${playEvent.occurredAt} = json_extract(expected.value, '$.occurredAt')
						AND ${playEvent.sortOrder} = json_extract(expected.value, '$.sortOrder')
						AND ${playEvent.payload} = json_extract(expected.value, '$.payload')
						AND ${playEvent.handId} IS json_extract(expected.value, '$.handId')
						AND ${playEvent.schemaVersion} = json_extract(expected.value, '$.schemaVersion')
				)
			)
		`
		),
		...[...playerIds].map((playerId) =>
			guardStatement(
				db,
				"event-player",
				sql`EXISTS (
				SELECT 1 FROM ${player} WHERE ${player.id} = ${playerId} AND ${player.userId} = ${scope.userId}
			)`
			)
		),
		...planned.statements,
		...buildProjectionStatements(db, scope, projection),
		...buildProjectionLineStatements(db, scope, projection.lines, now),
		...(options.after ?? []),
	]).catch((error: unknown) => {
		throw mapLiveWriteConflict(error);
	});
	return { eventIds: planned.eventIds, projection };
}
