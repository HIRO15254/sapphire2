import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashBlindSet } from "@sapphire2/db/schema/session-cash-blind-set";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import {
	sessionChipPurchaseOption,
	sessionChipPurchaseRecord,
} from "@sapphire2/db/schema/session-chip-purchase-option";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { sessionTournamentBlindSet } from "@sapphire2/db/schema/session-tournament-blind-set";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import {
	currency,
	currencyTransaction,
	store,
} from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { recalculate } from "../services/session-projection";

const PAGE_SIZE = 20;

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function validateSessionOwnership(
	db: DbInstance,
	sessionId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Session not found",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this session",
		});
	}

	return found;
}

function assertNotDiscarded(status: string): void {
	if (status === "discarded") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Cannot modify a discarded session",
		});
	}
}

// ---------------------------------------------------------------------------
// Shared blind set schema
// ---------------------------------------------------------------------------

const blindSetSchema = z.object({
	limitFormatId: z.number().int().min(1),
	blind1: z.number().int().min(0),
	blind2: z.number().int().min(0),
	blind3: z.number().int().min(0).optional(),
	blind4: z.number().int().min(0).optional(),
	ante: z.number().int().min(0).optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	sortOrder: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Manual cash_game create schema
// ---------------------------------------------------------------------------

const manualCashCreateSchema = z.object({
	source: z.literal("manual"),
	kind: z.literal("cash_game"),
	sessionDate: z.string(),
	startedAt: z.date(),
	endedAt: z.date().optional(),
	breakMinutes: z.number().int().min(0).optional(),
	memo: z.string().optional(),
	storeId: z.string().optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	ringGameId: z.string().optional(),
	cashRule: z.object({
		ruleName: z.string().min(1),
		minBuyIn: z.number().int().min(0).optional(),
		maxBuyIn: z.number().int().min(0).optional(),
		tableSize: z.number().int().min(1).optional(),
		variantId: z.number().int().min(1),
		blindSets: z.array(blindSetSchema).min(1),
	}),
	cashResult: z.object({
		buyIn: z.number().int().min(0),
		cashOut: z.number().int().min(0),
		evCashOut: z.number().int().min(0).optional(),
	}),
});

// ---------------------------------------------------------------------------
// Manual tournament create schema
// ---------------------------------------------------------------------------

const tournamentBlindLevelSchema = z.object({
	levelIndex: z.number().int().min(0),
	isBreak: z.boolean(),
	minutes: z.number().int().min(1).optional(),
	sortOrder: z.number().int().min(0),
	blindSets: z.array(blindSetSchema),
});

const chipPurchaseOptionSchema = z.object({
	name: z.string().min(1),
	cost: z.number().int().min(0),
	chips: z.number().int().min(0),
	sortOrder: z.number().int().min(0),
});

const chipPurchaseRecordSchema = z.object({
	optionSortOrder: z.number().int().min(0),
	count: z.number().int().min(0),
});

const manualTournamentCreateSchema = z.object({
	source: z.literal("manual"),
	kind: z.literal("tournament"),
	sessionDate: z.string(),
	startedAt: z.date(),
	endedAt: z.date().optional(),
	breakMinutes: z.number().int().min(0).optional(),
	memo: z.string().optional(),
	storeId: z.string().optional(),
	currencyId: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	tournamentId: z.string().optional(),
	tournamentRule: z.object({
		ruleName: z.string().min(1),
		startingStack: z.number().int().min(0).optional(),
		bountyAmount: z.number().int().min(0).optional(),
		tableSize: z.number().int().min(1).optional(),
		buyIn: z.number().int().min(0),
		entryFee: z.number().int().min(0).default(0),
		variantId: z.number().int().min(1),
		blindLevels: z.array(tournamentBlindLevelSchema),
	}),
	chipPurchaseOptions: z.array(chipPurchaseOptionSchema).optional(),
	chipPurchaseRecords: z.array(chipPurchaseRecordSchema).optional(),
	tournamentResult: z.object({
		placement: z.number().int().min(1).optional(),
		totalEntries: z.number().int().min(1).optional(),
		beforeDeadline: z.boolean(),
		prizeMoney: z.number().int().min(0).optional(),
		bountyPrizes: z.number().int().min(0).optional(),
		timerStartedAt: z.date().optional(),
	}),
});

const createInputSchema = z.discriminatedUnion("kind", [
	manualCashCreateSchema,
	manualTournamentCreateSchema,
]);

// ---------------------------------------------------------------------------
// List helpers
// ---------------------------------------------------------------------------

interface ListFilters {
	currencyId?: string;
	cursor?: string;
	dateFrom?: number;
	dateTo?: number;
	storeId?: string;
	type?: "cash_game" | "tournament";
}

function buildSessionListConditions(userId: string, filters: ListFilters) {
	const conditions = [eq(gameSession.userId, userId)];
	if (filters.type) {
		conditions.push(eq(gameSession.kind, filters.type));
	}
	if (filters.storeId) {
		conditions.push(eq(gameSession.storeId, filters.storeId));
	}
	if (filters.currencyId) {
		conditions.push(eq(gameSession.currencyId, filters.currencyId));
	}
	if (filters.dateFrom !== undefined) {
		conditions.push(
			gte(gameSession.sessionDate, new Date(filters.dateFrom * 1000))
		);
	}
	if (filters.dateTo !== undefined) {
		conditions.push(
			lte(gameSession.sessionDate, new Date(filters.dateTo * 1000))
		);
	}
	const paginationConditions = [...conditions];
	if (filters.cursor) {
		paginationConditions.push(lt(gameSession.id, filters.cursor));
	}
	return { conditions, paginationConditions };
}

// ---------------------------------------------------------------------------
// Currency transaction helpers (manual sessions)
// ---------------------------------------------------------------------------

async function upsertCurrencyTransaction(
	db: DbInstance,
	sessionId: string,
	currencyId: string,
	amount: number,
	sessionDate: Date,
	userId: string
): Promise<void> {
	const { transactionType } = await import("@sapphire2/db/schema/store");
	const [found] = await db
		.select()
		.from(transactionType)
		.where(
			and(
				eq(transactionType.userId, userId),
				eq(transactionType.name, "Session Result")
			)
		);
	let typeId: string;
	if (found) {
		typeId = found.id;
	} else {
		typeId = crypto.randomUUID();
		await db.insert(transactionType).values({
			id: typeId,
			userId,
			name: "Session Result",
			updatedAt: new Date(),
		});
	}

	const [existing] = await db
		.select()
		.from(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, sessionId));

	if (existing) {
		await db
			.update(currencyTransaction)
			.set({ amount, transactedAt: sessionDate })
			.where(eq(currencyTransaction.id, existing.id));
	} else {
		await db.insert(currencyTransaction).values({
			id: crypto.randomUUID(),
			currencyId,
			transactionTypeId: typeId,
			sessionId,
			amount,
			transactedAt: sessionDate,
		});
	}
}

// ---------------------------------------------------------------------------
// Tag helpers
// ---------------------------------------------------------------------------

async function syncSessionTags(
	db: DbInstance,
	sessionId: string,
	tagIds: string[] | undefined
): Promise<void> {
	if (tagIds === undefined) {
		return;
	}
	await db
		.delete(sessionToSessionTag)
		.where(eq(sessionToSessionTag.sessionId, sessionId));
	if (tagIds.length > 0) {
		await db
			.insert(sessionToSessionTag)
			.values(tagIds.map((tagId) => ({ sessionId, sessionTagId: tagId })));
	}
}

// ---------------------------------------------------------------------------
// Create helpers
// ---------------------------------------------------------------------------

type CashCreateInput = z.infer<typeof manualCashCreateSchema>;
type TournamentCreateInput = z.infer<typeof manualTournamentCreateSchema>;

async function insertCashGameDetails(
	db: DbInstance,
	sessionId: string,
	input: CashCreateInput,
	sessionDate: Date,
	userId: string
): Promise<void> {
	const { cashRule, cashResult } = input;
	await db.insert(sessionCashDetail).values({
		sessionId,
		ringGameId: input.ringGameId ?? null,
		ruleName: cashRule.ruleName,
		minBuyIn: cashRule.minBuyIn ?? null,
		maxBuyIn: cashRule.maxBuyIn ?? null,
		tableSize: cashRule.tableSize ?? null,
		variantId: cashRule.variantId,
		buyIn: cashResult.buyIn,
		cashOut: cashResult.cashOut,
		evCashOut: cashResult.evCashOut ?? null,
	});

	if (cashRule.blindSets.length > 0) {
		await db.insert(sessionCashBlindSet).values(
			cashRule.blindSets.map((bs) => ({
				sessionId,
				limitFormatId: bs.limitFormatId,
				blind1: bs.blind1,
				blind2: bs.blind2,
				blind3: bs.blind3 ?? null,
				blind4: bs.blind4 ?? null,
				ante: bs.ante ?? null,
				anteType: bs.anteType ?? null,
				sortOrder: bs.sortOrder,
			}))
		);
	}

	if (input.currencyId) {
		const pl = cashResult.cashOut - cashResult.buyIn;
		await upsertCurrencyTransaction(
			db,
			sessionId,
			input.currencyId,
			pl,
			sessionDate,
			userId
		);
	}
}

async function insertTournamentBlindLevels(
	db: DbInstance,
	sessionId: string,
	blindLevels: TournamentCreateInput["tournamentRule"]["blindLevels"]
): Promise<void> {
	for (const level of blindLevels) {
		const [insertedLevel] = await db
			.insert(sessionBlindLevel)
			.values({
				sessionId,
				levelIndex: level.levelIndex,
				isBreak: level.isBreak,
				minutes: level.minutes ?? null,
				sortOrder: level.sortOrder,
			})
			.returning({ id: sessionBlindLevel.id });

		if (!insertedLevel) {
			throw new TRPCError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Failed to insert blind level",
			});
		}

		if (!level.isBreak && level.blindSets.length > 0) {
			await db.insert(sessionTournamentBlindSet).values(
				level.blindSets.map((bs) => ({
					sessionBlindLevelId: insertedLevel.id,
					limitFormatId: bs.limitFormatId,
					blind1: bs.blind1,
					blind2: bs.blind2,
					blind3: bs.blind3 ?? null,
					blind4: bs.blind4 ?? null,
					ante: bs.ante ?? null,
					anteType: bs.anteType ?? null,
					sortOrder: bs.sortOrder,
				}))
			);
		}
	}
}

