import { ringGame } from "@sapphire2/db/schema/ring-game";
import { pokerSession } from "@sapphire2/db/schema/session";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import {
	currency,
	currencyTransaction,
	store,
	transactionType,
} from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

const PAGE_SIZE = 20;

async function validateSessionOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	sessionId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.id, sessionId));

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

function computeCashGamePL(buyIn: number, cashOut: number): number {
	return cashOut - buyIn;
}

function computeTournamentPL(
	tournamentBuyIn: number | null,
	entryFee: number | null,
	rebuyCount: number | null,
	rebuyCost: number | null,
	addonCost: number | null,
	prizeMoney: number | null,
	bountyPrizes: number | null
): number {
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) +
		(entryFee ?? 0) +
		(rebuyCount ?? 0) * (rebuyCost ?? 0) +
		(addonCost ?? 0);
	return income - cost;
}

interface RingGameConfigInput {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	tableSize?: number | null;
	variant?: string;
}

function buildRingGameUpdateData(
	input: RingGameConfigInput
): Record<string, unknown> | null {
	const keys = [
		"variant",
		"blind1",
		"blind2",
		"blind3",
		"ante",
		"anteType",
		"tableSize",
	] as const;
	const hasUpdate = keys.some((k) => input[k] !== undefined);
	if (!hasUpdate) {
		return null;
	}

	const data: Record<string, unknown> = { updatedAt: new Date() };
	for (const key of keys) {
		if (input[key] !== undefined) {
			data[key] = input[key];
		}
	}
	return data;
}

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function validateEntityOwnership(
	db: DbInstance,
	entityType: "currency" | "ringGame" | "store" | "tournament",
	entityId: string,
	userId: string
) {
	if (entityType === "store") {
		const [found] = await db.select().from(store).where(eq(store.id, entityId));
		if (!found) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
		}
		if (found.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this store",
			});
		}
	} else if (entityType === "ringGame") {
		const [found] = await db
			.select()
			.from(ringGame)
			.where(eq(ringGame.id, entityId));
		if (!found) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Ring game not found",
			});
		}
	} else if (entityType === "tournament") {
		const [found] = await db
			.select()
			.from(tournament)
			.where(eq(tournament.id, entityId));
		if (!found) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Tournament not found",
			});
		}
	} else if (entityType === "currency") {
		const [found] = await db
			.select()
			.from(currency)
			.where(eq(currency.id, entityId));
		if (!found) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Currency not found",
			});
		}
		if (found.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this currency",
			});
		}
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
	// Seed if not found
	const id = crypto.randomUUID();
	await db.insert(transactionType).values({
		id,
		userId,
		name: "Session Result",
		updatedAt: new Date(),
	});
	return id;
}

function computeSessionPL(session: typeof pokerSession.$inferSelect): number {
	if (
		session.type === "cash_game" &&
		session.buyIn !== null &&
		session.cashOut !== null
	) {
		return computeCashGamePL(session.buyIn, session.cashOut);
	}
	if (session.type === "tournament" && session.beforeDeadline === true) {
		return 0;
	}
	return computeTournamentPL(
		session.tournamentBuyIn,
		session.entryFee,
		session.rebuyCount,
		session.rebuyCost,
		session.addonCost,
		session.prizeMoney,
		session.bountyPrizes
	);
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

async function syncCurrencyTransaction(
	db: DbInstance,
	sessionId: string,
	oldCurrencyId: string | null,
	newCurrencyId: string | null | undefined,
	amount: number,
	sessionDate: Date,
	userId: string
) {
	// undefined means no change requested
	const effectiveNewCurrencyId =
		newCurrencyId === undefined ? oldCurrencyId : newCurrencyId;

	if (oldCurrencyId && !effectiveNewCurrencyId) {
		// Currency removed — delete transaction
		await db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId));
	} else if (!oldCurrencyId && effectiveNewCurrencyId) {
		// Currency added — create transaction
		await createCurrencyTransactionForSession(
			db,
			sessionId,
			effectiveNewCurrencyId,
			amount,
			sessionDate,
			userId
		);
	} else if (
		oldCurrencyId &&
		effectiveNewCurrencyId &&
		oldCurrencyId !== effectiveNewCurrencyId
	) {
		// Currency changed — delete old, create new
		await db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId));
		await createCurrencyTransactionForSession(
			db,
			sessionId,
			effectiveNewCurrencyId,
			amount,
			sessionDate,
			userId
		);
	} else if (effectiveNewCurrencyId) {
		// Same currency — update amount
		await db
			.update(currencyTransaction)
			.set({ amount, transactedAt: sessionDate })
			.where(eq(currencyTransaction.sessionId, sessionId));
	}
}

