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
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	dayEndPayload,
	purchaseChipsPayload,
	reentryPayload,
	tournamentSessionEndPayload,
	tournamentSessionStartPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/play-event-payloads";
import {
	entry,
	entryCash,
	entryTournament,
	type playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { and, eq, isNotNull } from "drizzle-orm";
import { type BatchStatement, insertChunks } from "../lib/batch";
import { addSafeIntegers, safeInteger } from "../lib/safe-integer";

export type ProjectorEvent = Pick<
	typeof playEvent.$inferSelect,
	"id" | "playSessionId" | "type" | "occurredAt" | "sortOrder" | "payload"
>;

export interface ProjectorContext {
	kind: EntryKind;
	playSessions: { id: string; seq: number; localDate: string }[];
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
	assetId: string;
	effect: LedgerEffect;
	id: string;
	occurredAt: Date;
	playSessionId: string;
	priceId: string | null;
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
	assetId: string;
	effect: LedgerEffect;
	priceId?: string;
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

export function compareEvents(a: ProjectorEvent, b: ProjectorEvent): number {
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

function readClock(
	startEvent: ProjectorEvent | null,
	kind: EntryKind
): Pick<PlaySessionProjection, "clockStartedAt" | "clockStartLevel"> {
	if (startEvent === null) {
		return { clockStartedAt: null, clockStartLevel: null };
	}
	const payload = JSON.parse(startEvent.payload);
	const clock =
		kind === "cash"
			? cashSessionStartPayload.parse(payload)
			: tournamentSessionStartPayload.parse(payload);
	return {
		clockStartedAt:
			typeof clock.timerStartedAt === "number"
				? new Date(clock.timerStartedAt * 1000)
				: null,
		clockStartLevel: clock.startLevel ?? null,
	};
}

function readCashEnd(event: ProjectorEvent) {
	const data = cashSessionEndPayload.parse(JSON.parse(event.payload));
	return {
		endStack: data.payments.reduce(
			(sum, payment) => addSafeIntegers(sum, payment.quantity),
			0
		),
		endState: data.endState ?? "cashed_out",
	};
}

function readTournamentResult(event: ProjectorEvent): TournamentResult {
	const parsed = tournamentSessionEndPayload.safeParse(
		JSON.parse(event.payload)
	);
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

function readTournamentEndState(event: ProjectorEvent): PlaySessionEndState {
	const parsed = tournamentSessionEndPayload.safeParse(
		JSON.parse(event.payload)
	);
	if (parsed.success && parsed.data.endState) {
		return parsed.data.endState;
	}
	return readTournamentResult(event).placement === 1 ? "finished" : "busted";
}

function readEnd(
	endEvent: ProjectorEvent,
	kind: EntryKind
): Pick<PlaySessionProjection, "endState" | "endStack"> {
	if (endEvent.type === "day_end") {
		const data = dayEndPayload.parse(JSON.parse(endEvent.payload));
		return { endStack: data.stackAmount, endState: data.endState };
	}
	if (kind === "cash") {
		return readCashEnd(endEvent);
	}
	return { endStack: null, endState: readTournamentEndState(endEvent) };
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
			breakMinutes: Math.floor(breakMs / MS_PER_MINUTE),
			endedAt: closingEvent?.occurredAt ?? null,
			id,
			startedAt: startEvent?.occurredAt ?? null,
			status,
			...(closingEvent === null
				? { endStack: null, endState: null }
				: readEnd(closingEvent, kind)),
			...readClock(startEvent, kind),
		},
	};
}

function projectCash(events: readonly ProjectorEvent[]): EntryDetailProjection {
	let evDiff = 0;
	for (const event of events) {
		if (event.type === "all_in") {
			const data = allInPayload.parse(JSON.parse(event.payload));
			evDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
		}
	}
	return { evDiff: safeInteger(Math.round(evDiff)), kind: "cash" };
}

function latestStackTotalEntries(
	events: readonly ProjectorEvent[]
): number | null {
	let totalEntries: number | null = null;
	for (const event of events) {
		if (event.type === "update_stack") {
			const data = updateStackPayload.parse(JSON.parse(event.payload));
			if (data.totalEntries !== undefined) {
				({ totalEntries } = data);
			}
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
		beforeDeadline: false,
		kind: "tournament",
		placement: null,
		totalEntries: latestStackTotalEntries(events),
	};
}

function sessionStartPayments(
	event: ProjectorEvent,
	kind: EntryKind
): LinePayment[] {
	const payload = JSON.parse(event.payload);
	const schema =
		kind === "cash" ? cashSessionStartPayload : tournamentSessionStartPayload;
	return schema.parse(payload).payments ?? [];
}

function sessionEndPayments(
	event: ProjectorEvent,
	kind: EntryKind
): LinePayment[] {
	const payload = JSON.parse(event.payload);
	if (kind === "cash") {
		return cashSessionEndPayload.parse(payload).payments;
	}
	const parsed = tournamentSessionEndPayload.safeParse(payload);
	return parsed.success ? parsed.data.payments : [];
}

function eventPayments(
	event: ProjectorEvent,
	kind: EntryKind,
	closingEventIds: ReadonlySet<string>
): LinePayment[] {
	switch (event.type) {
		case "session_start":
			return sessionStartPayments(event, kind);
		case "chips_add_remove": {
			const { amount, assetId, effect } = chipsAddRemovePayload.parse(
				JSON.parse(event.payload)
			);
			return amount > 0
				? [{ assetId, effect, quantity: amount, role: "addon" }]
				: [{ assetId, effect, quantity: -amount, role: "chip_remove" }];
		}
		case "purchase_chips":
			return purchaseChipsPayload.parse(JSON.parse(event.payload)).payments;
		case "reentry":
			return reentryPayload.parse(JSON.parse(event.payload)).payments;
		case "session_end":
			return closingEventIds.has(event.id)
				? sessionEndPayments(event, kind)
				: [];
		default:
			return [];
	}
}

function projectLines(
	ordered: readonly ProjectorEvent[],
	kind: EntryKind,
	closingEventIds: ReadonlySet<string>
): ProjectedLine[] {
	return ordered.flatMap((event) =>
		eventPayments(event, kind, closingEventIds).map((payment, n) => ({
			assetId: payment.assetId,
			effect: payment.effect,
			id: `${event.id}:${n}`,
			occurredAt: event.occurredAt,
			playSessionId: event.playSessionId,
			priceId: payment.priceId ?? null,
			quantity: signedLedgerQuantity(payment.role, payment.quantity),
			role: payment.role,
			sourceEventId: event.id,
		}))
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
		detail:
			context.kind === "cash"
				? projectCash(ordered)
				: projectTournament(ordered, finalFold.endEvent),
		lines: projectLines(
			ordered,
			context.kind,
			new Set(
				folds.flatMap((fold) =>
					fold.endEvent?.type === "session_end" ? [fold.endEvent.id] : []
				)
			)
		),
		playedOn: sessions
			.map((session) => session.localDate)
			// biome-ignore lint/complexity/useMathMinMax: Calendar dates are compared lexicographically, not numerically.
			.reduce((earliest, date) => (date < earliest ? date : earliest)),
		playSessions,
		status: settled ? "settled" : "open",
	};
}

export interface TournamentProgress {
	averageStack: number | null;
	chipTotal: number;
	currentStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
}

export function projectTournamentProgress(
	events: readonly ProjectorEvent[],
	startingStack: number | null
): TournamentProgress {
	let currentStack: number | null = null;
	let remainingPlayers: number | null = null;
	let totalEntries: number | null = null;
	let reportedChips = 0;
	let purchasedChips = 0;
	for (const event of [...events].sort(compareEvents)) {
		if (event.type === "update_stack") {
			const data = updateStackPayload.parse(JSON.parse(event.payload));
			currentStack = data.stackAmount;
			if (data.remainingPlayers !== undefined) {
				({ remainingPlayers } = data);
			}
			if (data.totalEntries !== undefined) {
				({ totalEntries } = data);
			}
			if (data.chipPurchaseCounts !== undefined) {
				reportedChips = data.chipPurchaseCounts.reduce(
					(sum, row) =>
						addSafeIntegers(
							sum,
							safeInteger(BigInt(row.count) * BigInt(row.chipsPerUnit))
						),
					0
				);
				purchasedChips = 0;
			}
		} else if (event.type === "purchase_chips") {
			purchasedChips = addSafeIntegers(
				purchasedChips,
				purchaseChipsPayload.parse(JSON.parse(event.payload)).chips
			);
		} else if (event.type === "day_end") {
			currentStack = dayEndPayload.parse(JSON.parse(event.payload)).stackAmount;
		}
	}
	const chipTotal = addSafeIntegers(reportedChips, purchasedChips);
	return {
		averageStack:
			startingStack === null ||
			totalEntries === null ||
			remainingPlayers === null ||
			remainingPlayers <= 0
				? null
				: safeInteger(
						(BigInt(startingStack) * BigInt(totalEntries) +
							BigInt(chipTotal) +
							BigInt(Math.floor(remainingPlayers / 2))) /
							BigInt(remainingPlayers)
					),
		chipTotal,
		currentStack,
		remainingPlayers,
		totalEntries,
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
					beforeDeadline: detail.beforeDeadline,
					placement: detail.placement,
					totalEntries: detail.totalEntries,
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
			.set({ playedOn: projection.playedOn, status: projection.status })
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
	const rows = lines.map((line) => ({
		...line,
		createdAt: now,
		entryId: scope.entryId,
		updatedAt: now,
		userId: scope.userId,
	}));
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
	statements.push(
		...insertChunks(rows, (chunk) => db.insert(ledgerLine).values(chunk))
	);
	return statements;
}
