import {
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { currency, store } from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeCashGamePLFromEvents,
	recalculateCashGameSession,
} from "../services/live-session-pl";

const DEFAULT_LIMIT = 20;

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function findLiveCashGameSession(
	db: DbInstance,
	id: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(gameSession)
		.where(
			and(
				eq(gameSession.id, id),
				eq(gameSession.kind, "cash_game"),
				eq(gameSession.source, "live")
			)
		);

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Live cash game session not found",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Live cash game session not found",
		});
	}

	return found;
}

interface EventSummary {
	addonCount: number;
	cashOut: number | null;
	currentStack: number | null;
	maxStack: number | null;
	minStack: number | null;
	totalBuyIn: number;
}

function computeSummaryFromEvents(
	events: { eventType: string; payload: string }[]
): EventSummary {
	let totalBuyIn = 0;
	let cashOut: number | null = null;
	let maxStack: number | null = null;
	let minStack: number | null = null;
	let currentStack: number | null = null;
	let addonCount = 0;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);
		if (event.eventType === "session_start") {
			const data = cashSessionStartPayload.parse(parsed);
			totalBuyIn += data.buyInAmount;
		} else if (event.eventType === "chips_add_remove") {
			const data = chipsAddRemovePayload.parse(parsed);
			if (data.type === "add") {
				totalBuyIn += data.amount;
				addonCount++;
			}
		} else if (event.eventType === "update_stack") {
			const data = updateStackPayload.parse(parsed);
			const stack = data.stackAmount;
			if (maxStack === null || stack > maxStack) {
				maxStack = stack;
			}
			if (minStack === null || stack < minStack) {
				minStack = stack;
			}
			currentStack = stack;
		} else if (event.eventType === "session_end") {
			const data = cashSessionEndPayload.parse(parsed);
			cashOut = data.cashOutAmount;
		}
	}

	return {
		totalBuyIn,
		cashOut,
		currentStack,
		maxStack,
		minStack,
		addonCount,
	};
}

async function resolveRingGameAssignment(
	db: DbInstance,
	ringGameId: string,
	userId: string,
	currentStoreId: string | null,
	currentCurrencyId: string | null
): Promise<{
	ringGameId: string;
	storeId?: string;
	currencyId?: string;
}> {
	const [foundRingGame] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, ringGameId));

	if (!foundRingGame) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ring game not found",
		});
	}

	if (foundRingGame.storeId) {
		const [foundStore] = await db
			.select()
			.from(store)
			.where(eq(store.id, foundRingGame.storeId));
		if (!foundStore || foundStore.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this ring game",
			});
		}
	}

	if (
		currentStoreId &&
		foundRingGame.storeId &&
		currentStoreId !== foundRingGame.storeId
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ring game belongs to a different store than the session",
		});
	}

	const patch: { ringGameId: string; storeId?: string; currencyId?: string } = {
		ringGameId,
	};
	if (!currentStoreId && foundRingGame.storeId) {
		patch.storeId = foundRingGame.storeId;
	}
	if (!currentCurrencyId && foundRingGame.currencyId) {
		patch.currencyId = foundRingGame.currencyId;
	}
	return patch;
}