async function insertTournamentChipPurchases(
	db: DbInstance,
	sessionId: string,
	chipOptions: TournamentCreateInput["chipPurchaseOptions"],
	chipRecords: TournamentCreateInput["chipPurchaseRecords"]
): Promise<void> {
	const options = chipOptions ?? [];
	const sortOrderToOptionId = new Map<number, number>();

	if (options.length > 0) {
		const insertedOptions = await db
			.insert(sessionChipPurchaseOption)
			.values(
				options.map((opt) => ({
					sessionId,
					name: opt.name,
					cost: opt.cost,
					chips: opt.chips,
					sortOrder: opt.sortOrder,
				}))
			)
			.returning({
				id: sessionChipPurchaseOption.id,
				sortOrder: sessionChipPurchaseOption.sortOrder,
			});

		for (const opt of insertedOptions) {
			sortOrderToOptionId.set(opt.sortOrder, opt.id);
		}
	}

	const records = chipRecords ?? [];
	if (records.length > 0) {
		const recordValues: {
			sessionId: string;
			chipPurchaseOptionId: number;
			count: number;
		}[] = [];

		for (const rec of records) {
			const optionId = sortOrderToOptionId.get(rec.optionSortOrder);
			if (optionId === undefined) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `No chip purchase option found with sortOrder ${rec.optionSortOrder}`,
				});
			}
			recordValues.push({
				sessionId,
				chipPurchaseOptionId: optionId,
				count: rec.count,
			});
		}

		await db.insert(sessionChipPurchaseRecord).values(recordValues);
	}
}

