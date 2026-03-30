import {
	ALL_EVENT_TYPES,
	isValidEventTypeForSessionType,
	playerJoinPayload,
	type SessionEventType,
	validateEventPayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	recalculateCashGamePL,
	recalculateTournamentPL,
} from "../services/live-session-pl";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

interface SessionInfo {
	sessionType: "cash_game" | "tournament";
	status: string;
}

function validateExactlyOneSessionId(
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined
) {
	if (
		(liveCashGameSessionId && liveTournamentSessionId) ||
		!(liveCashGameSessionId || liveTournamentSessionId)
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"Exactly one of liveCashGameSessionId or liveTournamentSessionId must be specified",
		});
	}
}

async function resolveSessionOwnership(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	userId: string
): Promise<SessionInfo> {
	if (liveCashGameSessionId) {
		const [session] = await db
			.select()
			.from(liveCashGameSession)
			.where(eq(liveCashGameSession.id, liveCashGameSessionId));
		if (!session || session.userId !== userId) {
			throw new TRPCError({
				code: session ? "FORBIDDEN" : "NOT_FOUND",
				message: session ? "You do not own this session" : "Session not found",
			});
		}
		return { sessionType: "cash_game", status: session.status };
	}
	const [session] = await db
		.select()
		.from(liveTournamentSession)
		.where(eq(liveTournamentSession.id, liveTournamentSessionId as string));
	if (!session || session.userId !== userId) {
		throw new TRPCError({
			code: session ? "FORBIDDEN" : "NOT_FOUND",
			message: session ? "You do not own this session" : "Session not found",
		});
	}
	return { sessionType: "tournament", status: session.status };
}

function buildSessionCondition(
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined
) {
	return liveCashGameSessionId
		? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionEvent.liveTournamentSessionId,
				liveTournamentSessionId as string
			);
}

async function computeNextSortOrder(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	occurredAtDate: Date
): Promise<number> {
	const occurredAtUnix = Math.floor(occurredAtDate.getTime() / 1000);
	const sessionCond = liveCashGameSessionId
		? eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionEvent.liveTournamentSessionId,
				liveTournamentSessionId as string
			);

	const [maxResult] = await db
		.select({ maxSortOrder: max(sessionEvent.sortOrder) })
		.from(sessionEvent)
		.where(
			and(
				sessionCond,
				sql`(unixepoch(${sessionEvent.occurredAt})) = ${occurredAtUnix}`
			)
		);

	return maxResult?.maxSortOrder != null ? maxResult.maxSortOrder + 1 : 0;
}

function buildTablePlayerCondition(
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	playerId: string
) {
	const sessionCond = liveCashGameSessionId
		? eq(sessionTablePlayer.liveCashGameSessionId, liveCashGameSessionId)
		: eq(
				sessionTablePlayer.liveTournamentSessionId,
				liveTournamentSessionId as string
			);
	return and(sessionCond, eq(sessionTablePlayer.playerId, playerId));
}

async function handlePlayerJoinSideEffect(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	validatedPayload: unknown
) {
	const parsed = playerJoinPayload.parse(validatedPayload);
	const now = new Date();
	const cond = buildTablePlayerCondition(
		liveCashGameSessionId,
		liveTournamentSessionId,
		parsed.playerId
	);

	const [existing] = await db.select().from(sessionTablePlayer).where(cond);

	if (existing) {
		await db
			.update(sessionTablePlayer)
			.set({ isActive: 1, joinedAt: now, updatedAt: now })
			.where(eq(sessionTablePlayer.id, existing.id));
	} else {
		await db.insert(sessionTablePlayer).values({
			id: crypto.randomUUID(),
			liveCashGameSessionId: liveCashGameSessionId ?? null,
			liveTournamentSessionId: liveTournamentSessionId ?? null,
			playerId: parsed.playerId,
			isActive: 1,
			joinedAt: now,
			updatedAt: now,
		});
	}
}

async function handlePlayerLeaveSideEffect(
	db: DbInstance,
	liveCashGameSessionId: string | undefined,
	liveTournamentSessionId: string | undefined,
	validatedPayload: unknown
) {
	const parsed = playerJoinPayload.parse(validatedPayload);
	const now = new Date();
	const cond = buildTablePlayerCondition(
		liveCashGameSessionId,
		liveTournamentSessionId,
		parsed.playerId
	);
	await db
		.update(sessionTablePlayer)
		.set({ isActive: 0, leftAt: now, updatedAt: now })
		.where(cond);
}

