import {
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	MAX_SEAT_POSITION,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import { currency } from "@sapphire2/db/schema/currency";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeCashGamePLFromEvents,
	computeHeroSeatPositionFromEvents,
	recalculateCashGameSession,
} from "../services/live-session-pl";
import { floorToMinute } from "../utils/session-event-time";
import {
	resolveCashRuleSnapshot,
	validateEntityOwnership,
	validateLiveLinkOwnership,
} from "./session";

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
			if (data.amount > 0) {
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
	currentRoomId: string | null,
	currentCurrencyId: string | null
): Promise<{
	ringGameId: string;
	roomId?: string;
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

	// Ownership is anchored on ring_game.userId (SA2-181), not derived from the
	// room, so null-roomId auto-generated snapshot rows are covered too. This
	// mirrors the caller's pre-check (validateEntityOwnership("ringGame", …)) as
	// defense-in-depth and keeps the ownership model unified.
	if (foundRingGame.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}

	if (
		currentRoomId &&
		foundRingGame.roomId &&
		currentRoomId !== foundRingGame.roomId
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ring game belongs to a different room than the session",
		});
	}

	const patch: { ringGameId: string; roomId?: string; currencyId?: string } = {
		ringGameId,
	};
	if (!currentRoomId && foundRingGame.roomId) {
		patch.roomId = foundRingGame.roomId;
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
					sql`${gameSession.startedAt} < (SELECT started_at FROM game_session WHERE id = ${input.cursor} AND user_id = ${userId})`
				);
			}

			const rows = await ctx.db
				.select({
					id: gameSession.id,
					userId: gameSession.userId,
					status: gameSession.status,
					roomId: gameSession.roomId,
					roomName: room.name,
					ringGameId: sessionCashDetail.ringGameId,
					ringGameName: sessionCashDetail.ruleName,
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
				.leftJoin(room, eq(room.id, gameSession.roomId))
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
						.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

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
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			const mappedEvents = events.map((e) => ({
				eventType: e.eventType,
				payload: e.payload,
			}));
			const s = computeSummaryFromEvents(mappedEvents);
			const pl = computeCashGamePLFromEvents(mappedEvents);

			const summary = {
				totalBuyIn: s.totalBuyIn,
				cashOut: s.cashOut,
				chipRemoveTotal: pl.chipRemoveTotal,
				profitLoss: pl.profitLoss,
				evCashOut: pl.evCashOut,
				evDiff: pl.evDiff,
				addonCount: s.addonCount,
				maxStack: s.maxStack,
				minStack: s.minStack,
				currentStack: s.currentStack,
			};

			const heroSeatPosition = computeHeroSeatPositionFromEvents(mappedEvents);

			return {
				...session,
				ringGameId: cashDetail?.ringGameId ?? null,
				heroSeatPosition,
				events,
				summary,
				// Snapshot fields from session_cash_detail. Display in the
				// live scene must read from here so renames / blind edits on
				// the master ring_game never propagate.
				ruleName: cashDetail?.ruleName ?? null,
				variant: cashDetail?.variant ?? null,
				blind1: cashDetail?.blind1 ?? null,
				blind2: cashDetail?.blind2 ?? null,
				blind3: cashDetail?.blind3 ?? null,
				ante: cashDetail?.ante ?? null,
				anteType: cashDetail?.anteType ?? null,
				minBuyIn: cashDetail?.minBuyIn ?? null,
				maxBuyIn: cashDetail?.maxBuyIn ?? null,
				tableSize: cashDetail?.tableSize ?? null,
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				roomId: z.string().optional(),
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
				// Verify ring-game ownership BEFORE any ring_game read so a caller
				// cannot probe another user's config via the buy-in bounds (SA2-174).
				await validateEntityOwnership(
					ctx.db,
					"ringGame",
					input.ringGameId,
					userId
				);
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

			await validateLiveLinkOwnership(ctx.db, input, userId);

			const id = crypto.randomUUID();

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: "cash_game",
				status: "active",
				source: "live",
				roomId: input.roomId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				sessionDate: now,
				updatedAt: now,
			});

			const snapshot = await resolveCashRuleSnapshot(ctx.db, {
				ringGameId: input.ringGameId,
			});
			await ctx.db.insert(sessionCashDetail).values({
				sessionId: id,
				ringGameId: input.ringGameId ?? null,
				ruleName: input.ringGameId ? snapshot.ruleName : "Cash Game",
				variant: snapshot.variant,
				blind1: snapshot.blind1,
				blind2: snapshot.blind2,
				blind3: snapshot.blind3,
				ante: snapshot.ante,
				anteType: snapshot.anteType,
				minBuyIn: snapshot.minBuyIn,
				maxBuyIn: snapshot.maxBuyIn,
				tableSize: snapshot.tableSize,
			});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: id,
				eventType: "session_start",
				occurredAt: floorToMinute(now),
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
				roomId: z.string().nullable().optional(),
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

			await validateLiveLinkOwnership(ctx.db, input, userId);

			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}
			if (input.roomId !== undefined) {
				updateData.roomId = input.roomId;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}

			const cashDetailUpdate: Partial<typeof sessionCashDetail.$inferInsert> =
				{};

			if (input.ringGameId === null) {
				cashDetailUpdate.ringGameId = null;
			} else if (input.ringGameId !== undefined) {
				// Verify ring-game ownership BEFORE the snapshot read (SA2-174).
				await validateEntityOwnership(
					ctx.db,
					"ringGame",
					input.ringGameId,
					userId
				);
				const resolvedRoomId =
					updateData.roomId === undefined ? existing.roomId : updateData.roomId;
				const resolvedCurrencyId =
					updateData.currencyId === undefined
						? existing.currencyId
						: updateData.currencyId;
				const patch = await resolveRingGameAssignment(
					ctx.db,
					input.ringGameId,
					userId,
					resolvedRoomId,
					resolvedCurrencyId
				);
				cashDetailUpdate.ringGameId = patch.ringGameId;
				if (patch.roomId) {
					updateData.roomId = patch.roomId;
				}
				if (patch.currencyId) {
					updateData.currencyId = patch.currencyId;
				}

				const snapshot = await resolveCashRuleSnapshot(ctx.db, {
					ringGameId: input.ringGameId,
				});
				cashDetailUpdate.ruleName = snapshot.ruleName;
				cashDetailUpdate.variant = snapshot.variant;
				cashDetailUpdate.blind1 = snapshot.blind1;
				cashDetailUpdate.blind2 = snapshot.blind2;
				cashDetailUpdate.blind3 = snapshot.blind3;
				cashDetailUpdate.ante = snapshot.ante;
				cashDetailUpdate.anteType = snapshot.anteType;
				cashDetailUpdate.minBuyIn = snapshot.minBuyIn;
				cashDetailUpdate.maxBuyIn = snapshot.maxBuyIn;
				cashDetailUpdate.tableSize = snapshot.tableSize;
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

	// Edit the session's frozen rule snapshot on session_cash_detail. The
	// master ring_game is NEVER touched by this mutation. Use it from the
	// live-session edit dialog to override snapshot data for this session
	// only.
	updateSnapshot: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				ruleName: z.string().min(1).optional(),
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				minBuyIn: z.number().int().nullable().optional(),
				maxBuyIn: z.number().int().nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveCashGameSession(ctx.db, input.id, userId);

			const detailUpdate: Partial<typeof sessionCashDetail.$inferInsert> = {};
			if (input.ruleName !== undefined) {
				detailUpdate.ruleName = input.ruleName;
			}
			if (input.variant !== undefined) {
				detailUpdate.variant = input.variant;
			}
			if (input.blind1 !== undefined) {
				detailUpdate.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				detailUpdate.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				detailUpdate.blind3 = input.blind3;
			}
			if (input.ante !== undefined) {
				detailUpdate.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				detailUpdate.anteType = input.anteType;
			}
			if (input.minBuyIn !== undefined) {
				detailUpdate.minBuyIn = input.minBuyIn;
			}
			if (input.maxBuyIn !== undefined) {
				detailUpdate.maxBuyIn = input.maxBuyIn;
			}
			if (input.tableSize !== undefined) {
				detailUpdate.tableSize = input.tableSize;
			}
			if (Object.keys(detailUpdate).length === 0) {
				return { id: input.id };
			}
			await ctx.db
				.update(sessionCashDetail)
				.set(detailUpdate)
				.where(eq(sessionCashDetail.sessionId, input.id));
			return { id: input.id };
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
				occurredAt: floorToMinute(now),
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

			const flooredEndOccurredAt = floorToMinute(endOccurredAt);
			const flooredNow = floorToMinute(now);

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "update_stack",
				occurredAt: flooredEndOccurredAt,
				sortOrder: endSortOrder,
				payload: JSON.stringify({ stackAmount: cashOutAmount }),
				updatedAt: now,
			});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_pause",
				occurredAt: flooredEndOccurredAt,
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
				occurredAt: flooredNow,
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
				heroSeatPosition: z
					.number()
					.int()
					.min(0)
					.max(MAX_SEAT_POSITION)
					.nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveCashGameSession(ctx.db, input.id, userId);

			const events = await ctx.db
				.select({
					eventType: sessionEvent.eventType,
					payload: sessionEvent.payload,
				})
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			const previousHeroSeat = computeHeroSeatPositionFromEvents(events);

			if (previousHeroSeat !== null && input.heroSeatPosition !== null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Hero is already seated. Leave the seat before assigning a new one.",
				});
			}

			if (previousHeroSeat === input.heroSeatPosition) {
				return { id: input.id };
			}

			const now = new Date();
			const [latest] = await ctx.db
				.select({ maxSort: max(sessionEvent.sortOrder) })
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id));
			const sortOrder = (latest?.maxSort ?? -1) + 1;

			if (input.heroSeatPosition === null) {
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					sessionId: input.id,
					eventType: "player_leave",
					occurredAt: floorToMinute(now),
					sortOrder,
					payload: JSON.stringify({ isHero: true }),
					updatedAt: now,
				});
			} else {
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					sessionId: input.id,
					eventType: "player_join",
					occurredAt: floorToMinute(now),
					sortOrder,
					payload: JSON.stringify({
						isHero: true,
						seatPosition: input.heroSeatPosition,
					}),
					updatedAt: now,
				});
			}

			return { id: input.id };
		}),
});