async function insertTournamentDetails(
	db: DbInstance,
	sessionId: string,
	input: TournamentCreateInput,
	sessionDate: Date,
	userId: string
): Promise<void> {
	const { tournamentRule, tournamentResult } = input;
	const beforeDeadline = tournamentResult.beforeDeadline;

	await db.insert(sessionTournamentDetail).values({
		sessionId,
		tournamentId: input.tournamentId ?? null,
		ruleName: tournamentRule.ruleName,
		startingStack: tournamentRule.startingStack ?? null,
		bountyAmount: tournamentRule.bountyAmount ?? null,
		tableSize: tournamentRule.tableSize ?? null,
		buyIn: tournamentRule.buyIn,
		entryFee: tournamentRule.entryFee,
		variantId: tournamentRule.variantId,
		placement: beforeDeadline ? null : (tournamentResult.placement ?? null),
		totalEntries: beforeDeadline
			? null
			: (tournamentResult.totalEntries ?? null),
		beforeDeadline,
		prizeMoney: tournamentResult.prizeMoney ?? null,
		bountyPrizes: tournamentResult.bountyPrizes ?? null,
		timerStartedAt: tournamentResult.timerStartedAt ?? null,
	});

	await insertTournamentBlindLevels(db, sessionId, tournamentRule.blindLevels);
	await insertTournamentChipPurchases(
		db,
		sessionId,
		input.chipPurchaseOptions,
		input.chipPurchaseRecords
	);

	if (input.currencyId) {
		const income =
			(tournamentResult.prizeMoney ?? 0) + (tournamentResult.bountyPrizes ?? 0);
		const cost = tournamentRule.buyIn + tournamentRule.entryFee;
		const pl = income - cost;
		await upsertCurrencyTransaction(
			db,
			sessionId,
			input.currencyId,
			pl,
			sessionDate,
			userId
		);
	}
}

