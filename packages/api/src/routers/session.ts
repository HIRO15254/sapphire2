import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
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
	chipPurchaseCost: number,
	prizeMoney: number | null,
	bountyPrizes: number | null
): number {
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost = (tournamentBuyIn ?? 0) + (entryFee ?? 0) + chipPurchaseCost;
	return income - cost;
}

/**
 * Cloudflare D1 rejects any query with more than 100 bound parameters. A
 * multi-row `INSERT` binds `columnsPerRow × rowCount` parameters, so a large
 * batch (e.g. a 14-level blind structure at 9 columns = 126 params) overflows
 * a single statement and fails at runtime. Split the rows so every INSERT
 * stays under the cap.
 */
const D1_MAX_BOUND_PARAMS = 100;

export function chunkForInsert<T>(rows: T[], columnsPerRow: number): T[][] {
	const perChunk = Math.max(1, Math.floor(D1_MAX_BOUND_PARAMS / columnsPerRow));
	const chunks: T[][] = [];
	for (let i = 0; i < rows.length; i += perChunk) {
		chunks.push(rows.slice(i, i + perChunk));
	}
	return chunks;
}

/**
 * Run a `WHERE ... IN (ids)` SELECT in chunks so no single statement exceeds
 * D1's 100 bound-parameter cap. A one-column `IN` binds one param per id, so a
 * batched lookup across >100 sessions (e.g. the chip-purchase / blind-level
 * maps below) overflows exactly like a wide multi-row INSERT — hence the reuse
 * of {@link chunkForInsert} with a single "column". Rows from every chunk are
 * concatenated in chunk order; callers bucket by id afterward, and because each
 * id lands in exactly one chunk, per-id ordering (sortOrder / level) survives.
 */
export async function selectInChunks<Id, Row>(
	ids: Id[],
	run: (chunk: Id[]) => Promise<Row[]>
): Promise<Row[]> {
	const rows: Row[] = [];
	for (const chunk of chunkForInsert(ids, 1)) {
		rows.push(...(await run(chunk)));
	}
	return rows;
}

interface SessionChipPurchaseWithCount {
	chips: number;
	cost: number;
	count: number;
	id: string;
	name: string;
	sortOrder: number;
}

/** Σ (cost × count) across a session's chip purchases. */
function sumChipPurchaseCost(
	purchases: { cost: number; count: number }[]
): number {
	return purchases.reduce((acc, p) => acc + p.cost * p.count, 0);
}

/**
 * Batched lookup of chip purchases (with their result counts) for the given
 * sessions, keyed by session id and ordered by sortOrder. Sessions with no
 * chip purchases are simply absent from the map.
 */
async function getSessionChipPurchaseMap(
	db: DbInstance,
	sessionIds: string[]
): Promise<Map<string, SessionChipPurchaseWithCount[]>> {
	const map = new Map<string, SessionChipPurchaseWithCount[]>();
	if (sessionIds.length === 0) {
		return map;
	}
	const rows = await selectInChunks(sessionIds, (chunk) =>
		db
			.select({
				sessionId: sessionChipPurchase.sessionId,
				id: sessionChipPurchase.id,
				name: sessionChipPurchase.name,
				cost: sessionChipPurchase.cost,
				chips: sessionChipPurchase.chips,
				sortOrder: sessionChipPurchase.sortOrder,
				count: sessionChipPurchaseResult.count,
			})
			.from(sessionChipPurchase)
			.leftJoin(
				sessionChipPurchaseResult,
				eq(
					sessionChipPurchaseResult.sessionChipPurchaseId,
					sessionChipPurchase.id
				)
			)
			.where(inArray(sessionChipPurchase.sessionId, chunk))
			.orderBy(asc(sessionChipPurchase.sortOrder))
	);
	for (const r of rows) {
		const entry: SessionChipPurchaseWithCount = {
			id: r.id,
			name: r.name,
			cost: r.cost,
			chips: r.chips,
			sortOrder: r.sortOrder,
			count: r.count ?? 0,
		};
		const existing = map.get(r.sessionId);
		if (existing) {
			existing.push(entry);
		} else {
			map.set(r.sessionId, [entry]);
		}
	}
	return map;
}

interface SessionBlindLevelRow {
	ante: number | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	isBreak: boolean;
	minutes: number | null;
}

/**
 * Batched lookup of a session's own blind structure, keyed by session id and
 * ordered by level. Mirrors {@link getSessionChipPurchaseMap} so `getById` /
 * `list` can hydrate the post-edit sheet's blind-structure editor from the
 * frozen session levels. Sessions with no structure are absent from the map.
 */
async function getSessionBlindLevelMap(
	db: DbInstance,
	sessionIds: string[]
): Promise<Map<string, SessionBlindLevelRow[]>> {
	const map = new Map<string, SessionBlindLevelRow[]>();
	if (sessionIds.length === 0) {
		return map;
	}
	const rows = await selectInChunks(sessionIds, (chunk) =>
		db
			.select({
				sessionId: sessionBlindLevel.sessionId,
				isBreak: sessionBlindLevel.isBreak,
				blind1: sessionBlindLevel.blind1,
				blind2: sessionBlindLevel.blind2,
				blind3: sessionBlindLevel.blind3,
				ante: sessionBlindLevel.ante,
				minutes: sessionBlindLevel.minutes,
			})
			.from(sessionBlindLevel)
			.where(inArray(sessionBlindLevel.sessionId, chunk))
			.orderBy(asc(sessionBlindLevel.level))
	);
	for (const r of rows) {
		const entry: SessionBlindLevelRow = {
			isBreak: r.isBreak,
			blind1: r.blind1,
			blind2: r.blind2,
			blind3: r.blind3,
			ante: r.ante,
			minutes: r.minutes,
		};
		const existing = map.get(r.sessionId);
		if (existing) {
			existing.push(entry);
		} else {
			map.set(r.sessionId, [entry]);
		}
	}
	return map;
}

