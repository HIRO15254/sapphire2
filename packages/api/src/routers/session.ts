import { ringGame } from "@sapphire2/db/schema/ring-game";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
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

async function syncCurrencyTransaction(
	db: DbInstance,
	sessionId: string,
	oldCurrencyId: string | null,
	newCurrencyId: string | null | undefined,
	amount: number,
	sessionDate: Date,
	userId: string
) {
	const effectiveNewCurrencyId =
		newCurrencyId === undefined ? oldCurrencyId : newCurrencyId;

	if (oldCurrencyId && !effectiveNewCurrencyId) {
		await db
			.delete(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, sessionId));
	} else if (!oldCurrencyId && effectiveNewCurrencyId) {
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

const CASH_LIVE_LINKED_RESTRICTED_FIELDS = [
	"buyIn",
	"cashOut",
	"evCashOut",
	"startedAt",
	"endedAt",
	"breakMinutes",
	"sessionDate",
	"ringGameId",
	"variant",
	"blind1",
	"blind2",
	"blind3",
	"ante",
	"anteType",
	"tableSize",
] as const;

const TOURNAMENT_LIVE_LINKED_RESTRICTED_FIELDS = [
	"tournamentBuyIn",
	"entryFee",
	"placement",
	"totalEntries",
	"beforeDeadline",
	"prizeMoney",
	"bountyPrizes",
	"rebuyCount",
	"rebuyCost",
	"addonCost",
	"startedAt",
	"endedAt",
	"breakMinutes",
	"sessionDate",
	"tournamentId",
] as const;

export function assertNoLiveLinkedRestrictedEdits(
	session: {
		source: string;
		kind: string;
	},
	input: Record<string, unknown>
): void {
	if (session.source !== "live") {
		return;
	}
	const fields =
		session.kind === "cash_game"
			? CASH_LIVE_LINKED_RESTRICTED_FIELDS
			: TOURNAMENT_LIVE_LINKED_RESTRICTED_FIELDS;
	const violations = fields.filter((f) => input[f] !== undefined);
	if (violations.length > 0) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Cannot edit fields derived from live session events: ${violations.join(", ")}`,
		});
	}
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

const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: z.number().int().min(0),
	cashOut: z.number().int().min(0),
	evCashOut: z.number().int().min(0).optional(),
	storeId: z.string().optional(),
	ringGameId: z.string().optional(),
	currencyId: z.string().optional(),
	variant: z.string().default("nlh"),
	blind1: z.number().int().optional(),
	blind2: z.number().int().optional(),
	blind3: z.number().int().optional(),
	ante: z.number().int().optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	tableSize: z.number().int().optional(),
	startedAt: z.number().optional(),
	endedAt: z.number().optional(),
	breakMinutes: z.number().int().min(0).optional(),
	memo: z.string().optional(),
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
		storeId: z.string().optional(),
		tournamentId: z.string().optional(),
		currencyId: z.string().optional(),
		startedAt: z.number().optional(),
		endedAt: z.number().optional(),
		breakMinutes: z.number().int().min(0).optional(),
		memo: z.string().optional(),
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
	userId: string,
	filters: {
		currencyId?: string;
		dateFrom?: number;
		dateTo?: number;
		storeId?: string;
		type?: "cash_game" | "tournament";
	},
	typeFilter?: "cash_game" | "tournament"
): Promise<SessionSummary> {
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

	const allSessions = await db
		.select({
			type: gameSession.kind,
			buyIn: sessionCashDetail.buyIn,
			cashOut: sessionCashDetail.cashOut,
			evCashOut: sessionCashDetail.evCashOut,
			entryFee: sessionTournamentDetail.entryFee,
			rebuyCount: sessionTournamentDetail.rebuyCount,
			rebuyCost: sessionTournamentDetail.rebuyCost,
			addonCost: sessionTournamentDetail.addonCost,
			prizeMoney: sessionTournamentDetail.prizeMoney,
			bountyPrizes: sessionTournamentDetail.bountyPrizes,
			placement: sessionTournamentDetail.placement,
			totalEntries: sessionTournamentDetail.totalEntries,
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
		.where(and(...conditions));

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

// ---------------------------------------------------------------------------
// create helpers
// ---------------------------------------------------------------------------

async function _createCashGameDetailForSession(
	db: DbInstance,
	sessionId: string,
	input: {
		ringGameId?: string;
		variant?: string;
		blind1?: number;
		blind2?: number;
		blind3?: number;
		ante?: number;
		anteType?: "none" | "all" | "bb";
		tableSize?: number;
		buyIn: number;
		cashOut: number;
		evCashOut?: number;
	},
	now: Date
): Promise<void> {
	let ringGameId = input.ringGameId ?? null;
	if (!ringGameId) {
		ringGameId = crypto.randomUUID();
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
	}
	await db.insert(sessionCashDetail).values({
		sessionId,
		ringGameId,
		buyIn: input.buyIn,
		cashOut: input.cashOut,
		evCashOut: input.evCashOut ?? null,
	});
}

async function _createTournamentDetailForSession(
	db: DbInstance,
	sessionId: string,
	input: {
		tournamentId?: string;
		tournamentBuyIn: number;
		entryFee: number;
		beforeDeadline?: boolean;
		placement?: number;
		totalEntries?: number;
		prizeMoney?: number;
		rebuyCount?: number;
		rebuyCost?: number;
		addonCost?: number;
		bountyPrizes?: number;
	}
): Promise<void> {
	const beforeDeadline = input.beforeDeadline === true;
	await db.insert(sessionTournamentDetail).values({
		sessionId,
		tournamentId: input.tournamentId ?? null,
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
	});
}

function _computeCreatePL(input: CreateInput): number {
	if (input.type === "cash_game") {
		return computeCashGamePL(input.buyIn, input.cashOut);
	}
	return computeTournamentPL(
		input.tournamentBuyIn,
		input.entryFee,
		input.rebuyCount ?? null,
		input.rebuyCost ?? null,
		input.addonCost ?? null,
		input.prizeMoney ?? null,
		input.bountyPrizes ?? null
	);
}

// ---------------------------------------------------------------------------
// list helpers
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

interface ListItemRaw {
	addonCost: number | null;
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	prizeMoney: number | null;
	rebuyCost: number | null;
	rebuyCount: number | null;
	source: string;
	tournamentBuyIn: number | null;
	type: string;
}

function enrichItemWithPL<T extends ListItemRaw>(item: T) {
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

	const liveCashGameSessionId =
		item.source === "live" && item.type === "cash_game" ? item.id : null;
	const liveTournamentSessionId =
		item.source === "live" && item.type === "tournament" ? item.id : null;

	return {
		...item,
		liveCashGameSessionId,
		liveTournamentSessionId,
		profitLoss,
		evProfitLoss,
		evDiff,
	};
}

// ---------------------------------------------------------------------------
// update helpers
// ---------------------------------------------------------------------------

interface UpdateInput {
	breakMinutes?: number | null;
	currencyId?: string | null;
	endedAt?: number | null;
	memo?: string | null;
	sessionDate?: number;
	startedAt?: number | null;
	storeId?: string | null;
}

function buildSessionUpdateFields(
	input: UpdateInput
): Partial<typeof gameSession.$inferInsert> {
	const update: Partial<typeof gameSession.$inferInsert> = {
		updatedAt: new Date(),
	};
	if (input.sessionDate !== undefined) {
		update.sessionDate = new Date(input.sessionDate * 1000);
	}
	if (input.storeId !== undefined) {
		update.storeId = input.storeId;
	}
	if (input.currencyId !== undefined) {
		update.currencyId = input.currencyId;
	}
	if (input.memo !== undefined) {
		update.memo = input.memo;
	}
	if (input.breakMinutes !== undefined) {
		update.breakMinutes = input.breakMinutes;
	}
	const startedAt = nullableTimestampToDate(input.startedAt);
	if (startedAt !== undefined) {
		update.startedAt = startedAt;
	}
	const endedAt = nullableTimestampToDate(input.endedAt);
	if (endedAt !== undefined) {
		update.endedAt = endedAt;
	}
	return update;
}

interface CashUpdateInput {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	buyIn?: number;
	cashOut?: number;
	evCashOut?: number | null;
	ringGameId?: string | null;
	tableSize?: number | null;
	variant?: string;
}

async function applyCashDetailUpdate(
	db: DbInstance,
	sessionId: string,
	input: CashUpdateInput
): Promise<void> {
	const cashUpdate: Partial<typeof sessionCashDetail.$inferInsert> = {};
	if (input.buyIn !== undefined) {
		cashUpdate.buyIn = input.buyIn;
	}
	if (input.cashOut !== undefined) {
		cashUpdate.cashOut = input.cashOut;
	}
	if (input.evCashOut !== undefined) {
		cashUpdate.evCashOut = input.evCashOut;
	}
	if (input.ringGameId !== undefined) {
		cashUpdate.ringGameId = input.ringGameId;
	}

	if (Object.keys(cashUpdate).length > 0) {
		const [existingDetail] = await db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, sessionId));
		if (existingDetail) {
			await db
				.update(sessionCashDetail)
				.set(cashUpdate)
				.where(eq(sessionCashDetail.sessionId, sessionId));
		} else {
			await db.insert(sessionCashDetail).values({ sessionId, ...cashUpdate });
		}
	}

	const rgUpdateData = buildRingGameUpdateData(input);
	if (rgUpdateData) {
		const [currentDetail] = await db
			.select()
			.from(sessionCashDetail)
			.where(eq(sessionCashDetail.sessionId, sessionId));
		if (currentDetail?.ringGameId) {
			await db
				.update(ringGame)
				.set(rgUpdateData)
				.where(eq(ringGame.id, currentDetail.ringGameId));
		}
	}
}

interface TournamentUpdateInput {
	addonCost?: number | null;
	beforeDeadline?: boolean | null;
	bountyPrizes?: number | null;
	entryFee?: number;
	placement?: number | null;
	prizeMoney?: number | null;
	rebuyCost?: number | null;
	rebuyCount?: number | null;
	totalEntries?: number | null;
	tournamentBuyIn?: number;
	tournamentId?: string | null;
}

async function applyTournamentDetailUpdate(
	db: DbInstance,
	sessionId: string,
	input: TournamentUpdateInput
): Promise<void> {
	const tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	if (input.tournamentId !== undefined) {
		tournUpdate.tournamentId = input.tournamentId;
	}
	if (input.tournamentBuyIn !== undefined) {
		tournUpdate.tournamentBuyIn = input.tournamentBuyIn;
	}
	if (input.entryFee !== undefined) {
		tournUpdate.entryFee = input.entryFee;
	}
	if (input.placement !== undefined) {
		tournUpdate.placement = input.placement;
	}
	if (input.totalEntries !== undefined) {
		tournUpdate.totalEntries = input.totalEntries;
	}
	if (input.beforeDeadline !== undefined) {
		tournUpdate.beforeDeadline = input.beforeDeadline;
		if (input.beforeDeadline === true) {
			tournUpdate.placement = null;
			tournUpdate.totalEntries = null;
		}
	}
	if (input.prizeMoney !== undefined) {
		tournUpdate.prizeMoney = input.prizeMoney;
	}
	if (input.rebuyCount !== undefined) {
		tournUpdate.rebuyCount = input.rebuyCount;
	}
	if (input.rebuyCost !== undefined) {
		tournUpdate.rebuyCost = input.rebuyCost;
	}
	if (input.addonCost !== undefined) {
		tournUpdate.addonCost = input.addonCost;
	}
	if (input.bountyPrizes !== undefined) {
		tournUpdate.bountyPrizes = input.bountyPrizes;
	}

	if (Object.keys(tournUpdate).length === 0) {
		return;
	}
	const [existingDetail] = await db
		.select()
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, sessionId));
	if (existingDetail) {
		await db
			.update(sessionTournamentDetail)
			.set(tournUpdate)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	} else {
		await db
			.insert(sessionTournamentDetail)
			.values({ sessionId, ...tournUpdate });
	}
}

async function insertCashGameSessionDetail(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof cashGameCreateSchema>,
	now: Date
): Promise<void> {
	let ringGameId = input.ringGameId ?? null;
	if (!ringGameId) {
		ringGameId = crypto.randomUUID();
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
	}
	await db.insert(sessionCashDetail).values({
		sessionId,
		ringGameId,
		buyIn: input.buyIn,
		cashOut: input.cashOut,
		evCashOut: input.evCashOut ?? null,
	});
}

async function insertTournamentSessionDetail(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof tournamentCreateSchema>
): Promise<void> {
	const beforeDeadline = input.beforeDeadline === true;
	await db.insert(sessionTournamentDetail).values({
		sessionId,
		tournamentId: input.tournamentId ?? null,
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
	});
}

async function insertSessionTags(
	db: DbInstance,
	sessionId: string,
	tagIds: string[] | undefined
): Promise<void> {
	if (tagIds && tagIds.length > 0) {
		await db
			.insert(sessionToSessionTag)
			.values(tagIds.map((tagId) => ({ sessionId, sessionTagId: tagId })));
	}
}

async function selectCreatedSession(db: DbInstance, id: string) {
	const [created] = await db
		.select({
			id: gameSession.id,
			userId: gameSession.userId,
			type: gameSession.kind,
			kind: gameSession.kind,
			status: gameSession.status,
			source: gameSession.source,
			sessionDate: gameSession.sessionDate,
			startedAt: gameSession.startedAt,
			endedAt: gameSession.endedAt,
			breakMinutes: gameSession.breakMinutes,
			memo: gameSession.memo,
			storeId: gameSession.storeId,
			currencyId: gameSession.currencyId,
			createdAt: gameSession.createdAt,
			updatedAt: gameSession.updatedAt,
			liveCashGameSessionId: gameSession.id,
			liveTournamentSessionId: gameSession.id,
		})
		.from(gameSession)
		.where(eq(gameSession.id, id));
	return created;
}

async function maybeCreateCurrencyTransactionForCreate(
	db: DbInstance,
	id: string,
	input: CreateInput,
	sessionDate: Date,
	userId: string
): Promise<void> {
	if (!input.currencyId) {
		return;
	}
	const pl = _computeCreatePL(input);
	await createCurrencyTransactionForSession(
		db,
		id,
		input.currencyId,
		pl,
		sessionDate,
		userId
	);
}

function computeSessionPLFromDetails(
	kind: string,
	cashDetail: { buyIn: number | null; cashOut: number | null } | undefined,
	tournamentDetail:
		| {
				tournamentBuyIn: number | null;
				entryFee: number | null;
				rebuyCount: number | null;
				rebuyCost: number | null;
				addonCost: number | null;
				prizeMoney: number | null;
				bountyPrizes: number | null;
		  }
		| undefined
): number {
	if (
		kind === "cash_game" &&
		cashDetail?.buyIn != null &&
		cashDetail?.cashOut != null
	) {
		return computeCashGamePL(cashDetail.buyIn, cashDetail.cashOut);
	}
	if (kind === "tournament" && tournamentDetail) {
		return computeTournamentPL(
			tournamentDetail.tournamentBuyIn,
			tournamentDetail.entryFee,
			tournamentDetail.rebuyCount,
			tournamentDetail.rebuyCost,
			tournamentDetail.addonCost,
			tournamentDetail.prizeMoney,
			tournamentDetail.bountyPrizes
		);
	}
	return 0;
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

			await ctx.db.insert(gameSession).values({
				id,
				userId,
				kind: input.type,
				status: "completed",
				source: "manual",
				sessionDate,
				startedAt: timestampToDate(input.startedAt),
				endedAt: timestampToDate(input.endedAt),
				breakMinutes: input.breakMinutes ?? null,
				memo: input.memo ?? null,
				storeId: input.storeId ?? null,
				currencyId: input.currencyId ?? null,
				updatedAt: now,
			});

			if (input.type === "cash_game") {
				await insertCashGameSessionDetail(ctx.db, id, input, now);
			} else {
				await insertTournamentSessionDetail(ctx.db, id, input);
			}

			await insertSessionTags(ctx.db, id, input.tagIds);

			await maybeCreateCurrencyTransactionForCreate(
				ctx.db,
				id,
				input,
				sessionDate,
				userId
			);

			return selectCreatedSession(ctx.db, id);
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
					type: gameSession.kind,
					sessionDate: gameSession.sessionDate,
					source: gameSession.source,
					status: gameSession.status,
					buyIn: sessionCashDetail.buyIn,
					cashOut: sessionCashDetail.cashOut,
					evCashOut: sessionCashDetail.evCashOut,
					tournamentBuyIn: sessionTournamentDetail.tournamentBuyIn,
					entryFee: sessionTournamentDetail.entryFee,
					placement: sessionTournamentDetail.placement,
					totalEntries: sessionTournamentDetail.totalEntries,
					beforeDeadline: sessionTournamentDetail.beforeDeadline,
					prizeMoney: sessionTournamentDetail.prizeMoney,
					rebuyCount: sessionTournamentDetail.rebuyCount,
					rebuyCost: sessionTournamentDetail.rebuyCost,
					addonCost: sessionTournamentDetail.addonCost,
					bountyPrizes: sessionTournamentDetail.bountyPrizes,
					startedAt: gameSession.startedAt,
					endedAt: gameSession.endedAt,
					breakMinutes: gameSession.breakMinutes,
					memo: gameSession.memo,
					storeId: gameSession.storeId,
					storeName: store.name,
					ringGameId: sessionCashDetail.ringGameId,
					ringGameName: ringGame.name,
					ringGameBlind2: ringGame.blind2,
					tournamentId: sessionTournamentDetail.tournamentId,
					tournamentName: tournament.name,
					currencyId: gameSession.currencyId,
					currencyName: currency.name,
					currencyUnit: currency.unit,
					createdAt: gameSession.createdAt,
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

			const itemsWithPL = items.map(enrichItemWithPL);

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

			const summary = await computeSummary(ctx.db, userId, input, input.type);

			return { items: itemsWithTags, nextCursor, summary };
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

			const liveCashGameSessionId =
				session.source === "live" && session.kind === "cash_game"
					? session.id
					: null;
			const liveTournamentSessionId =
				session.source === "live" && session.kind === "tournament"
					? session.id
					: null;

			return {
				...session,
				type: session.kind,
				liveCashGameSessionId,
				liveTournamentSessionId,
				...cashDetail,
				...tournamentDetail,
			};
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.number().optional(),
				storeId: z.string().nullable().optional(),
				ringGameId: z.string().nullable().optional(),
				tournamentId: z.string().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				buyIn: z.number().int().min(0).optional(),
				cashOut: z.number().int().min(0).optional(),
				evCashOut: z.number().int().min(0).nullable().optional(),
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
				startedAt: z.number().nullable().optional(),
				endedAt: z.number().nullable().optional(),
				breakMinutes: z.number().int().min(0).nullable().optional(),
				memo: z.string().nullable().optional(),
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				tagIds: z.array(z.string()).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);

			assertNoLiveLinkedRestrictedEdits(
				{ source: session.source, kind: session.kind },
				input
			);

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

			const sessionUpdateFields = buildSessionUpdateFields(input);
			await ctx.db
				.update(gameSession)
				.set(sessionUpdateFields)
				.where(eq(gameSession.id, input.id));

			if (session.kind === "cash_game") {
				await applyCashDetailUpdate(ctx.db, input.id, input);
			} else {
				await applyTournamentDetailUpdate(ctx.db, input.id, input);
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

			const [updatedCashDetail] = await ctx.db
				.select()
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.sessionId, input.id));

			const [updatedTournamentDetail] = await ctx.db
				.select()
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.sessionId, input.id));

			const pl = computeSessionPLFromDetails(
				updated.kind,
				updatedCashDetail,
				updatedTournamentDetail
			);

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

			await ctx.db.delete(gameSession).where(eq(gameSession.id, input.id));
			return { success: true };
		}),
});
