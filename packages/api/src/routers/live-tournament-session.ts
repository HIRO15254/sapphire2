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
} from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeTournamentPLFromEvents,
	recalculateTournamentSession,
} from "../services/live-session-pl";

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

async function fetchTournamentMasterData(
	db: DbInstance,
	tournamentId: string | null
): Promise<{
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
	startingStack: number | null;
}> {
	if (!tournamentId) {
		return {
			tournamentBuyIn: undefined,
			entryFee: undefined,
			startingStack: null,
		};
	}
	const [t] = await db
		.select({
			buyIn: tournament.buyIn,
			entryFee: tournament.entryFee,
			startingStack: tournament.startingStack,
		})
		.from(tournament)
		.where(eq(tournament.id, tournamentId));
	return {
		tournamentBuyIn: t?.buyIn ?? undefined,
		entryFee: t?.entryFee ?? undefined,
		startingStack: t?.startingStack ?? null,
	};
}

function computeStackStats(
	events: { eventType: string; payload: string }[],
	startingStack: number | null
): {
	maxStack: number | null;
	minStack: number | null;
	currentStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
	averageStack: number | null;
} {
	let maxStack: number | null = null;
	let minStack: number | null = null;
	let currentStack: number | null = null;
	let remainingPlayers: number | null = null;
	let totalEntries: number | null = null;
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
		if (parsed.data.remainingPlayers !== null) {
			remainingPlayers = parsed.data.remainingPlayers;
		}
		if (parsed.data.totalEntries !== null) {
			totalEntries = parsed.data.totalEntries;
		}

		// Auto-calculate averageStack from chipPurchaseCounts
		averageStack = computeAverageStack(
			totalEntries,
			startingStack,
			remainingPlayers,
			parsed.data.chipPurchaseCounts
		);

		// Legacy fallback
		if (averageStack === null && parsed.data.averageStack !== undefined) {
			averageStack = parsed.data.averageStack ?? null;
		}
	}

	return {
		maxStack,
		minStack,
		currentStack,
		remainingPlayers,
		totalEntries,
		averageStack,
	};
}

function computeAverageStack(
	totalEntries: number | null,
	startingStack: number | null,
	remainingPlayers: number | null,
	chipPurchaseCounts: Array<{
		name: string;
		count: number;
		chipsPerUnit: number;
	}>
): number | null {
	if (!(totalEntries && startingStack && remainingPlayers)) {
		return null;
	}
	let totalChips = totalEntries * startingStack;
	for (const cp of chipPurchaseCounts) {
		totalChips += cp.count * cp.chipsPerUnit;
	}
	return Math.round(totalChips / remainingPlayers);
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
					const statsForList = computeStackStats(
						events.map((e) => ({
							eventType: e.eventType,
							payload: e.payload,
						})),
						null // startingStack not available in list view
					);

					return {
						...item,
						eventCount,
						latestStackAmount: statsForList.currentStack,
						remainingPlayers: statsForList.remainingPlayers,
						averageStack: statsForList.averageStack,
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

			const masterData = await fetchTournamentMasterData(
				ctx.db,
				session.tournamentId
			);

			// Session-level buyIn/entryFee take precedence over tournament master data
			const tournamentBuyIn = session.buyIn ?? masterData.tournamentBuyIn;
			const entryFee = session.entryFee ?? masterData.entryFee;

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
				events.map((e) => ({ eventType: e.eventType, payload: e.payload })),
				masterData.startingStack
			);

			const summary = {
				buyIn: tournamentBuyIn ?? null,
				entryFee: entryFee ?? null,
				rebuyCount: pl.rebuyCount,
				rebuyCost: pl.rebuyCost,
				addonCount: pl.addonCount,
				addonCost: pl.addonCost,
				placement: pl.placement,
				totalEntries: stackStats.totalEntries ?? pl.totalEntries,
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
				buyIn: z.number().int().min(0).optional(),
				entryFee: z.number().int().min(0).optional(),
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
				buyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
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

			await recalculateTournamentSession(ctx.db, input.id, userId);

			const [linkedPokerSession] = await ctx.db
				.select({ id: pokerSession.id })
				.from(pokerSession)
				.where(eq(pokerSession.liveTournamentSessionId, input.id));

			const pokerSessionId = linkedPokerSession?.id ?? null;

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

	updateHeroSeat: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				heroSeatPosition: z.number().int().min(0).max(8).nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveTournamentSession(ctx.db, input.id, userId);

			await ctx.db
				.update(liveTournamentSession)
				.set({ heroSeatPosition: input.heroSeatPosition })
				.where(eq(liveTournamentSession.id, input.id));

			return { id: input.id };
		}),
});
