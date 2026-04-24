import {
	tournamentSessionEndPayload,
	updateStackPayload,
	updateTournamentInfoPayload,
} from "@sapphire2/db/constants/session-event-types";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTablePlayer } from "@sapphire2/db/schema/session-table-player";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
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
import { floorToMinute } from "../utils/session-event-time";

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
		.from(gameSession)
		.where(
			and(
				eq(gameSession.id, id),
				eq(gameSession.kind, "tournament"),
				eq(gameSession.source, "live")
			)
		);

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
	const anyActive = await db
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
}

async function fetchTournamentMasterData(
	db: DbInstance,
	tournamentId: string | null
): Promise<{
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
	startingStack: number | undefined;
	tableSize: number | null;
}> {
	if (!tournamentId) {
		return {
			tournamentBuyIn: undefined,
			entryFee: undefined,
			startingStack: undefined,
			tableSize: null,
		};
	}
	const [t] = await db
		.select({
			buyIn: tournament.buyIn,
			entryFee: tournament.entryFee,
			startingStack: tournament.startingStack,
			tableSize: tournament.tableSize,
		})
		.from(tournament)
		.where(eq(tournament.id, tournamentId));
	return {
		tournamentBuyIn: t?.buyIn ?? undefined,
		entryFee: t?.entryFee ?? undefined,
		startingStack: t?.startingStack ?? undefined,
		tableSize: t?.tableSize ?? null,
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

function buildLiveSessionUpdateData(input: {
	memo?: string | null;
	storeId?: string | null;
	currencyId?: string | null;
}): Partial<typeof gameSession.$inferInsert> {
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
	return updateData;
}

async function resolveDetailUpdate(
	db: DbInstance,
	input: {
		tournamentId?: string | null;
		timerStartedAt?: number | null;
	},
	updateData: Partial<typeof gameSession.$inferInsert>,
	existing: { storeId: string | null; currencyId: string | null },
	userId: string
): Promise<{
	detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>;
	patchedUpdateData: Partial<typeof gameSession.$inferInsert>;
}> {
	const detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	const patchedUpdateData = { ...updateData };

	if (input.timerStartedAt !== undefined) {
		detailUpdate.timerStartedAt =
			input.timerStartedAt === null
				? null
				: new Date(input.timerStartedAt * 1000);
	}

	if (input.tournamentId === null) {
		detailUpdate.tournamentId = null;
	} else if (input.tournamentId !== undefined) {
		const resolvedStoreId =
			patchedUpdateData.storeId === undefined
				? existing.storeId
				: patchedUpdateData.storeId;
		const resolvedCurrencyId =
			patchedUpdateData.currencyId === undefined
				? existing.currencyId
				: patchedUpdateData.currencyId;
		const patch = await resolveTournamentAssignment(
			db,
			input.tournamentId,
			userId,
			resolvedStoreId,
			resolvedCurrencyId
		);
		detailUpdate.tournamentId = patch.tournamentId;
		if (patch.storeId) {
			patchedUpdateData.storeId = patch.storeId;
		}
		if (patch.currencyId) {
			patchedUpdateData.currencyId = patch.currencyId;
		}
	}

	return { detailUpdate, patchedUpdateData };
}

async function upsertLiveTournamentDetail(
	db: DbInstance,
	sessionId: string,
	existingDetail: { sessionId: string } | undefined,
	detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>
): Promise<void> {
	if (Object.keys(detailUpdate).length === 0) {
		return;
	}
	if (existingDetail) {
		await db
			.update(sessionTournamentDetail)
			.set(detailUpdate)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	} else {
		await db.insert(sessionTournamentDetail).values({
			sessionId,
			...detailUpdate,
		});
	}
}

async function syncTimerStartedAtEvent(
	db: DbInstance,
	sessionId: string,
	timerStartedAt: number | null | undefined
): Promise<void> {
	if (timerStartedAt === undefined) {
		return;
	}
	const [startEvent] = await db
		.select()
		.from(sessionEvent)
		.where(
			and(
				eq(sessionEvent.sessionId, sessionId),
				eq(sessionEvent.eventType, "session_start")
			)
		);
	if (!startEvent) {
		return;
	}
	const existingPayload = JSON.parse(startEvent.payload) as Record<
		string,
		unknown
	>;
	await db
		.update(sessionEvent)
		.set({
			payload: JSON.stringify({
				...existingPayload,
				timerStartedAt: timerStartedAt ?? null,
			}),
			updatedAt: new Date(),
		})
		.where(eq(sessionEvent.id, startEvent.id));
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

async function getNextEventSortOrder(
	db: DbInstance,
	sessionId: string
): Promise<number> {
	const [latest] = await db
		.select({ sortOrder: sessionEvent.sortOrder })
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(desc(sessionEvent.sortOrder))
		.limit(1);
	return latest ? (latest.sortOrder ?? 0) + 1 : 0;
}

type CompleteInput =
	| {
			id: string;
			beforeDeadline: false;
			placement: number;
			totalEntries: number;
			prizeMoney: number;
			bountyPrizes: number;
	  }
	| {
			id: string;
			beforeDeadline: true;
			prizeMoney: number;
			bountyPrizes: number;
	  };

function buildTournamentEndPayload(input: CompleteInput) {
	if (input.beforeDeadline === false) {
		return tournamentSessionEndPayload.parse({
			beforeDeadline: false,
			placement: input.placement,
			totalEntries: input.totalEntries,
			prizeMoney: input.prizeMoney,
			bountyPrizes: input.bountyPrizes,
		});
	}
	return tournamentSessionEndPayload.parse({
		beforeDeadline: true,
		prizeMoney: input.prizeMoney,
		bountyPrizes: input.bountyPrizes,
	});
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

			const conditions = [
				eq(gameSession.userId, userId),
				eq(gameSession.kind, "tournament"),
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
					tournamentId: sessionTournamentDetail.tournamentId,
					tournamentName: tournament.name,
					startingStack: tournament.startingStack,
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
					sessionTournamentDetail,
					eq(sessionTournamentDetail.sessionId, gameSession.id)
				)
				.leftJoin(store, eq(store.id, gameSession.storeId))
				.leftJoin(
					tournament,
					eq(tournament.id, sessionTournamentDetail.tournamentId)
				)
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

			const [detail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			const masterData = await fetchTournamentMasterData(
				ctx.db,
				detail?.tournamentId ?? null
			);

			const tournamentBuyIn =
				detail?.tournamentBuyIn ?? masterData.tournamentBuyIn;
			const entryFee = detail?.entryFee ?? masterData.entryFee;

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(asc(sessionEvent.sortOrder));

			const tablePlayers = await ctx.db
				.select()
				.from(sessionTablePlayer)
				.where(eq(sessionTablePlayer.sessionId, input.id));

			const blindLevels = detail?.tournamentId
				? await ctx.db
						.select()
						.from(blindLevel)
						.where(eq(blindLevel.tournamentId, detail.tournamentId))
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

			return {
				...session,
				tournamentId: detail?.tournamentId ?? null,
				buyIn: detail?.tournamentBuyIn ?? null,
				entryFee: detail?.entryFee ?? null,
				timerStartedAt: detail?.timerStartedAt ?? null,
				heroSeatPosition: session.heroSeatPosition ?? null,
				events,
				tablePlayers,
				blindLevels,
				summary,
				tableSize: masterData.tableSize,
			};
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

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: "tournament",
				status: "active",
				source: "live",
				storeId: input.storeId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				sessionDate: now,
				updatedAt: now,
			});

			await ctx.db.insert(sessionTournamentDetail).values({
				sessionId: id,
				tournamentId: input.tournamentId ?? null,
				tournamentBuyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
				timerStartedAt:
					input.timerStartedAt === undefined
						? null
						: new Date(input.timerStartedAt * 1000),
			});

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: id,
				eventType: "session_start",
				occurredAt: floorToMinute(now),
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

			const [existingDetail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			const baseUpdateData = buildLiveSessionUpdateData(input);
			const { detailUpdate, patchedUpdateData } = await resolveDetailUpdate(
				ctx.db,
				input,
				baseUpdateData,
				existing,
				userId
			);

			await ctx.db
				.update(gameSession)
				.set(patchedUpdateData)
				.where(eq(gameSession.id, input.id));

			await upsertLiveTournamentDetail(
				ctx.db,
				input.id,
				existingDetail,
				detailUpdate
			);

			await syncTimerStartedAtEvent(ctx.db, input.id, input.timerStartedAt);

			const [updated] = await ctx.db
				.select()
				.from(gameSession)
				.where(eq(gameSession.id, input.id));

			const [updatedDetail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			return {
				...updated,
				tournamentId: updatedDetail?.tournamentId ?? null,
				buyIn: updatedDetail?.tournamentBuyIn ?? null,
				entryFee: updatedDetail?.entryFee ?? null,
				timerStartedAt: updatedDetail?.timerStartedAt ?? null,
			};
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
			const nextSortOrder = await getNextEventSortOrder(ctx.db, input.id);
			const endPayload = buildTournamentEndPayload(input);

			await ctx.db.insert(sessionEvent).values({
				id: crypto.randomUUID(),
				sessionId: input.id,
				eventType: "session_end",
				occurredAt: floorToMinute(now),
				sortOrder: nextSortOrder,
				payload: JSON.stringify(endPayload),
				updatedAt: now,
			});

			await recalculateTournamentSession(ctx.db, input.id, userId);

			return { id: input.id, pokerSessionId: input.id };
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
			const session = await findLiveTournamentSession(ctx.db, input.id, userId);

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
					occurredAt: floorToMinute(now),
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
					occurredAt: floorToMinute(now),
					sortOrder,
					payload: JSON.stringify({ isHero: true }),
					updatedAt: now,
				});
			}

			return { id: input.id };
		}),
});
