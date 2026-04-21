import {
	tournamentSessionEndPayload,
	updateStackPayload,
	updateTournamentInfoPayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { pokerSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { currency, store } from "@sapphire2/db/schema/store";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
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
				sql`${liveCashGameSession.status} != 'completed'`
			)
		)
		.limit(1);

	const anyActiveTournament = await db
		.select({ id: liveTournamentSession.id })
		.from(liveTournamentSession)
		.where(
			and(
				eq(liveTournamentSession.userId, userId),
				sql`${liveTournamentSession.status} != 'completed'`
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
	startingStack: number | undefined;
}> {
	if (!tournamentId) {
		return {
			tournamentBuyIn: undefined,
			entryFee: undefined,
			startingStack: undefined,
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
		startingStack: t?.startingStack ?? undefined,
	};
}

interface StackBounds {
	currentStack: number | null;
	maxStack: number | null;
	minStack: number | null;
}

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

interface TournamentInfo {
	chipPurchaseCounts: ChipPurchaseCount[];
	remainingPlayers: number | null;
	totalEntries: number | null;
}

function applyUpdateStack(payload: string, bounds: StackBounds): StackBounds {
	const parsed = updateStackPayload.safeParse(JSON.parse(payload));
	if (!parsed.success) {
		return bounds;
	}
	const stack = parsed.data.stackAmount;
	return {
		maxStack:
			bounds.maxStack === null || stack > bounds.maxStack
				? stack
				: bounds.maxStack,
		minStack:
			bounds.minStack === null || stack < bounds.minStack
				? stack
				: bounds.minStack,
		currentStack: stack,
	};
}

function applyUpdateTournamentInfo(
	payload: string,
	info: TournamentInfo
): TournamentInfo {
	const parsed = updateTournamentInfoPayload.safeParse(JSON.parse(payload));
	if (!parsed.success) {
		return info;
	}
	return {
		remainingPlayers: parsed.data.remainingPlayers ?? info.remainingPlayers,
		totalEntries: parsed.data.totalEntries ?? info.totalEntries,
		chipPurchaseCounts:
			parsed.data.chipPurchaseCounts.length > 0
				? parsed.data.chipPurchaseCounts
				: info.chipPurchaseCounts,
	};
}

function computeStackStats(
	events: { eventType: string; payload: string }[],
	startingStack?: number | null
): {
	maxStack: number | null;
	minStack: number | null;
	currentStack: number | null;
	remainingPlayers: number | null;
	totalEntries: number | null;
	averageStack: number | null;
} {
	let bounds: StackBounds = {
		maxStack: null,
		minStack: null,
		currentStack: null,
	};
	let info: TournamentInfo = {
		chipPurchaseCounts: [],
		remainingPlayers: null,
		totalEntries: null,
	};

	for (const event of events) {
		if (event.eventType === "update_stack") {
			bounds = applyUpdateStack(event.payload, bounds);
		} else if (event.eventType === "update_tournament_info") {
			info = applyUpdateTournamentInfo(event.payload, info);
		}
	}

	let averageStack: number | null = null;
	if (
		startingStack &&
		info.totalEntries &&
		info.remainingPlayers &&
		info.remainingPlayers > 0
	) {
		const chipTotal = info.chipPurchaseCounts.reduce(
			(acc, c) => acc + c.count * c.chipsPerUnit,
			0
		);
		averageStack = Math.round(
			(startingStack * info.totalEntries + chipTotal) / info.remainingPlayers
		);
	}

	return { ...bounds, ...info, averageStack };
}

async function resolveTournamentAssignment(
	db: DbInstance,
	tournamentId: string,
	userId: string,
	currentStoreId: string | null,
	currentCurrencyId: string | null
): Promise<{
	tournamentId: string;
	storeId?: string;
	currencyId?: string;
}> {
	const [foundTournament] = await db
		.select()
		.from(tournament)
		.where(eq(tournament.id, tournamentId));

	if (!foundTournament) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Tournament not found",
		});
	}

	const [foundStore] = await db
		.select()
		.from(store)
		.where(eq(store.id, foundTournament.storeId));
	if (!foundStore || foundStore.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	}

	if (currentStoreId && currentStoreId !== foundTournament.storeId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Tournament belongs to a different store than the session",
		});
	}

	const patch: {
		tournamentId: string;
		storeId?: string;
		currencyId?: string;
	} = { tournamentId };
	if (!currentStoreId) {
		patch.storeId = foundTournament.storeId;
	}
	if (!currentCurrencyId && foundTournament.currencyId) {
		patch.currencyId = foundTournament.currencyId;
	}
	return patch;
}