/**
 * Delete + reinsert a session's chip purchases together with their result
 * counts. The session_chip_purchase delete cascades to old result rows, so
 * only the inserts are added here. Used by both create and update so counts
 * are always written against the freshly generated purchase ids.
 */
async function persistSessionChipPurchases(
	db: DbInstance,
	sessionId: string,
	chipPurchases: {
		chips: number;
		cost: number;
		count: number;
		name: string;
	}[]
): Promise<void> {
	await db
		.delete(sessionChipPurchase)
		.where(eq(sessionChipPurchase.sessionId, sessionId));
	if (chipPurchases.length === 0) {
		return;
	}
	const rows = chipPurchases.map((p, idx) => ({
		id: crypto.randomUUID(),
		sessionId,
		name: p.name,
		cost: p.cost,
		chips: p.chips,
		sortOrder: idx,
	}));
	for (const chunk of chunkForInsert(rows, 6)) {
		await db.insert(sessionChipPurchase).values(chunk);
	}
	const resultRows = rows.map((r, idx) => ({
		sessionChipPurchaseId: r.id,
		count: chipPurchases[idx]?.count ?? 0,
	}));
	for (const chunk of chunkForInsert(resultRows, 2)) {
		await db.insert(sessionChipPurchaseResult).values(chunk);
	}
}

/**
 * Delete + reinsert a session's blind level structure. Used by both create
 * (explicit override of the master snapshot) and update (session-wizard edits
 * to a session's own blind structure) so the array is always written fresh.
 */
export async function persistSessionBlindLevels(
	db: DbInstance,
	sessionId: string,
	blindLevels: {
		ante?: number | null;
		blind1?: number | null;
		blind2?: number | null;
		blind3?: number | null;
		isBreak: boolean;
		minutes?: number | null;
	}[]
): Promise<void> {
	await db
		.delete(sessionBlindLevel)
		.where(eq(sessionBlindLevel.sessionId, sessionId));
	if (blindLevels.length === 0) {
		return;
	}
	const rows = blindLevels.map((l, idx) => ({
		id: crypto.randomUUID(),
		sessionId,
		level: idx + 1,
		isBreak: l.isBreak,
		blind1: l.blind1 ?? null,
		blind2: l.blind2 ?? null,
		blind3: l.blind3 ?? null,
		ante: l.ante ?? null,
		minutes: l.minutes ?? null,
	}));
	for (const chunk of chunkForInsert(rows, 9)) {
		await db.insert(sessionBlindLevel).values(chunk);
	}
}

async function validateEntityOwnership(
	db: DbInstance,
	entityType: "currency" | "ringGame" | "room" | "tournament",
	entityId: string,
	userId: string
) {
	if (entityType === "room") {
		const [found] = await db.select().from(room).where(eq(room.id, entityId));
		if (!found) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
		}
		if (found.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this room",
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
		// A tournament has no userId of its own; ownership is derived from its
		// room. Without this check a caller could pass another user's
		// tournamentId to snapshot their blind structure / chip purchases (IDOR).
		const [foundRoom] = await db
			.select()
			.from(room)
			.where(eq(room.id, found.roomId));
		if (!foundRoom || foundRoom.userId !== userId) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: "You do not own this tournament",
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
	computeCashGamePL,
	computeTournamentPL,
	getSessionChipPurchaseMap,
	sumChipPurchaseCost,
	validateEntityOwnership,
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
	"ruleName",
	"variant",
	"blind1",
	"blind2",
	"blind3",
	"ante",
	"anteType",
	"minBuyIn",
	"maxBuyIn",
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
	"chipPurchases",
	"startedAt",
	"endedAt",
	"breakMinutes",
	"sessionDate",
	"tournamentId",
	"ruleName",
	"variant",
	"startingStack",
	"bountyAmount",
	"tableSize",
	"blindLevels",
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
	roomId: z.string().optional(),
	ringGameId: z.string().optional(),
	currencyId: z.string().optional(),
	// Snapshot fields — written through to session_cash_detail. When
	// ringGameId is also provided, these override the parent values; when
	// no master is referenced they define the rule wholesale.
	ruleName: z.string().min(1).optional(),
	variant: z.string().default("nlh"),
	blind1: z.number().int().optional(),
	blind2: z.number().int().optional(),
	blind3: z.number().int().optional(),
	ante: z.number().int().optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	minBuyIn: z.number().int().optional(),
	maxBuyIn: z.number().int().optional(),
	tableSize: z.number().int().optional(),
	startedAt: z.number().optional(),
	endedAt: z.number().optional(),
	breakMinutes: z.number().int().min(0).optional(),
	memo: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
});