export {
	buildRingGameUpdateData,
	computeCashGamePL,
	computeTournamentPL,
	validateSessionOwnership,
};

const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: z.number().int().min(0),
	cashOut: z.number().int().min(0),
	evCashOut: z.number().int().min(0).optional(),
	// Links (all optional)
	storeId: z.string().optional(),
	ringGameId: z.string().optional(),
	currencyId: z.string().optional(),
	// Ring game config (all optional)
	variant: z.string().default("nlh"),
	blind1: z.number().int().optional(),
	blind2: z.number().int().optional(),
	blind3: z.number().int().optional(),
	ante: z.number().int().optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	tableSize: z.number().int().optional(),
	// Time + memo
	startedAt: z.number().optional(),
	endedAt: z.number().optional(),
	breakMinutes: z.number().int().min(0).optional(),
	memo: z.string().optional(),
	// Tags
	tagIds: z.array(z.string()).optional(),
});

const tournamentCreateSchema = z
	.object({
		type: z.literal("tournament"),
		sessionDate: z.number(),
		tournamentBuyIn: z.number().int().min(0),
		entryFee: z.number().int().min(0).default(0),
		beforeDeadline: z.boolean().optional(),
		placement: z.number().int().min(1).optional(),
		totalEntries: z.number().int().min(1).optional(),
		prizeMoney: z.number().int().min(0).optional(),
		rebuyCount: z.number().int().min(0).optional(),
		rebuyCost: z.number().int().min(0).optional(),
		addonCost: z.number().int().min(0).optional(),
		bountyPrizes: z.number().int().min(0).optional(),
		// Links (all optional)
		storeId: z.string().optional(),
		tournamentId: z.string().optional(),
		currencyId: z.string().optional(),
		// Time + memo
		startedAt: z.number().optional(),
		endedAt: z.number().optional(),
		breakMinutes: z.number().int().min(0).optional(),
		memo: z.string().optional(),
		// Tags
		tagIds: z.array(z.string()).optional(),
	})
	.refine(
		(data) => {
			if (data.beforeDeadline === true) {
				return true;
			}
			if (data.placement !== undefined && data.totalEntries !== undefined) {
				return data.placement <= data.totalEntries;
			}
			return true;
		},
		{ message: "Placement must be less than or equal to total entries" }
	);

const createInputSchema = z.discriminatedUnion("type", [
	cashGameCreateSchema,
	tournamentCreateSchema,
]);

type CreateInput = z.infer<typeof createInputSchema>;

function buildCashGameSessionValues(
	input: Extract<CreateInput, { type: "cash_game" }>,
	ringGameId: string
): Partial<typeof pokerSession.$inferInsert> {
	return {
		buyIn: input.buyIn,
		cashOut: input.cashOut,
		evCashOut: input.evCashOut ?? null,
		ringGameId,
	};
}

function buildTournamentSessionValues(
	input: Extract<CreateInput, { type: "tournament" }>
): Partial<typeof pokerSession.$inferInsert> {
	const beforeDeadline = input.beforeDeadline === true;
	return {
		tournamentBuyIn: input.tournamentBuyIn,
		entryFee: input.entryFee,
		beforeDeadline: beforeDeadline ? true : null,
		placement: beforeDeadline ? null : (input.placement ?? null),
		totalEntries: beforeDeadline ? null : (input.totalEntries ?? null),
		prizeMoney: input.prizeMoney ?? null,
		rebuyCount: input.rebuyCount ?? null,
		rebuyCost: input.rebuyCost ?? null,
		addonCost: input.addonCost ?? null,
		bountyPrizes: input.bountyPrizes ?? null,
	};
}

function timestampToDate(ts: number | undefined): Date | null {
	return ts === undefined ? null : new Date(ts * 1000);
}

function nullableTimestampToDate(
	ts: number | null | undefined
): Date | null | undefined {
	if (ts === undefined) {
		return undefined;
	}
	return ts === null ? null : new Date(ts * 1000);
}

const SESSION_UPDATE_FIELDS = [
	"buyIn",
	"cashOut",
	"tournamentBuyIn",
	"entryFee",
	"placement",
	"totalEntries",
	"beforeDeadline",
	"prizeMoney",
	"rebuyCount",
	"rebuyCost",
	"addonCost",
	"bountyPrizes",
	"evCashOut",
	"breakMinutes",
	"memo",
] as const;