export const liveCashGameSessionRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				status: z.enum(["active", "paused", "completed"]).optional(),
				cursor: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const conditions = [
				eq(gameSession.userId, userId),
				eq(gameSession.kind, "cash_game"),
				eq(gameSession.source, "live"),
			];
			if (input.status) {
				conditions.push(eq(gameSession.status, input.status));
			}
			if (input.cursor) {
				conditions.push(
					sql`${gameSession.startedAt} < (SELECT started_at FROM game_session WHERE id = ${input.cursor})`
				);
			}

			const rows = await ctx.db
				.select({
					id: gameSession.id,
					userId: gameSession.userId,
					status: gameSession.status,
					storeId: gameSession.storeId,
					storeName: store.name,
					ringGameId: sessionCashDetail.ringGameId,
					ringGameName: ringGame.name,
					currencyId: gameSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					startedAt: gameSession.startedAt,
					endedAt: gameSession.endedAt,
					memo: gameSession.memo,
					createdAt: gameSession.createdAt,
					updatedAt: gameSession.updatedAt,
				})
				.from(gameSession)
				.leftJoin(
					sessionCashDetail,
					eq(sessionCashDetail.sessionId, gameSession.id)
				)
				.leftJoin(store, eq(store.id, gameSession.storeId))
				.leftJoin(ringGame, eq(ringGame.id, sessionCashDetail.ringGameId))
				.leftJoin(currency, eq(currency.id, gameSession.currencyId))
				.where(and(...conditions))
				.orderBy(desc(gameSession.startedAt))
				.limit(input.limit + 1);

			const hasMore = rows.length > input.limit;
			const items = hasMore ? rows.slice(0, input.limit) : rows;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			const enrichedItems = await Promise.all(
				items.map(async (item) => {
					const events = await ctx.db
						.select({
							eventType: sessionEvent.eventType,
							payload: sessionEvent.payload,
							sortOrder: sessionEvent.sortOrder,
						})
						.from(sessionEvent)
						.where(eq(sessionEvent.sessionId, item.id))
						.orderBy(asc(sessionEvent.sortOrder));

					const eventCount = events.length;
					let latestStackAmount: number | null = null;

					for (const event of [...events].reverse()) {
						if (event.eventType === "update_stack") {
							const parsed = updateStackPayload.safeParse(
								JSON.parse(event.payload)
							);
							if (parsed.success) {
								latestStackAmount = parsed.data.stackAmount;
								break;
							}
						}
					}

					return { ...item, eventCount, latestStackAmount };
				})
			);

			return { items: enrichedItems, nextCursor };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			const [cashDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const tablePlayers = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(eq(sessionTablePlayer.sessionId, input.id));

			const mappedEvents = events.map((e) => ({
				eventType: e.eventType,
				payload: e.payload,
			}));
			const s = computeSummaryFromEvents(mappedEvents);
			const pl = computeCashGamePLFromEvents(mappedEvents);

			const summary = {
				totalBuyIn: s.totalBuyIn,
				cashOut: s.cashOut,
				profitLoss: pl.profitLoss,
				evCashOut: pl.evCashOut,
				evDiff: pl.evDiff,
				addonCount: s.addonCount,
				maxStack: s.maxStack,
				minStack: s.minStack,
				currentStack: s.currentStack,
			};

			return {
				...session,
				ringGameId: cashDetail?.ringGameId ?? null,
				heroSeatPosition: session.heroSeatPosition ?? null,
				events,
				tablePlayers,
				summary,
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string().optional(),
				ringGameId: z.string().optional(),
				currencyId: z.string().optional(),
				memo: z.string().optional(),
				initialBuyIn: z.number().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const now = new Date();

			const anyActive = await ctx.db
				.select({ id: gameSession.id })
				.from(gameSession)
				.where(
					and(
						eq(gameSession.userId, userId),
						eq(gameSession.source, "live"),
						sql`${gameSession.status} != 'completed'`
					)
				)
				.limit(1);

			if (anyActive.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Another session is already active",
				});
			}

			if (input.ringGameId) {
				const [foundRingGame] = await ctx.db
					.select({
						minBuyIn: ringGame.minBuyIn,
						maxBuyIn: ringGame.maxBuyIn,
					})
					.from(ringGame)
					.where(eq(ringGame.id, input.ringGameId));

				if (foundRingGame) {
					if (
						foundRingGame.minBuyIn !== null &&
						input.initialBuyIn < foundRingGame.minBuyIn
					) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Initial buy-in must be at least ${foundRingGame.minBuyIn}`,
						});
					}
					if (
						foundRingGame.maxBuyIn !== null &&
						input.initialBuyIn > foundRingGame.maxBuyIn
					) {
						throw new TRPCError({
							code: "BAD_REQUEST",
							message: `Initial buy-in must be at most ${foundRingGame.maxBuyIn}`,
						});
					}
				}
			}

			const id = crypto.randomUUID();

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: "cash_game",
				status: "active",
				source: "live",
				storeId: input.storeId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				sessionDate: now,
				updatedAt: now,
			});

			await ctx.db.insert(sessionCashDetail).values({
				sessionId: id,
				ringGameId: input.ringGameId ?? null,
			});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: 0,
				payload: JSON.stringify({ buyInAmount: input.initialBuyIn }),
				updatedAt: now,
			});

			return { id };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				memo: z.string().nullable().optional(),
				storeId: z.string().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				ringGameId: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveCashGameSession(ctx.db, input.id, userId);

			const [existingCashDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			const updateData: Partial<typeof gameSession.$inferInsert> = {
				updatedAt: new Date(),
			};

			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}
			if (input.storeId !== undefined) {
				updateData.storeId = input.storeId;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}

			const cashDetailUpdate: Partial<typeof sessionCashDetail.$inferInsert> =
				{};

			if (input.ringGameId === null) {
				cashDetailUpdate.ringGameId = null;
			} else if (input.ringGameId !== undefined) {
				const resolvedStoreId =
					updateData.storeId === undefined
						? existing.storeId
						: updateData.storeId;
				const resolvedCurrencyId =
					updateData.currencyId === undefined
						? existing.currencyId
						: updateData.currencyId;
				const patch = await resolveRingGameAssignment(
					ctx.db,
					input.ringGameId,
					userId,
					resolvedStoreId,
					resolvedCurrencyId
				);
				cashDetailUpdate.ringGameId = patch.ringGameId;
				if (patch.storeId) {
					updateData.storeId = patch.storeId;
				}
				if (patch.currencyId) {
					updateData.currencyId = patch.currencyId;
				}
			}

			await ctx.db
				.update(gameSession)
				.set(updateData)
				.where(eq(gameSession.id, input.id));

			if (Object.keys(cashDetailUpdate).length > 0) {
				if (existingCashDetail) {
					await ctx.db
						.update(sessionCashDetail)
						.set(cashDetailUpdate)
						.where(eq(sessionCashDetail.sessionId, input.id));
				} else {
					await ctx.db.insert(sessionCashDetail).values({
						sessionId: input.id,
						...cashDetailUpdate,
					});
				}
			}

			const [updated] = await ctx.db
				.select()
				.from(gameSession)
				.where(eq(gameSession.id, input.id));

			const [updatedDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			return { ...updated, ringGameId: updatedDetail?.ringGameId ?? null };
		}),

	complete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				finalStack: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status === "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is already completed",
				});
			}

			const now = new Date();

			const existingEvents = await ctx.db
				.select({ sortOrder: sessionEvent.sortOrder })
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);

			const nextSortOrder =
				existingEvents.length > 0 ? (existingEvents[0]?.sortOrder ?? 0) + 1 : 0;

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_end",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify({ cashOutAmount: input.finalStack }),
				updatedAt: now,
			});

			await recalculateCashGameSession(ctx.db, input.id, userId);

			return { id: input.id, pokerSessionId: input.id };
		}),

	reopen: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status !== "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Session is not completed",
				});
			}

			const anyActive = await ctx.db
				.select({ id: gameSession.id })
				.from(gameSession)
				.where(
					and(
						eq(gameSession.userId, userId),
						eq(gameSession.source, "live"),
						sql`${gameSession.status} != 'completed'`
					)
				)
				.limit(1);

			if (anyActive.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Another session is already active",
				});
			}

			const now = new Date();

			const [sessionEndEvent] = await ctx.db
				.select({
					id: sessionEvent.id,
					occurredAt: sessionEvent.occurredAt,
					sortOrder: sessionEvent.sortOrder,
					payload: sessionEvent.payload,
				})
				.from(sessionEvent)
				.where(
					and(
						eq(sessionEvent.sessionId, input.id),
						eq(sessionEvent.eventType, "session_end")
					)
				)
				.limit(1);

			if (!sessionEndEvent) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session end event not found",
				});
			}

			const endPayload = cashSessionEndPayload.parse(
				JSON.parse(sessionEndEvent.payload)
			);
			const cashOutAmount = endPayload.cashOutAmount;
			const endOccurredAt = sessionEndEvent.occurredAt;
			const endSortOrder = sessionEndEvent.sortOrder;

			await ctx.db
				.delete(sessionEvent)
				.where(eq(sessionEvent.id, sessionEndEvent.id));

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "update_stack",
				occurredAt: endOccurredAt,
				sortOrder: endSortOrder,
				payload: JSON.stringify({ stackAmount: cashOutAmount }),
				updatedAt: now,
			});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_pause",
				occurredAt: endOccurredAt,
				sortOrder: endSortOrder + 1,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			// session_resume must sort strictly after session_pause so
			// computeSessionStateFromEvents sees the pair in the right order
			// and break-minute calculation can close the pause.
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_resume",
				occurredAt: now,
				sortOrder: endSortOrder + 2,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			await recalculateCashGameSession(ctx.db, input.id, userId);

			return { id: input.id };
		}),

	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			if (session.status === "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Cannot discard a completed session",
				});
			}

			await ctx.db.delete(gameSession).where(eq(gameSession.id, input.id));

			return { id: input.id };
		}),

	updateHeroSeat: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				heroSeatPosition: z.number().int().min(0).max(8).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveCashGameSession(ctx.db, input.id, userId);

			const previousHeroSeat = session.heroSeatPosition;

			await ctx.db
				.update(gameSession)
				.set({ heroSeatPosition: input.heroSeatPosition })
				.where(eq(gameSession.id, input.id));

			const now = new Date();

			const getNextSortOrder = async () => {
				const [latest] = await ctx.db
					.select({ maxSort: max(sessionEvent.sortOrder) })
					.from(sessionEvent)
					.where(eq(sessionEvent.sessionId, input.id));
				return (latest?.maxSort ?? -1) + 1;
			};

			if (previousHeroSeat === null && input.heroSeatPosition !== null) {
				const sortOrder = await getNextSortOrder();
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					sessionId: input.id,
					eventType: "player_join",
					occurredAt: now,
					sortOrder,
					payload: JSON.stringify({ isHero: true }),
					updatedAt: now,
				});
			}

			if (previousHeroSeat !== null && input.heroSeatPosition === null) {
				const sortOrder = await getNextSortOrder();
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					sessionId: input.id,
					eventType: "player_leave",
					occurredAt: now,
					sortOrder,
					payload: JSON.stringify({ isHero: true }),
					updatedAt: now,
				});
			}

			return { id: input.id };
		}),
});