// A rule-defined chip purchase plus how many times it was bought (`count`).
// Shared by session.create and session.update.
const chipPurchaseInputSchema = z.object({
	name: z.string(),
	cost: z.number().int(),
	chips: z.number().int(),
	count: z.number().int().min(0).default(0),
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
		bountyPrizes: z.number().int().min(0).optional(),
		roomId: z.string().optional(),
		tournamentId: z.string().optional(),
		currencyId: z.string().optional(),
		// Snapshot fields — same role as on the cash schema. Allows manual
		// sessions (or wizard-driven creation) to declare the rule wholesale
		// even when no master tournament is referenced.
		ruleName: z.string().min(1).optional(),
		variant: z.string().optional(),
		startingStack: z.number().int().optional(),
		bountyAmount: z.number().int().optional(),
		tableSize: z.number().int().optional(),
		blindLevels: z
			.array(
				z.object({
					isBreak: z.boolean(),
					blind1: z.number().int().nullable().optional(),
					blind2: z.number().int().nullable().optional(),
					blind3: z.number().int().nullable().optional(),
					ante: z.number().int().nullable().optional(),
					minutes: z.number().int().nullable().optional(),
				})
			)
			.optional(),
		chipPurchases: z.array(chipPurchaseInputSchema).optional(),
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
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	chipPurchaseCost: number;
	entryFee: number | null;
	evCashOut: number | null;
	placement: number | null;
	prizeMoney: number | null;
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
		s.chipPurchaseCost,
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
		roomId?: string;
		type?: "cash_game" | "tournament";
	},
	typeFilter?: "cash_game" | "tournament"
): Promise<SessionSummary> {
	const conditions = [eq(gameSession.userId, userId)];
	if (filters.type) {
		conditions.push(eq(gameSession.kind, filters.type));
	}
	if (filters.roomId) {
		conditions.push(eq(gameSession.roomId, filters.roomId));
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

	const rawSessions = await db
		.select({
			id: gameSession.id,
			type: gameSession.kind,
			buyIn: sessionCashDetail.buyIn,
			cashOut: sessionCashDetail.cashOut,
			evCashOut: sessionCashDetail.evCashOut,
			entryFee: sessionTournamentDetail.entryFee,
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

	const totalSessions = rawSessions.length;
	if (totalSessions === 0) {
		return EMPTY_SUMMARY;
	}

	const chipPurchaseMap = await getSessionChipPurchaseMap(
		db,
		rawSessions.map((s) => s.id)
	);
	const allSessions: SummarySessionRow[] = rawSessions.map((s) => ({
		...s,
		chipPurchaseCost: sumChipPurchaseCost(chipPurchaseMap.get(s.id) ?? []),
	}));

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
	if (input.roomId) {
		await validateEntityOwnership(db, "room", input.roomId, userId);
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

function _computeCreatePL(input: CreateInput): number {
	if (input.type === "cash_game") {
		return computeCashGamePL(input.buyIn, input.cashOut);
	}
	return computeTournamentPL(
		input.tournamentBuyIn,
		input.entryFee,
		sumChipPurchaseCost(input.chipPurchases ?? []),
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
	roomId?: string;
	type?: "cash_game" | "tournament";
}

/**
 * The list orders sessions by the moment they actually started, not by the
 * (date-only) `sessionDate` field: `sessionDate` has no time component, so
 * same-day sessions used to tie-break on `id` (a random UUID) and came out in
 * a seemingly arbitrary order. `startedAt` is optional (older / quick-add
 * sessions may not have one), so it falls back to `sessionDate`.
 */
function sessionOrderKeySql() {
	return sql`coalesce(${gameSession.startedAt}, ${gameSession.sessionDate})`;
}

/**
 * Composite keyset cursor for the session list. The list orders by
 * `sessionOrderKey DESC, id DESC`, so paginating on `id` alone is wrong — id
 * order is unrelated to that order, which made the second page drop or
 * duplicate rows (and stop early, so "Load more" only worked once). The
 * cursor therefore encodes both the order key (epoch ms) and the id as
 * `"<ms>_<id>"`.
 */
export function encodeSessionCursor(row: {
	id: string;
	sessionDate: Date;
	startedAt: Date | null;
}): string {
	const sortKey = row.startedAt ?? row.sessionDate;
	return `${sortKey.getTime()}_${row.id}`;
}

/**
 * Parse an {@link encodeSessionCursor} value back into its order key + id.
 * Returns `null` for a malformed cursor (missing separator, empty /
 * non-integer timestamp, or empty id) so the caller treats it as "no cursor"
 * instead of crashing. Splits on the first separator only, so ids containing
 * `_` survive.
 */
export function parseSessionCursor(
	cursor: string
): { id: string; sortKey: Date } | null {
	const separator = cursor.indexOf("_");
	if (separator === -1) {
		return null;
	}
	const rawMs = cursor.slice(0, separator);
	const id = cursor.slice(separator + 1);
	const ms = Number(rawMs);
	if (rawMs === "" || id === "" || !Number.isInteger(ms)) {
		return null;
	}
	return { id, sortKey: new Date(ms) };
}

function buildSessionListConditions(userId: string, filters: ListFilters) {
	const conditions = [eq(gameSession.userId, userId)];
	if (filters.type) {
		conditions.push(eq(gameSession.kind, filters.type));
	}
	if (filters.roomId) {
		conditions.push(eq(gameSession.roomId, filters.roomId));
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
		const parsed = parseSessionCursor(filters.cursor);
		if (parsed) {
			// Keyset must match the (sessionOrderKey DESC, id DESC) ordering:
			// take rows strictly after the cursor in that order. The order key
			// is stored in seconds (sqlite "timestamp" mode), so the cursor's ms
			// value is floored to seconds before comparing.
			const cursorSeconds = Math.floor(parsed.sortKey.getTime() / 1000);
			const keyset = sql`(${sessionOrderKeySql()} < ${cursorSeconds}) or (${sessionOrderKeySql()} = ${cursorSeconds} and ${gameSession.id} < ${parsed.id})`;
			paginationConditions.push(keyset);
		}
	}
	return { conditions, paginationConditions };
}

interface ListItemRaw {
	bountyPrizes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	chipPurchaseCost: number;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	prizeMoney: number | null;
	source: string;
	tournamentBuyIn: number | null;
	type: string;
}

export interface ProfitLossSeriesRow {
	bountyPrizes: number | null;
	breakMinutes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	chipPurchaseCost: number;
	endedAt: Date | null;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	prizeMoney: number | null;
	ringGameBlind2: number | null;
	sessionDate: Date;
	startedAt: Date | null;
	tournamentBuyIn: number | null;
	type: string;
}

interface CashGameStats {
	buyInTotal: number | null;
	evProfitLoss: number | null;
	profitLoss: number;
}

function computeCashStats(r: ProfitLossSeriesRow): CashGameStats {
	if (r.buyIn === null || r.cashOut === null) {
		return { profitLoss: 0, evProfitLoss: null, buyInTotal: null };
	}
	return {
		profitLoss: computeCashGamePL(r.buyIn, r.cashOut),
		evProfitLoss:
			r.evCashOut === null ? null : computeCashGamePL(r.buyIn, r.evCashOut),
		buyInTotal: r.buyIn,
	};
}

interface TournamentStats {
	buyInTotal: number | null;
	profitLoss: number;
}

function computeTournamentStats(r: ProfitLossSeriesRow): TournamentStats {
	const profitLoss = computeTournamentPL(
		r.tournamentBuyIn,
		r.entryFee,
		r.chipPurchaseCost,
		r.prizeMoney,
		r.bountyPrizes
	);
	const total =
		(r.tournamentBuyIn ?? 0) + (r.entryFee ?? 0) + r.chipPurchaseCost;
	return { profitLoss, buyInTotal: total === 0 ? null : total };
}

function computePlayMinutes(r: ProfitLossSeriesRow): number | null {
	if (!(r.startedAt && r.endedAt)) {
		return null;
	}
	const elapsed = Math.max(
		0,
		(r.endedAt.getTime() - r.startedAt.getTime()) / 60_000
	);
	return Math.max(0, elapsed - (r.breakMinutes ?? 0));
}

interface ProfitLossSeriesFilters {
	currencyId?: string;
	dateFrom?: number;
	dateTo?: number;
	ringGameId?: string;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

/**
 * Shared body of the `profitLossSeries` resolver. Extracted so both
 * `session.profitLossSeries` (which keeps its `ringGameId` filter) and the
 * stats router can reuse the exact same selection + point mapping, keeping the
 * point shape identical across both surfaces.
 */
export async function fetchProfitLossSeries(
	db: DbInstance,
	userId: string,
	input: ProfitLossSeriesFilters
) {
	const conditions = [eq(gameSession.userId, userId)];
	if (input.type) {
		conditions.push(eq(gameSession.kind, input.type));
	}
	if (input.roomId) {
		conditions.push(eq(gameSession.roomId, input.roomId));
	}
	if (input.currencyId) {
		conditions.push(eq(gameSession.currencyId, input.currencyId));
	}
	if (input.ringGameId) {
		conditions.push(eq(sessionCashDetail.ringGameId, input.ringGameId));
	}
	if (input.dateFrom !== undefined) {
		conditions.push(
			gte(gameSession.sessionDate, new Date(input.dateFrom * 1000))
		);
	}
	if (input.dateTo !== undefined) {
		conditions.push(
			lte(gameSession.sessionDate, new Date(input.dateTo * 1000))
		);
	}

	const rows = await db
		.select({
			id: gameSession.id,
			type: gameSession.kind,
			sessionDate: gameSession.sessionDate,
			startedAt: gameSession.startedAt,
			endedAt: gameSession.endedAt,
			breakMinutes: gameSession.breakMinutes,
			buyIn: sessionCashDetail.buyIn,
			cashOut: sessionCashDetail.cashOut,
			evCashOut: sessionCashDetail.evCashOut,
			ringGameBlind2: sessionCashDetail.blind2,
			tournamentBuyIn: sessionTournamentDetail.tournamentBuyIn,
			entryFee: sessionTournamentDetail.entryFee,
			prizeMoney: sessionTournamentDetail.prizeMoney,
			bountyPrizes: sessionTournamentDetail.bountyPrizes,
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
		.where(and(...conditions))
		.orderBy(asc(sessionOrderKeySql()), asc(gameSession.id));

	const chipPurchaseMap = await getSessionChipPurchaseMap(
		db,
		rows.map((r) => r.id)
	);
	const points = rows.map((r) =>
		toProfitLossSeriesPoint({
			...r,
			chipPurchaseCost: sumChipPurchaseCost(chipPurchaseMap.get(r.id) ?? []),
		})
	);

	return { points };
}

export function toProfitLossSeriesPoint(r: ProfitLossSeriesRow) {
	const cashStats =
		r.type === "cash_game"
			? computeCashStats(r)
			: ({
					profitLoss: 0,
					evProfitLoss: null,
					buyInTotal: null,
				} satisfies CashGameStats);
	const tourneyStats =
		r.type === "tournament"
			? computeTournamentStats(r)
			: ({ profitLoss: 0, buyInTotal: null } satisfies TournamentStats);
	const profitLoss =
		r.type === "cash_game" ? cashStats.profitLoss : tourneyStats.profitLoss;
	const buyInTotal =
		r.type === "cash_game" ? cashStats.buyInTotal : tourneyStats.buyInTotal;
	return {
		id: r.id,
		type: r.type as "cash_game" | "tournament",
		sessionDate: Math.floor(r.sessionDate.getTime() / 1000),
		// Chronological order key: sessionDate has no time component, so same-day
		// sessions need startedAt to sort by actual play order (SA2-98). Mirrors
		// the DB query's own `sessionOrderKeySql()` ordering.
		sortKey: Math.floor((r.startedAt ?? r.sessionDate).getTime() / 1000),
		profitLoss,
		evProfitLoss: cashStats.evProfitLoss,
		playMinutes: computePlayMinutes(r),
		bigBlind: r.ringGameBlind2 ?? null,
		buyInTotal,
	};
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
			item.chipPurchaseCost,
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

/**
 * Shared SELECT for an enriched session row (aliased fields + the cash /
 * tournament snapshot scalars). Used by both `list` (paginated) and `getById`
 * (single id) so the detail page receives exactly the same shape as a list
 * item — display logic and the edit-wizard pre-fill both rely on these aliases.
 */
function selectEnrichedSessionRows(db: DbInstance) {
	return db
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
			bountyPrizes: sessionTournamentDetail.bountyPrizes,
			startedAt: gameSession.startedAt,
			endedAt: gameSession.endedAt,
			breakMinutes: gameSession.breakMinutes,
			memo: gameSession.memo,
			roomId: gameSession.roomId,
			roomName: room.name,
			ringGameId: sessionCashDetail.ringGameId,
			ringGameName: sessionCashDetail.ruleName,
			ringGameBlind2: sessionCashDetail.blind2,
			tournamentId: sessionTournamentDetail.tournamentId,
			tournamentName: sessionTournamentDetail.ruleName,
			currencyId: gameSession.currencyId,
			currencyName: currency.name,
			currencyUnit: currency.unit,
			createdAt: gameSession.createdAt,
			// Cash snapshot scalars used by the edit-mode wizard to
			// pre-fill the Rules step with the frozen rule.
			cashVariant: sessionCashDetail.variant,
			cashBlind1: sessionCashDetail.blind1,
			cashBlind3: sessionCashDetail.blind3,
			cashAnte: sessionCashDetail.ante,
			cashAnteType: sessionCashDetail.anteType,
			cashMinBuyIn: sessionCashDetail.minBuyIn,
			cashMaxBuyIn: sessionCashDetail.maxBuyIn,
			cashTableSize: sessionCashDetail.tableSize,
			// Tournament snapshot scalars (same role).
			tournamentVariant: sessionTournamentDetail.variant,
			tournamentStartingStack: sessionTournamentDetail.startingStack,
			tournamentBountyAmount: sessionTournamentDetail.bountyAmount,
			tournamentTableSize: sessionTournamentDetail.tableSize,
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
		.leftJoin(room, eq(room.id, gameSession.roomId))
		.leftJoin(currency, eq(currency.id, gameSession.currencyId));
}

/**
 * Attaches chip purchases (+ their summed cost), profit/loss, the live-session
 * id discriminators, and tag links to raw session rows from
 * {@link selectEnrichedSessionRows}.
 */
async function enrichSessionRows<
	T extends Omit<ListItemRaw, "chipPurchaseCost"> & { id: string },
>(db: DbInstance, rows: T[]) {
	const detailSessionIds = rows.map((row) => row.id);
	const [chipPurchaseMap, blindLevelMap] = await Promise.all([
		getSessionChipPurchaseMap(db, detailSessionIds),
		getSessionBlindLevelMap(db, detailSessionIds),
	]);
	const withChipPurchases = rows.map((item) => {
		const chipPurchases = chipPurchaseMap.get(item.id) ?? [];
		return {
			...item,
			blindLevels: blindLevelMap.get(item.id) ?? [],
			chipPurchases,
			chipPurchaseCost: sumChipPurchaseCost(chipPurchases),
		};
	});

	const withPL = withChipPurchases.map(enrichItemWithPL);

	const sessionIds = withPL.map((item) => item.id);
	const tagLinks = await selectInChunks(sessionIds, (chunk) =>
		db
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
			.where(inArray(sessionToSessionTag.sessionId, chunk))
	);

	return withPL.map((item) => ({
		...item,
		tags: tagLinks
			.filter((tl) => tl.sessionId === item.id)
			.map((tl) => ({ id: tl.tagId, name: tl.tagName })),
	}));
}

// ---------------------------------------------------------------------------
// update helpers
// ---------------------------------------------------------------------------

interface UpdateInput {
	breakMinutes?: number | null;
	currencyId?: string | null;
	endedAt?: number | null;
	memo?: string | null;
	roomId?: string | null;
	sessionDate?: number;
	startedAt?: number | null;
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
	if (input.roomId !== undefined) {
		update.roomId = input.roomId;
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
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	ringGameId?: string | null;
	ruleName?: string;
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

	// Snapshot field overrides — written to detail, never propagated to parent.
	if (input.ruleName !== undefined) {
		cashUpdate.ruleName = input.ruleName;
	}
	if (input.variant !== undefined) {
		cashUpdate.variant = input.variant;
	}
	if (input.blind1 !== undefined) {
		cashUpdate.blind1 = input.blind1;
	}
	if (input.blind2 !== undefined) {
		cashUpdate.blind2 = input.blind2;
	}
	if (input.blind3 !== undefined) {
		cashUpdate.blind3 = input.blind3;
	}
	if (input.ante !== undefined) {
		cashUpdate.ante = input.ante;
	}
	if (input.anteType !== undefined) {
		cashUpdate.anteType = input.anteType;
	}
	if (input.tableSize !== undefined) {
		cashUpdate.tableSize = input.tableSize;
	}
	if (input.minBuyIn !== undefined) {
		cashUpdate.minBuyIn = input.minBuyIn;
	}
	if (input.maxBuyIn !== undefined) {
		cashUpdate.maxBuyIn = input.maxBuyIn;
	}

	if (input.ringGameId !== undefined) {
		cashUpdate.ringGameId = input.ringGameId;
		if (input.ringGameId) {
			// Re-snapshot from the new parent, while letting explicit input
			// fields override.
			const snapshot = await resolveCashRuleSnapshot(db, input);
			cashUpdate.ruleName = snapshot.ruleName;
			cashUpdate.variant = snapshot.variant;
			cashUpdate.blind1 = snapshot.blind1;
			cashUpdate.blind2 = snapshot.blind2;
			cashUpdate.blind3 = snapshot.blind3;
			cashUpdate.ante = snapshot.ante;
			cashUpdate.anteType = snapshot.anteType;
			cashUpdate.minBuyIn = snapshot.minBuyIn;
			cashUpdate.maxBuyIn = snapshot.maxBuyIn;
			cashUpdate.tableSize = snapshot.tableSize;
		}
	}

	if (Object.keys(cashUpdate).length === 0) {
		return;
	}
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

interface TournamentUpdateInput {
	beforeDeadline?: boolean | null;
	blindLevels?: {
		ante?: number | null;
		blind1?: number | null;
		blind2?: number | null;
		blind3?: number | null;
		isBreak: boolean;
		minutes?: number | null;
	}[];
	bountyAmount?: number | null;
	bountyPrizes?: number | null;
	chipPurchases?: {
		chips: number;
		cost: number;
		count: number;
		name: string;
	}[];
	entryFee?: number;
	placement?: number | null;
	prizeMoney?: number | null;
	ruleName?: string;
	startingStack?: number | null;
	tableSize?: number | null;
	totalEntries?: number | null;
	tournamentBuyIn?: number;
	tournamentId?: string | null;
	variant?: string;
}

async function applyTournamentSnapshotUpdate(
	db: DbInstance,
	tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>,
	input: TournamentUpdateInput
): Promise<void> {
	if (input.tournamentId === undefined) {
		return;
	}
	tournUpdate.tournamentId = input.tournamentId;
	if (!input.tournamentId) {
		return;
	}
	const snapshot = await resolveTournamentRuleSnapshot(db, {
		tournamentId: input.tournamentId,
		tournamentBuyIn: input.tournamentBuyIn,
		entryFee: input.entryFee,
		ruleName: input.ruleName,
		variant: input.variant,
		startingStack: input.startingStack,
		bountyAmount: input.bountyAmount,
		tableSize: input.tableSize,
	});
	tournUpdate.ruleName = snapshot.ruleName;
	tournUpdate.variant = snapshot.variant;
	tournUpdate.startingStack = snapshot.startingStack;
	tournUpdate.bountyAmount = snapshot.bountyAmount;
	tournUpdate.tableSize = snapshot.tableSize;
	if (input.tournamentBuyIn === undefined) {
		tournUpdate.tournamentBuyIn = snapshot.tournamentBuyIn;
	}
	if (input.entryFee === undefined) {
		tournUpdate.entryFee = snapshot.entryFee;
	}
}

function applyTournamentScalarUpdates(
	tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert>,
	input: TournamentUpdateInput
): void {
	const scalarKeys = [
		"tournamentBuyIn",
		"entryFee",
		"placement",
		"totalEntries",
		"prizeMoney",
		"bountyPrizes",
	] as const;
	for (const key of scalarKeys) {
		if (input[key] !== undefined) {
			tournUpdate[key] = input[key];
		}
	}
	// Snapshot field overrides — written to detail, never propagated to
	// parent. Assigned individually (rather than via `scalarKeys`) since
	// `variant` is a string while the rest are nullable numbers, which the
	// generic keyed loop above can't type-check across.
	if (input.ruleName !== undefined) {
		tournUpdate.ruleName = input.ruleName;
	}
	if (input.variant !== undefined) {
		tournUpdate.variant = input.variant;
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
	if (input.beforeDeadline !== undefined) {
		tournUpdate.beforeDeadline = input.beforeDeadline;
		if (input.beforeDeadline === true) {
			tournUpdate.placement = null;
			tournUpdate.totalEntries = null;
		}
	}
}

async function applyTournamentDetailUpdate(
	db: DbInstance,
	sessionId: string,
	input: TournamentUpdateInput
): Promise<void> {
	const tournUpdate: Partial<typeof sessionTournamentDetail.$inferInsert> = {};
	await applyTournamentSnapshotUpdate(db, tournUpdate, input);
	applyTournamentScalarUpdates(tournUpdate, input);

	if (Object.keys(tournUpdate).length > 0) {
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

	// Re-snapshot blind levels / chip purchases when the parent link changes.
	// `null` keeps the existing snapshot (frozen).
	if (input.tournamentId) {
		await resnapshotTournamentStructure(db, sessionId, input.tournamentId);
	}

	// Explicit blind levels / chip purchases (with result counts) override the
	// snapshot. Runs after the re-snapshot so the explicit arrays win when both
	// apply.
	if (input.blindLevels !== undefined) {
		await persistSessionBlindLevels(db, sessionId, input.blindLevels);
	}
	if (input.chipPurchases !== undefined) {
		await persistSessionChipPurchases(db, sessionId, input.chipPurchases);
	}
}

interface CashRuleSnapshot {
	ante: number | null;
	anteType: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	maxBuyIn: number | null;
	minBuyIn: number | null;
	ruleName: string;
	tableSize: number | null;
	variant: string;
}

interface CashRuleInput {
	ante?: number | null;
	anteType?: "none" | "all" | "bb" | null;
	blind1?: number | null;
	blind2?: number | null;
	blind3?: number | null;
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	ringGameId?: string | null;
	ruleName?: string;
	tableSize?: number | null;
	variant?: string;
}

function pick<T>(override: T | undefined, fallback: T): T {
	return override === undefined ? fallback : override;
}

function defaultCashSnapshot(input: CashRuleInput): CashRuleSnapshot {
	return {
		ruleName: input.ruleName ?? "Untitled",
		variant: input.variant ?? "nlh",
		blind1: input.blind1 ?? null,
		blind2: input.blind2 ?? null,
		blind3: input.blind3 ?? null,
		ante: input.ante ?? null,
		anteType: input.anteType ?? null,
		minBuyIn: input.minBuyIn ?? null,
		maxBuyIn: input.maxBuyIn ?? null,
		tableSize: input.tableSize ?? null,
	};
}

function mergeCashSnapshotWithParent(
	input: CashRuleInput,
	rg: typeof ringGame.$inferSelect
): CashRuleSnapshot {
	return {
		ruleName: input.ruleName ?? rg.name,
		variant: input.variant ?? rg.variant,
		blind1: pick(input.blind1, rg.blind1),
		blind2: pick(input.blind2, rg.blind2),
		blind3: pick(input.blind3, rg.blind3),
		ante: pick(input.ante, rg.ante),
		anteType: pick(input.anteType, rg.anteType),
		minBuyIn: pick(input.minBuyIn, rg.minBuyIn),
		maxBuyIn: pick(input.maxBuyIn, rg.maxBuyIn),
		tableSize: pick(input.tableSize, rg.tableSize),
	};
}

async function resolveCashRuleSnapshot(
	db: DbInstance,
	input: CashRuleInput
): Promise<CashRuleSnapshot> {
	if (!input.ringGameId) {
		return defaultCashSnapshot(input);
	}
	const [rg] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, input.ringGameId));
	if (!rg) {
		return defaultCashSnapshot(input);
	}
	return mergeCashSnapshotWithParent(input, rg);
}

async function insertCashGameSessionDetail(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof cashGameCreateSchema>,
	now: Date
): Promise<void> {
	let ringGameId = input.ringGameId ?? null;
	const snapshot = await resolveCashRuleSnapshot(db, input);

	if (!ringGameId) {
		ringGameId = crypto.randomUUID();
		const derivedName = `${snapshot.variant} ${snapshot.blind1 ?? 0}/${snapshot.blind2 ?? 0}`;
		await db.insert(ringGame).values({
			id: ringGameId,
			roomId: null,
			name: derivedName,
			variant: snapshot.variant,
			blind1: snapshot.blind1,
			blind2: snapshot.blind2,
			blind3: snapshot.blind3,
			ante: snapshot.ante,
			anteType: snapshot.anteType,
			minBuyIn: null,
			maxBuyIn: null,
			tableSize: snapshot.tableSize,
			updatedAt: now,
		});
		snapshot.ruleName = derivedName;
	}
	await db.insert(sessionCashDetail).values({
		sessionId,
		ringGameId,
		buyIn: input.buyIn,
		cashOut: input.cashOut,
		evCashOut: input.evCashOut ?? null,
		ruleName: snapshot.ruleName,
		variant: snapshot.variant,
		blind1: snapshot.blind1,
		blind2: snapshot.blind2,
		blind3: snapshot.blind3,
		ante: snapshot.ante,
		anteType: snapshot.anteType,
		minBuyIn: snapshot.minBuyIn,
		maxBuyIn: snapshot.maxBuyIn,
		tableSize: snapshot.tableSize,
	});
}

interface TournamentRuleSnapshot {
	bountyAmount: number | null;
	entryFee: number | null;
	ruleName: string;
	startingStack: number | null;
	tableSize: number | null;
	tournamentBuyIn: number | null;
	variant: string;
}

interface TournamentRuleInput {
	bountyAmount?: number | null;
	entryFee?: number | null;
	ruleName?: string;
	startingStack?: number | null;
	tableSize?: number | null;
	tournamentBuyIn?: number | null;
	tournamentId?: string | null;
	variant?: string;
}

async function resolveTournamentRuleSnapshot(
	db: DbInstance,
	input: TournamentRuleInput
): Promise<TournamentRuleSnapshot> {
	let base: TournamentRuleSnapshot = {
		ruleName: input.ruleName ?? "Untitled",
		variant: input.variant ?? "nlh",
		tournamentBuyIn: input.tournamentBuyIn ?? null,
		entryFee: input.entryFee ?? null,
		startingStack: input.startingStack ?? null,
		bountyAmount: input.bountyAmount ?? null,
		tableSize: input.tableSize ?? null,
	};
	if (input.tournamentId) {
		const [t] = await db
			.select()
			.from(tournament)
			.where(eq(tournament.id, input.tournamentId));
		if (t) {
			base = {
				ruleName: input.ruleName ?? t.name,
				variant: input.variant ?? t.variant,
				tournamentBuyIn:
					input.tournamentBuyIn !== undefined && input.tournamentBuyIn !== null
						? input.tournamentBuyIn
						: t.buyIn,
				entryFee:
					input.entryFee !== undefined && input.entryFee !== null
						? input.entryFee
						: t.entryFee,
				startingStack: pick(input.startingStack, t.startingStack),
				bountyAmount: pick(input.bountyAmount, t.bountyAmount),
				tableSize: pick(input.tableSize, t.tableSize),
			};
		}
	}
	return base;
}

async function insertTournamentSessionDetail(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof tournamentCreateSchema>
): Promise<void> {
	const beforeDeadline = input.beforeDeadline === true;
	const snapshot = await resolveTournamentRuleSnapshot(db, {
		tournamentId: input.tournamentId,
		tournamentBuyIn: input.tournamentBuyIn,
		entryFee: input.entryFee,
		ruleName: input.ruleName,
		variant: input.variant,
		startingStack: input.startingStack,
		bountyAmount: input.bountyAmount,
		tableSize: input.tableSize,
	});
	await db.insert(sessionTournamentDetail).values({
		sessionId,
		tournamentId: input.tournamentId ?? null,
		tournamentBuyIn: snapshot.tournamentBuyIn,
		entryFee: snapshot.entryFee,
		beforeDeadline: beforeDeadline ? true : null,
		placement: beforeDeadline ? null : (input.placement ?? null),
		totalEntries: beforeDeadline ? null : (input.totalEntries ?? null),
		prizeMoney: input.prizeMoney ?? null,
		bountyPrizes: input.bountyPrizes ?? null,
		ruleName: snapshot.ruleName,
		variant: snapshot.variant,
		startingStack: snapshot.startingStack,
		bountyAmount: snapshot.bountyAmount,
		tableSize: snapshot.tableSize,
	});
	if (input.tournamentId) {
		await snapshotTournamentStructure(db, sessionId, input.tournamentId);
	}
	// Allow callers to override the snapshotted structure with explicit
	// blind levels / chip purchases. This runs after the parent copy so
	// the explicit arrays win when both are supplied.
	if (input.blindLevels !== undefined) {
		await persistSessionBlindLevels(db, sessionId, input.blindLevels);
	}
	if (input.chipPurchases !== undefined) {
		await persistSessionChipPurchases(db, sessionId, input.chipPurchases);
	}
}

async function snapshotTournamentStructure(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<void> {
	const levels = await db
		.select()
		.from(blindLevel)
		.where(eq(blindLevel.tournamentId, tournamentId))
		.orderBy(asc(blindLevel.level));
	if (levels.length > 0) {
		const levelRows = levels.map((l) => ({
			id: crypto.randomUUID(),
			sessionId,
			level: l.level,
			isBreak: l.isBreak,
			blind1: l.blind1,
			blind2: l.blind2,
			blind3: l.blind3,
			ante: l.ante,
			minutes: l.minutes,
		}));
		for (const chunk of chunkForInsert(levelRows, 9)) {
			await db.insert(sessionBlindLevel).values(chunk);
		}
	}

	const purchases = await db
		.select()
		.from(tournamentChipPurchase)
		.where(eq(tournamentChipPurchase.tournamentId, tournamentId))
		.orderBy(asc(tournamentChipPurchase.sortOrder));
	if (purchases.length > 0) {
		const purchaseRows = purchases.map((p) => ({
			id: crypto.randomUUID(),
			sessionId,
			name: p.name,
			cost: p.cost,
			chips: p.chips,
			sortOrder: p.sortOrder,
		}));
		for (const chunk of chunkForInsert(purchaseRows, 6)) {
			await db.insert(sessionChipPurchase).values(chunk);
		}
		// Every chip purchase starts with a result row (count 0) so the
		// result table always has a row to update.
		const resultRows = purchaseRows.map((r) => ({
			sessionChipPurchaseId: r.id,
			count: 0,
		}));
		for (const chunk of chunkForInsert(resultRows, 2)) {
			await db.insert(sessionChipPurchaseResult).values(chunk);
		}
	}
}

async function resnapshotTournamentStructure(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<void> {
	await db
		.delete(sessionBlindLevel)
		.where(eq(sessionBlindLevel.sessionId, sessionId));
	await db
		.delete(sessionChipPurchase)
		.where(eq(sessionChipPurchase.sessionId, sessionId));
	await snapshotTournamentStructure(db, sessionId, tournamentId);
}

export {
	persistSessionChipPurchases,
	resnapshotTournamentStructure,
	resolveCashRuleSnapshot,
	resolveTournamentRuleSnapshot,
	snapshotTournamentStructure,
};

async function insertSessionTags(
	db: DbInstance,
	sessionId: string,
	tagIds: string[] | undefined
): Promise<void> {
	if (tagIds && tagIds.length > 0) {
		const rows = tagIds.map((tagId) => ({ sessionId, sessionTagId: tagId }));
		for (const chunk of chunkForInsert(rows, 2)) {
			await db.insert(sessionToSessionTag).values(chunk);
		}
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
			roomId: gameSession.roomId,
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
				prizeMoney: number | null;
				bountyPrizes: number | null;
		  }
		| undefined,
	chipPurchaseCost: number
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
			chipPurchaseCost,
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
				roomId: input.roomId ?? null,
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
				roomId: z.string().optional(),
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

			const data = await selectEnrichedSessionRows(ctx.db)
				.where(and(...paginationConditions))
				.orderBy(desc(sessionOrderKeySql()), desc(gameSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const last = items.at(-1);
			const nextCursor =
				hasMore && last ? encodeSessionCursor(last) : undefined;

			const itemsWithTags = await enrichSessionRows(ctx.db, items);

			const summary = await computeSummary(ctx.db, userId, input, input.type);

			return { items: itemsWithTags, nextCursor, summary };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			// Ownership guard — throws NOT_FOUND when the session is missing or
			// belongs to another user.
			await validateSessionOwnership(ctx.db, input.id, userId);

			const rows = await selectEnrichedSessionRows(ctx.db).where(
				and(eq(gameSession.id, input.id), eq(gameSession.userId, userId))
			);
			const [enriched] = await enrichSessionRows(ctx.db, rows);

			if (!enriched) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found",
				});
			}

			return enriched;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.number().optional(),
				roomId: z.string().nullable().optional(),
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
				bountyPrizes: z.number().int().min(0).nullable().optional(),
				startingStack: z.number().int().nullable().optional(),
				bountyAmount: z.number().int().nullable().optional(),
				blindLevels: z
					.array(
						z.object({
							isBreak: z.boolean(),
							blind1: z.number().int().nullable().optional(),
							blind2: z.number().int().nullable().optional(),
							blind3: z.number().int().nullable().optional(),
							ante: z.number().int().nullable().optional(),
							minutes: z.number().int().nullable().optional(),
						})
					)
					.optional(),
				chipPurchases: z.array(chipPurchaseInputSchema).optional(),
				startedAt: z.number().nullable().optional(),
				endedAt: z.number().nullable().optional(),
				breakMinutes: z.number().int().min(0).nullable().optional(),
				memo: z.string().nullable().optional(),
				ruleName: z.string().optional(),
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				minBuyIn: z.number().int().nullable().optional(),
				maxBuyIn: z.number().int().nullable().optional(),
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

			if (input.roomId) {
				await validateEntityOwnership(ctx.db, "room", input.roomId, userId);
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
					const tagRows = input.tagIds.map((tagId) => ({
						sessionId: input.id,
						sessionTagId: tagId,
					}));
					for (const chunk of chunkForInsert(tagRows, 2)) {
						await ctx.db.insert(sessionToSessionTag).values(chunk);
					}
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

			const updatedChipPurchaseMap = await getSessionChipPurchaseMap(ctx.db, [
				input.id,
			]);
			const pl = computeSessionPLFromDetails(
				updated.kind,
				updatedCashDetail,
				updatedTournamentDetail,
				sumChipPurchaseCost(updatedChipPurchaseMap.get(input.id) ?? [])
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

	// profit/loss time series — shared by the statistics page and the stats router
	profitLossSeries: protectedProcedure
		.input(
			z.object({
				type: z.enum(["cash_game", "tournament"]).optional(),
				roomId: z.string().optional(),
				ringGameId: z.string().optional(),
				currencyId: z.string().optional(),
				dateFrom: z.number().optional(),
				dateTo: z.number().optional(),
			})
		)
		.query(({ ctx, input }) =>
			fetchProfitLossSeries(ctx.db, ctx.session.user.id, input)
		),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(gameSession).where(eq(gameSession.id, input.id));
			return { success: true };
		}),
});
