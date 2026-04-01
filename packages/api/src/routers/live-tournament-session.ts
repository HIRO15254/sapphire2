import {
	tournamentResultPayload,
	tournamentStackRecordPayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { pokerSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import {
	currency,
	currencyTransaction,
	store,
	transactionType,
} from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { computeTournamentPLFromEvents } from "../services/live-session-pl";

const DEFAULT_LIMIT = 20;

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function findLiveTournamentSession(
	db: DbInstance,
	id: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(liveTournamentSession)
		.where(eq(liveTournamentSession.id, id));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Live tournament session not found",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Live tournament session not found",
		});
	}

	return found;
}

async function assertNoActiveSession(
	db: DbInstance,
	userId: string
): Promise<void> {
	const anyActiveCash = await db
		.select({ id: liveCashGameSession.id })
		.from(liveCashGameSession)
		.where(
			and(
				eq(liveCashGameSession.userId, userId),
				eq(liveCashGameSession.status, "active")
			)
		)
		.limit(1);

	const anyActiveTournament = await db
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

async function upsertCurrencyTransaction(
	db: DbInstance,
	pokerSessionId: string,
	currencyId: string,
	profitLoss: number,
	sessionDate: Date,
	userId: string
): Promise<void> {
	const [existingTx] = await db
		.select({ id: currencyTransaction.id })
		.from(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, pokerSessionId));

	if (existingTx) {
		await db
			.update(currencyTransaction)
			.set({ amount: profitLoss })
			.where(eq(currencyTransaction.id, existingTx.id));
		return;
	}

	const typeId = await getSessionResultTypeId(db, userId);
	await db.insert(currencyTransaction).values({
		id: crypto.randomUUID(),
		currencyId,
		transactionTypeId: typeId,
		sessionId: pokerSessionId,
		amount: profitLoss,
		transactedAt: sessionDate,
	});
}

async function fetchTournamentBuyInInfo(
	db: DbInstance,
	tournamentId: string | null
): Promise<{
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
}> {
	if (!tournamentId) {
		return { tournamentBuyIn: undefined, entryFee: undefined };
	}
	const [t] = await db
		.select({ buyIn: tournament.buyIn, entryFee: tournament.entryFee })
		.from(tournament)
		.where(eq(tournament.id, tournamentId));
	return {
		tournamentBuyIn: t?.buyIn ?? undefined,
		entryFee: t?.entryFee ?? undefined,
	};
}

function computeStackStats(events: { eventType: string; payload: string }[]): {
	maxStack: number | null;
	minStack: number | null;
	currentStack: number | null;
	remainingPlayers: number | null;
	averageStack: number | null;
} {
	let maxStack: number | null = null;
	let minStack: number | null = null;
	let currentStack: number | null = null;
	let remainingPlayers: number | null = null;
	let averageStack: number | null = null;

	for (const event of events) {
		if (event.eventType !== "tournament_stack_record") {
			continue;
		}
		const parsed = tournamentStackRecordPayload.safeParse(
			JSON.parse(event.payload)
		);
		if (!parsed.success) {
			continue;
		}
		const stack = parsed.data.stackAmount;
		if (maxStack === null || stack > maxStack) {
			maxStack = stack;
		}
		if (minStack === null || stack < minStack) {
			minStack = stack;
		}
		currentStack = stack;
		remainingPlayers = parsed.data.remainingPlayers;
		averageStack = parsed.data.averageStack;
	}

	return { maxStack, minStack, currentStack, remainingPlayers, averageStack };
}

type TournamentPL = ReturnType<typeof computeTournamentPLFromEvents>;