function buildSessionUpdateData(
	input: Record<string, unknown>
): Partial<typeof pokerSession.$inferInsert> {
	const data: Partial<typeof pokerSession.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.sessionDate !== undefined) {
		data.sessionDate = new Date((input.sessionDate as number) * 1000);
	}
	for (const field of SESSION_UPDATE_FIELDS) {
		if (input[field] !== undefined) {
			(data as Record<string, unknown>)[field] = input[field];
		}
	}
	if (input.beforeDeadline === true) {
		data.placement = null;
		data.totalEntries = null;
	}
	const startedAt = nullableTimestampToDate(
		input.startedAt as number | null | undefined
	);
	if (startedAt !== undefined) {
		data.startedAt = startedAt;
	}
	const endedAt = nullableTimestampToDate(
		input.endedAt as number | null | undefined
	);
	if (endedAt !== undefined) {
		data.endedAt = endedAt;
	}
	return data;
}

async function validateCreateLinks(
	db: DbInstance,
	input: CreateInput,
	userId: string
) {
	if (input.storeId) {
		await validateEntityOwnership(db, "store", input.storeId, userId);
	}
	if (input.currencyId) {
		await validateEntityOwnership(db, "currency", input.currencyId, userId);
	}
	if (input.type === "cash_game" && input.ringGameId) {
		await validateEntityOwnership(db, "ringGame", input.ringGameId, userId);
	}
	if (input.type === "tournament" && input.tournamentId) {
		await validateEntityOwnership(db, "tournament", input.tournamentId, userId);
	}
}

async function buildCreateValues(
	db: DbInstance,
	input: CreateInput,
	now: Date
) {
	const linkValues: Partial<typeof pokerSession.$inferInsert> = {
		storeId: input.storeId ?? null,
		currencyId: input.currencyId ?? null,
	};

	if (input.type === "cash_game") {
		if (input.ringGameId) {
			return {
				linkValues,
				typeValues: buildCashGameSessionValues(input, input.ringGameId),
			};
		}
		const ringGameId = crypto.randomUUID();
		await db.insert(ringGame).values({
			id: ringGameId,
			storeId: null,
			name: `${input.variant ?? "nlh"} ${input.blind1 ?? 0}/${input.blind2 ?? 0}`,
			variant: input.variant ?? "nlh",
			blind1: input.blind1 ?? null,
			blind2: input.blind2 ?? null,
			blind3: input.blind3 ?? null,
			ante: input.ante ?? null,
			anteType: input.anteType ?? null,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: input.tableSize ?? null,
			updatedAt: now,
		});
		return {
			linkValues,
			typeValues: buildCashGameSessionValues(input, ringGameId),
		};
	}

	if (input.tournamentId) {
		linkValues.tournamentId = input.tournamentId;
	}
	return { linkValues, typeValues: buildTournamentSessionValues(input) };
}

function buildFilterConditions(
	userId: string,
	filters: {
		currencyId?: string;
		dateFrom?: number;
		dateTo?: number;
		storeId?: string;
		type?: "cash_game" | "tournament";
	}
) {
	const conditions = [eq(pokerSession.userId, userId)];
	if (filters.type) {
		conditions.push(eq(pokerSession.type, filters.type));
	}
	if (filters.storeId) {
		conditions.push(eq(pokerSession.storeId, filters.storeId));
	}
	if (filters.currencyId) {
		conditions.push(eq(pokerSession.currencyId, filters.currencyId));
	}
	if (filters.dateFrom !== undefined) {
		conditions.push(
			gte(pokerSession.sessionDate, new Date(filters.dateFrom * 1000))
		);
	}
	if (filters.dateTo !== undefined) {
		conditions.push(
			lte(pokerSession.sessionDate, new Date(filters.dateTo * 1000))
		);
	}
	return conditions;
}

interface SessionSummary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	itmRate: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalPrizeMoney: number | null;
	totalProfitLoss: number;
	totalSessions: number;
	winRate: number;
}

interface SummarySessionRow {
	addonCost: number | null;
	beforeDeadline: boolean | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	entryFee: number | null;
	evCashOut: number | null;
	placement: number | null;
	prizeMoney: number | null;
	rebuyCost: number | null;
	rebuyCount: number | null;
	totalEntries: number | null;
	type: string;
}

