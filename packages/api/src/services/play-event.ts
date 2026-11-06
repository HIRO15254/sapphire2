import type { Database } from "@sapphire2/db";
import {
	allInPayload,
	chipsAddRemovePayload,
	memoPayload,
	paymentsSchema,
	playEventPayloadSchema,
	purchaseChipsPayload,
	reentryPayload,
	sessionPausePayload,
	sessionResumePayload,
	tableChangePayload,
	updateStackPayload,
} from "@sapphire2/db/constants/play-event-payloads";
import { playEvent } from "@sapphire2/db/schema/entry";
import { hand } from "@sapphire2/db/schema/hand";
import { tournamentRulePrice } from "@sapphire2/db/schema/rule";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import {
	commitEntryEventChange,
	type EntryEventState,
	findStoredEvent,
	loadEntryEventState,
	resolveAppendTarget,
} from "./entry-live-writes";
import { compareEvents } from "./entry-projector";
import { MAX_ENTRY_PAYMENTS, type ManualPaymentInput } from "./entry-writes";
import {
	assertEventPayments,
	assertLiveEntry,
	entryKeptReferences,
	eventInstant,
	loadEntryRuleFacts,
} from "./live-entry";
import { type PlayEventOutput, toPlayEventOutput } from "./play-event-output";

const LIFECYCLE_EVENT_TYPES = ["session_start", "session_end", "day_end"];
const PARTICIPATION_EVENT_TYPES = ["player_join", "player_leave"];

export const PLAY_EVENT_INPUT_PAYLOADS = {
	table_change: tableChangePayload,
	session_pause: sessionPausePayload,
	session_resume: sessionResumePayload,
	chips_add_remove: chipsAddRemovePayload,
	all_in: allInPayload,
	purchase_chips: z.object({
		priceId: idSchema,
		payments: paymentsSchema(["chip_purchase", "fee"]).max(MAX_ENTRY_PAYMENTS),
	}),
	reentry: z.object({
		payments: reentryPayload.shape.payments.max(MAX_ENTRY_PAYMENTS),
	}),
	update_stack: updateStackPayload.extend({
		chipPurchaseCounts: z
			.array(
				updateStackPayload.shape.chipPurchaseCounts.unwrap().element.extend({
					name: z.string().min(1).max(100),
				})
			)
			.max(100)
			.optional(),
	}),
	memo: z.object({ text: memoPayload.shape.text.max(5000) }),
} as const;

export type PlayEventInputType = keyof typeof PLAY_EVENT_INPUT_PAYLOADS;

export type PlayEventInputPayload = {
	[Type in PlayEventInputType]: {
		eventType: Type;
		payload: z.infer<(typeof PLAY_EVENT_INPUT_PAYLOADS)[Type]>;
	};
}[PlayEventInputType];

function badRequest(message: string): never {
	throw new TRPCError({ code: "BAD_REQUEST", message });
}

function isInputType(type: string): type is PlayEventInputType {
	return Object.hasOwn(PLAY_EVENT_INPUT_PAYLOADS, type);
}

function parseInputPayload(
	type: PlayEventInputType,
	payload: unknown
): PlayEventInputPayload {
	const parsed = PLAY_EVENT_INPUT_PAYLOADS[type].safeParse(payload);
	if (!parsed.success) {
		badRequest(`Invalid ${type} payload: ${parsed.error.issues[0]?.message}`);
	}
	return { eventType: type, payload: parsed.data } as PlayEventInputPayload;
}

function assertSeatFits(
	seat: number | null | undefined,
	tableSize: number | null
) {
	if (
		seat !== null &&
		seat !== undefined &&
		tableSize !== null &&
		seat >= tableSize
	) {
		badRequest(`Seat ${seat} is outside this ${tableSize}-handed table`);
	}
}

