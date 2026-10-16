import {
	MAX_SEAT_POSITION,
	tournamentSessionEndPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";
import {
	entry,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { room } from "@sapphire2/db/schema/room";
import type { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { levelGamesSchema } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, ne } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { runBatch } from "../lib/batch";
import {
	ACTIVE_SESSION_CONFLICT_MESSAGE,
	runUnfinishedLiveSessionWrite,
} from "../lib/db-errors";
import {
	findLiveTournamentEntrySession,
	getPlayEventMap,
	type LegacySessionEventRow,
	listEntryPlayEvents,
	listLiveTournamentEntryRows,
} from "../services/entry-live-reads";
import {
	applyEntryEventChange,
	buildLiveEntryStartStatements,
	type EntryEventChange,
	updateEntryHeroSeat,
} from "../services/entry-live-writes";
import {
	buildEntryDeleteStatements,
	legacySessionDateSql,
} from "../services/entry-session";
import { assertLevelGameStructures } from "../services/game-structure";
import {
	computeHeroSeatPositionFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";
import {
	assertHandTrackingEditable,
	buildHandTrackingStatements,
	buildLiveSessionUpdateData,
	dealerSeatSchema,
	handCountSchema,
} from "../utils/live-session-update";
import { assertSeatPositionFitsTableSize } from "../utils/seat-position";
import { floorToMinute } from "../utils/session-event-time";
import {
	buildSessionBlindLevelStatements,
	buildSessionChipPurchaseStatements,
	buildTournamentStructureReplacementStatements,
	buildTournamentStructureStatements,
	encodeSessionCursor,
	resolveTournamentRuleSnapshot,
	sessionKeysetCondition,
	validateEntityOwnership,
	validateLiveLinkOwnership,
} from "./session";
import {
	buildTournamentCreateStatements,
	tournamentCreateWithLevelsInputSchema,
} from "./tournament";

const DEFAULT_LIMIT = 20;
const nonnegativeSafeIntegerSchema = z
	.number()
	.int()
	.min(0)
	.max(Number.MAX_SAFE_INTEGER);
const nullableNonnegativeSafeIntegerSchema = nonnegativeSafeIntegerSchema
	.nullable()
	.optional();
const nullableTableSizeSchema = z
	.number()
	.int()
	.min(2)
	.max(10)
	.nullable()
	.optional();

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

const LIVE_TOURNAMENT_SESSION_FORBIDDEN_MESSAGE =
	"You do not own this live tournament session";

const tournamentDetailColumns = {
	sessionId: sessionTournamentDetail.sessionId,
	tournamentBuyIn: sessionTournamentDetail.tournamentBuyIn,
	entryFee: sessionTournamentDetail.entryFee,
	prizeMoney: sessionTournamentDetail.prizeMoney,
	bountyPrizes: sessionTournamentDetail.bountyPrizes,
	ruleName: sessionTournamentDetail.ruleName,
	variant: sessionTournamentDetail.variant,
	startingStack: sessionTournamentDetail.startingStack,
	bountyAmount: sessionTournamentDetail.bountyAmount,
	tableSize: sessionTournamentDetail.tableSize,
	houseRules: sessionTournamentDetail.houseRules,
};

type TournamentDetail = Pick<
	typeof sessionTournamentDetail.$inferSelect,
	keyof typeof tournamentDetailColumns
>;

const liveTournamentSessionListInput = z.object({
	status: z.enum(["active", "paused", "completed"]).optional(),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(DEFAULT_LIMIT),
});

async function findLiveTournamentSession(
	db: DbInstance,
	id: string,
	userId: string
) {
	const found = await findLiveTournamentEntrySession(db, userId, id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: LIVE_TOURNAMENT_SESSION_FORBIDDEN_MESSAGE,
		});
	}

	return found.session;
}

async function assertNoActiveSession(
	db: DbInstance,
	userId: string
): Promise<void> {
	const anyActive = await db
		.select({ id: playSession.id })
		.from(playSession)
		.where(and(eq(playSession.userId, userId), ne(playSession.status, "ended")))
		.limit(1);

	if (anyActive.length > 0) {
		throw new TRPCError({
			code: "CONFLICT",
			message: ACTIVE_SESSION_CONFLICT_MESSAGE,
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

async function assembleLiveTournamentListPage<
	Row extends {
		id: string;
		sessionDate: Date;
		startedAt: Date | null;
		startingStack: number | null;
	},
>(
	rows: Row[],
	limit: number,
	loadEvents: (
		ids: string[]
	) => Promise<Map<string, { eventType: string; payload: string }[]>>
) {
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;
	const last = items.at(-1);
	const nextCursor = hasMore && last ? encodeSessionCursor(last) : undefined;

	const eventMap = await loadEvents(items.map((item) => item.id));

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
}

async function assembleLiveTournamentSession(
	db: DbInstance,
	session: typeof gameSession.$inferSelect,
	moved: { timerStartedAt: Date | null; tournamentId: string | null },
	detail: TournamentDetail | undefined,
	events: LegacySessionEventRow[]
) {
	const masterData = detailSnapshotForGetById(detail);

	const tournamentBuyIn = detail?.tournamentBuyIn ?? masterData.tournamentBuyIn;
	const entryFee = detail?.entryFee ?? masterData.entryFee;

	const blindLevels = await db
		.select()
		.from(sessionBlindLevel)
		.where(eq(sessionBlindLevel.sessionId, session.id))
		.orderBy(asc(sessionBlindLevel.level));

	const chipPurchases = await db
		.select()
		.from(sessionChipPurchase)
		.where(eq(sessionChipPurchase.sessionId, session.id))
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
		tournamentId: moved.tournamentId,
		buyIn: detail?.tournamentBuyIn ?? null,
		entryFee: detail?.entryFee ?? null,
		timerStartedAt: moved.timerStartedAt,
		heroSeatPosition,
		events,
		blindLevels,
		chipPurchases,
		summary,
		tableSize: masterData.tableSize,
		ruleName: detail?.ruleName ?? null,
		variant: detail?.variant ?? null,
		startingStack: detail?.startingStack ?? null,
		bountyAmount: detail?.bountyAmount ?? null,
		houseRules: detail?.houseRules ?? null,
	};
}

async function listLiveTournamentSessions(
	db: DbInstance,
	userId: string,
	input: z.output<typeof liveTournamentSessionListInput>
) {
	const rows = await listLiveTournamentEntryRows(db, userId, {
		status: input.status,
		keyset: sessionKeysetCondition(
			input.cursor,
			legacySessionDateSql(),
			entry.id
		),
		limit: input.limit + 1,
	});
	return assembleLiveTournamentListPage(rows, input.limit, (ids) =>
		getPlayEventMap(db, userId, ids)
	);
}

async function getLiveTournamentSession(
	db: DbInstance,
	userId: string,
	input: { id: string }
) {
	const found = await findLiveTournamentEntrySession(db, userId, input.id);
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: LIVE_TOURNAMENT_SESSION_FORBIDDEN_MESSAGE,
		});
	}
	const [detail] = await db
		.select(tournamentDetailColumns)
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, input.id));
	const events = await listEntryPlayEvents(db, userId, input.id);
	return assembleLiveTournamentSession(
		db,
		found.session,
		{ tournamentId: found.tournamentId, timerStartedAt: found.timerStartedAt },
		detail,
		events
	);
}