function computeSessionPLFromRow(s: SummarySessionRow): number {
	if (s.type === "cash_game" && s.buyIn !== null && s.cashOut !== null) {
		return computeCashGamePL(s.buyIn, s.cashOut);
	}
	if (s.type === "tournament" && s.beforeDeadline === true) {
		return 0;
	}
	return computeTournamentPL(
		s.buyIn,
		s.entryFee,
		s.rebuyCount,
		s.rebuyCost,
		s.addonCost,
		s.prizeMoney,
		s.bountyPrizes
	);
}

function aggregateSessions(allSessions: SummarySessionRow[]) {
	let totalProfitLoss = 0;
	let winCount = 0;
	let tournamentCount = 0;
	let totalPlacement = 0;
	let placementCount = 0;
	let totalPrize = 0;
	let itmCount = 0;
	let totalEvProfitLoss = 0;
	let totalEvDiff = 0;
	let evSessionCount = 0;

	for (const s of allSessions) {
		const pl = computeSessionPLFromRow(s);
		totalProfitLoss += pl;
		if (pl > 0) {
			winCount++;
		}

		accumulateEvMetrics(
			s,
			pl,
			{ totalEvProfitLoss, totalEvDiff, evSessionCount },
			(ev) => {
				totalEvProfitLoss = ev.totalEvProfitLoss;
				totalEvDiff = ev.totalEvDiff;
				evSessionCount = ev.evSessionCount;
			}
		);

		if (s.type === "tournament") {
			tournamentCount++;
			if (s.placement !== null) {
				totalPlacement += s.placement;
				placementCount++;
			}
			const prize = (s.prizeMoney ?? 0) + (s.bountyPrizes ?? 0);
			totalPrize += prize;
			if (prize > 0) {
				itmCount++;
			}
		}
	}

	return {
		totalProfitLoss,
		winCount,
		tournamentCount,
		totalPlacement,
		placementCount,
		totalPrize,
		itmCount,
		totalEvProfitLoss,
		totalEvDiff,
		evSessionCount,
	};
}

function accumulateEvMetrics(
	s: SummarySessionRow,
	pl: number,
	current: {
		totalEvProfitLoss: number;
		totalEvDiff: number;
		evSessionCount: number;
	},
	update: (ev: {
		totalEvProfitLoss: number;
		totalEvDiff: number;
		evSessionCount: number;
	}) => void
) {
	if (s.type !== "cash_game" || s.evCashOut === null || s.buyIn === null) {
		return;
	}
	const evPl = s.evCashOut - s.buyIn;
	update({
		totalEvProfitLoss: current.totalEvProfitLoss + evPl,
		totalEvDiff: current.totalEvDiff + (evPl - pl),
		evSessionCount: current.evSessionCount + 1,
	});
}

const EMPTY_SUMMARY: SessionSummary = {
	totalSessions: 0,
	totalProfitLoss: 0,
	winRate: 0,
	avgProfitLoss: null,
	avgPlacement: null,
	totalPrizeMoney: null,
	itmRate: null,
	totalEvProfitLoss: null,
	totalEvDiff: null,
};

async function computeSummary(
	db: DbInstance,
	filterConditions: ReturnType<typeof buildFilterConditions>,
	typeFilter?: "cash_game" | "tournament"
): Promise<SessionSummary> {
	const allSessions = await db
		.select({
			type: pokerSession.type,
			buyIn: pokerSession.buyIn,
			cashOut: pokerSession.cashOut,
			evCashOut: pokerSession.evCashOut,
			entryFee: pokerSession.entryFee,
			rebuyCount: pokerSession.rebuyCount,
			rebuyCost: pokerSession.rebuyCost,
			addonCost: pokerSession.addonCost,
			prizeMoney: pokerSession.prizeMoney,
			bountyPrizes: pokerSession.bountyPrizes,
			placement: pokerSession.placement,
			totalEntries: pokerSession.totalEntries,
			beforeDeadline: pokerSession.beforeDeadline,
		})
		.from(pokerSession)
		.where(and(...filterConditions));

	const totalSessions = allSessions.length;
	if (totalSessions === 0) {
		return EMPTY_SUMMARY;
	}

	const agg = aggregateSessions(allSessions);
	const isTournament = typeFilter === "tournament";

	return {
		totalSessions,
		totalProfitLoss: agg.totalProfitLoss,
		winRate: (agg.winCount / totalSessions) * 100,
		avgProfitLoss: agg.totalProfitLoss / totalSessions,
		avgPlacement:
			isTournament && agg.placementCount > 0
				? agg.totalPlacement / agg.placementCount
				: null,
		totalPrizeMoney: isTournament ? agg.totalPrize : null,
		itmRate:
			isTournament && agg.tournamentCount > 0
				? (agg.itmCount / agg.tournamentCount) * 100
				: null,
		totalEvProfitLoss: agg.evSessionCount > 0 ? agg.totalEvProfitLoss : null,
		totalEvDiff: agg.evSessionCount > 0 ? agg.totalEvDiff : null,
	};
}