async function resolvePurchase(
	db: Database,
	userId: string,
	entryId: string,
	ruleVersionId: string,
	payload: { payments: ManualPaymentInput[]; priceId: string },
	eventId?: string,
	keptPriceId?: string
) {
	const [price] = await db
		.select({
			ruleId: tournamentRulePrice.ruleId,
			kind: tournamentRulePrice.kind,
			label: tournamentRulePrice.label,
			chips: tournamentRulePrice.chips,
		})
		.from(tournamentRulePrice)
		.where(
			and(
				eq(tournamentRulePrice.id, payload.priceId),
				eq(tournamentRulePrice.userId, userId)
			)
		);
	const kept = await entryKeptReferences(db, userId, entryId, eventId);
	if (
		!price ||
		(price.ruleId !== ruleVersionId &&
			!kept.priceCounts.has(payload.priceId) &&
			keptPriceId !== payload.priceId)
	) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This price is not part of the entry's tournament rule",
		});
	}
	if (price.kind !== "addon") {
		badRequest("Chips are purchased with an add-on price");
	}
	const payments = payload.payments.map((payment) => {
		if (payment.priceId !== undefined && payment.priceId !== payload.priceId) {
			badRequest("Every payment of a chip purchase pays its own price");
		}
		return { ...payment, priceId: payload.priceId };
	});
	await assertEventPayments(
		db,
		userId,
		entryId,
		ruleVersionId,
		payments,
		eventId
	);
	return {
		priceId: payload.priceId,
		label: price.label || "Add-on",
		chips: price.chips ?? 0,
		payments,
	};
}

async function resolvePayload(
	db: Database,
	userId: string,
	entryId: string,
	state: EntryEventState,
	playSessionId: string,
	input: PlayEventInputPayload,
	eventId?: string
): Promise<unknown> {
	const facts = await loadEntryRuleFacts(db, userId, entryId, state.kind);
	switch (input.eventType) {
		case "all_in":
			if (input.payload.handId !== undefined) {
				const [linked] = await db
					.select({ id: hand.id })
					.from(hand)
					.where(
						and(
							eq(hand.id, input.payload.handId),
							eq(hand.playSessionId, playSessionId),
							eq(hand.userId, userId)
						)
					);
				if (!linked) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "This hand is not part of the event's play session",
					});
				}
			}
			return input.payload;
		case "chips_add_remove":
			await assertEventPayments(
				db,
				userId,
				entryId,
				facts.ruleVersionId,
				[
					{
						assetId: input.payload.assetId,
						effect: input.payload.effect,
						quantity: Math.abs(input.payload.amount),
						role: input.payload.amount > 0 ? "addon" : "chip_remove",
					},
				],
				eventId
			);
			return input.payload;
		case "reentry":
			await assertEventPayments(
				db,
				userId,
				entryId,
				facts.ruleVersionId,
				input.payload.payments,
				eventId
			);
			return input.payload;
		case "purchase_chips": {
			const previous = state.events.find((event) => event.id === eventId);
			const kept = previous
				? purchaseChipsPayload.safeParse(JSON.parse(previous.payload))
				: undefined;
			return await resolvePurchase(
				db,
				userId,
				entryId,
				facts.ruleVersionId,
				input.payload,
				eventId,
				kept?.success ? kept.data.priceId : undefined
			);
		}
		case "table_change":
			assertSeatFits(input.payload.seatPosition, facts.tableSize);
			return input.payload;
		default:
			return input.payload;
	}
}

export async function listPlayEvents(
	db: Database,
	userId: string,
	input: { entryId: string; playSessionId?: string }
): Promise<PlayEventOutput[]> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	if (
		input.playSessionId !== undefined &&
		!state.playSessions.some((play) => play.id === input.playSessionId)
	) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "This play session does not belong to the entry",
		});
	}
	return state.events
		.filter(
			(event) =>
				input.playSessionId === undefined ||
				event.playSessionId === input.playSessionId
		)
		.map((event) => toPlayEventOutput(state.kind, event));
}

async function readEvent(
	db: Database,
	userId: string,
	entryId: string,
	id: string
): Promise<PlayEventOutput> {
	const state = await loadEntryEventState(db, userId, entryId);
	return toPlayEventOutput(state.kind, findStoredEvent(state, id));
}