// ---------------------------------------------------------------------------
// Update helpers
// ---------------------------------------------------------------------------

type SessionRow = Awaited<ReturnType<typeof validateSessionOwnership>>;

interface UpdateInput {
	beforeDeadline?: boolean | null;
	bountyAmount?: number | null;
	bountyPrizes?: number | null;
	buyIn?: number;
	cashOut?: number;
	cashRuleName?: string;
	entryFee?: number;
	evCashOut?: number | null;
	id: string;
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	placement?: number | null;
	prizeMoney?: number | null;
	ringGameId?: string | null;
	startingStack?: number | null;
	tableSize?: number | null;
	totalEntries?: number | null;
	tournamentBuyIn?: number;
	tournamentId?: string | null;
	tournamentRuleName?: string;
	variantId?: number;
}

async function applyCashUpdate(
	db: DbInstance,
	sessionId: string,
	session: SessionRow,
	input: UpdateInput
): Promise<void> {
	const cashUpdate: Partial<typeof sessionCashDetail.$inferInsert> = {};
	if (input.cashRuleName !== undefined) {
		cashUpdate.ruleName = input.cashRuleName;
	}
	if (input.minBuyIn !== undefined) {
		cashUpdate.minBuyIn = input.minBuyIn;
	}
	if (input.maxBuyIn !== undefined) {
		cashUpdate.maxBuyIn = input.maxBuyIn;
	}
	if (input.tableSize !== undefined) {
		cashUpdate.tableSize = input.tableSize;
	}
	if (input.variantId !== undefined) {
		cashUpdate.variantId = input.variantId;
	}
	if (input.ringGameId !== undefined) {
		cashUpdate.ringGameId = input.ringGameId;
	}
	if (session.source === "manual") {
		if (input.buyIn !== undefined) {
			cashUpdate.buyIn = input.buyIn;
		}
		if (input.cashOut !== undefined) {
			cashUpdate.cashOut = input.cashOut;
		}
		if (input.evCashOut !== undefined) {
			cashUpdate.evCashOut = input.evCashOut;
		}
	}

	if (Object.keys(cashUpdate).length > 0) {
		await db
			.update(sessionCashDetail)
			.set(cashUpdate)
			.where(eq(sessionCashDetail.sessionId, sessionId));
	}
}

function applyManualTournamentResultFields(
	tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>,
	input: UpdateInput
): void {
	if (input.beforeDeadline !== undefined) {
		tournUpdate.beforeDeadline = input.beforeDeadline;
		if (input.beforeDeadline === true) {
			tournUpdate.placement = null;
			tournUpdate.totalEntries = null;
		}
	}
	if (input.placement !== undefined) {
		tournUpdate.placement = input.placement;
	}
	if (input.totalEntries !== undefined) {
		tournUpdate.totalEntries = input.totalEntries;
	}
	if (input.prizeMoney !== undefined) {
		tournUpdate.prizeMoney = input.prizeMoney;
	}
	if (input.bountyPrizes !== undefined) {
		tournUpdate.bountyPrizes = input.bountyPrizes;
	}
}

