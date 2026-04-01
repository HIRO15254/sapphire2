import {
	chipAddPayload,
	stackRecordPayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { pokerSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import {
	currency,
	currencyTransaction,
	store,
	transactionType,
} from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { computeCashGamePLFromEvents } from "../services/live-session-pl";

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
		.from(liveCashGameSession)
		.where(eq(liveCashGameSession.id, id));

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

async function getSessionResultTypeId(
	db: DbInstance,
	userId: string
): Promise<string> {
	const [found] = await db
		.select()
		.from(transactionType)
		.where(
			and(
				eq(transactionType.userId, userId),
				eq(transactionType.name, "Session Result")
			)
		);

	if (found) {
		return found.id;
	}

	const id = crypto.randomUUID();
	await db.insert(transactionType).values({
		id,
		userId,
		name: "Session Result",
		updatedAt: new Date(),
	});
	return id;
}

async function createCurrencyTransactionForSession(
	db: DbInstance,
	sessionId: string,
	currencyId: string,
	amount: number,
	sessionDate: Date,
	userId: string
) {
	const typeId = await getSessionResultTypeId(db, userId);
	await db.insert(currencyTransaction).values({
		id: crypto.randomUUID(),
		currencyId,
		transactionTypeId: typeId,
		sessionId,
		amount,
		transactedAt: sessionDate,
	});
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
	let maxStack: number | null = null;
	let minStack: number | null = null;
	let currentStack: number | null = null;
	let chipAddCount = 0;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);
		if (event.eventType === "chip_add") {
			totalBuyIn += chipAddPayload.parse(parsed).amount;
			chipAddCount++;
		} else if (event.eventType === "stack_record") {
			const data = stackRecordPayload.parse(parsed);
			const stack = data.stackAmount;
			if (maxStack === null || stack > maxStack) {
				maxStack = stack;
			}
			if (minStack === null || stack < minStack) {
				minStack = stack;
			}
			currentStack = stack;
		}
	}

	return {
		totalBuyIn,
		cashOut: currentStack,
		currentStack,
		maxStack,
		minStack,
		addonCount: chipAddCount > 0 ? chipAddCount - 1 : 0,
	};
}