async function resolveDetailUpdate(
	db: DbInstance,
	input: {
		keepSnapshot?: boolean;
		tournamentId?: string | null;
		timerStartedAt?: number | null;
	},
	updateData: Partial<typeof entry.$inferInsert>,
	existing: { roomId: string | null; currencyId: string | null },
	userId: string
): Promise<{
	detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>;
	patchedUpdateData: Partial<typeof entry.$inferInsert>;
	entryTournamentUpdate: Partial<typeof entryTournament.$inferInsert>;
}> {
	const detailUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	const patchedUpdateData = { ...updateData };

	const entryTournamentUpdate: Partial<typeof entryTournament.$inferInsert> =
		{};

	if (input.tournamentId === null) {
		entryTournamentUpdate.tournamentId = null;
	} else if (input.tournamentId !== undefined) {
		const resolvedRoomId =
			patchedUpdateData.roomId === undefined
				? existing.roomId
				: patchedUpdateData.roomId;
		const resolvedCurrencyId =
			patchedUpdateData.assetId === undefined
				? existing.currencyId
				: patchedUpdateData.assetId;
		const patch = await resolveTournamentAssignment(
			db,
			input.tournamentId,
			userId,
			resolvedRoomId,
			resolvedCurrencyId
		);
		entryTournamentUpdate.tournamentId = patch.tournamentId;
		if (patch.roomId) {
			patchedUpdateData.roomId = patch.roomId;
		}
		if (patch.currencyId) {
			patchedUpdateData.assetId = patch.currencyId;
		}

		if (!input.keepSnapshot) {
			const snapshot = await resolveTournamentRuleSnapshot(db, {
				tournamentId: input.tournamentId,
			});
			detailUpdate.ruleName = snapshot.ruleName;
			detailUpdate.variant = snapshot.variant;
			detailUpdate.startingStack = snapshot.startingStack;
			detailUpdate.bountyAmount = snapshot.bountyAmount;
			detailUpdate.tableSize = snapshot.tableSize;
			detailUpdate.houseRules = snapshot.houseRules;
			detailUpdate.tournamentBuyIn = snapshot.tournamentBuyIn;
			detailUpdate.entryFee = snapshot.entryFee;
		}
	}

	return { detailUpdate, patchedUpdateData, entryTournamentUpdate };
}

