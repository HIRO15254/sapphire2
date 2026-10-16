import {
	ALL_EVENT_TYPES,
	getSessionCurrentState,
	isEventAllowedInState,
	isValidEventTypeForSessionType,
	LIFECYCLE_EVENT_TYPES,
	MANUAL_CREATE_BLOCKED_EVENT_TYPES,
	purchaseChipsPayload,
	type SessionEventType,
	validateEventPayload,
} from "@sapphire2/db/constants/session-event-types";
import { entry, playEvent, playSession } from "@sapphire2/db/schema/entry";
import { player } from "@sapphire2/db/schema/player";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	findOwnedEntryId,
	listEntryPlayEvents,
} from "../services/entry-live-reads";
import {
	applyEntryEventChange,
	type EntryEventChange,
} from "../services/entry-live-writes";
import {
	assertAppendOccurredAtOrdering,
	assertOccurredAtOrdering,
	floorToMinute,
	resolveOccurredAt,
} from "../utils/session-event-time";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

function resolveSessionId(input: {
	sessionId?: string;
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}): string {
	const sessionId =
		input.sessionId ??
		input.liveCashGameSessionId ??
		input.liveTournamentSessionId;
	if (!sessionId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
		});
	}
	return sessionId;
}

const SESSION_FORBIDDEN_MESSAGE = "You do not own this session";

async function resolveSessionOwnership(
	db: DbInstance,
	sessionId: string,
	userId: string
) {
	const ownedId = await findOwnedEntryId(db, userId, sessionId);
	if (!ownedId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const [owned] = await db
		.select({ kind: entry.kind })
		.from(entry)
		.where(and(eq(entry.id, ownedId), eq(entry.userId, userId)));
	if (!owned) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SESSION_FORBIDDEN_MESSAGE,
		});
	}
	return {
		sessionType:
			owned.kind === "cash" ? ("cash_game" as const) : ("tournament" as const),
	};
}

async function resolveSessionScopedEventPayload(
	db: DbInstance,
	sessionId: string,
	userId: string,
	eventType: SessionEventType,
	validatedPayload: unknown
): Promise<unknown> {
	if (eventType === "purchase_chips") {
		const payload = purchaseChipsPayload.parse(validatedPayload);
		const [purchase] = await db
			.select({
				id: sessionChipPurchase.id,
				sessionId: sessionChipPurchase.sessionId,
				name: sessionChipPurchase.name,
				cost: sessionChipPurchase.cost,
				chips: sessionChipPurchase.chips,
			})
			.from(sessionChipPurchase)
			.where(
				and(
					eq(sessionChipPurchase.id, payload.sessionChipPurchaseId),
					eq(sessionChipPurchase.sessionId, sessionId)
				)
			);

		if (!purchase || purchase.sessionId !== sessionId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this chip purchase",
			});
		}

		return {
			sessionChipPurchaseId: purchase.id,
			name: purchase.name,
			cost: purchase.cost,
			chips: purchase.chips,
		};
	}

	if (eventType === "player_join" || eventType === "player_leave") {
		const { playerId } = validatedPayload as { playerId?: string };
		if (!playerId) {
			return validatedPayload;
		}

		const [ownedPlayer] = await db
			.select({ id: player.id, userId: player.userId })
			.from(player)
			.where(and(eq(player.id, playerId), eq(player.userId, userId)));
		if (!ownedPlayer || ownedPlayer.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this player",
			});
		}
	}

	return validatedPayload;
}

function parseEventPayload(event: { payload: string }) {
	return JSON.parse(event.payload) as unknown;
}

const sessionIdInput = z.object({
	sessionId: z.string().optional(),
	liveCashGameSessionId: z.string().optional(),
	liveTournamentSessionId: z.string().optional(),
});