export const sessionRouter = router({
	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			const now = new Date();
			const sessionDate = new Date(input.sessionDate * 1000);

			await validateCreateLinks(ctx.db, input, userId);
			const { linkValues, typeValues } = await buildCreateValues(
				ctx.db,
				input,
				now
			);

			await ctx.db.insert(pokerSession).values({
				id,
				userId,
				type: input.type,
				sessionDate,
				startedAt: timestampToDate(input.startedAt),
				endedAt: timestampToDate(input.endedAt),
				breakMinutes: input.breakMinutes ?? null,
				memo: input.memo ?? null,
				updatedAt: now,
				...linkValues,
				...typeValues,
			});

			if (input.tagIds && input.tagIds.length > 0) {
				await ctx.db.insert(sessionToSessionTag).values(
					input.tagIds.map((tagId) => ({
						sessionId: id,
						sessionTagId: tagId,
					}))
				);
			}

			if (input.currencyId) {
				const [session] = await ctx.db
					.select()
					.from(pokerSession)
					.where(eq(pokerSession.id, id));
				if (!session) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Session not found after creation",
					});
				}
				const pl = computeSessionPL(session);
				await createCurrencyTransactionForSession(
					ctx.db,
					id,
					input.currencyId,
					pl,
					sessionDate,
					userId
				);
			}

			const [created] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, id));
			return created;
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

			const filterConditions = buildFilterConditions(userId, input);
			const paginationConditions = [...filterConditions];
			if (input.cursor) {
				paginationConditions.push(lt(pokerSession.id, input.cursor));
			}

			const data = await ctx.db
				.select({
					id: pokerSession.id,
					type: pokerSession.type,
					sessionDate: pokerSession.sessionDate,
					buyIn: pokerSession.buyIn,
					cashOut: pokerSession.cashOut,
					evCashOut: pokerSession.evCashOut,
					tournamentBuyIn: pokerSession.tournamentBuyIn,
					entryFee: pokerSession.entryFee,
					placement: pokerSession.placement,
					totalEntries: pokerSession.totalEntries,
					beforeDeadline: pokerSession.beforeDeadline,
					prizeMoney: pokerSession.prizeMoney,
					rebuyCount: pokerSession.rebuyCount,
					rebuyCost: pokerSession.rebuyCost,
					addonCost: pokerSession.addonCost,
					bountyPrizes: pokerSession.bountyPrizes,
					startedAt: pokerSession.startedAt,
					endedAt: pokerSession.endedAt,
					breakMinutes: pokerSession.breakMinutes,
					memo: pokerSession.memo,
					storeId: pokerSession.storeId,
					storeName: store.name,
					ringGameId: pokerSession.ringGameId,
					ringGameName: ringGame.name,
					ringGameBlind2: ringGame.blind2,
					tournamentId: pokerSession.tournamentId,
					tournamentName: tournament.name,
					currencyId: pokerSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					createdAt: pokerSession.createdAt,
					liveCashGameSessionId: pokerSession.liveCashGameSessionId,
					liveTournamentSessionId: pokerSession.liveTournamentSessionId,
				})
				.from(pokerSession)
				.leftJoin(store, eq(store.id, pokerSession.storeId))
				.leftJoin(ringGame, eq(ringGame.id, pokerSession.ringGameId))
				.leftJoin(tournament, eq(tournament.id, pokerSession.tournamentId))
				.leftJoin(currency, eq(currency.id, pokerSession.currencyId))
				.where(and(...paginationConditions))
				.orderBy(desc(pokerSession.sessionDate), desc(pokerSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			const itemsWithPL = items.map((item) => {
				let profitLoss: number | null = null;
				let evProfitLoss: number | null = null;
				let evDiff: number | null = null;
				if (
					item.type === "cash_game" &&
					item.buyIn !== null &&
					item.cashOut !== null
				) {
					profitLoss = computeCashGamePL(item.buyIn, item.cashOut);
					if (item.evCashOut !== null) {
						evProfitLoss = item.evCashOut - item.buyIn;
						evDiff = evProfitLoss - profitLoss;
					}
				} else if (item.type === "tournament") {
					if (item.beforeDeadline === true) {
						profitLoss = null;
					} else {
						profitLoss = computeTournamentPL(
							item.tournamentBuyIn,
							item.entryFee,
							item.rebuyCount,
							item.rebuyCost,
							item.addonCost,
							item.prizeMoney,
							item.bountyPrizes
						);
					}
				}
				return { ...item, profitLoss, evProfitLoss, evDiff };
			});

			const sessionIds = itemsWithPL.map((item) => item.id);
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

			const itemsWithTags = itemsWithPL.map((item) => ({
				...item,
				tags: tagLinks
					.filter((tl) => tl.sessionId === item.id)
					.map((tl) => ({ id: tl.tagId, name: tl.tagName })),
			}));

			// Summary aggregation
			const summary = await computeSummary(
				ctx.db,
				filterConditions,
				input.type
			);

			return { items: itemsWithTags, nextCursor, summary };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);
			return session;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.number().optional(),
				// Links
				storeId: z.string().nullable().optional(),
				ringGameId: z.string().nullable().optional(),
				tournamentId: z.string().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				// Cash game fields
				buyIn: z.number().int().min(0).optional(),
				cashOut: z.number().int().min(0).optional(),
				evCashOut: z.number().int().min(0).nullable().optional(),
				// Tournament fields
				tournamentBuyIn: z.number().int().min(0).optional(),
				entryFee: z.number().int().min(0).optional(),
				placement: z.number().int().min(1).nullable().optional(),
				totalEntries: z.number().int().min(1).nullable().optional(),
				beforeDeadline: z.boolean().nullable().optional(),
				prizeMoney: z.number().int().min(0).nullable().optional(),
				rebuyCount: z.number().int().min(0).nullable().optional(),
				rebuyCost: z.number().int().min(0).nullable().optional(),
				addonCost: z.number().int().min(0).nullable().optional(),
				bountyPrizes: z.number().int().min(0).nullable().optional(),
				// Common
				startedAt: z.number().nullable().optional(),
				endedAt: z.number().nullable().optional(),
				breakMinutes: z.number().int().min(0).nullable().optional(),
				memo: z.string().nullable().optional(),
				// Ring game config updates
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				// Tags
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);

			// Validate linked entity ownership
			if (input.storeId) {
				await validateEntityOwnership(ctx.db, "store", input.storeId, userId);
			}
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}
			if (input.ringGameId) {
				await validateEntityOwnership(
					ctx.db,
					"ringGame",
					input.ringGameId,
					userId
				);
			}
			if (input.tournamentId) {
				await validateEntityOwnership(
					ctx.db,
					"tournament",
					input.tournamentId,
					userId
				);
			}

			const updateData = buildSessionUpdateData(input);

			// Handle link field updates
			if (input.storeId !== undefined) {
				updateData.storeId = input.storeId;
			}
			if (input.ringGameId !== undefined) {
				updateData.ringGameId = input.ringGameId;
			}
			if (input.tournamentId !== undefined) {
				updateData.tournamentId = input.tournamentId;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}

			await ctx.db
				.update(pokerSession)
				.set(updateData)
				.where(eq(pokerSession.id, input.id));

			// Update linked ringGame if game config fields provided
			const rgUpdateData = buildRingGameUpdateData(input);
			if (rgUpdateData && session.ringGameId) {
				await ctx.db
					.update(ringGame)
					.set(rgUpdateData)
					.where(eq(ringGame.id, session.ringGameId));
			}

			if (input.tagIds !== undefined) {
				await ctx.db
					.delete(sessionToSessionTag)
					.where(eq(sessionToSessionTag.sessionId, input.id));
				if (input.tagIds.length > 0) {
					await ctx.db.insert(sessionToSessionTag).values(
						input.tagIds.map((tagId) => ({
							sessionId: input.id,
							sessionTagId: tagId,
						}))
					);
				}
			}

			// Sync currency transaction
			const [updated] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, input.id));

			if (!updated) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Session not found after update",
				});
			}

			const pl = computeSessionPL(updated);
			await syncCurrencyTransaction(
				ctx.db,
				input.id,
				session.currencyId,
				input.currencyId,
				pl,
				updated.sessionDate,
				userId
			);

			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(pokerSession).where(eq(pokerSession.id, input.id));
			return { success: true };
		}),
});