export async function createPlayEvent(
	db: Database,
	userId: string,
	input: PlayEventInputPayload & {
		entryId: string;
		occurredAt?: number;
		playSessionId?: string;
	},
	now: Date
): Promise<PlayEventOutput> {
	const state = await loadEntryEventState(db, userId, input.entryId);
	assertLiveEntry(state);
	if (!playEventPayloadSchema(state.kind, input.eventType)) {
		badRequest(`A ${state.kind} entry has no ${input.eventType} event`);
	}
	const occurredAt = eventInstant(input.occurredAt, now);
	const payload = await resolvePayload(
		db,
		userId,
		input.entryId,
		state,
		resolveAppendTarget(state, input.playSessionId),
		input
	);
	const { eventIds } = await commitEntryEventChange(db, {
		change: {
			op: "append",
			events: [
				{
					type: input.eventType,
					occurredAt,
					playSessionId: input.playSessionId,
					payload,
				},
			],
		},
		entryId: input.entryId,
		now,
		state,
		userId,
	});
	return await readEvent(db, userId, input.entryId, eventIds[0] ?? "");
}

async function loadEventState(
	db: Database,
	userId: string,
	id: string
): Promise<{ entryId: string; state: EntryEventState }> {
	const [owned] = await db
		.select({ entryId: playEvent.entryId })
		.from(playEvent)
		.where(and(eq(playEvent.id, id), eq(playEvent.userId, userId)));
	if (!owned) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this event",
		});
	}
	return {
		entryId: owned.entryId,
		state: await loadEntryEventState(db, userId, owned.entryId),
	};
}

function assertEditableType(type: string, action: "deleted" | "edited") {
	if (LIFECYCLE_EVENT_TYPES.includes(type)) {
		badRequest(
			`A ${type} event is ${action} only through the live start, complete and undo operations`
		);
	}
}

export async function updatePlayEvent(
	db: Database,
	userId: string,
	input: { id: string; occurredAt?: number; payload?: unknown },
	now: Date
): Promise<PlayEventOutput> {
	const { entryId, state } = await loadEventState(db, userId, input.id);
	const target = findStoredEvent(state, input.id);
	assertEditableType(target.type, "edited");
	if (!isInputType(target.type)) {
		badRequest(`A ${target.type} event is changed through tablePlayer`);
	}
	const occurredAt =
		input.occurredAt === undefined
			? undefined
			: eventInstant(input.occurredAt, now);
	const payload =
		input.payload === undefined
			? undefined
			: await resolvePayload(
					db,
					userId,
					entryId,
					state,
					target.playSessionId,
					parseInputPayload(target.type, input.payload),
					target.id
				);
	await commitEntryEventChange(db, {
		change: { op: "update", id: input.id, occurredAt, payload },
		entryId,
		now,
		state,
		userId,
	});
	return await readEvent(db, userId, entryId, input.id);
}

function assertSafeParticipationUndo(
	state: EntryEventState,
	target: EntryEventState["events"][number]
) {
	const play = state.playSessions.find(({ id }) => id === target.playSessionId);
	const last = state.events.at(-1);
	if (play?.status === "ended" || compareEvents(target, last ?? target) < 0) {
		throw new TRPCError({
			code: "CONFLICT",
			message:
				"Only the latest table change of a play session in progress can be undone",
		});
	}
}

export async function deletePlayEvent(
	db: Database,
	userId: string,
	id: string,
	now: Date
): Promise<void> {
	const { entryId, state } = await loadEventState(db, userId, id);
	const target = findStoredEvent(state, id);
	assertEditableType(target.type, "deleted");
	if (PARTICIPATION_EVENT_TYPES.includes(target.type)) {
		assertSafeParticipationUndo(state, target);
	}
	await commitEntryEventChange(db, {
		change: { op: "delete", id },
		entryId,
		now,
		state,
		userId,
	});
}