async function upsertPokerSession(
	db: DbInstance,
	liveTournamentSessionId: string,
	userId: string,
	session: {
		startedAt: Date;
		storeId: string | null;
		tournamentId: string | null;
		currencyId: string | null;
		memo: string | null;
	},
	tournamentBuyIn: number | undefined,
	entryFee: number | undefined,
	pl: TournamentPL,
	now: Date
): Promise<string> {
	const [existing] = await db
		.select({ id: pokerSession.id })
		.from(pokerSession)
		.where(eq(pokerSession.liveTournamentSessionId, liveTournamentSessionId));

	if (existing) {
		await db
			.update(pokerSession)
			.set({
				placement: pl.placement,
				totalEntries: pl.totalEntries,
				prizeMoney: pl.prizeMoney,
				bountyPrizes: pl.bountyPrizes,
				rebuyCount: pl.rebuyCount,
				rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
				addonCost: pl.addonCost > 0 ? pl.addonCost : null,
				endedAt: now,
				updatedAt: now,
			})
			.where(eq(pokerSession.id, existing.id));
		return existing.id;
	}

	const pokerSessionId = crypto.randomUUID();
	await db.insert(pokerSession).values({
		id: pokerSessionId,
		userId,
		type: "tournament",
		sessionDate: session.startedAt,
		storeId: session.storeId ?? null,
		tournamentId: session.tournamentId ?? null,
		currencyId: session.currencyId ?? null,
		liveTournamentSessionId,
		tournamentBuyIn: tournamentBuyIn ?? null,
		entryFee: entryFee ?? null,
		placement: pl.placement,
		totalEntries: pl.totalEntries,
		prizeMoney: pl.prizeMoney,
		bountyPrizes: pl.bountyPrizes,
		rebuyCount: pl.rebuyCount,
		rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
		addonCost: pl.addonCost > 0 ? pl.addonCost : null,
		startedAt: session.startedAt,
		endedAt: now,
		memo: session.memo ?? null,
		updatedAt: now,
	});
	return pokerSessionId;
}

