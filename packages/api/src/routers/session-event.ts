import {
	ALL_EVENT_TYPES,
	getSessionCurrentState,
	isEventAllowedInState,
	isValidEventTypeForSessionType,
	LIFECYCLE_EVENT_TYPES,
	MANUAL_CREATE_BLOCKED_EVENT_TYPES,
	type SessionEventType,
	validateEventPayload,
} from "@sapphire2/db/constants/session-event-types";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	recalculateCashGameSession,
	recalculateTournamentSession,
} from "../services/live-session-pl";
import {
	assertOccurredAtOrdering,
	floorToMinute,
	nextAppendSortOrder,
	resolveOccurredAt,
} from "../utils/session-event-time";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

interface SessionInfo {
	sessionDate: Date;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
	status: string;
}

function resolveSessionId(input: {
	sessionId?: string;
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}): string | undefined {
	return (
		input.sessionId ??
		input.liveCashGameSessionId ??
		input.liveTournamentSessionId
	);
}

async function resolveSessionOwnership(
	db: DbInstance,
	sessionId: string,
	userId: string
): Promise<SessionInfo> {
	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session || session.userId !== userId) {
		throw new TRPCError({
			code: session ? "FORBIDDEN" : "NOT_FOUND",
			message: session ? "You do not own this session" : "Session not found",
		});
	}

	return {
		sessionId: session.id,
		sessionType: session.kind as "cash_game" | "tournament",
		status: session.status,
		sessionDate: session.sessionDate,
	};
}

async function recalculateSession(
	db: DbInstance,
	sessionId: string,
	sessionType: "cash_game" | "tournament",
	userId: string
) {
	if (sessionType === "cash_game") {
		await recalculateCashGameSession(db, sessionId, userId);
	} else {
		await recalculateTournamentSession(db, sessionId, userId);
	}
}

function parseEventPayload(event: { payload: string }) {
	return JSON.parse(event.payload) as unknown;
}

const sessionIdInput = z.object({
	sessionId: z.string().optional(),
	liveCashGameSessionId: z.string().optional(),
	liveTournamentSessionId: z.string().optional(),
});

export const sessionEventRouter = router({
	list: protectedProcedure
		.input(sessionIdInput)
		.query(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(ctx.db, sessionId, userId);

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, sessionId))
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			return events.map((event) => ({
				...event,
				payload: parseEventPayload(event),
			}));
		}),

	create: protectedProcedure
		.input(
			sessionIdInput.extend({
				eventType: z.enum(ALL_EVENT_TYPES),
				occurredAt: z.number().optional(),
				payload: z.unknown(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
				});
			}

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

			const sessionEvents = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, sessionId));
			const currentState = getSessionCurrentState(sessionEvents);
			if (!isEventAllowedInState(eventType, currentState)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Event type "${eventType}" is not allowed in the current session state "${currentState}"`,
				});
			}

			const validatedPayload = validateEventPayload(
				eventType,
				input.payload,
				sessionType
			);
			const occurredAtDate = resolveOccurredAt(input.occurredAt, new Date());

			const sortOrder = await nextAppendSortOrder(ctx.db, sessionId);

			await assertOccurredAtOrdering(
				ctx.db,
				sessionId,
				sortOrder,
				occurredAtDate
			);

			const id = crypto.randomUUID();
			await ctx.db.insert(sessionEvent).values({
				id,
				sessionId,
				eventType,
				occurredAt: occurredAtDate,
				sortOrder,
				payload: JSON.stringify(validatedPayload),
				updatedAt: new Date(),
			});

			await recalculateSession(ctx.db, sessionId, sessionType, userId);

			const [created] = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.id, id));
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
				.from(sessionEvent)
				.where(eq(sessionEvent.id, input.id));
			if (!event) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
			}

			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				event.sessionId,
				userId
			);

			const eventType = event.eventType as SessionEventType;
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (input.occurredAt !== undefined) {
				const flooredOccurredAt = floorToMinute(
					new Date(input.occurredAt * 1000)
				);
				await assertOccurredAtOrdering(
					ctx.db,
					event.sessionId,
					event.sortOrder,
					flooredOccurredAt
				);
				updates.occurredAt = flooredOccurredAt;
			}
			let validatedPayload: unknown;
			if (input.payload !== undefined) {
				validatedPayload = validateEventPayload(
					eventType,
					input.payload,
					sessionType
				);
				updates.payload = JSON.stringify(validatedPayload);
			}

			await ctx.db
				.update(sessionEvent)
				.set(updates)
				.where(eq(sessionEvent.id, input.id));

			if (
				eventType === "session_start" &&
				sessionType === "tournament" &&
				validatedPayload &&
				typeof validatedPayload === "object"
			) {
				const timerRaw = (validatedPayload as Record<string, unknown>)
					.timerStartedAt;
				let timerStartedAt: Date | null | undefined;
				if (typeof timerRaw === "number") {
					timerStartedAt = new Date(timerRaw * 1000);
				} else if (timerRaw === null) {
					timerStartedAt = null;
				}
				if (timerStartedAt !== undefined) {
					await ctx.db
						.update(sessionTournamentDetail)
						.set({ timerStartedAt })
						.where(eq(sessionTournamentDetail.sessionId, event.sessionId));
				}
			}

			await recalculateSession(ctx.db, event.sessionId, sessionType, userId);

			const [updated] = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.id, input.id));
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
				.from(sessionEvent)
				.where(eq(sessionEvent.id, input.id));
			if (!event) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
			}

			if (
				(LIFECYCLE_EVENT_TYPES as readonly string[]).includes(event.eventType)
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Lifecycle events cannot be deleted",
				});
			}

			const { sessionType } = await resolveSessionOwnership(
				ctx.db,
				event.sessionId,
				userId
			);

			await ctx.db.delete(sessionEvent).where(eq(sessionEvent.id, input.id));

			await recalculateSession(ctx.db, event.sessionId, sessionType, userId);

			return { success: true };
		}),
});
