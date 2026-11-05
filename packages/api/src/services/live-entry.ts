import type { Database } from "@sapphire2/db";
import {
	type END_STATES_REQUIRING_STACK,
	type EntryKind,
	endStatesForKind,
	type PlaySessionEndState,
	SETTLING_END_STATES,
} from "@sapphire2/db/constants/entry";
import type { LedgerRole } from "@sapphire2/db/constants/ledger";
import {
	entry,
	entryCash,
	entryTournament,
	playEvent,
	playSession,
} from "@sapphire2/db/schema/entry";
import { hand } from "@sapphire2/db/schema/hand";
import { ledgerLine, userSetting } from "@sapphire2/db/schema/ledger";
import { cashRule, tournamentRule } from "@sapphire2/db/schema/rule";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { runBatch, selectInChunks } from "../lib/batch";
import type { CashRuleInput } from "./cash-rules";
import {
	buildLiveEntryStartStatements,
	commitEntryEventChange,
	type EntryEventState,
	loadEntryEventState,
	mapLiveWriteConflict,
	resolveAppendTarget,
} from "./entry-live-writes";
import {
	projectEntry,
	projectTournamentProgress,
	type TournamentProgress,
} from "./entry-projector";
import {
	type EntryOutput,
	type EntryRow,
	getEntry,
	hydrateEntries,
} from "./entry-reads";
import {
	assertMetadata,
	assertPaymentAssets,
	assertPaymentPrices,
	deleteEntry,
	type ManualPaymentInput,
	planCreateRule,
	updateEntry,
} from "./entry-writes";
import { type PlayEventOutput, toPlayEventOutput } from "./play-event-output";
import type { TournamentRuleInput } from "./tournament-rule";

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";
export const EVENT_CLOCK_SKEW_SECONDS = 60;

const PROGRESS_EVENT_TYPES = ["update_stack", "purchase_chips", "day_end"];
const PROGRESS_EXTRA_PARAMS = 1 + PROGRESS_EVENT_TYPES.length;

const START_ROLES = {
	cash: ["buy_in"],
	tournament: ["buy_in", "fee"],
} as const satisfies Record<EntryKind, readonly LedgerRole[]>;

const COMPLETE_ROLES = {
	cash: ["cash_out"],
	tournament: ["prize", "bounty"],
} as const satisfies Record<EntryKind, readonly LedgerRole[]>;

const COMPLETE_END_STATES = {
	cash: ["cashed_out", "finished"],
	tournament: ["busted", "finished"],
} as const satisfies Record<EntryKind, readonly PlaySessionEndState[]>;

export type LiveEntryOutput = EntryOutput & {
	progress: TournamentProgress | null;
};

export type LiveEntryDetailOutput = LiveEntryOutput & {
	currentButtonSeat: number | null;
	currentPlaySessionId: string | null;
	events: PlayEventOutput[];
};

interface LiveStartShared {
	assetId?: string;
	label?: string;
	localDate?: string;
	memo?: string;
	payments: ManualPaymentInput[];
	roomId?: string;
	startedAt?: number;
}

export type LiveStartInput = LiveStartShared &
	(
		| { kind: "cash"; ringGameId?: string; rule?: CashRuleInput }
		| {
				initialStack?: number;
				kind: "tournament";
				rule?: TournamentRuleInput;
				startLevel?: number;
				timerStartedAt?: number;
				tournamentId?: string;
		  }
	);

export interface LiveCompleteInput {
	beforeDeadline?: boolean;
	endState: PlaySessionEndState;
	id: string;
	occurredAt?: number;
	payments: ManualPaymentInput[];
	placement?: number;
	totalEntries?: number;
}

export interface LiveEndPlayInput {
	endState: (typeof END_STATES_REQUIRING_STACK)[number];
	id: string;
	occurredAt?: number;
	stackAmount: number;
}

export interface LiveStartNextPlayInput {
	id: string;
	label?: string;
	localDate?: string;
	payments?: ManualPaymentInput[];
	startedAt?: number;
	startLevel?: number;
}

const TERMINAL_EVENT_TYPES = ["session_end", "day_end"];

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

function undoConflict(message: string): never {
	throw new TRPCError({ code: "CONFLICT", message });
}

async function assertNoUnfinishedPlay(
	db: Database,
	userId: string
): Promise<void> {
	const [unfinished] = await db
		.select({ id: playSession.id })
		.from(playSession)
		.where(and(eq(playSession.userId, userId), ne(playSession.status, "ended")))
		.limit(1);
	if (unfinished) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Another play session is already in progress",
		});
	}
}