async function listSessionEvents(
	db: DbInstance,
	userId: string,
	input: z.output<typeof sessionIdInput>
) {
	const sessionId = resolveSessionId(input);
	const ownedId = await findOwnedEntryId(db, userId, sessionId);
	if (!ownedId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const events = await listEntryPlayEvents(db, userId, ownedId);
	return events.map((event) => ({
		...event,
		payload: parseEventPayload(event),
	}));
}

export const sessionEventRouter = router({
	list: protectedProcedure
		.input(sessionIdInput)
		.query(({ ctx, input }) =>
			listSessionEvents(ctx.db, ctx.session.user.id, input)
		),

	create: protectedProcedure
		.input(
			sessionIdInput.extend({
				eventType: z.enum(ALL_EVENT_TYPES),
				occurredAt: z.number().optional(),
				payload: z.unknown(),
				playSessionId: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			const userId = ctx.session.user.id;
			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				sessionId,
				userId
			);

			const { eventType } = input;

			if (MANUAL_CREATE_BLOCKED_EVENT_TYPES.includes(eventType)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This event type is auto-created and cannot be manually added",
				});
			}

			if (!isValidEventTypeForSessionType(eventType, sessionType)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Event type "${eventType}" is not valid for session type "${sessionType}"`,
				});
			}

			const sessionEvents = await listEntryPlayEvents(
				ctx.db,
				userId,
				sessionId
			);
			const plays = await ctx.db
				.select({ id: playSession.id, status: playSession.status })
				.from(playSession)
				.where(
					and(
						eq(playSession.entryId, sessionId),
						eq(playSession.userId, userId)
					)
				)
				.orderBy(playSession.seq);
			const target = input.playSessionId
				? plays.find((play) => play.id === input.playSessionId)
				: (plays.find((play) => play.status !== "ended") ?? plays.at(-1));
			if (!target) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: SESSION_FORBIDDEN_MESSAGE,
				});
			}
			const targetIds = await ctx.db
				.select({ id: playEvent.id })
				.from(playEvent)
				.where(
					and(
						eq(playEvent.entryId, sessionId),
						eq(playEvent.userId, userId),
						eq(playEvent.playSessionId, target.id)
					)
				);
			const ids = new Set(targetIds.map(({ id }) => id));
			const currentState = getSessionCurrentState(
				sessionEvents.filter((event) => ids.has(event.id))
			);
			if (!isEventAllowedInState(eventType, currentState)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Event type "${eventType}" is not allowed in the current session state "${currentState}"`,
				});
			}

			const validatedPayload = await resolveSessionScopedEventPayload(
				ctx.db,
				sessionId,
				userId,
				eventType,
				validateEventPayload(eventType, input.payload, sessionType)
			);
			const occurredAtDate = resolveOccurredAt(input.occurredAt, new Date());

			await assertAppendOccurredAtOrdering(ctx.db, sessionId, occurredAtDate);

			const id = crypto.randomUUID();
			await applyEntryEventChange(
				ctx.db,
				userId,
				sessionId,
				{
					op: "append",
					events: [
						{
							id,
							type: eventType,
							playSessionId: target.id,
							occurredAt: occurredAtDate,
							payload: validatedPayload,
						},
					],
				},
				new Date()
			);
			const created = (
				await listEntryPlayEvents(ctx.db, userId, sessionId)
			).find((event) => event.id === id);
			if (!created) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
			}
			return { ...created, payload: parseEventPayload(created) };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				occurredAt: z.number().optional(),
				payload: z.unknown().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [event] = await ctx.db
				.select()
				.from(playEvent)
				.where(and(eq(playEvent.id, input.id), eq(playEvent.userId, userId)));
			if (!event) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this event",
				});
			}

			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				event.entryId,
				userId
			);

			const eventType = event.type as SessionEventType;
			const updates: Extract<EntryEventChange, { op: "update" }> = {
				op: "update",
				id: input.id,
			};
			if (input.occurredAt !== undefined) {
				const flooredOccurredAt = floorToMinute(
					new Date(input.occurredAt * 1000)
				);
				await assertOccurredAtOrdering(
					ctx.db,
					event.entryId,
					event.sortOrder,
					flooredOccurredAt
				);
				updates.occurredAt = flooredOccurredAt;
			}
			let validatedPayload: unknown;
			if (input.payload !== undefined) {
				validatedPayload = await resolveSessionScopedEventPayload(
					ctx.db,
					event.entryId,
					userId,
					eventType,
					validateEventPayload(eventType, input.payload, sessionType)
				);
				updates.payload = validatedPayload;
			}

			await applyEntryEventChange(
				ctx.db,
				userId,
				event.entryId,
				updates,
				new Date()
			);
			const updated = (
				await listEntryPlayEvents(ctx.db, userId, event.entryId)
			).find((row) => row.id === input.id);
			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
			}
			return { ...updated, payload: parseEventPayload(updated) };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [event] = await ctx.db
				.select()
				.from(playEvent)
				.where(and(eq(playEvent.id, input.id), eq(playEvent.userId, userId)));
			if (!event) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this event",
				});
			}

			await resolveSessionOwnership(ctx.db, event.entryId, userId);

			if ((LIFECYCLE_EVENT_TYPES as readonly string[]).includes(event.type)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Lifecycle events cannot be deleted",
				});
			}

			await applyEntryEventChange(
				ctx.db,
				userId,
				event.entryId,
				{ op: "delete", id: input.id },
				new Date()
			);

			return { success: true };
		}),
});