async function applyTournamentUpdate(
	db: DbInstance,
	sessionId: string,
	session: SessionRow,
	input: UpdateInput
): Promise<void> {
	const tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	if (input.tournamentRuleName !== undefined) {
		tournUpdate.ruleName = input.tournamentRuleName;
	}
	if (input.startingStack !== undefined) {
		tournUpdate.startingStack = input.startingStack;
	}
	if (input.bountyAmount !== undefined) {
		tournUpdate.bountyAmount = input.bountyAmount;
	}
	if (input.tableSize !== undefined) {
		tournUpdate.tableSize = input.tableSize;
	}
	if (input.tournamentBuyIn !== undefined) {
		tournUpdate.buyIn = input.tournamentBuyIn;
	}
	if (input.entryFee !== undefined) {
		tournUpdate.entryFee = input.entryFee;
	}
	if (input.variantId !== undefined) {
		tournUpdate.variantId = input.variantId;
	}
	if (input.tournamentId !== undefined) {
		tournUpdate.tournamentId = input.tournamentId;
	}
	if (session.source === "manual") {
		applyManualTournamentResultFields(tournUpdate, input);
	}

	if (Object.keys(tournUpdate).length > 0) {
		await db
			.update(sessionTournamentDetail)
			.set(tournUpdate)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	}
}