function assertTerminalTime(
	state: EntryEventState,
	playSessionId: string,
	occurredAt: Date
): void {
	const latest = state.events
		.filter((event) => event.playSessionId === playSessionId)
		.reduce((max, event) => Math.max(max, event.occurredAt.getTime()), 0);
	if (occurredAt.getTime() < latest) {
		badRequest(
			"The end time is earlier than an event already recorded in this play session"
		);
	}
}

export function eventInstant(seconds: number | undefined, now: Date): Date {
	const current = Math.floor(now.getTime() / 1000);
	const value = seconds ?? current;
	if (value > current + EVENT_CLOCK_SKEW_SECONDS) {
		badRequest(
			`An event time cannot be more than ${EVENT_CLOCK_SKEW_SECONDS} seconds in the future`
		);
	}
	return new Date(value * 1000);
}

export function zonedLocalDate(at: Date, timeZone: string | null): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timeZone ?? DEFAULT_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(at);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((candidate) => candidate.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}`;
}

async function userLocalDate(
	db: Database,
	userId: string,
	at: Date
): Promise<string> {
	const [setting] = await db
		.select({ timeZone: userSetting.timeZone })
		.from(userSetting)
		.where(eq(userSetting.userId, userId));
	return zonedLocalDate(at, setting?.timeZone ?? null);
}

export function assertLiveEntry(state: Pick<EntryEventState, "source">): void {
	if (state.source !== "live") {
		badRequest("This entry was not recorded live");
	}
}

function assertRoles(
	payments: readonly ManualPaymentInput[],
	allowed: readonly LedgerRole[],
	context: string
): void {
	for (const payment of payments) {
		if (!allowed.includes(payment.role)) {
			badRequest(`${context} cannot record a ${payment.role} payment`);
		}
	}
}

export interface EntryRuleFacts {
	ruleVersionId: string;
	tableSize: number | null;
}

export async function loadEntryRuleFacts(
	db: Database,
	userId: string,
	entryId: string,
	kind: EntryKind
): Promise<EntryRuleFacts> {
	const [row] =
		kind === "cash"
			? await db
					.select({ ruleVersionId: cashRule.id, tableSize: cashRule.tableSize })
					.from(entryCash)
					.innerJoin(
						cashRule,
						and(
							eq(cashRule.id, entryCash.cashRuleId),
							eq(cashRule.userId, entryCash.userId)
						)
					)
					.where(
						and(eq(entryCash.entryId, entryId), eq(entryCash.userId, userId))
					)
			: await db
					.select({
						ruleVersionId: tournamentRule.id,
						tableSize: tournamentRule.tableSize,
					})
					.from(entryTournament)
					.innerJoin(
						tournamentRule,
						and(
							eq(tournamentRule.id, entryTournament.tournamentRuleId),
							eq(tournamentRule.userId, entryTournament.userId)
						)
					)
					.where(
						and(
							eq(entryTournament.entryId, entryId),
							eq(entryTournament.userId, userId)
						)
					);
	if (!row) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Entry is missing its kind detail",
		});
	}
	return row;
}

export async function entryKeptReferences(
	db: Database,
	userId: string,
	entryId: string,
	eventId?: string
): Promise<{ assetIds: Set<string>; priceCounts: Map<string, number> }> {
	const rows =
		eventId === undefined
			? []
			: await db
					.select({ assetId: ledgerLine.assetId, priceId: ledgerLine.priceId })
					.from(ledgerLine)
					.where(
						and(
							eq(ledgerLine.entryId, entryId),
							eq(ledgerLine.userId, userId),
							eq(ledgerLine.sourceEventId, eventId)
						)
					);
	const priceCounts = new Map<string, number>();
	for (const row of rows) {
		if (row.priceId) {
			priceCounts.set(row.priceId, (priceCounts.get(row.priceId) ?? 0) + 1);
		}
	}
	return { assetIds: new Set(rows.map((row) => row.assetId)), priceCounts };
}

export async function assertEventPayments(
	db: Database,
	userId: string,
	entryId: string,
	ruleVersionId: string,
	payments: readonly ManualPaymentInput[],
	eventId?: string
): Promise<void> {
	if (payments.length === 0) {
		return;
	}
	const kept = await entryKeptReferences(db, userId, entryId, eventId);
	await assertPaymentAssets(db, userId, [...payments], kept.assetIds);
	await assertPaymentPrices(
		db,
		userId,
		ruleVersionId,
		[...payments],
		new Set(kept.priceCounts.keys()),
		kept.priceCounts
	);
}

export async function startLiveEntry(
	db: Database,
	userId: string,
	input: LiveStartInput,
	now: Date
): Promise<string> {
	const startedAt = eventInstant(input.startedAt, now);
	assertRoles(input.payments, START_ROLES[input.kind], "A live start");
	await assertMetadata(db, userId, input, null);
	await assertPaymentAssets(db, userId, input.payments, new Set());
	const rule = await planCreateRule(db, userId, input);
	await assertPaymentPrices(
		db,
		userId,
		rule.ruleVersionId,
		input.payments,
		new Set()
	);
	await assertNoUnfinishedPlay(db, userId);
	const localDate =
		input.localDate ?? (await userLocalDate(db, userId, startedAt));
	const id = crypto.randomUUID();
	const clock =
		input.kind === "tournament"
			? {
					...(input.timerStartedAt === undefined
						? {}
						: { timerStartedAt: input.timerStartedAt }),
					...(input.startLevel === undefined
						? {}
						: { startLevel: input.startLevel }),
				}
			: {};
	await runBatch(db, [
		...rule.statements,
		...buildLiveEntryStartStatements(db, {
			id,
			userId,
			detail:
				input.kind === "cash"
					? {
							kind: "cash",
							ringGameId: input.ringGameId ?? null,
							cashRuleId: rule.ruleVersionId,
						}
					: {
							kind: "tournament",
							tournamentId: input.tournamentId ?? null,
							tournamentRuleId: rule.ruleVersionId,
						},
			assetId: input.assetId ?? null,
			roomId: input.roomId ?? null,
			title: null,
			memo: input.memo ?? null,
			label: input.label ?? null,
			localDate,
			now,
			startEvent: {
				occurredAt: startedAt,
				payload: { payments: input.payments, ...clock },
			},
			followUps:
				input.kind === "tournament" && input.initialStack !== undefined
					? [
							{
								type: "update_stack",
								occurredAt: startedAt,
								payload: { stackAmount: input.initialStack },
							},
						]
					: [],
		}),
	]).catch((error: unknown) => {
		throw mapLiveWriteConflict(error);
	});
	return id;
}

function completePayload(kind: EntryKind, input: LiveCompleteInput) {
	if (kind === "cash") {
		if (
			input.beforeDeadline !== undefined ||
			input.placement !== undefined ||
			input.totalEntries !== undefined
		) {
			badRequest("A cash entry has no tournament result");
		}
		return { endState: input.endState, payments: input.payments };
	}
	if (input.beforeDeadline) {
		return {
			endState: input.endState,
			beforeDeadline: true,
			payments: input.payments,
		};
	}
	if (input.placement === undefined || input.totalEntries === undefined) {
		badRequest(
			"A tournament finish needs placement and totalEntries unless it ended before the registration deadline"
		);
	}
	if (input.placement > input.totalEntries) {
		badRequest("Placement must be less than or equal to total entries");
	}
	return {
		endState: input.endState,
		beforeDeadline: false,
		placement: input.placement,
		totalEntries: input.totalEntries,
		payments: input.payments,
	};
}

export async function completeLiveEntry(
	db: Database,
	userId: string,
	input: LiveCompleteInput,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, input.id);
	assertLiveEntry(state);
	const occurredAt = eventInstant(input.occurredAt, now);
	const allowedEndStates: readonly PlaySessionEndState[] =
		COMPLETE_END_STATES[state.kind];
	if (
		!(
			allowedEndStates.includes(input.endState) &&
			(SETTLING_END_STATES as readonly PlaySessionEndState[]).includes(
				input.endState
			)
		)
	) {
		badRequest(
			`A ${state.kind} entry cannot be completed as ${input.endState}`
		);
	}
	assertRoles(input.payments, COMPLETE_ROLES[state.kind], "Completing");
	const playSessionId = resolveAppendTarget(state, undefined);
	assertTerminalTime(state, playSessionId, occurredAt);
	const payload = completePayload(state.kind, input);
	const facts = await loadEntryRuleFacts(db, userId, input.id, state.kind);
	await assertEventPayments(
		db,
		userId,
		input.id,
		facts.ruleVersionId,
		input.payments
	);
	await commitEntryEventChange(db, {
		change: {
			op: "append",
			events: [{ type: "session_end", occurredAt, playSessionId, payload }],
		},
		entryId: input.id,
		now,
		state,
		userId,
	});
}

export async function endLivePlay(
	db: Database,
	userId: string,
	input: LiveEndPlayInput,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, input.id);
	assertLiveEntry(state);
	const occurredAt = eventInstant(input.occurredAt, now);
	if (!endStatesForKind(state.kind).includes(input.endState)) {
		badRequest(`A ${state.kind} day cannot end as ${input.endState}`);
	}
	const playSessionId = resolveAppendTarget(state, undefined);
	assertTerminalTime(state, playSessionId, occurredAt);
	await commitEntryEventChange(db, {
		change: {
			op: "append",
			events: [
				{
					type: "day_end",
					occurredAt,
					playSessionId,
					payload: { endState: input.endState, stackAmount: input.stackAmount },
				},
			],
		},
		entryId: input.id,
		now,
		state,
		userId,
	});
}

function assertContinuable(
	kind: EntryKind,
	endState: PlaySessionEndState | null,
	input: LiveStartNextPlayInput
): void {
	if (endState === null) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "The entry's last play session has not ended",
		});
	}
	if (endState === "finished" || endState === "cashed_out") {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message:
				"A finished entry cannot continue; undo its end to correct a mistaken finish",
		});
	}
	if ((input.payments ?? []).length > 0 && endState !== "busted") {
		badRequest("Only a re-entry after a bust records payments");
	}
	if (kind === "cash" && input.startLevel !== undefined) {
		badRequest("A cash play session has no start level");
	}
}

export async function startNextLivePlay(
	db: Database,
	userId: string,
	input: LiveStartNextPlayInput,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, input.id);
	assertLiveEntry(state);
	const startedAt = eventInstant(input.startedAt, now);
	const previous = state.playSessions.at(-1);
	const projected = projectEntry(state.events, state).playSessions.at(-1);
	if (!(previous && projected)) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Entry is missing its play sessions",
		});
	}
	assertContinuable(state.kind, projected.endState, input);
	if (projected.endedAt && startedAt < projected.endedAt) {
		badRequest(
			"The next play session cannot start before the previous one ended"
		);
	}
	const payments = input.payments ?? [];
	const facts = await loadEntryRuleFacts(db, userId, input.id, state.kind);
	await assertEventPayments(
		db,
		userId,
		input.id,
		facts.ruleVersionId,
		payments
	);
	await assertNoUnfinishedPlay(db, userId);
	const localDate =
		input.localDate ?? (await userLocalDate(db, userId, startedAt));
	const next = {
		id: crypto.randomUUID(),
		seq: previous.seq + 1,
		localDate,
		status: "active" as const,
	};
	await commitEntryEventChange(db, {
		before: [
			db.insert(playSession).values({
				...next,
				userId,
				entryId: input.id,
				kind: state.kind,
				label: input.label ?? null,
				createdAt: now,
				updatedAt: now,
			}),
		],
		change: {
			op: "append",
			events: [
				{
					type: "session_start",
					occurredAt: startedAt,
					playSessionId: next.id,
					payload: {
						payments,
						...(input.startLevel === undefined
							? {}
							: { startLevel: input.startLevel }),
					},
				},
			],
		},
		entryId: input.id,
		now,
		state: { ...state, playSessions: [...state.playSessions, next] },
		userId,
	});
}

export async function undoLiveEndPlay(
	db: Database,
	userId: string,
	id: string,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, id);
	assertLiveEntry(state);
	const last = state.playSessions.at(-1);
	const terminal = state.events
		.filter((event) => event.playSessionId === last?.id)
		.at(-1);
	if (
		!(
			last?.status === "ended" &&
			terminal &&
			TERMINAL_EVENT_TYPES.includes(terminal.type)
		)
	) {
		undoConflict("The entry's last play session has no end to undo");
	}
	await assertNoUnfinishedPlay(db, userId);
	await commitEntryEventChange(db, {
		change: { op: "delete", id: terminal.id },
		entryId: id,
		now,
		state,
		userId,
	});
}

export async function undoLiveStartNextPlay(
	db: Database,
	userId: string,
	id: string,
	now: Date
): Promise<void> {
	const state = await loadEntryEventState(db, userId, id);
	assertLiveEntry(state);
	const last = state.playSessions.at(-1);
	if (!last || last.seq <= 1) {
		undoConflict("Only a later play session of the entry can be discarded");
	}
	const events = state.events.filter(
		(event) => event.playSessionId === last.id
	);
	const [start] = events;
	if (!(events.length === 1 && start?.type === "session_start")) {
		undoConflict(
			"The last play session has events beyond its start and cannot be discarded"
		);
	}
	const [counted] = await db
		.select({ id: hand.id })
		.from(hand)
		.where(and(eq(hand.playSessionId, last.id), eq(hand.userId, userId)))
		.limit(1);
	if (counted) {
		undoConflict("The last play session has hands and cannot be discarded");
	}
	const owned = and(
		eq(playSession.id, last.id),
		eq(playSession.entryId, id),
		eq(playSession.userId, userId)
	);
	await commitEntryEventChange(db, {
		before: [
			db
				.update(playSession)
				.set({
					seq: sql`CASE WHEN EXISTS (SELECT 1 FROM ${hand} WHERE ${hand.playSessionId} = ${last.id}) OR EXISTS (SELECT 1 FROM ${playEvent} WHERE ${playEvent.playSessionId} = ${last.id} AND ${playEvent.id} <> ${start.id}) THEN NULL ELSE ${playSession.seq} END`,
				})
				.where(owned),
		],
		change: { op: "delete", id: start.id },
		after: [db.delete(playSession).where(owned)],
		entryId: id,
		now,
		state: {
			...state,
			playSessions: state.playSessions.filter((play) => play.id !== last.id),
		},
		userId,
	});
}

export async function updateLiveEntry(
	db: Database,
	userId: string,
	input: {
		assetId?: string | null;
		id: string;
		memo?: string | null;
		roomId?: string | null;
	},
	now: Date
): Promise<void> {
	assertLiveEntry(await loadEntryEventState(db, userId, input.id));
	await updateEntry(db, userId, input, now);
}

export async function discardLiveEntry(
	db: Database,
	userId: string,
	id: string
): Promise<void> {
	const [row] = await db
		.select({ source: entry.source, status: entry.status })
		.from(entry)
		.where(and(eq(entry.id, id), eq(entry.userId, userId)));
	if (!row) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Entry unavailable" });
	}
	assertLiveEntry(row);
	if (row.status === "settled") {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "A completed entry cannot be discarded",
		});
	}
	await deleteEntry(db, userId, id);
}

export async function attachProgress(
	db: Database,
	userId: string,
	outputs: EntryOutput[]
): Promise<LiveEntryOutput[]> {
	const tournamentIds = outputs.flatMap((output) =>
		output.kind === "tournament" ? [output.id] : []
	);
	const events = await selectInChunks(
		tournamentIds,
		(chunk) =>
			db
				.select({
					id: playEvent.id,
					entryId: playEvent.entryId,
					playSessionId: playEvent.playSessionId,
					type: playEvent.type,
					occurredAt: playEvent.occurredAt,
					sortOrder: playEvent.sortOrder,
					payload: playEvent.payload,
				})
				.from(playEvent)
				.where(
					and(
						eq(playEvent.userId, userId),
						inArray(playEvent.entryId, chunk),
						inArray(playEvent.type, PROGRESS_EVENT_TYPES)
					)
				),
		PROGRESS_EXTRA_PARAMS
	);
	return outputs.map((output) => ({
		...output,
		progress:
			output.kind === "tournament"
				? projectTournamentProgress(
						events.filter((event) => event.entryId === output.id),
						output.ruleVersion.startingStack
					)
				: null,
	}));
}

export async function hydrateLiveEntries(
	db: Database,
	userId: string,
	rows: EntryRow[]
): Promise<LiveEntryOutput[]> {
	return await attachProgress(
		db,
		userId,
		await hydrateEntries(db, userId, rows)
	);
}

export async function getLiveEntry(
	db: Database,
	userId: string,
	id: string
): Promise<LiveEntryOutput> {
	const output = await getEntry(db, userId, id);
	assertLiveEntry(output);
	const [live] = await attachProgress(db, userId, [output]);
	if (!live) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Entry unavailable" });
	}
	return live;
}

export async function getLiveEntryDetail(
	db: Database,
	userId: string,
	id: string
): Promise<LiveEntryDetailOutput> {
	const output = await getLiveEntry(db, userId, id);
	const state = await loadEntryEventState(db, userId, id);
	const current =
		output.playSessions.find((play) => play.status !== "ended") ?? null;
	const [latestHand] = current
		? await db
				.select({ buttonSeat: hand.buttonSeat })
				.from(hand)
				.where(and(eq(hand.playSessionId, current.id), eq(hand.userId, userId)))
				.orderBy(desc(hand.handNo))
				.limit(1)
		: [];
	return {
		...output,
		events: state.events.map((event) => toPlayEventOutput(state.kind, event)),
		currentPlaySessionId: current?.id ?? null,
		currentButtonSeat: latestHand?.buttonSeat ?? null,
	};
}