async function timerStartedAtEventChange(
	db: DbInstance,
	userId: string,
	sessionId: string,
	timerStartedAt: number | null | undefined
): Promise<EntryEventChange[]> {
	if (timerStartedAt === undefined) {
		return [];
	}
	const startEvent = (await listEntryPlayEvents(db, userId, sessionId)).find(
		(event) => event.eventType === "session_start"
	);
	if (!startEvent) {
		throw new TRPCError({
			code: "PRECONDITION_FAILED",
			message: "Session start event not found",
		});
	}
	return [
		{
			op: "update",
			id: startEvent.id,
			payload: { ...JSON.parse(startEvent.payload), timerStartedAt },
		},
	];
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
		.select({
			roomId: tournament.roomId,
			currencyId: tournament.currencyId,
		})
		.from(tournament)
		.innerJoin(
			room,
			and(eq(room.id, tournament.roomId), eq(room.userId, userId))
		)
		.where(and(eq(tournament.id, tournamentId), eq(tournament.userId, userId)));

	if (!foundTournament) {
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

const liveTournamentCompleteInputSchema = z
	.object({ id: z.string() })
	.and(tournamentSessionEndPayload);

export const liveTournamentSessionRouter = router({
	list: protectedProcedure
		.input(liveTournamentSessionListInput)
		.query(({ ctx, input }) =>
			listLiveTournamentSessions(ctx.db, ctx.session.user.id, input)
		),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(({ ctx, input }) =>
			getLiveTournamentSession(ctx.db, ctx.session.user.id, input)
		),

	create: protectedProcedure
		.input(
			z.object({
				roomId: z.string().min(1).optional(),
				tournamentId: z.string().min(1).optional(),
				currencyId: z.string().min(1).optional(),
				buyIn: z.number().int().min(0).optional(),
				entryFee: z.number().int().min(0).optional(),
				memo: z.string().optional(),
				timerStartedAt: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			await validateLiveLinkOwnership(ctx.db, input, userId);
			if (input.tournamentId) {
				await validateEntityOwnership(
					ctx.db,
					"tournament",
					input.tournamentId,
					userId
				);
			}
			await assertNoActiveSession(ctx.db, userId);

			const id = crypto.randomUUID();
			const now = new Date();

			const snapshot = await resolveTournamentRuleSnapshot(ctx.db, {
				tournamentId: input.tournamentId,
				tournamentBuyIn: input.buyIn,
				entryFee: input.entryFee,
			});
			const structureStatements = input.tournamentId
				? await buildTournamentStructureStatements(
						ctx.db,
						id,
						input.tournamentId
					)
				: [];

			await runUnfinishedLiveSessionWrite(() =>
				runBatch(ctx.db, [
					...buildLiveEntryStartStatements(ctx.db, {
						id,
						userId,
						now,
						detail: {
							kind: "tournament",
							tournamentId: input.tournamentId ?? null,
							buyIn: snapshot.tournamentBuyIn ?? null,
							entryFee: snapshot.entryFee ?? null,
						},
						assetId: input.currencyId ?? null,
						roomId: input.roomId ?? null,
						memo: input.memo ?? null,
						title: null,
						localDate: new Date(now.getTime() + 9 * 60 * 60 * 1000)
							.toISOString()
							.slice(0, 10),
						startEvent: {
							occurredAt: floorToMinute(now),
							payload: { timerStartedAt: input.timerStartedAt ?? null },
						},
					}),
					ctx.db.insert(sessionTournamentDetail).values({
						sessionId: id,
						tournamentBuyIn: snapshot.tournamentBuyIn,
						entryFee: snapshot.entryFee,
						ruleName: input.tournamentId ? snapshot.ruleName : "Tournament",
						variant: snapshot.variant,
						startingStack: snapshot.startingStack,
						bountyAmount: snapshot.bountyAmount,
						tableSize: snapshot.tableSize,
						houseRules: snapshot.houseRules,
					}),
					...structureStatements,
				])
			);

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

			const sessionUpdate: Partial<typeof entry.$inferInsert> = {
				updatedAt: now,
			};
			if (!existing.roomId) {
				sessionUpdate.roomId = input.roomId;
			}
			if (!existing.currencyId && input.currencyId) {
				sessionUpdate.assetId = input.currencyId;
			}
			const detailSnapshot = {
				tournamentBuyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
				ruleName: input.name,
				variant: input.variant,
				startingStack: input.startingStack ?? null,
				bountyAmount: input.bountyAmount ?? null,
				tableSize: input.tableSize ?? null,
				houseRules: input.houseRules ?? null,
			};
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
					userId,
				}),
				ctx.db
					.update(entry)
					.set(sessionUpdate)
					.where(and(eq(entry.id, input.sessionId), eq(entry.userId, userId))),
				ctx.db
					.update(entryTournament)
					.set({ tournamentId })
					.where(
						and(
							eq(entryTournament.entryId, input.sessionId),
							eq(entryTournament.userId, userId)
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
			await applyEntryEventChange(
				ctx.db,
				userId,
				input.sessionId,
				[],
				now,
				statements,
				{
					assetId: sessionUpdate.assetId,
					tournamentId,
					tournamentBuyIn: detailSnapshot.tournamentBuyIn,
					entryFee: detailSnapshot.entryFee,
				}
			);

			return { sessionId: input.sessionId, tournamentId };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				memo: z.string().nullable().optional(),
				roomId: z.string().min(1).nullable().optional(),
				currencyId: z.string().min(1).nullable().optional(),
				tournamentId: z.string().min(1).nullable().optional(),
				keepSnapshot: z.boolean().optional(),
				timerStartedAt: z.number().int().nullable().optional(),
				handCount: handCountSchema,
				dealerSeat: dealerSeatSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const existing = await findLiveTournamentSession(
				ctx.db,
				input.id,
				userId
			);
			await assertHandTrackingEditable(ctx.db, userId, input.id, input);

			const [existingDetail] = await ctx.db
				.select(tournamentDetailColumns)
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			await validateLiveLinkOwnership(ctx.db, input, userId);

			const baseUpdateData = buildLiveSessionUpdateData(input);
			const { detailUpdate, patchedUpdateData, entryTournamentUpdate } =
				await resolveDetailUpdate(
					ctx.db,
					input,
					baseUpdateData,
					existing,
					userId
				);

			const statements: BatchStatement[] = [
				ctx.db
					.update(entry)
					.set(patchedUpdateData)
					.where(and(eq(entry.id, input.id), eq(entry.userId, userId))),
				...buildHandTrackingStatements(ctx.db, userId, input.id, input),
			];
			if (Object.keys(entryTournamentUpdate).length > 0) {
				statements.push(
					ctx.db
						.update(entryTournament)
						.set(entryTournamentUpdate)
						.where(
							and(
								eq(entryTournament.entryId, input.id),
								eq(entryTournament.userId, userId)
							)
						)
				);
			}
			if (Object.keys(detailUpdate).length > 0) {
				statements.push(
					existingDetail
						? ctx.db
								.update(sessionTournamentDetail)
								.set(detailUpdate)
								.where(eq(sessionTournamentDetail.sessionId, input.id))
						: ctx.db
								.insert(sessionTournamentDetail)
								.values({ sessionId: input.id, ...detailUpdate })
				);
			}
			if (input.tournamentId && !input.keepSnapshot) {
				statements.push(
					...(await buildTournamentStructureReplacementStatements(
						ctx.db,
						input.id,
						input.tournamentId
					))
				);
			}
			const changes = await timerStartedAtEventChange(
				ctx.db,
				userId,
				input.id,
				input.timerStartedAt
			);
			await applyEntryEventChange(
				ctx.db,
				userId,
				input.id,
				changes,
				new Date(),
				statements,
				{
					assetId: patchedUpdateData.assetId,
					tournamentId: entryTournamentUpdate.tournamentId,
					tournamentBuyIn: detailUpdate.tournamentBuyIn,
					entryFee: detailUpdate.entryFee,
				}
			);
			const updated = await findLiveTournamentEntrySession(
				ctx.db,
				userId,
				input.id
			);
			const [updatedDetail] = await ctx.db
				.select(tournamentDetailColumns)
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));
			return {
				...updated?.session,
				tournamentId: updated?.tournamentId ?? null,
				buyIn: updatedDetail?.tournamentBuyIn ?? null,
				entryFee: updatedDetail?.entryFee ?? null,
				timerStartedAt: updated?.timerStartedAt ?? null,
			};
		}),

	updateSnapshot: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				ruleName: z.string().min(1).optional(),
				variant: z.string().optional(),
				tournamentBuyIn: nullableNonnegativeSafeIntegerSchema,
				entryFee: nullableNonnegativeSafeIntegerSchema,
				startingStack: nullableNonnegativeSafeIntegerSchema,
				bountyAmount: nullableNonnegativeSafeIntegerSchema,
				tableSize: nullableTableSizeSchema,
				houseRules: z.string().nullable().optional(),
				blindLevels: z
					.array(
						z.object({
							isBreak: z.boolean(),
							blind1: nullableNonnegativeSafeIntegerSchema,
							blind2: nullableNonnegativeSafeIntegerSchema,
							blind3: nullableNonnegativeSafeIntegerSchema,
							ante: nullableNonnegativeSafeIntegerSchema,
							minutes: nullableNonnegativeSafeIntegerSchema,
							games: levelGamesSchema.nullish(),
						})
					)
					.optional(),
				chipPurchases: z
					.array(
						z.object({
							name: z.string().min(1),
							cost: nonnegativeSafeIntegerSchema,
							chips: nonnegativeSafeIntegerSchema,
						})
					)
					.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await findLiveTournamentSession(ctx.db, input.id, userId);
			await assertLevelGameStructures(ctx.db, userId, input.blindLevels, {
				sessionId: input.id,
			});

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
			if (input.houseRules !== undefined) {
				detailUpdate.houseRules = input.houseRules;
			}
			const statements: BatchStatement[] = [];
			if (Object.keys(detailUpdate).length > 0) {
				statements.push(
					ctx.db
						.update(sessionTournamentDetail)
						.set(detailUpdate)
						.where(eq(sessionTournamentDetail.sessionId, input.id))
				);
			}
			if (input.blindLevels !== undefined) {
				statements.push(
					...buildSessionBlindLevelStatements(
						ctx.db,
						input.id,
						input.blindLevels
					)
				);
			}
			if (input.chipPurchases !== undefined) {
				statements.push(
					...buildSessionChipPurchaseStatements(
						ctx.db,
						input.id,
						input.chipPurchases.map((purchase) => ({ ...purchase, count: 0 }))
					)
				);
			}
			await applyEntryEventChange(
				ctx.db,
				userId,
				input.id,
				[],
				new Date(),
				statements,
				{
					tournamentBuyIn: detailUpdate.tournamentBuyIn,
					entryFee: detailUpdate.entryFee,
				}
			);

			return { id: input.id };
		}),

	complete: protectedProcedure
		.input(liveTournamentCompleteInputSchema)
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
			const endPayload = buildTournamentEndPayload(input);

			await applyEntryEventChange(
				ctx.db,
				userId,
				input.id,
				{
					op: "append",
					events: [
						{
							type: "session_end",
							occurredAt: floorToMinute(now),
							payload: endPayload,
						},
					],
				},
				now
			);

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

			await runBatch(
				ctx.db,
				buildEntryDeleteStatements(ctx.db, input.id, userId)
			);

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
			const [detail] = await ctx.db
				.select({ tableSize: sessionTournamentDetail.tableSize })
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));
			assertSeatPositionFitsTableSize(
				input.heroSeatPosition,
				detail?.tableSize ?? null
			);

			await updateEntryHeroSeat(
				ctx.db,
				userId,
				input.id,
				input.heroSeatPosition,
				new Date()
			);

			return { id: input.id };
		}),
});