async function syncManualCurrencyTransaction(
	db: DbInstance,
	sessionId: string,
	sessionKind: string,
	currencyId: string,
	sessionDate: Date,
	userId: string
): Promise<void> {
	const [cashDetail] = await db
		.select()
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, sessionId));
	const [tournDetail] = await db
		.select()
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, sessionId));

	let pl = 0;
	if (
		sessionKind === "cash_game" &&
		cashDetail?.buyIn != null &&
		cashDetail?.cashOut != null
	) {
		pl = cashDetail.cashOut - cashDetail.buyIn;
	} else if (sessionKind === "tournament" && tournDetail) {
		const income =
			(tournDetail.prizeMoney ?? 0) + (tournDetail.bountyPrizes ?? 0);
		const cost = (tournDetail.buyIn ?? 0) + (tournDetail.entryFee ?? 0);
		pl = income - cost;
	}

	await upsertCurrencyTransaction(
		db,
		sessionId,
		currencyId,
		pl,
		sessionDate,
		userId
	);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const sessionRouter = router({
	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			const now = new Date();
			const sessionDate = new Date(input.sessionDate);

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: input.kind,
				status: "completed",
				source: "manual",
				sessionDate,
				startedAt: input.startedAt,
				endedAt: input.endedAt ?? null,
				breakMinutes: input.breakMinutes ?? null,
				memo: input.memo ?? null,
				storeId: input.storeId ?? null,
				currencyId: input.currencyId ?? null,
				updatedAt: now,
			});

			if (input.kind === "cash_game") {
				await insertCashGameDetails(ctx.db, id, input, sessionDate, userId);
			} else {
				await insertTournamentDetails(ctx.db, id, input, sessionDate, userId);
			}

			// Insert tags
			if (input.tagIds && input.tagIds.length > 0) {
				await ctx.db.insert(sessionToSessionTag).values(
					input.tagIds.map((tagId) => ({
						sessionId: id,
						sessionTagId: tagId,
					}))
				);
			}

			return { id };
		}),

	list: protectedProcedure
		.input(
			z.object({
				cursor: z.string().optional(),
				type: z.enum(["cash_game", "tournament"]).optional(),
				storeId: z.string().optional(),
				currencyId: z.string().optional(),
				dateFrom: z.number().optional(),
				dateTo: z.number().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const { paginationConditions } = buildSessionListConditions(
				userId,
				input
			);

			const data = await ctx.db
				.select({
					id: gameSession.id,
					kind: gameSession.kind,
					source: gameSession.source,
					status: gameSession.status,
					sessionDate: gameSession.sessionDate,
					startedAt: gameSession.startedAt,
					endedAt: gameSession.endedAt,
					breakMinutes: gameSession.breakMinutes,
					memo: gameSession.memo,
					storeId: gameSession.storeId,
					storeName: store.name,
					currencyId: gameSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					createdAt: gameSession.createdAt,
					// cash detail
					cashBuyIn: sessionCashDetail.buyIn,
					cashOut: sessionCashDetail.cashOut,
					evCashOut: sessionCashDetail.evCashOut,
					cashRuleName: sessionCashDetail.ruleName,
					cashRingGameId: sessionCashDetail.ringGameId,
					ringGameName: ringGame.name,
					// tournament detail
					tournamentBuyIn: sessionTournamentDetail.buyIn,
					tournamentEntryFee: sessionTournamentDetail.entryFee,
					placement: sessionTournamentDetail.placement,
					totalEntries: sessionTournamentDetail.totalEntries,
					beforeDeadline: sessionTournamentDetail.beforeDeadline,
					prizeMoney: sessionTournamentDetail.prizeMoney,
					bountyPrizes: sessionTournamentDetail.bountyPrizes,
					tournamentRuleName: sessionTournamentDetail.ruleName,
					tournamentId: sessionTournamentDetail.tournamentId,
					tournamentName: tournament.name,
				})
				.from(gameSession)
				.leftJoin(
					sessionCashDetail,
					eq(sessionCashDetail.sessionId, gameSession.id)
				)
				.leftJoin(
					sessionTournamentDetail,
					eq(sessionTournamentDetail.sessionId, gameSession.id)
				)
				.leftJoin(store, eq(store.id, gameSession.storeId))
				.leftJoin(ringGame, eq(ringGame.id, sessionCashDetail.ringGameId))
				.leftJoin(
					tournament,
					eq(tournament.id, sessionTournamentDetail.tournamentId)
				)
				.leftJoin(currency, eq(currency.id, gameSession.currencyId))
				.where(and(...paginationConditions))
				.orderBy(desc(gameSession.sessionDate), desc(gameSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			const sessionIds = items.map((item) => item.id);
			const tagLinks =
				sessionIds.length > 0
					? await ctx.db
							.select({
								sessionId: sessionToSessionTag.sessionId,
								tagId: sessionTag.id,
								tagName: sessionTag.name,
							})
							.from(sessionToSessionTag)
							.innerJoin(
								sessionTag,
								eq(sessionTag.id, sessionToSessionTag.sessionTagId)
							)
							.where(inArray(sessionToSessionTag.sessionId, sessionIds))
					: [];

			const itemsWithTags = items.map((item) => ({
				...item,
				tags: tagLinks
					.filter((tl) => tl.sessionId === item.id)
					.map((tl) => ({ id: tl.tagId, name: tl.tagName })),
			}));

			return { items: itemsWithTags, nextCursor };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);

			const [cashDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			const [tournamentDetail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			const cashBlindSets =
				session.kind === "cash_game"
					? await ctx.db
							.select()
							.from(sessionCashBlindSet)
							.where(eq(sessionCashBlindSet.sessionId, input.id))
					: [];

			const blindLevels =
				session.kind === "tournament"
					? await ctx.db
							.select()
							.from(sessionBlindLevel)
							.where(eq(sessionBlindLevel.sessionId, input.id))
					: [];

			const levelIds = blindLevels.map((l) => l.id);
			const tournamentBlindSets =
				levelIds.length > 0
					? await ctx.db
							.select()
							.from(sessionTournamentBlindSet)
							.where(
								inArray(sessionTournamentBlindSet.sessionBlindLevelId, levelIds)
							)
					: [];

			const chipPurchaseOptions =
				session.kind === "tournament"
					? await ctx.db
							.select()
							.from(sessionChipPurchaseOption)
							.where(eq(sessionChipPurchaseOption.sessionId, input.id))
					: [];

			const optionIds = chipPurchaseOptions.map((o) => o.id);
			const chipPurchaseRecords =
				optionIds.length > 0
					? await ctx.db
							.select()
							.from(sessionChipPurchaseRecord)
							.where(
								inArray(
									sessionChipPurchaseRecord.chipPurchaseOptionId,
									optionIds
								)
							)
					: [];

			const tags = await ctx.db
				.select({
					id: sessionTag.id,
					name: sessionTag.name,
				})
				.from(sessionToSessionTag)
				.innerJoin(
					sessionTag,
					eq(sessionTag.id, sessionToSessionTag.sessionTagId)
				)
				.where(eq(sessionToSessionTag.sessionId, input.id));

			return {
				...session,
				cashDetail: cashDetail ?? null,
				tournamentDetail: tournamentDetail ?? null,
				cashBlindSets,
				blindLevels,
				tournamentBlindSets,
				chipPurchaseOptions,
				chipPurchaseRecords,
				tags,
			};
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.string().optional(),
				startedAt: z.date().nullable().optional(),
				endedAt: z.date().nullable().optional(),
				breakMinutes: z.number().int().min(0).nullable().optional(),
				memo: z.string().nullable().optional(),
				storeId: z.string().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				tagIds: z.array(z.string()).optional(),
				// cash rule snapshot fields
				cashRuleName: z.string().min(1).optional(),
				minBuyIn: z.number().int().min(0).nullable().optional(),
				maxBuyIn: z.number().int().min(0).nullable().optional(),
				tableSize: z.number().int().min(1).nullable().optional(),
				variantId: z.number().int().min(1).optional(),
				ringGameId: z.string().nullable().optional(),
				// cash result (manual only)
				buyIn: z.number().int().min(0).optional(),
				cashOut: z.number().int().min(0).optional(),
				evCashOut: z.number().int().min(0).nullable().optional(),
				// tournament rule snapshot fields
				tournamentRuleName: z.string().min(1).optional(),
				startingStack: z.number().int().min(0).nullable().optional(),
				bountyAmount: z.number().int().min(0).nullable().optional(),
				tournamentBuyIn: z.number().int().min(0).optional(),
				entryFee: z.number().int().min(0).optional(),
				tournamentId: z.string().nullable().optional(),
				// tournament result (manual only)
				placement: z.number().int().min(1).nullable().optional(),
				totalEntries: z.number().int().min(1).nullable().optional(),
				beforeDeadline: z.boolean().nullable().optional(),
				prizeMoney: z.number().int().min(0).nullable().optional(),
				bountyPrizes: z.number().int().min(0).nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			// Update game_session common fields
			const sessionUpdate: Partial<typeof gameSession.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.sessionDate !== undefined) {
				sessionUpdate.sessionDate = new Date(input.sessionDate);
			}
			if (input.startedAt !== undefined) {
				sessionUpdate.startedAt = input.startedAt;
			}
			if (input.endedAt !== undefined) {
				sessionUpdate.endedAt = input.endedAt;
			}
			if (input.breakMinutes !== undefined) {
				sessionUpdate.breakMinutes = input.breakMinutes;
			}
			if (input.memo !== undefined) {
				sessionUpdate.memo = input.memo;
			}
			if (input.storeId !== undefined) {
				sessionUpdate.storeId = input.storeId;
			}
			if (input.currencyId !== undefined) {
				sessionUpdate.currencyId = input.currencyId;
			}

			await ctx.db
				.update(gameSession)
				.set(sessionUpdate)
				.where(eq(gameSession.id, input.id));

			if (session.kind === "cash_game") {
				await applyCashUpdate(ctx.db, input.id, session, input);
			} else if (session.kind === "tournament") {
				await applyTournamentUpdate(ctx.db, input.id, session, input);
			}

			await syncSessionTags(ctx.db, input.id, input.tagIds);

			// Recalculate projection (no-op for manual sessions)
			await recalculate(ctx.db, input.id);

			const [updated] = await ctx.db
				.select()
				.from(gameSession)
				.where(eq(gameSession.id, input.id));

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session not found after update",
				});
			}

			// Sync currency transaction for manual sessions
			if (updated.source === "manual" && updated.currencyId) {
				await syncManualCurrencyTransaction(
					ctx.db,
					input.id,
					updated.kind,
					updated.currencyId,
					updated.sessionDate,
					userId
				);
			}

			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);
			assertNotDiscarded(session.status);

			await ctx.db.delete(gameSession).where(eq(gameSession.id, input.id));
			return { success: true };
		}),
});

export { assertNotDiscarded };
