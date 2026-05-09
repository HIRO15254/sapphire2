import {
	ALL_EVENT_TYPES,
	purchaseChipsPayload,
	type SessionEventType,
	validateEventPayload,
} from "@sapphire2/db/constants/session-event-types";
import { player } from "@sapphire2/db/schema/player";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionChipPurchaseOption } from "@sapphire2/db/schema/session-chip-purchase-option";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { recalculate } from "../services/session-projection";
import {
	assertOccurredAtOrdering,
	floorToMinute,
	nextAppendSortOrder,
} from "../utils/session-event-time";
import {
	assertEventAllowedForSource,
	assertLiveSession,
} from "../utils/session-guards";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

function assertNotDiscarded(status: string): void {
	if (status === "discarded") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot modify a discarded session",
		});
	}
}

interface SessionInfo {
	sessionDate: Date;
	sessionId: string;
	sessionType: "cash_game" | "tournament";
	source: "live" | "manual";
	status: string;
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
		source: session.source as "live" | "manual",
		status: session.status,
		sessionDate: session.sessionDate,
	};
}

async function guardChipPurchaseOptionId(
	db: DbInstance,
	sessionId: string,
	chipPurchaseOptionId: string
): Promise<number> {
	const numericId = Number(chipPurchaseOptionId);
	if (!Number.isInteger(numericId) || numericId <= 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Invalid chipPurchaseOptionId: "${chipPurchaseOptionId}"`,
		});
	}

	const allOptions = await db
		.select({ id: sessionChipPurchaseOption.id })
		.from(sessionChipPurchaseOption)
		.where(eq(sessionChipPurchaseOption.sessionId, sessionId));

	const optionIds = allOptions.map((o) => o.id);
	if (!optionIds.includes(numericId)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Chip purchase option "${chipPurchaseOptionId}" does not belong to session "${sessionId}"`,
		});
	}

	return numericId;
}

function parseEventPayload(event: { payload: string }) {
	return JSON.parse(event.payload) as unknown;
}

async function insertEventAndRecalculate(
	db: DbInstance,
	sessionId: string,
	eventType: SessionEventType,
	occurredAt: Date,
	payload: unknown
): Promise<string> {
	const sortOrder = await nextAppendSortOrder(db, sessionId);
	await assertOccurredAtOrdering(db, sessionId, sortOrder, occurredAt);

	const id = crypto.randomUUID();
	await db.insert(sessionEvent).values({
		id,
		sessionId,
		eventType,
		occurredAt,
		sortOrder,
		payload: JSON.stringify(payload),
		updatedAt: new Date(),
	});

	await recalculate(db, sessionId);

	return id;
}

const sessionIdInput = z.object({
	sessionId: z.string().optional(),
});

function resolveSessionId(input: { sessionId?: string }): string | undefined {
	return input.sessionId;
}