export const liveTournamentSessionRouter = router({
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

			const conditions = [eq(liveTournamentSession.userId, userId)];
			if (input.status) {
				conditions.push(eq(liveTournamentSession.status, input.status));
			}
			if (input.cursor) {
				conditions.push(
					sql`${liveTournamentSession.startedAt} < (SELECT started_at FROM live_tournament_session WHERE id = ${input.cursor})`
				);
			}

			const rows = await ctx.db
				.select({
					id: liveTournamentSession.id,
					userId: liveTournamentSession.userId,
					status: liveTournamentSession.status,
					storeId: liveTournamentSession.storeId,
					storeName: store.name,
					tournamentId: liveTournamentSession.tournamentId,
					tournamentName: tournament.name,
					currencyId: liveTournamentSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					startedAt: liveTournamentSession.startedAt,
					endedAt: liveTournamentSession.endedAt,
					memo: liveTournamentSession.memo,
					createdAt: liveTournamentSession.createdAt,
					updatedAt: liveTournamentSession.updatedAt,
				})
				.from(liveTournamentSession)
				.leftJoin(store, eq(store.id, liveTournamentSession.storeId))
				.leftJoin(
					tournament,
					eq(tournament.id, liveTournamentSession.tournamentId)
				)
				.leftJoin(currency, eq(currency.id, liveTournamentSession.currencyId))
				.where(and(...conditions))
				.orderBy(desc(liveTournamentSession.startedAt))
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
						.where(eq(sessionEvent.liveTournamentSessionId, item.id))
						.orderBy(asc(sessionEvent.sortOrder));

					const eventCount = events.length;
					let latestStackAmount: number | null = null;
					let remainingPlayers: number | null = null;
					let averageStack: number | null = null;

					for (const event of [...events].reverse()) {
						if (event.eventType === "tournament_stack_record") {
							const parsed = tournamentStackRecordPayload.safeParse(
								JSON.parse(event.payload)
							);
							if (parsed.success) {
								latestStackAmount = parsed.data.stackAmount;
								remainingPlayers = parsed.data.remainingPlayers;
								averageStack = parsed.data.averageStack;
								break;
							}
						}
					}

					return {
						...item,
						eventCount,
						latestStackAmount,
						remainingPlayers,
						averageStack,
					};
				})
			);

			return { items: enrichedItems, nextCursor };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

			const { tournamentBuyIn, entryFee } = await fetchTournamentBuyInInfo(
				ctx.db,
				session.tournamentId
			);

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.liveTournamentSessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const tablePlayers = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(eq(sessionTablePlayer.liveTournamentSessionId, input.id));

			const pl = computeTournamentPLFromEvents(
				events.map((e) => ({ eventType: e.eventType, payload: e.payload })),
				tournamentBuyIn,
				entryFee
			);

			const stackStats = computeStackStats(
				events.map((e) => ({ eventType: e.eventType, payload: e.payload }))
			);

			const summary = {
				rebuyCount: pl.rebuyCount,
				rebuyCost: pl.rebuyCost,
				addonCount: pl.addonCount,
				addonCost: pl.addonCost,
				placement: pl.placement,
				totalEntries: pl.totalEntries,
				prizeMoney: pl.prizeMoney,
				bountyPrizes: pl.bountyPrizes,
				profitLoss: pl.profitLoss,
				maxStack: stackStats.maxStack,
				minStack: stackStats.minStack,
				currentStack: stackStats.currentStack,
				remainingPlayers: stackStats.remainingPlayers,
				averageStack: stackStats.averageStack,
			};

			return { ...session, events, tablePlayers, summary };
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string().optional(),
				tournamentId: z.string().optional(),
				currencyId: z.string().optional(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			await assertNoActiveSession(ctx.db, userId);

			const id = crypto.randomUUID();
			const now = new Date();

			await ctx.db.insert(liveTournamentSession).values({
				id,
				userId,
				status: "active",
				storeId: input.storeId ?? null,
				tournamentId: input.tournamentId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				updatedAt: now,
			});

			// Auto-create session_start event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: 0,
				payload: JSON.stringify({}),
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
			await findLiveTournamentSession(ctx.db, input.id, userId);

			const updateData: Partial<typeof liveTournamentSession.$inferInsert> = {
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
				.update(liveTournamentSession)
				.set(updateData)
				.where(eq(liveTournamentSession.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(liveTournamentSession)
				.where(eq(liveTournamentSession.id, input.id));

			return updated;
		}),

	complete: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				placement: z.number().int().min(1),
				totalEntries: z.number().int().min(1),
				prizeMoney: z.number().int().min(0),
				bountyPrizes: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

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
				.where(eq(sessionEvent.liveTournamentSessionId, input.id))
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);

			const nextSortOrder =
				existingEvents.length > 0 ? (existingEvents[0]?.sortOrder ?? 0) + 1 : 0;

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: input.id,
				eventType: "tournament_result",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify(
					tournamentResultPayload.parse({
						placement: input.placement,
						totalEntries: input.totalEntries,
						prizeMoney: input.prizeMoney,
						bountyPrizes: input.bountyPrizes ?? null,
					})
				),
				updatedAt: now,
			});

			// Insert session_end event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: input.id,
				eventType: "session_end",
				occurredAt: now,
				sortOrder: nextSortOrder + 1,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			await ctx.db
				.update(liveTournamentSession)
				.set({ status: "completed", endedAt: now, updatedAt: now })
				.where(eq(liveTournamentSession.id, input.id));

			const allEvents = await ctx.db
				.select({
					eventType: sessionEvent.eventType,
					payload: sessionEvent.payload,
				})
				.from(sessionEvent)
				.where(eq(sessionEvent.liveTournamentSessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const { tournamentBuyIn, entryFee } = await fetchTournamentBuyInInfo(
				ctx.db,
				session.tournamentId
			);

			const pl = computeTournamentPLFromEvents(
				allEvents,
				tournamentBuyIn,
				entryFee
			);

			const pokerSessionId = await upsertPokerSession(
				ctx.db,
				input.id,
				userId,
				session,
				tournamentBuyIn,
				entryFee,
				pl,
				now
			);

			if (session.currencyId && pl.profitLoss !== null) {
				await upsertCurrencyTransaction(
					ctx.db,
					pokerSessionId,
					session.currencyId,
					pl.profitLoss,
					session.startedAt,
					userId
				);
			}

			return { id: input.id, pokerSessionId };
		}),

	reopen: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

			if (session.status !== "completed") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only completed sessions can be reopened",
				});
			}

			await assertNoActiveSession(ctx.db, userId);

			const [linkedPokerSession] = await ctx.db
				.select({ id: pokerSession.id })
				.from(pokerSession)
				.where(eq(pokerSession.liveTournamentSessionId, input.id));

			if (linkedPokerSession) {
				await ctx.db
					.delete(currencyTransaction)
					.where(eq(currencyTransaction.sessionId, linkedPokerSession.id));

				await ctx.db
					.delete(pokerSession)
					.where(eq(pokerSession.id, linkedPokerSession.id));
			}

			const now = new Date();

			// Add new session_start event (keeps previous session_end + tournament_result in history)
			const [lastEvent] = await ctx.db
				.select({ sortOrder: sessionEvent.sortOrder })
				.from(sessionEvent)
				.where(eq(sessionEvent.liveTournamentSessionId, input.id))
				.orderBy(desc(sessionEvent.sortOrder))
				.limit(1);
			const nextSortOrder = lastEvent ? (lastEvent.sortOrder ?? 0) + 1 : 0;

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: input.id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify({}),
				updatedAt: now,
			});

			await ctx.db
				.update(liveTournamentSession)
				.set({ status: "active", endedAt: null, updatedAt: now })
				.where(eq(liveTournamentSession.id, input.id));

			return { id: input.id };
		}),

	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

			if (session.status !== "active") {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Only active sessions can be discarded",
				});
			}

			await ctx.db
				.delete(liveTournamentSession)
				.where(eq(liveTournamentSession.id, input.id));

			return { id: input.id };
		}),
});