export const liveTournamentSessionRouter = router({
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
					startingStack: tournament.startingStack,
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
						item.startingStack
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

			const blindLevels = session.tournamentId
				? await ctx.db
						.select()
						.from(blindLevel)
						.where(eq(blindLevel.tournamentId, session.tournamentId))
						.orderBy(asc(blindLevel.level))
				: [];

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
				startingStack: masterData.startingStack ?? null,
			};

			return { ...session, events, tablePlayers, blindLevels, summary };
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
				timerStartedAt: z.number().int().optional(),
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
				timerStartedAt:
					input.timerStartedAt === undefined
						? null
						: new Date(input.timerStartedAt * 1000),
				updatedAt: now,
			});

			// Auto-create session_start event
			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: id,
				eventType: "session_start",
				occurredAt: now,
				sortOrder: 0,
				payload: JSON.stringify({
					timerStartedAt: input.timerStartedAt ?? null,
				}),
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
				tournamentId: z.string().nullable().optional(),
				timerStartedAt: z.number().int().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveTournamentSession(
				ctx.db,
				input.id,
				userId
			);

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
			if (input.timerStartedAt !== undefined) {
				updateData.timerStartedAt =
					input.timerStartedAt === null
						? null
						: new Date(input.timerStartedAt * 1000);
			}

			if (input.tournamentId === null) {
				updateData.tournamentId = null;
			} else if (input.tournamentId !== undefined) {
				const resolvedStoreId =
					updateData.storeId === undefined
						? existing.storeId
						: updateData.storeId;
				const resolvedCurrencyId =
					updateData.currencyId === undefined
						? existing.currencyId
						: updateData.currencyId;
				const patch = await resolveTournamentAssignment(
					ctx.db,
					input.tournamentId,
					userId,
					resolvedStoreId,
					resolvedCurrencyId
				);
				updateData.tournamentId = patch.tournamentId;
				if (patch.storeId) {
					updateData.storeId = patch.storeId;
				}
				if (patch.currencyId) {
					updateData.currencyId = patch.currencyId;
				}
			}

			await ctx.db
				.update(liveTournamentSession)
				.set(updateData)
				.where(eq(liveTournamentSession.id, input.id));

			// Keep the session_start event payload's timerStartedAt in sync so that
			// the event view and the column stay consistent.
			if (input.timerStartedAt !== undefined) {
				const [startEvent] = await ctx.db
					.select()
					.from(sessionEvent)
					.where(
						and(
							eq(sessionEvent.liveTournamentSessionId, input.id),
							eq(sessionEvent.eventType, "session_start")
						)
					);
				if (startEvent) {
					const existingPayload = JSON.parse(startEvent.payload) as Record<
						string,
						unknown
					>;
					await ctx.db
						.update(sessionEvent)
						.set({
							payload: JSON.stringify({
								...existingPayload,
								timerStartedAt: input.timerStartedAt ?? null,
							}),
							updatedAt: new Date(),
						})
						.where(eq(sessionEvent.id, startEvent.id));
				}
			}

			const [updated] = await ctx.db
				.select()
				.from(liveTournamentSession)
				.where(eq(liveTournamentSession.id, input.id));

			return updated;
		}),

	complete: protectedProcedure
		.input(
			z.discriminatedUnion("beforeDeadline", [
				z.object({
					id: z.string(),
					beforeDeadline: z.literal(false),
					placement: z.number().int().min(1),
					totalEntries: z.number().int().min(1),
					prizeMoney: z.number().int().min(0),
					bountyPrizes: z.number().int().min(0),
				}),
				z.object({
					id: z.string(),
					beforeDeadline: z.literal(true),
					prizeMoney: z.number().int().min(0),
					bountyPrizes: z.number().int().min(0),
				}),
			])
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

			const endPayload =
				input.beforeDeadline === false
					? tournamentSessionEndPayload.parse({
							beforeDeadline: false,
							placement: input.placement,
							totalEntries: input.totalEntries,
							prizeMoney: input.prizeMoney,
							bountyPrizes: input.bountyPrizes,
						})
					: tournamentSessionEndPayload.parse({
							beforeDeadline: true,
							prizeMoney: input.prizeMoney,
							bountyPrizes: input.bountyPrizes,
						});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				liveTournamentSessionId: input.id,
				eventType: "session_end",
				occurredAt: now,
				sortOrder: nextSortOrder,
				payload: JSON.stringify(endPayload),
				updatedAt: now,
			});

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
		.mutation(() => {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "Tournament sessions cannot be reopened after completion",
			});
		}),

	discard: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

			if (session.status === "completed") {
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
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

			const previousHeroSeat = session.heroSeatPosition;

			await ctx.db
				.update(liveTournamentSession)
				.set({ heroSeatPosition: input.heroSeatPosition })
				.where(eq(liveTournamentSession.id, input.id));

			const now = new Date();

			const getNextSortOrder = async () => {
				const [latest] = await ctx.db
					.select({ maxSort: max(sessionEvent.sortOrder) })
					.from(sessionEvent)
					.where(eq(sessionEvent.liveTournamentSessionId, input.id));
				return (latest?.maxSort ?? -1) + 1;
			};

			// Hero sitting down
			if (previousHeroSeat === null && input.heroSeatPosition !== null) {
				const sortOrder = await getNextSortOrder();
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					liveCashGameSessionId: null,
					liveTournamentSessionId: input.id,
					eventType: "player_join",
					occurredAt: now,
					sortOrder,
					payload: JSON.stringify({ isHero: true }),
					updatedAt: now,
				});
			}

			// Hero standing up
			if (previousHeroSeat !== null && input.heroSeatPosition === null) {
				const sortOrder = await getNextSortOrder();
				await ctx.db.insert(sessionEvent).values({
					id: crypto.randomUUID(),
					liveCashGameSessionId: null,
					liveTournamentSessionId: input.id,
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