async function recalculateIfCompleted(
	db: DbInstance,
	sessionStatus: string,
	liveCashGameSessionId: string | null | undefined,
	liveTournamentSessionId: string | null | undefined,
	userId: string
) {
	if (sessionStatus !== "completed") {
		return;
	}
	if (liveCashGameSessionId) {
		await recalculateCashGamePL(db, liveCashGameSessionId, userId);
	} else if (liveTournamentSessionId) {
		await recalculateTournamentPL(db, liveTournamentSessionId, userId);
	}
}

function parseEventPayload(event: { payload: string }) {
	return JSON.parse(event.payload) as unknown;
}

export const sessionEventRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId } = input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(
					buildSessionCondition(liveCashGameSessionId, liveTournamentSessionId)
				)
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			return events.map((event) => ({
				...event,
				payload: parseEventPayload(event),
			}));
		}),

	create: protectedProcedure
		.input(
			z.object({
				liveCashGameSessionId: z.string().optional(),
				liveTournamentSessionId: z.string().optional(),
				eventType: z.enum(ALL_EVENT_TYPES),
				occurredAt: z.number().optional(),
				payload: z.unknown(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const { liveCashGameSessionId, liveTournamentSessionId, eventType } =
				input;
			validateExactlyOneSessionId(
				liveCashGameSessionId,
				liveTournamentSessionId
			);

			const userId = ctx.session.user.id;
			const { sessionType, status } = await resolveSessionOwnership(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			if (!isValidEventTypeForSessionType(eventType, sessionType)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Event type "${eventType}" is not valid for session type "${sessionType}"`,
				});
			}

			const validatedPayload = validateEventPayload(eventType, input.payload);
			const occurredAtDate = input.occurredAt
				? new Date(input.occurredAt * 1000)
				: new Date();

			const sortOrder = await computeNextSortOrder(
				ctx.db,
				liveCashGameSessionId,
				liveTournamentSessionId,
				occurredAtDate
			);

			const id = crypto.randomUUID();
			await ctx.db.insert(sessionEvent).values({
				id,
				liveCashGameSessionId: liveCashGameSessionId ?? null,
				liveTournamentSessionId: liveTournamentSessionId ?? null,
				eventType,
				occurredAt: occurredAtDate,
				sortOrder,
				payload: JSON.stringify(validatedPayload),
				updatedAt: new Date(),
			});

			if (eventType === "player_join") {
				await handlePlayerJoinSideEffect(
					ctx.db,
					liveCashGameSessionId,
					liveTournamentSessionId,
					validatedPayload
				);
			} else if (eventType === "player_leave") {
				await handlePlayerLeaveSideEffect(
					ctx.db,
					liveCashGameSessionId,
					liveTournamentSessionId,
					validatedPayload
				);
			}

			await recalculateIfCompleted(
				ctx.db,
				status,
				liveCashGameSessionId,
				liveTournamentSessionId,
				userId
			);

			const [created] = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.id, id));
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

			const { status } = await resolveSessionOwnership(
				ctx.db,
				event.liveCashGameSessionId ?? undefined,
				event.liveTournamentSessionId ?? undefined,
				userId
			);

			const eventType = event.eventType as SessionEventType;
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (input.occurredAt !== undefined) {
				updates.occurredAt = new Date(input.occurredAt * 1000);
			}
			if (input.payload !== undefined) {
				updates.payload = JSON.stringify(
					validateEventPayload(eventType, input.payload)
				);
			}

			await ctx.db
				.update(sessionEvent)
				.set(updates)
				.where(eq(sessionEvent.id, input.id));

			await recalculateIfCompleted(
				ctx.db,
				status,
				event.liveCashGameSessionId,
				event.liveTournamentSessionId,
				userId
			);

			const [updated] = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.id, input.id));
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

			const { status } = await resolveSessionOwnership(
				ctx.db,
				event.liveCashGameSessionId ?? undefined,
				event.liveTournamentSessionId ?? undefined,
				userId
			);

			if (event.eventType === "player_join") {
				const parsed = playerJoinPayload.parse(JSON.parse(event.payload));
				const cond = buildTablePlayerCondition(
					event.liveCashGameSessionId ?? undefined,
					event.liveTournamentSessionId ?? undefined,
					parsed.playerId
				);
				await ctx.db.delete(sessionTablePlayer).where(cond);
			}

			await ctx.db.delete(sessionEvent).where(eq(sessionEvent.id, input.id));

			await recalculateIfCompleted(
				ctx.db,
				status,
				event.liveCashGameSessionId,
				event.liveTournamentSessionId,
				userId
			);

			return { success: true };
		}),
});