export const liveCashGameSessionRouter = router({
	list: protectedProcedure
		.input(
			z.object({
				status: z.enum(["active", "completed"]).optional(),
				cursor: z.string().optional(),
				limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const conditions = [eq(liveCashGameSession.userId, userId)];
			if (input.status) {
				conditions.push(eq(liveCashGameSession.status, input.status));
			}
			if (input.cursor) {
				conditions.push(
					sql`${liveCashGameSession.startedAt} < (SELECT started_at FROM live_cash_game_session WHERE id = ${input.cursor})`
				);
			}

			const rows = await ctx.db
				.select({
					id: liveCashGameSession.id,
					userId: liveCashGameSession.userId,
					status: liveCashGameSession.status,
					storeId: liveCashGameSession.storeId,
					storeName: store.name,
					ringGameId: liveCashGameSession.ringGameId,
					ringGameName: ringGame.name,
					currencyId: liveCashGameSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					startedAt: liveCashGameSession.startedAt,
					endedAt: liveCashGameSession.endedAt,
					memo: liveCashGameSession.memo,
					createdAt: liveCashGameSession.createdAt,
					updatedAt: liveCashGameSession.updatedAt,
				})
				.from(liveCashGameSession)
				.leftJoin(store, eq(store.id, liveCashGameSession.storeId))
				.leftJoin(ringGame, eq(ringGame.id, liveCashGameSession.ringGameId))
				.leftJoin(currency, eq(currency.id, liveCashGameSession.currencyId))
				.where(and(...conditions))
				.orderBy(desc(liveCashGameSession.startedAt))
				.limit(input.limit + 1);

			const hasMore = rows.length > input.limit;
			const items = hasMore ? rows.slice(0, input.limit) : rows;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			// Fetch event counts and latest stack amount per session
			const sessionIds = items.map((r) => r.id);
			const enrichedItems = await Promise.all(
				items.map(async (item) => {
					if (!sessionIds.includes(item.id)) {
						return { ...item, eventCount: 0, latestStackAmount: null };
					}

					const events = await ctx.db
						.select({
							eventType: sessionEvent.eventType,
							payload: sessionEvent.payload,
							sortOrder: sessionEvent.sortOrder,
						})
						.from(sessionEvent)
						.where(eq(sessionEvent.liveCashGameSessionId, item.id))
						.orderBy(asc(sessionEvent.sortOrder));

					const eventCount = events.length;
					let latestStackAmount: number | null = null;

					for (const event of [...events].reverse()) {
						if (event.eventType === "stack_record") {
							const parsed = stackRecordPayload.safeParse(
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

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.liveCashGameSessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const tablePlayers = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(eq(sessionTablePlayer.liveCashGameSessionId, input.id));

			const s = computeSummaryFromEvents(
				events.map((e) => ({ eventType: e.eventType, payload: e.payload }))
			);
			const profitLoss = s.cashOut !== null ? s.cashOut - s.totalBuyIn : null;
			const evCashOut = computeCashGamePLFromEvents(
				events.map((e) => ({ eventType: e.eventType, payload: e.payload }))
			).evCashOut;

			const summary = {
				totalBuyIn: s.totalBuyIn,
				cashOut: s.cashOut,
				profitLoss,
				evCashOut,
				addonCount: s.addonCount,
				maxStack: s.maxStack,
				minStack: s.minStack,
				currentStack: s.currentStack,
			};

			return { ...session, events, tablePlayers, summary };
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

			// Check no other active session exists across both cash game and tournament tables
			const anyActiveCash = await ctx.db
				.select({ id: liveCashGameSession.id })
				.from(liveCashGameSession)
				.where(
					and(
						eq(liveCashGameSession.userId, userId),
						eq(liveCashGameSession.status, "active")
					)
				)
				.limit(1);

			const anyActiveTournament = await ctx.db
				.select({ id: liveTournamentSession.id })
				.from(liveTournamentSession)
				.where(
					and(
						eq(liveTournamentSession.userId, userId),
						eq(liveTournamentSession.status, "active")
					)
				)
				.limit(1);

			if (anyActiveCash.length > 0 || anyActiveTournament.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Another session is already active",
				});
			}

			const id = crypto.randomUUID();

			await ctx.db.insert(liveCashGameSession).values({
				id,
				userId,
				status: "active",
				storeId: input.storeId ?? null,
				ringGameId: input.ringGameId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				updatedAt: now,
			});

			// Auto-create session_start event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveCashGameSessionId: id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: 0,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			// Auto-create initial buy-in event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveCashGameSessionId: id,
				eventType: "chip_add",
				occurredAt: now,
				sortOrder: 1,
				payload: JSON.stringify({ amount: input.initialBuyIn }),
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
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveCashGameSession(ctx.db, input.id, userId);

			const updateData: Partial<typeof liveCashGameSession.$inferInsert> = {
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

			await ctx.db
				.update(liveCashGameSession)
				.set(updateData)
				.where(eq(liveCashGameSession.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(liveCashGameSession)
				.where(eq(liveCashGameSession.id, input.id));

			return updated;
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

			// Get existing events to determine sort order
			const existingEvents = await ctx.db
				.select({ sortOrder: sessionEvent.sortOrder })
				.from(sessionEvent)
				.where(eq(sessionEvent.liveCashGameSessionId, input.id))
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);

			const nextSortOrder =
				existingEvents.length > 0 ? (existingEvents[0]?.sortOrder ?? 0) + 1 : 0;

			// Insert stack_record event as the final stack (cash-out)
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveCashGameSessionId: input.id,
				eventType: "stack_record",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify({ stackAmount: input.finalStack }),
				updatedAt: now,
			});

			// Insert session_end event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveCashGameSessionId: input.id,
				eventType: "session_end",
				occurredAt: now,
				sortOrder: nextSortOrder + 1,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			// Mark session as completed
			await ctx.db
				.update(liveCashGameSession)
				.set({ status: "completed", endedAt: now, updatedAt: now })
				.where(eq(liveCashGameSession.id, input.id));

			// Fetch all events for P&L computation
			const allEvents = await ctx.db
				.select({
					eventType: sessionEvent.eventType,
					payload: sessionEvent.payload,
				})
				.from(sessionEvent)
				.where(eq(sessionEvent.liveCashGameSessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const pl = computeCashGamePLFromEvents(allEvents);

			// Check if a pokerSession already exists for this live session
			const [existingPokerSession] = await ctx.db
				.select({ id: pokerSession.id })
				.from(pokerSession)
				.where(eq(pokerSession.liveCashGameSessionId, input.id));

			let pokerSessionId: string;

			if (existingPokerSession) {
				pokerSessionId = existingPokerSession.id;
				await ctx.db
					.update(pokerSession)
					.set({
						buyIn: pl.totalBuyIn,
						cashOut: pl.cashOut,
						evCashOut: pl.evCashOut,
						endedAt: now,
						updatedAt: now,
					})
					.where(eq(pokerSession.id, pokerSessionId));

				// Update or create currency transaction
				if (session.currencyId && pl.profitLoss !== null) {
					const [existingTx] = await ctx.db
						.select({ id: currencyTransaction.id })
						.from(currencyTransaction)
						.where(eq(currencyTransaction.sessionId, pokerSessionId));

					if (existingTx) {
						await ctx.db
							.update(currencyTransaction)
							.set({ amount: pl.profitLoss })
							.where(eq(currencyTransaction.id, existingTx.id));
					} else {
						await createCurrencyTransactionForSession(
							ctx.db,
							pokerSessionId,
							session.currencyId,
							pl.profitLoss,
							session.startedAt,
							userId
						);
					}
				}
			} else {
				pokerSessionId = crypto.randomUUID();
				await ctx.db.insert(pokerSession).values({
					id: pokerSessionId,
					userId,
					type: "cash_game",
					sessionDate: session.startedAt,
					storeId: session.storeId ?? null,
					ringGameId: session.ringGameId ?? null,
					currencyId: session.currencyId ?? null,
					liveCashGameSessionId: input.id,
					buyIn: pl.totalBuyIn,
					cashOut: pl.cashOut,
					evCashOut: pl.evCashOut,
					startedAt: session.startedAt,
					endedAt: now,
					memo: session.memo ?? null,
					updatedAt: now,
				});

				// Create currency transaction if currencyId is set and P&L is available
				if (session.currencyId && pl.profitLoss !== null) {
					await createCurrencyTransactionForSession(
						ctx.db,
						pokerSessionId,
						session.currencyId,
						pl.profitLoss,
						session.startedAt,
						userId
					);
				}
			}

			return { id: input.id, pokerSessionId };
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

			// Check no other active session exists across both cash game and tournament tables
			const anyActiveCash = await ctx.db
				.select({ id: liveCashGameSession.id })
				.from(liveCashGameSession)
				.where(
					and(
						eq(liveCashGameSession.userId, userId),
						eq(liveCashGameSession.status, "active")
					)
				)
				.limit(1);

			const anyActiveTournament = await ctx.db
				.select({ id: liveTournamentSession.id })
				.from(liveTournamentSession)
				.where(
					and(
						eq(liveTournamentSession.userId, userId),
						eq(liveTournamentSession.status, "active")
					)
				)
				.limit(1);

			if (anyActiveCash.length > 0 || anyActiveTournament.length > 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Another session is already active",
				});
			}

			// Find linked pokerSession and clean up derived data
			const [linkedPokerSession] = await ctx.db
				.select({ id: pokerSession.id })
				.from(pokerSession)
				.where(eq(pokerSession.liveCashGameSessionId, input.id));

			if (linkedPokerSession) {
				await ctx.db
					.delete(currencyTransaction)
					.where(eq(currencyTransaction.sessionId, linkedPokerSession.id));
				await ctx.db
					.delete(pokerSession)
					.where(eq(pokerSession.id, linkedPokerSession.id));
			}

			const now = new Date();

			// Add new session_start event (keeps previous events in history)
			const [lastEvent] = await ctx.db
				.select({ sortOrder: sessionEvent.sortOrder })
				.from(sessionEvent)
				.where(eq(sessionEvent.liveCashGameSessionId, input.id))
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);
			const nextSortOrder = lastEvent ? (lastEvent.sortOrder ?? 0) + 1 : 0;

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveCashGameSessionId: input.id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			// Reopen the session
			await ctx.db
				.update(liveCashGameSession)
				.set({ status: "active", endedAt: null, updatedAt: now })
				.where(eq(liveCashGameSession.id, input.id));

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

			// Cascade deletes events and players via FK constraints
			await ctx.db
				.delete(liveCashGameSession)
				.where(eq(liveCashGameSession.id, input.id));

			return { id: input.id };
		}),
});
