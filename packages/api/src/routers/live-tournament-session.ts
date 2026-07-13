import {
	MAX_SEAT_POSITION,
	tournamentSessionEndPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import { currency } from "@sapphire2/db/schema/currency";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { levelGamesSchema } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, max, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeHeroSeatPositionFromEvents,
	computeTournamentPLFromEvents,
	recalculateTournamentSession,
} from "../services/live-session-pl";
import { floorToMinute } from "../utils/session-event-time";
import {
	encodeSessionCursor,
	getSessionEventMap,
	persistSessionBlindLevels,
	persistSessionChipPurchases,
	resnapshotTournamentStructure,
	resolveTournamentRuleSnapshot,
	sessionKeysetCondition,
	sessionOrderKeySql,
	snapshotTournamentStructure,
	validateEntityOwnership,
	validateLiveLinkOwnership,
} from "./session";
import {
	buildTournamentCreateStatements,
	tournamentCreateWithLevelsInputSchema,
} from "./tournament";

const DEFAULT_LIMIT = 20;

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

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

	if (
		!found ||
		found.kind !== "tournament" ||
		found.source !== "live" ||
		found.userId !== userId
	) {
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

function detailSnapshotForGetById(
	detail:
		| {
				tournamentBuyIn: number | null;
				entryFee: number | null;
				startingStack: number | null;
				tableSize: number | null;
		  }
		| undefined
): {
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
	startingStack: number | undefined;
	tableSize: number | null;
} {
	if (!detail) {
		return {
			tournamentBuyIn: undefined,
			entryFee: undefined,
			startingStack: undefined,
			tableSize: null,
		};
	}
	return {
		tournamentBuyIn: detail.tournamentBuyIn ?? undefined,
		entryFee: detail.entryFee ?? undefined,
		startingStack: detail.startingStack ?? undefined,
		tableSize: detail.tableSize ?? null,
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

function applyUpdateStack(
	payload: string,
	bounds: StackBounds,
	info: TournamentInfo
): { bounds: StackBounds; info: TournamentInfo } {
	const parsed = updateStackPayload.safeParse(JSON.parse(payload));
	if (!parsed.success) {
		return { bounds, info };
	}
	const stack = parsed.data.stackAmount;
	const nextBounds: StackBounds = {
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
	const nextInfo: TournamentInfo = {
		remainingPlayers: parsed.data.remainingPlayers ?? info.remainingPlayers,
		totalEntries: parsed.data.totalEntries ?? info.totalEntries,
		chipPurchaseCounts:
			parsed.data.chipPurchaseCounts &&
			parsed.data.chipPurchaseCounts.length > 0
				? parsed.data.chipPurchaseCounts
				: info.chipPurchaseCounts,
	};
	return { bounds: nextBounds, info: nextInfo };
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
			const next = applyUpdateStack(event.payload, bounds, info);
			bounds = next.bounds;
			info = next.info;
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
	roomId?: string | null;
	currencyId?: string | null;
}): Partial<typeof gameSession.$inferInsert> {
	const updateData: Partial<typeof gameSession.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.memo !== undefined) {
		updateData.memo = input.memo;
	}
	if (input.roomId !== undefined) {
		updateData.roomId = input.roomId;
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
	existing: { roomId: string | null; currencyId: string | null },
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
		const resolvedRoomId =
			patchedUpdateData.roomId === undefined
				? existing.roomId
				: patchedUpdateData.roomId;
		const resolvedCurrencyId =
			patchedUpdateData.currencyId === undefined
				? existing.currencyId
				: patchedUpdateData.currencyId;
		const patch = await resolveTournamentAssignment(
			db,
			input.tournamentId,
			userId,
			resolvedRoomId,
			resolvedCurrencyId
		);
		detailUpdate.tournamentId = patch.tournamentId;
		if (patch.roomId) {
			patchedUpdateData.roomId = patch.roomId;
		}
		if (patch.currencyId) {
			patchedUpdateData.currencyId = patch.currencyId;
		}

		const snapshot = await resolveTournamentRuleSnapshot(db, {
			tournamentId: input.tournamentId,
		});
		detailUpdate.ruleName = snapshot.ruleName;
		detailUpdate.variant = snapshot.variant;
		detailUpdate.startingStack = snapshot.startingStack;
		detailUpdate.bountyAmount = snapshot.bountyAmount;
		detailUpdate.tableSize = snapshot.tableSize;
		detailUpdate.tournamentBuyIn = snapshot.tournamentBuyIn;
		detailUpdate.entryFee = snapshot.entryFee;
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
	currentRoomId: string | null,
	currentCurrencyId: string | null
): Promise<{
	tournamentId: string;
	roomId?: string;
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

	const [foundRoom] = await db
		.select()
		.from(room)
		.where(eq(room.id, foundTournament.roomId));
	if (!foundRoom || foundRoom.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	}

	if (currentRoomId && currentRoomId !== foundTournament.roomId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Tournament belongs to a different room than the session",
		});
	}

	const patch: {
		tournamentId: string;
		roomId?: string;
		currencyId?: string;
	} = { tournamentId };
	if (!currentRoomId) {
		patch.roomId = foundTournament.roomId;
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
			// Composite (startedAt, id) keyset — a malformed / deleted-row cursor
			// degrades to "no cursor" instead of silently emptying the page
			// (SA2-150). Shared with session.list so both stay in lockstep.
			const keyset = sessionKeysetCondition(input.cursor);
			if (keyset) {
				conditions.push(keyset);
			}

			const rows = await ctx.db
				.select({
					id: gameSession.id,
					userId: gameSession.userId,
					status: gameSession.status,
					roomId: gameSession.roomId,
					roomName: room.name,
					tournamentId: sessionTournamentDetail.tournamentId,
					tournamentName: sessionTournamentDetail.ruleName,
					startingStack: sessionTournamentDetail.startingStack,
					currencyId: gameSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					startedAt: gameSession.startedAt,
					sessionDate: gameSession.sessionDate,
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
				.leftJoin(room, eq(room.id, gameSession.roomId))
				.leftJoin(currency, eq(currency.id, gameSession.currencyId))
				.where(and(...conditions))
				.orderBy(desc(sessionOrderKeySql()), desc(gameSession.id))
				.limit(input.limit + 1);

			const hasMore = rows.length > input.limit;
			const items = hasMore ? rows.slice(0, input.limit) : rows;
			const last = items.at(-1);
			const nextCursor =
				hasMore && last ? encodeSessionCursor(last) : undefined;

			// SA2-151: fetch every page item's events in one batched inArray
			// query, then bucket by session id, instead of a per-item query
			// (an N+1 whose per-query latency dominated under D1). getSessionEventMap
			// preserves the (occurredAt, sortOrder) ordering computeStackStats needs.
			const eventMap = await getSessionEventMap(
				ctx.db,
				items.map((item) => item.id)
			);

			const enrichedItems = items.map((item) => {
				const events = eventMap.get(item.id) ?? [];
				const eventCount = events.length;
				const statsForList = computeStackStats(events, item.startingStack);

				return {
					...item,
					eventCount,
					latestStackAmount: statsForList.currentStack,
					remainingPlayers: statsForList.remainingPlayers,
					averageStack: statsForList.averageStack,
				};
			});

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

			const masterData = detailSnapshotForGetById(detail);

			const tournamentBuyIn =
				detail?.tournamentBuyIn ?? masterData.tournamentBuyIn;
			const entryFee = detail?.entryFee ?? masterData.entryFee;

			const events = await ctx.db
				.select()
				.from(sessionEvent)
				.where(eq(sessionEvent.sessionId, input.id))
				.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

			const blindLevels = await ctx.db
				.select()
				.from(sessionBlindLevel)
				.where(eq(sessionBlindLevel.sessionId, input.id))
				.orderBy(asc(sessionBlindLevel.level));

			const chipPurchases = await ctx.db
				.select()
				.from(sessionChipPurchase)
				.where(eq(sessionChipPurchase.sessionId, input.id))
				.orderBy(asc(sessionChipPurchase.sortOrder));

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
				chipPurchaseCost: pl.chipPurchaseCost,
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

			const heroSeatPosition = computeHeroSeatPositionFromEvents(
				events.map((e) => ({ eventType: e.eventType, payload: e.payload }))
			);

			return {
				...session,
				tournamentId: detail?.tournamentId ?? null,
				buyIn: detail?.tournamentBuyIn ?? null,
				entryFee: detail?.entryFee ?? null,
				timerStartedAt: detail?.timerStartedAt ?? null,
				heroSeatPosition,
				events,
				blindLevels,
				chipPurchases,
				summary,
				tableSize: masterData.tableSize,
				// Snapshot fields from session_tournament_detail. These stay
				// stable even if the parent tournament is renamed or its
				// blind/chip structure is edited after session creation.
				ruleName: detail?.ruleName ?? null,
				variant: detail?.variant ?? null,
				startingStack: detail?.startingStack ?? null,
				bountyAmount: detail?.bountyAmount ?? null,
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				roomId: z.string().optional(),
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

			await validateLiveLinkOwnership(ctx.db, input, userId);
			// Validate tournament ownership before reading its structure so a
			// caller cannot snapshot another user's blind levels / chip purchases
			// via snapshotTournamentStructure (IDOR).
			if (input.tournamentId) {
				await validateEntityOwnership(
					ctx.db,
					"tournament",
					input.tournamentId,
					userId
				);
			}

			const id = crypto.randomUUID();
			const now = new Date();

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: "tournament",
				status: "active",
				source: "live",
				roomId: input.roomId ?? null,
				currencyId: input.currencyId ?? null,
				startedAt: now,
				memo: input.memo ?? null,
				sessionDate: now,
				updatedAt: now,
			});

			const snapshot = await resolveTournamentRuleSnapshot(ctx.db, {
				tournamentId: input.tournamentId,
				tournamentBuyIn: input.buyIn,
				entryFee: input.entryFee,
			});
			await ctx.db.insert(sessionTournamentDetail).values({
				sessionId: id,
				tournamentId: input.tournamentId ?? null,
				tournamentBuyIn: snapshot.tournamentBuyIn,
				entryFee: snapshot.entryFee,
				timerStartedAt:
					input.timerStartedAt === undefined
						? null
						: new Date(input.timerStartedAt * 1000),
				ruleName: input.tournamentId ? snapshot.ruleName : "Tournament",
				variant: snapshot.variant,
				startingStack: snapshot.startingStack,
				bountyAmount: snapshot.bountyAmount,
				tableSize: snapshot.tableSize,
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

			if (input.tournamentId) {
				await snapshotTournamentStructure(ctx.db, id, input.tournamentId);
			}

			return { id };
		}),

	createAndAssignTournament: protectedProcedure
		.input(
			tournamentCreateWithLevelsInputSchema.extend({ sessionId: z.string() })
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveTournamentSession(
				ctx.db,
				input.sessionId,
				userId
			);
			await validateLiveLinkOwnership(ctx.db, input, userId);
			if (existing.roomId && existing.roomId !== input.roomId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Tournament belongs to a different room than the session",
				});
			}

			const now = new Date();
			const tournamentId = crypto.randomUUID();
			const blindLevels = input.blindLevels ?? [];
			const chipPurchases = input.chipPurchases ?? [];

			const sessionUpdate: Partial<typeof gameSession.$inferInsert> = {
				updatedAt: now,
			};
			if (!existing.roomId) {
				sessionUpdate.roomId = input.roomId;
			}
			if (!existing.currencyId && input.currencyId) {
				sessionUpdate.currencyId = input.currencyId;
			}
			const detailSnapshot = {
				tournamentId,
				tournamentBuyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
				ruleName: input.name,
				variant: input.variant,
				startingStack: input.startingStack ?? null,
				bountyAmount: input.bountyAmount ?? null,
				tableSize: input.tableSize ?? null,
			};
			// The FK-checked upsert is intentionally in the same batch as the master
			// insert. A concurrent session deletion therefore makes the whole batch
			// fail instead of committing an orphan tournament.
			const detailStatement = ctx.db
				.insert(sessionTournamentDetail)
				.values({
					sessionId: input.sessionId,
					...detailSnapshot,
				})
				.onConflictDoUpdate({
					target: sessionTournamentDetail.sessionId,
					set: detailSnapshot,
				});

			const sessionPurchaseRows = chipPurchases.map((purchase, sortOrder) => ({
				id: crypto.randomUUID(),
				sessionId: input.sessionId,
				name: purchase.name,
				cost: purchase.cost,
				chips: purchase.chips,
				sortOrder,
			}));
			const statements: [BatchStatement, ...BatchStatement[]] = [
				...buildTournamentCreateStatements(ctx.db, {
					id: tournamentId,
					input,
					now,
				}),
				ctx.db
					.update(gameSession)
					.set(sessionUpdate)
					.where(
						and(
							eq(gameSession.id, input.sessionId),
							eq(gameSession.userId, userId),
							eq(gameSession.kind, "tournament"),
							eq(gameSession.source, "live")
						)
					),
				detailStatement,
				ctx.db
					.delete(sessionBlindLevel)
					.where(eq(sessionBlindLevel.sessionId, input.sessionId)),
				ctx.db
					.delete(sessionChipPurchase)
					.where(eq(sessionChipPurchase.sessionId, input.sessionId)),
				...blindLevels.map((level, index) =>
					ctx.db.insert(sessionBlindLevel).values({
						id: crypto.randomUUID(),
						sessionId: input.sessionId,
						level: index + 1,
						isBreak: level.isBreak,
						blind1: level.blind1 ?? null,
						blind2: level.blind2 ?? null,
						blind3: level.blind3 ?? null,
						ante: level.ante ?? null,
						minutes: level.minutes ?? null,
						games: level.games ?? null,
					})
				),
				...sessionPurchaseRows.map((row) =>
					ctx.db.insert(sessionChipPurchase).values(row)
				),
				...sessionPurchaseRows.map((row) =>
					ctx.db.insert(sessionChipPurchaseResult).values({
						sessionChipPurchaseId: row.id,
						count: 0,
					})
				),
			];
			await ctx.db.batch(statements);

			return { sessionId: input.sessionId, tournamentId };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				memo: z.string().nullable().optional(),
				roomId: z.string().nullable().optional(),
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

			await validateLiveLinkOwnership(ctx.db, input, userId);

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

			// Re-snapshot blind levels / chip purchases when the parent link
			// changes to a new tournament. `null` keeps the existing snapshot.
			if (input.tournamentId) {
				await resnapshotTournamentStructure(
					ctx.db,
					input.id,
					input.tournamentId
				);
			}

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

	// Edit the session's frozen rule snapshot — scalar fields on
	// session_tournament_detail, plus optional full-list replacements of
	// session_blind_level and session_chip_purchase. The master tournament
	// is NEVER touched by this mutation. Use it from the live-session edit
	// dialog to override snapshot data for this session only.
	updateSnapshot: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				ruleName: z.string().min(1).optional(),
				variant: z.string().optional(),
				tournamentBuyIn: z.number().int().nullable().optional(),
				entryFee: z.number().int().nullable().optional(),
				startingStack: z.number().int().nullable().optional(),
				bountyAmount: z.number().int().nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				blindLevels: z
					.array(
						z.object({
							isBreak: z.boolean(),
							blind1: z.number().int().nullable().optional(),
							blind2: z.number().int().nullable().optional(),
							blind3: z.number().int().nullable().optional(),
							ante: z.number().int().nullable().optional(),
							minutes: z.number().int().nullable().optional(),
							games: levelGamesSchema.nullish(),
						})
					)
					.optional(),
				chipPurchases: z
					.array(
						z.object({
							name: z.string(),
							cost: z.number().int(),
							chips: z.number().int(),
						})
					)
					.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveTournamentSession(ctx.db, input.id, userId);

			const detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> =
				{};
			if (input.ruleName !== undefined) {
				detailUpdate.ruleName = input.ruleName;
			}
			if (input.variant !== undefined) {
				detailUpdate.variant = input.variant;
			}
			if (input.tournamentBuyIn !== undefined) {
				detailUpdate.tournamentBuyIn = input.tournamentBuyIn;
			}
			if (input.entryFee !== undefined) {
				detailUpdate.entryFee = input.entryFee;
			}
			if (input.startingStack !== undefined) {
				detailUpdate.startingStack = input.startingStack;
			}
			if (input.bountyAmount !== undefined) {
				detailUpdate.bountyAmount = input.bountyAmount;
			}
			if (input.tableSize !== undefined) {
				detailUpdate.tableSize = input.tableSize;
			}
			if (Object.keys(detailUpdate).length > 0) {
				await ctx.db
					.update(sessionTournamentDetail)
					.set(detailUpdate)
					.where(eq(sessionTournamentDetail.sessionId, input.id));
			}

			if (input.blindLevels !== undefined) {
				// Reuse the shared helper so the DELETE + re-INSERT is chunked
				// under D1's 100 bound-parameter cap (9 columns/row => 11 rows
				// max per INSERT). A single unchunked INSERT of >=12 levels
				// overflows and throws AFTER the DELETE commits, permanently
				// wiping the session's blind structure (SA2-115).
				await persistSessionBlindLevels(ctx.db, input.id, input.blindLevels);
			}

			if (input.chipPurchases !== undefined) {
				// Editing the live session's rule snapshot. Counts are derived
				// from purchase_chips events, so each chip purchase is (re)seeded
				// with a result row at count 0; recalculateTournamentSession
				// overwrites the counts on completion.
				await persistSessionChipPurchases(
					ctx.db,
					input.id,
					input.chipPurchases.map((p) => ({ ...p, count: 0 }))
				);
			}

			return { id: input.id };
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
			await findLiveTournamentSession(ctx.db, input.id, userId);

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