export const sessionEventRouter = router({
	list: protectedProcedure
		.input(sessionIdInput)
		.query(async ({ ctx, input }) => {
			const sessionId = resolveSessionId(input);

			if (!sessionId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "A session id must be specified",
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
					message: "A session id must be specified",
				});
			}

			const userId = ctx.session.user.id;
			const { sessionType, source, status, sessionDate } =
				await resolveSessionOwnership(ctx.db, sessionId, userId);

			assertNotDiscarded(status);
			assertEventAllowedForSource(source, input.eventType);

			const validatedPayload = validateEventPayload(
				input.eventType,
				input.payload,
				sessionType
			);

			// Guard chipPurchaseOptionId for purchase_chips
			if (input.eventType === "purchase_chips") {
				const parsed = purchaseChipsPayload.parse(validatedPayload);
				await guardChipPurchaseOptionId(
					ctx.db,
					sessionId,
					parsed.chipPurchaseOptionId
				);
			}

			const rawOccurredAt = input.occurredAt
				? new Date(input.occurredAt * 1000)
				: sessionDate;
			const occurredAtDate = floorToMinute(rawOccurredAt);

			const id = await insertEventAndRecalculate(
				ctx.db,
				sessionId,
				input.eventType,
				occurredAtDate,
				validatedPayload
			);

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

			const { sessionType, source, status } = await resolveSessionOwnership(
				ctx.db,
				event.sessionId,
				userId
			);

			assertNotDiscarded(status);
			assertLiveSession(source);

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

			if (input.payload !== undefined) {
				const validatedPayload = validateEventPayload(
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

			await recalculate(ctx.db, event.sessionId);

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

			const { source, status } = await resolveSessionOwnership(
				ctx.db,
				event.sessionId,
				userId
			);

			assertNotDiscarded(status);
			assertLiveSession(source);

			await ctx.db.delete(sessionEvent).where(eq(sessionEvent.id, input.id));

			await recalculate(ctx.db, event.sessionId);

			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// Player seat operations (live sessions only)
	// ---------------------------------------------------------------------------

	addPlayer: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				playerId: z.string().optional(),
				isHero: z.boolean().default(false),
				seatPosition: z.number().int().min(0).max(8).optional(),
				occurredAt: z.number().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { source, status, sessionDate } = await resolveSessionOwnership(
				ctx.db,
				input.sessionId,
				userId
			);

			assertNotDiscarded(status);
			assertLiveSession(source);

			if (!(input.isHero || input.playerId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "playerId is required when isHero is false",
				});
			}

			if (input.playerId) {
				const [foundPlayer] = await ctx.db
					.select({ id: player.id })
					.from(player)
					.where(eq(player.id, input.playerId));
				if (!foundPlayer) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Player not found",
					});
				}
			}

			const payload = {
				playerId: input.playerId,
				isHero: input.isHero,
				seatPosition: input.seatPosition,
			};

			const rawOccurredAt = input.occurredAt
				? new Date(input.occurredAt * 1000)
				: sessionDate;
			const occurredAtDate = floorToMinute(rawOccurredAt);

			const id = await insertEventAndRecalculate(
				ctx.db,
				input.sessionId,
				"player_join",
				occurredAtDate,
				payload
			);

			return { id };
		}),

	removePlayer: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				playerId: z.string().optional(),
				isHero: z.boolean().default(false),
				occurredAt: z.number().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { source, status, sessionDate } = await resolveSessionOwnership(
				ctx.db,
				input.sessionId,
				userId
			);

			assertNotDiscarded(status);
			assertLiveSession(source);

			if (!(input.isHero || input.playerId)) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "playerId is required when isHero is false",
				});
			}

			const payload = {
				playerId: input.playerId,
				isHero: input.isHero,
			};

			const rawOccurredAt = input.occurredAt
				? new Date(input.occurredAt * 1000)
				: sessionDate;
			const occurredAtDate = floorToMinute(rawOccurredAt);

			const id = await insertEventAndRecalculate(
				ctx.db,
				input.sessionId,
				"player_leave",
				occurredAtDate,
				payload
			);

			return { id };
		}),

	addTemporaryPlayer: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				name: z.string().min(1),
				seatPosition: z.number().int().min(0).max(8).optional(),
				occurredAt: z.number().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { source, status, sessionDate } = await resolveSessionOwnership(
				ctx.db,
				input.sessionId,
				userId
			);

			assertNotDiscarded(status);
			assertLiveSession(source);

			const now = new Date();
			const playerId = crypto.randomUUID();
			await ctx.db.insert(player).values({
				id: playerId,
				isTemporary: true,
				memo: null,
				name: input.name,
				updatedAt: now,
				userId,
			});

			const payload = {
				playerId,
				isHero: false,
				seatPosition: input.seatPosition,
			};

			const rawOccurredAt = input.occurredAt
				? new Date(input.occurredAt * 1000)
				: sessionDate;
			const occurredAtDate = floorToMinute(rawOccurredAt);

			const id = await insertEventAndRecalculate(
				ctx.db,
				input.sessionId,
				"player_join",
				occurredAtDate,
				payload
			);

			return { id, playerId };
		}),
});
