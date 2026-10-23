import type { Database } from "@sapphire2/db";
import {
	type EntryKind,
	type EntryStatus,
	type PlaySessionEndState,
	type PlaySessionStatus,
	SETTLING_END_STATES,
} from "@sapphire2/db/constants/entry";
import {
	type LedgerEffect,
	type LedgerRole,
	signedLedgerQuantity,
} from "@sapphire2/db/constants/ledger";
import {
	cashSessionEndPayloadV2,
	cashSessionStartPayloadV2,
	dayEndPayload,
	purchaseChipsPayloadV2,
	reentryPayload,
	tournamentSessionEndPayloadV2,
	tournamentSessionStartPayloadV2,
	updateStackPayloadV2,
} from "@sapphire2/db/constants/play-event-payloads";
import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
	tournamentSessionStartPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import {
	entry,
	entryCash,
	entryTournament,
	type playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { type BatchStatement, chunkForInsert } from "../lib/batch";

export type ProjectorEvent = Pick<
	typeof playEvent.$inferSelect,
	| "id"
	| "playSessionId"
	| "type"
	| "schemaVersion"
	| "occurredAt"
	| "sortOrder"
	| "payload"
>;

export interface ProjectorContext {
	assetId: string | null;
	kind: EntryKind;
	playSessions: { id: string; seq: number; localDate: string }[];
	tournamentEntryCost: { buyIn: number | null; fee: number | null } | null;
}

export interface PlaySessionProjection {
	breakMinutes: number;
	clockStartedAt: Date | null;
	clockStartLevel: number | null;
	endedAt: Date | null;
	endStack: number | null;
	endState: PlaySessionEndState | null;
	id: string;
	startedAt: Date | null;
	status: PlaySessionStatus;
}

export type EntryDetailProjection =
	| { kind: "cash"; evDiff: number | null }
	| {
			kind: "tournament";
			beforeDeadline: boolean;
			placement: number | null;
			totalEntries: number | null;
	  };

export interface ProjectedLine {
	assetId: string | null;
	effect: LedgerEffect;
	id: string;
	occurredAt: Date;
	playSessionId: string;
	quantity: number;
	role: LedgerRole;
	sourceEventId: string;
}

export interface EntryProjection {
	detail: EntryDetailProjection;
	lines: ProjectedLine[];
	playedOn: string;
	playSessions: PlaySessionProjection[];
	status: EntryStatus;
}

interface LinePayment {
	assetId: string | null;
	effect: LedgerEffect;
	quantity: number;
	role: LedgerRole;
}

interface PlaySessionFold {
	endEvent: ProjectorEvent | null;
	projection: PlaySessionProjection;
}

interface TournamentResult {
	beforeDeadline: boolean;
	placement: number | null;
	totalEntries: number | null;
}

const MS_PER_MINUTE = 60_000;

function compareEvents(a: ProjectorEvent, b: ProjectorEvent): number {
	const byTime = a.occurredAt.getTime() - b.occurredAt.getTime();
	if (byTime !== 0) {
		return byTime;
	}
	if (a.sortOrder !== b.sortOrder) {
		return a.sortOrder - b.sortOrder;
	}
	if (a.id === b.id) {
		return 0;
	}
	return a.id < b.id ? -1 : 1;
}

function isV2(event: ProjectorEvent): boolean {
	if (event.schemaVersion === 1) {
		return false;
	}
	if (event.schemaVersion === 2) {
		return true;
	}
	throw new Error(
		`Unsupported payload schema version ${event.schemaVersion} on event ${event.id}`
	);
}

function readClock(
	startEvent: ProjectorEvent | null,
	kind: EntryKind
): Pick<PlaySessionProjection, "clockStartedAt" | "clockStartLevel"> {
	if (startEvent === null || (kind === "cash" && !isV2(startEvent))) {
		return { clockStartedAt: null, clockStartLevel: null };
	}
	const payload = JSON.parse(startEvent.payload);
	let clock: { timerStartedAt?: number | null; startLevel?: number };
	if (!isV2(startEvent)) {
		clock = tournamentSessionStartPayload.parse(payload);
	} else if (kind === "cash") {
		clock = cashSessionStartPayloadV2.parse(payload);
	} else {
		clock = tournamentSessionStartPayloadV2.parse(payload);
	}
	return {
		clockStartedAt:
			typeof clock.timerStartedAt === "number"
				? new Date(clock.timerStartedAt * 1000)
				: null,
		clockStartLevel: clock.startLevel ?? null,
	};
}

function readCashOut(event: ProjectorEvent): number {
	if (isV2(event)) {
		return cashSessionEndPayloadV2
			.parse(JSON.parse(event.payload))
			.payments.reduce((sum, payment) => sum + payment.quantity, 0);
	}
	return cashSessionEndPayload.parse(JSON.parse(event.payload)).cashOutAmount;
}

function readTournamentResult(event: ProjectorEvent): TournamentResult {
	const payload = JSON.parse(event.payload);
	const parsed = isV2(event)
		? tournamentSessionEndPayloadV2.safeParse(payload)
		: tournamentSessionEndPayload.safeParse(payload);
	if (!parsed.success) {
		return { beforeDeadline: false, placement: null, totalEntries: null };
	}
	if (parsed.data.beforeDeadline) {
		return { beforeDeadline: true, placement: null, totalEntries: null };
	}
	return {
		beforeDeadline: false,
		placement: parsed.data.placement,
		totalEntries: parsed.data.totalEntries,
	};
}

function readEnd(
	endEvent: ProjectorEvent,
	kind: EntryKind
): Pick<PlaySessionProjection, "endState" | "endStack"> {
	if (endEvent.type === "day_end") {
		const data = dayEndPayload.parse(JSON.parse(endEvent.payload));
		return { endState: data.endState, endStack: data.stackAmount };
	}
	if (kind === "cash") {
		return { endState: "cashed_out", endStack: readCashOut(endEvent) };
	}
	const { placement } = readTournamentResult(endEvent);
	return { endState: placement === 1 ? "finished" : "busted", endStack: null };
}

function foldPlaySession(
	id: string,
	events: readonly ProjectorEvent[],
	kind: EntryKind
): PlaySessionFold {
	let startEvent: ProjectorEvent | null = null;
	let endEvent: ProjectorEvent | null = null;
	let status: PlaySessionStatus = "active";
	let pausedAt: number | null = null;
	let breakMs = 0;

	for (const event of events) {
		switch (event.type) {
			case "session_start":
				startEvent ??= event;
				status = "active";
				break;
			case "session_pause":
				pausedAt = event.occurredAt.getTime();
				status = "paused";
				break;
			case "session_resume":
				if (pausedAt !== null) {
					breakMs += event.occurredAt.getTime() - pausedAt;
					pausedAt = null;
				}
				status = "active";
				break;
			case "session_end":
			case "day_end":
				endEvent = event;
				status = "ended";
				break;
			default:
				break;
		}
	}

	const closingEvent = status === "ended" ? endEvent : null;
	if (closingEvent !== null && pausedAt !== null) {
		breakMs += Math.max(0, closingEvent.occurredAt.getTime() - pausedAt);
	}

	return {
		endEvent: closingEvent,
		projection: {
			id,
			startedAt: startEvent?.occurredAt ?? null,
			endedAt: closingEvent?.occurredAt ?? null,
			breakMinutes: Math.floor(breakMs / MS_PER_MINUTE),
			status,
			...(closingEvent === null
				? { endState: null, endStack: null }
				: readEnd(closingEvent, kind)),
			...readClock(startEvent, kind),
		},
	};
}

function projectCash(
	events: readonly ProjectorEvent[],
	settled: boolean
): EntryDetailProjection {
	if (!settled) {
		return { kind: "cash", evDiff: null };
	}
	let evDiff = 0;
	for (const event of events) {
		if (event.type === "all_in") {
			const data = allInPayload.parse(JSON.parse(event.payload));
			evDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
		}
	}
	return { kind: "cash", evDiff: Math.round(evDiff) };
}

function latestStackTotalEntries(
	events: readonly ProjectorEvent[]
): number | null {
	let totalEntries: number | null = null;
	for (const event of events) {
		if (event.type === "update_stack") {
			const payload = JSON.parse(event.payload);
			const data = isV2(event)
				? updateStackPayloadV2.parse(payload)
				: updateStackPayload.parse(payload);
			totalEntries = data.totalEntries ?? totalEntries;
		}
	}
	return totalEntries;
}

function projectTournament(
	events: readonly ProjectorEvent[],
	finalEndEvent: ProjectorEvent | null
): EntryDetailProjection {
	if (finalEndEvent?.type === "session_end") {
		return { kind: "tournament", ...readTournamentResult(finalEndEvent) };
	}
	return {
		kind: "tournament",
		beforeDeadline: false,
		placement: null,
		totalEntries: latestStackTotalEntries(events),
	};
}

function mainAssetPayment(
	context: ProjectorContext,
	role: LedgerRole,
	quantity: number
): LinePayment[] {
	return quantity > 0
		? [{ assetId: context.assetId, quantity, role, effect: "real" }]
		: [];
}

function sessionStartPayments(
	event: ProjectorEvent,
	context: ProjectorContext,
	isEntryStart: boolean
): LinePayment[] {
	const payload = JSON.parse(event.payload);
	if (isV2(event)) {
		const schema =
			context.kind === "cash"
				? cashSessionStartPayloadV2
				: tournamentSessionStartPayloadV2;
		return schema.parse(payload).payments ?? [];
	}
	if (context.kind === "cash") {
		return mainAssetPayment(
			context,
			"buy_in",
			cashSessionStartPayload.parse(payload).buyInAmount
		);
	}
	if (!isEntryStart) {
		return [];
	}
	return [
		...mainAssetPayment(
			context,
			"buy_in",
			context.tournamentEntryCost?.buyIn ?? 0
		),
		...mainAssetPayment(context, "fee", context.tournamentEntryCost?.fee ?? 0),
	];
}

function sessionEndPayments(
	event: ProjectorEvent,
	context: ProjectorContext
): LinePayment[] {
	const payload = JSON.parse(event.payload);
	if (context.kind === "cash") {
		return isV2(event)
			? cashSessionEndPayloadV2.parse(payload).payments
			: mainAssetPayment(
					context,
					"cash_out",
					cashSessionEndPayload.parse(payload).cashOutAmount
				);
	}
	if (isV2(event)) {
		const parsed = tournamentSessionEndPayloadV2.safeParse(payload);
		return parsed.success ? parsed.data.payments : [];
	}
	const parsed = tournamentSessionEndPayload.safeParse(payload);
	if (!parsed.success) {
		return [];
	}
	return [
		...mainAssetPayment(context, "prize", parsed.data.prizeMoney),
		...mainAssetPayment(context, "bounty", parsed.data.bountyPrizes),
	];
}

function eventPayments(
	event: ProjectorEvent,
	context: ProjectorContext,
	entryStartId: string | null,
	closingEventIds: ReadonlySet<string>
): LinePayment[] {
	switch (event.type) {
		case "session_start":
			return sessionStartPayments(event, context, event.id === entryStartId);
		case "chips_add_remove": {
			const { amount } = chipsAddRemovePayload.parse(JSON.parse(event.payload));
			return amount > 0
				? mainAssetPayment(context, "addon", amount)
				: mainAssetPayment(context, "chip_remove", -amount);
		}
		case "purchase_chips": {
			const payload = JSON.parse(event.payload);
			return isV2(event)
				? purchaseChipsPayloadV2.parse(payload).payments
				: mainAssetPayment(
						context,
						"chip_purchase",
						purchaseChipsPayload.parse(payload).cost
					);
		}
		case "reentry":
			return reentryPayload.parse(JSON.parse(event.payload)).payments;
		case "session_end":
			return closingEventIds.has(event.id)
				? sessionEndPayments(event, context)
				: [];
		default:
			return [];
	}
}

function projectLines(
	ordered: readonly ProjectorEvent[],
	context: ProjectorContext,
	entryStartId: string | null,
	closingEventIds: ReadonlySet<string>
): ProjectedLine[] {
	return ordered.flatMap((event) =>
		eventPayments(event, context, entryStartId, closingEventIds).map(
			(payment, n) => ({
				id: `${event.id}:${n}`,
				assetId: payment.assetId,
				quantity: signedLedgerQuantity(payment.role, payment.quantity),
				role: payment.role,
				effect: payment.effect,
				playSessionId: event.playSessionId,
				sourceEventId: event.id,
				occurredAt: event.occurredAt,
			})
		)
	);
}

export function projectEntry(
	events: readonly ProjectorEvent[],
	context: ProjectorContext
): EntryProjection {
	const sessions = [...context.playSessions].sort((a, b) => a.seq - b.seq);
	const eventsBySession = new Map<string, ProjectorEvent[]>(
		sessions.map((session) => [session.id, []])
	);
	const ordered = [...events].sort(compareEvents);
	for (const event of ordered) {
		const bucket = eventsBySession.get(event.playSessionId);
		if (!bucket) {
			throw new Error(
				`Event ${event.id} belongs to a play session outside the entry`
			);
		}
		bucket.push(event);
	}

	const folds = sessions.map((session) =>
		foldPlaySession(
			session.id,
			eventsBySession.get(session.id) ?? [],
			context.kind
		)
	);
	const finalFold = folds.at(-1);
	if (!finalFold) {
		throw new Error("An entry has at least one play session");
	}

	const playSessions = folds.map((fold) => fold.projection);
	const finalEndState = finalFold.projection.endState;
	const settled =
		playSessions.every((session) => session.status === "ended") &&
		finalEndState !== null &&
		(SETTLING_END_STATES as readonly PlaySessionEndState[]).includes(
			finalEndState
		);

	return {
		status: settled ? "settled" : "open",
		playedOn: sessions
			.map((session) => session.localDate)
			.reduce((earliest, date) => (date < earliest ? date : earliest)),
		playSessions,
		detail:
			context.kind === "cash"
				? projectCash(ordered, settled)
				: projectTournament(ordered, finalFold.endEvent),
		lines: projectLines(
			ordered,
			context,
			(eventsBySession.get(sessions[0]?.id ?? "") ?? []).find(
				(event) => event.type === "session_start"
			)?.id ?? null,
			new Set(
				folds.flatMap((fold) =>
					fold.endEvent?.type === "session_end" ? [fold.endEvent.id] : []
				)
			)
		),
	};
}

export function buildProjectionStatements(
	db: Database,
	scope: { entryId: string; userId: string },
	projection: EntryProjection
): BatchStatement[] {
	const statements: BatchStatement[] = projection.playSessions.map(
		({ id, ...values }) =>
			db
				.update(playSession)
				.set(values)
				.where(
					and(
						eq(playSession.id, id),
						eq(playSession.entryId, scope.entryId),
						eq(playSession.userId, scope.userId)
					)
				)
	);

	const { detail } = projection;
	if (detail.kind === "cash") {
		statements.push(
			db
				.update(entryCash)
				.set({ evDiff: detail.evDiff })
				.where(
					and(
						eq(entryCash.entryId, scope.entryId),
						eq(entryCash.userId, scope.userId)
					)
				)
		);
	} else {
		statements.push(
			db
				.update(entryTournament)
				.set({
					placement: detail.placement,
					totalEntries: detail.totalEntries,
					beforeDeadline: detail.beforeDeadline,
				})
				.where(
					and(
						eq(entryTournament.entryId, scope.entryId),
						eq(entryTournament.userId, scope.userId)
					)
				)
		);
	}

	statements.push(
		db
			.update(entry)
			.set({ status: projection.status, playedOn: projection.playedOn })
			.where(and(eq(entry.id, scope.entryId), eq(entry.userId, scope.userId)))
	);

	return statements;
}

export function buildProjectionLineStatements(
	db: Database,
	scope: { entryId: string; userId: string },
	lines: readonly ProjectedLine[],
	now: Date
): BatchStatement[] {
	const rows = lines.map(({ assetId, ...line }) => {
		if (assetId === null) {
			throw new TRPCError({
				code: "PRECONDITION_FAILED",
				message: "Choose a currency for this session before recording money",
			});
		}
		return {
			...line,
			assetId,
			userId: scope.userId,
			entryId: scope.entryId,
			createdAt: now,
			updatedAt: now,
		};
	});
	const statements: BatchStatement[] = [
		db
			.delete(ledgerLine)
			.where(
				and(
					eq(ledgerLine.entryId, scope.entryId),
					eq(ledgerLine.userId, scope.userId),
					isNotNull(ledgerLine.sourceEventId)
				)
			),
	];
	for (const chunk of chunkForInsert(rows, Object.keys(rows[0] ?? {}).length)) {
		statements.push(db.insert(ledgerLine).values(chunk));
	}
	return statements;
}
