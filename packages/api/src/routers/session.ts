import {
	DEFAULT_GAME_GROUPS,
	DEFAULT_VARIANT_LABEL,
	MIX_VARIANT,
	variantDisplayLabel,
} from "@sapphire2/db/constants/game-variants";
import { currency, currencyTransaction } from "@sapphire2/db/schema/currency";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { item, itemTransaction } from "@sapphire2/db/schema/item";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionItemUsage } from "@sapphire2/db/schema/session-item-usage";
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
import {
	type LevelGameGroup,
	levelGamesSchema,
	type MixGameGroup,
	mixGamesSchema,
} from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	lte,
	type SQL,
	sql,
} from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { type BatchStatement, runBatch } from "../lib/batch";
import { optionalUniqueTagIdsSchema } from "../lib/tag-ids";
import {
	computeNetItemCounts,
	type SessionItemUsageInput,
} from "../services/live-session-pl";
import { ensureSessionResultTypeId } from "../services/session-result-type";
import { sessionEventOrderBy } from "../utils/session-event-time";
import { compareBuiltinFirst } from "./_game-masters";

const PAGE_SIZE = 20;

// Match gameGroup.list / useGameGroups: builtin buckets are
// limit -> stud -> bigbet, followed by custom groups alphabetically.
const CANONICAL_GAME_GROUP_ORDER = new Map<string, number>(
	DEFAULT_GAME_GROUPS.map((group, index) => [group.key, index])
);
const compareCanonicalGameGroups = compareBuiltinFirst(
	CANONICAL_GAME_GROUP_ORDER
);

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
			code: "FORBIDDEN",
			message: "You do not own this session",
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
 * batch (e.g. a 14-level blind structure at 10 columns = 140 params) overflows
 * a single statement and fails at runtime. Split the rows so every INSERT
 * stays under the cap. session_blind_level is at exactly 10 columns → 10 rows
 * per INSERT (10 × 10 = 100); adding an 11th column requires dropping the
 * chunk size to 9 or the re-INSERT overflows after the DELETE has committed.
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
	run: (chunk: Id[]) => Promise<Row[]>,
	extraBoundParams = 0
): Promise<Row[]> {
	if (
		!Number.isInteger(extraBoundParams) ||
		extraBoundParams < 0 ||
		extraBoundParams >= D1_MAX_BOUND_PARAMS
	) {
		throw new RangeError(
			`extraBoundParams must be an integer from 0 to ${D1_MAX_BOUND_PARAMS - 1}`
		);
	}
	const rows: Row[] = [];
	const perChunk = D1_MAX_BOUND_PARAMS - extraBoundParams;
	for (let index = 0; index < ids.length; index += perChunk) {
		rows.push(...(await run(ids.slice(index, index + perChunk))));
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
	games: LevelGameGroup[] | null;
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
				games: sessionBlindLevel.games,
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
			games: r.games,
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

interface SessionEventForList {
	eventType: string;
	payload: string;
}

/**
 * Batched lookup of session events for the live-session `list` endpoints, keyed
 * by session id and ordered by (occurredAt asc, sortOrder asc, id asc) — the exact order
 * the per-session query used before SA2-151 collapsed the N+1 (one
 * `WHERE session_id = ?` query per page item, up to limit+1 ≈ 100 extra
 * round-trips that D1's per-query latency made expensive) into a single
 * `inArray` fetch via {@link selectInChunks}. Each bucket is re-sorted in
 * application code so per-session ordering holds even though selectInChunks
 * concatenates chunk results (and a mocked db may ignore ORDER BY). Sessions
 * with no events are absent from the map.
 */
export async function getSessionEventMap(
	db: DbInstance,
	sessionIds: string[]
): Promise<Map<string, SessionEventForList[]>> {
	const map = new Map<string, SessionEventForList[]>();
	if (sessionIds.length === 0) {
		return map;
	}
	const rows = await selectInChunks(sessionIds, (chunk) =>
		db
			.select({
				id: sessionEvent.id,
				sessionId: sessionEvent.sessionId,
				eventType: sessionEvent.eventType,
				payload: sessionEvent.payload,
				occurredAt: sessionEvent.occurredAt,
				sortOrder: sessionEvent.sortOrder,
			})
			.from(sessionEvent)
			.where(inArray(sessionEvent.sessionId, chunk))
			.orderBy(...sessionEventOrderBy())
	);
	const buckets = new Map<
		string,
		{
			id: string;
			eventType: string;
			occurredAt: Date;
			payload: string;
			sortOrder: number;
		}[]
	>();
	for (const r of rows) {
		const entry = {
			id: r.id,
			eventType: r.eventType,
			payload: r.payload,
			occurredAt: r.occurredAt,
			sortOrder: r.sortOrder,
		};
		const existing = buckets.get(r.sessionId);
		if (existing) {
			existing.push(entry);
		} else {
			buckets.set(r.sessionId, [entry]);
		}
	}
	for (const [sessionId, events] of buckets) {
		events.sort(
			(a, b) =>
				Number(a.occurredAt) - Number(b.occurredAt) ||
				a.sortOrder - b.sortOrder ||
				a.id.localeCompare(b.id)
		);
		map.set(
			sessionId,
			events.map((e) => ({ eventType: e.eventType, payload: e.payload }))
		);
	}
	return map;
}

/**
 * Delete + reinsert a session's chip purchases together with their result
 * counts. The session_chip_purchase delete cascades to old result rows, so
 * only the inserts are added here. Used by both create and update so counts
 * are always written against the freshly generated purchase ids.
 */
function buildSessionChipPurchaseStatements(
	db: DbInstance,
	sessionId: string,
	chipPurchases: {
		chips: number;
		cost: number;
		count: number;
		name: string;
	}[]
): BatchStatement[] {
	// The DELETE always leads the group so the "clear then re-seed" runs as one
	// atomic unit — a failed re-INSERT can no longer permanently wipe the saved
	// chip-purchase history (SA2-116).
	const statements: BatchStatement[] = [
		db
			.delete(sessionChipPurchase)
			.where(eq(sessionChipPurchase.sessionId, sessionId)),
	];
	if (chipPurchases.length === 0) {
		return statements;
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
		statements.push(db.insert(sessionChipPurchase).values(chunk));
	}
	const resultRows = rows.map((r, idx) => ({
		sessionChipPurchaseId: r.id,
		count: chipPurchases[idx]?.count ?? 0,
	}));
	for (const chunk of chunkForInsert(resultRows, 2)) {
		statements.push(db.insert(sessionChipPurchaseResult).values(chunk));
	}
	return statements;
}

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
	await runBatch(
		db,
		buildSessionChipPurchaseStatements(db, sessionId, chipPurchases)
	);
}

/**
 * Delete + reinsert a session's blind level structure. Used by both create
 * (explicit override of the master snapshot) and update (session-wizard edits
 * to a session's own blind structure) so the array is always written fresh.
 */
function buildSessionBlindLevelStatements(
	db: DbInstance,
	sessionId: string,
	blindLevels: {
		ante?: number | null;
		blind1?: number | null;
		blind2?: number | null;
		blind3?: number | null;
		games?: LevelGameGroup[] | null;
		isBreak: boolean;
		minutes?: number | null;
	}[]
): BatchStatement[] {
	// DELETE leads so the whole re-seed commits (or rolls back) as one unit —
	// a failed re-INSERT can no longer strand the session with no blind
	// structure (SA2-116).
	const statements: BatchStatement[] = [
		db
			.delete(sessionBlindLevel)
			.where(eq(sessionBlindLevel.sessionId, sessionId)),
	];
	if (blindLevels.length === 0) {
		return statements;
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
		games: l.games ?? null,
	}));
	// 10 columns/row since the games column => 10 rows per INSERT under D1's
	// 100 bound-param cap (SA2-115).
	for (const chunk of chunkForInsert(rows, 10)) {
		statements.push(db.insert(sessionBlindLevel).values(chunk));
	}
	return statements;
}

export async function persistSessionBlindLevels(
	db: DbInstance,
	sessionId: string,
	blindLevels: {
		ante?: number | null;
		blind1?: number | null;
		blind2?: number | null;
		blind3?: number | null;
		games?: LevelGameGroup[] | null;
		isBreak: boolean;
		minutes?: number | null;
	}[]
): Promise<void> {
	await runBatch(
		db,
		buildSessionBlindLevelStatements(db, sessionId, blindLevels)
	);
}

/**
 * Assert the room `roomId` exists and belongs to `userId`, else throw FORBIDDEN
 * with `forbiddenMessage`. Shared by the room-derived ownership branches
 * (ringGame / tournament) so their ownership rule stays in one place.
 */
async function assertRoomOwnedBy(
	db: DbInstance,
	roomId: string,
	userId: string,
	forbiddenMessage: string
): Promise<void> {
	const [foundRoom] = await db.select().from(room).where(eq(room.id, roomId));
	if (!foundRoom || foundRoom.userId !== userId) {
		throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
	}
}

async function validateRingGameOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof ringGame.$inferSelect> {
	const [found] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}
	// A ring game now carries its own userId (SA2-181), so ownership is a direct
	// comparison — no longer derived from the room. A null userId is a
	// legacy/orphan row that cannot be proven owned → FORBIDDEN. This supersedes
	// the previous room-join and keeps null-roomId auto-generated snapshot rows
	// correctly owned after the backfill, closing the IDOR gap (SA2-174/SA2-181).
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this ring game",
		});
	}
	return found;
}

async function validateRoomOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof room.$inferSelect> {
	const [found] = await db.select().from(room).where(eq(room.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	}
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	}
	return found;
}

async function validateTournamentOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof tournament.$inferSelect> {
	const [found] = await db
		.select()
		.from(tournament)
		.where(eq(tournament.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	}
	// A tournament has no userId of its own; ownership is derived from its
	// room. Without this check a caller could pass another user's
	// tournamentId to snapshot their blind structure / chip purchases (IDOR).
	await assertRoomOwnedBy(
		db,
		found.roomId,
		userId,
		"You do not own this tournament"
	);
	return found;
}

async function validateCurrencyOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof currency.$inferSelect> {
	const [found] = await db
		.select()
		.from(currency)
		.where(eq(currency.id, entityId));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	}
	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	}
	return found;
}

async function validateGameGroupOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameGroup.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameGroup)
		.where(eq(gameGroup.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game group",
		});
	}
	return found;
}

async function validateGameVariantOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameVariant.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game variant",
		});
	}
	return found;
}

async function validateGameMixOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof gameMix.$inferSelect> {
	const [found] = await db
		.select()
		.from(gameMix)
		.where(eq(gameMix.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this mix",
		});
	}
	return found;
}

async function validateItemOwnershipBranch(
	db: DbInstance,
	entityId: string,
	userId: string
): Promise<typeof item.$inferSelect> {
	const [found] = await db.select().from(item).where(eq(item.id, entityId));
	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this item",
		});
	}
	return found;
}

/**
 * Uniform-FORBIDDEN ownership contract (SA2-183): fetch by id only, then
 * treat "missing" and "owned by someone else" identically. Shared by the
 * game-group/game-variant/game-mix routers, which previously hand-rolled this
 * exact check three times (`validateGameGroupOwnership`,
 * `validateGameVariantOwnership`, `validateGameMixOwnership` — c39). Each
 * entity type's check is factored into its own `validate*OwnershipBranch`
 * helper above so this dispatcher stays simple.
 */
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameGroup",
	entityId: string,
	userId: string
): Promise<typeof gameGroup.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameMix",
	entityId: string,
	userId: string
): Promise<typeof gameMix.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "gameVariant",
	entityId: string,
	userId: string
): Promise<typeof gameVariant.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "currency",
	entityId: string,
	userId: string
): Promise<typeof currency.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "ringGame",
	entityId: string,
	userId: string
): Promise<typeof ringGame.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "room",
	entityId: string,
	userId: string
): Promise<typeof room.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "tournament",
	entityId: string,
	userId: string
): Promise<typeof tournament.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType: "item",
	entityId: string,
	userId: string
): Promise<typeof item.$inferSelect>;
async function validateEntityOwnership(
	db: DbInstance,
	entityType:
		| "currency"
		| "gameGroup"
		| "gameMix"
		| "gameVariant"
		| "item"
		| "ringGame"
		| "room"
		| "tournament",
	entityId: string,
	userId: string
): Promise<unknown> {
	switch (entityType) {
		case "room":
			return await validateRoomOwnershipBranch(db, entityId, userId);
		case "ringGame":
			return await validateRingGameOwnershipBranch(db, entityId, userId);
		case "tournament":
			return await validateTournamentOwnershipBranch(db, entityId, userId);
		case "currency":
			return await validateCurrencyOwnershipBranch(db, entityId, userId);
		case "gameGroup":
			return await validateGameGroupOwnershipBranch(db, entityId, userId);
		case "gameVariant":
			return await validateGameVariantOwnershipBranch(db, entityId, userId);
		case "gameMix":
			return await validateGameMixOwnershipBranch(db, entityId, userId);
		case "item":
			return await validateItemOwnershipBranch(db, entityId, userId);
		default:
			return undefined;
	}
}

async function createCurrencyTransactionForSession(
	db: DbInstance,
	sessionId: string,
	currencyId: string,
	amount: number,
	sessionDate: Date,
	userId: string
) {
	const typeId = await ensureSessionResultTypeId(db, userId);
	await db.insert(currencyTransaction).values({
		id: crypto.randomUUID(),
		currencyId,
		transactionTypeId: typeId,
		sessionId,
		amount,
		transactedAt: sessionDate,
	});
}

/**
 * Build the "Session Result" ledger INSERT for a parent batch. The shared
 * ensure commits the persistent transaction-type master first; the returned
 * array contains only ledger statements so parent/session/tag writes remain
 * atomic. An unused master may remain when the parent batch fails (SA2-116).
 */
async function buildCurrencyTransactionStatements(
	db: DbInstance,
	sessionId: string,
	currencyId: string,
	amount: number,
	sessionDate: Date,
	userId: string
): Promise<BatchStatement[]> {
	const typeId = await ensureSessionResultTypeId(db, userId);
	return [
		db.insert(currencyTransaction).values({
			id: crypto.randomUUID(),
			currencyId,
			transactionTypeId: typeId,
			sessionId,
			amount,
			transactedAt: sessionDate,
		}),
	];
}

export async function syncCurrencyTransaction(
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
		// Delete the stale ledger row and re-create it for the new currency in a
		// SINGLE batch, so a failed re-INSERT can no longer permanently drop the
		// session's currency transaction (SA2-116 — the same failure class this PR
		// fixes on the create path).
		await runBatch(db, [
			db
				.delete(currencyTransaction)
				.where(eq(currencyTransaction.sessionId, sessionId)),
			...(await buildCurrencyTransactionStatements(
				db,
				sessionId,
				effectiveNewCurrencyId,
				amount,
				sessionDate,
				userId
			)),
		]);
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
	"mixGames",
	"blind1",
	"blind2",
	"blind3",
	"ante",
	"anteType",
	"minBuyIn",
	"maxBuyIn",
	"tableSize",
	"virtualBuyIn",
	"virtualCashOut",
	"itemUsages",
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
	"virtualBuyIn",
	"virtualCashOut",
	"itemUsages",
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

const nonNegativeIntegerSchema = z.number().int().min(0);
const nullableNonNegativeIntegerSchema = nonNegativeIntegerSchema.nullable();
const tableSizeSchema = z.number().int().min(2).max(10);
const nullableTableSizeSchema = tableSizeSchema.nullable();

// One item-based virtual buy-in / cash-out row. The server snapshots
// itemName / unitValue / currencyId from the authoritative item row at write
// time — the client only names the item, its direction, and how many.
// Shared by session.create and session.update (undefined = leave unchanged,
// [] = clear, same replacement semantics as tagIds / chipPurchases).
const itemUsageInputSchema = z.object({
	itemId: z.string().min(1),
	direction: z.enum(["buy_in", "cash_out"]),
	count: z.number().int().min(1),
});
const optionalItemUsagesSchema = z.array(itemUsageInputSchema).optional();

const sessionBlindLevelInputSchema = z.object({
	isBreak: z.boolean(),
	blind1: nullableNonNegativeIntegerSchema.optional(),
	blind2: nullableNonNegativeIntegerSchema.optional(),
	blind3: nullableNonNegativeIntegerSchema.optional(),
	ante: nullableNonNegativeIntegerSchema.optional(),
	minutes: nullableNonNegativeIntegerSchema.optional(),
	games: levelGamesSchema.nullish(),
});

const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: nonNegativeIntegerSchema,
	cashOut: nonNegativeIntegerSchema,
	evCashOut: nonNegativeIntegerSchema.optional(),
	roomId: z.string().min(1).optional(),
	ringGameId: z.string().min(1).optional(),
	currencyId: z.string().min(1).optional(),
	// Snapshot fields — written through to session_cash_detail. When
	// ringGameId is also provided, these override the parent values; when
	// no master is referenced they define the rule wholesale.
	ruleName: z.string().min(1).optional(),
	// Plain optional (mirrors tournamentCreateSchema.variant) — a schema-level
	// default here would coerce an omitted variant to a fixed string BEFORE it
	// ever reaches mergeCashSnapshotWithParent, permanently defeating
	// inheritance from the ring game (c10). The "NL Hold'em" fallback for the
	// true no-parent case lives solely in defaultCashSnapshot.
	variant: z.string().optional(),
	mixGames: mixGamesSchema.nullish(),
	blind1: nonNegativeIntegerSchema.optional(),
	blind2: nonNegativeIntegerSchema.optional(),
	blind3: nonNegativeIntegerSchema.optional(),
	ante: nonNegativeIntegerSchema.optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	minBuyIn: nonNegativeIntegerSchema.optional(),
	maxBuyIn: nonNegativeIntegerSchema.optional(),
	tableSize: tableSizeSchema.optional(),
	startedAt: z.number().optional(),
	endedAt: z.number().optional(),
	breakMinutes: nonNegativeIntegerSchema.optional(),
	memo: z.string().optional(),
	tagIds: optionalUniqueTagIdsSchema,
	virtualBuyIn: nonNegativeIntegerSchema.optional(),
	virtualCashOut: nonNegativeIntegerSchema.optional(),
	itemUsages: optionalItemUsagesSchema,
});

// A rule-defined chip purchase plus how many times it was bought (`count`).
// Shared by session.create and session.update.
const chipPurchaseInputSchema = z.object({
	name: z.string().min(1),
	cost: nonNegativeIntegerSchema,
	chips: nonNegativeIntegerSchema,
	count: nonNegativeIntegerSchema.default(0),
});

const tournamentCreateSchema = z
	.object({
		type: z.literal("tournament"),
		sessionDate: z.number(),
		tournamentBuyIn: nonNegativeIntegerSchema,
		entryFee: nonNegativeIntegerSchema.default(0),
		beforeDeadline: z.boolean().optional(),
		placement: z.number().int().min(1).optional(),
		totalEntries: z.number().int().min(1).optional(),
		prizeMoney: nonNegativeIntegerSchema.optional(),
		bountyPrizes: nonNegativeIntegerSchema.optional(),
		roomId: z.string().min(1).optional(),
		tournamentId: z.string().min(1).optional(),
		currencyId: z.string().min(1).optional(),
		// Snapshot fields — same role as on the cash schema. Allows manual
		// sessions (or wizard-driven creation) to declare the rule wholesale
		// even when no master tournament is referenced.
		ruleName: z.string().min(1).optional(),
		variant: z.string().optional(),
		startingStack: nonNegativeIntegerSchema.optional(),
		bountyAmount: nonNegativeIntegerSchema.optional(),
		tableSize: tableSizeSchema.optional(),
		blindLevels: z.array(sessionBlindLevelInputSchema).optional(),
		chipPurchases: z.array(chipPurchaseInputSchema).optional(),
		startedAt: z.number().optional(),
		endedAt: z.number().optional(),
		breakMinutes: nonNegativeIntegerSchema.optional(),
		memo: z.string().optional(),
		tagIds: optionalUniqueTagIdsSchema,
		virtualBuyIn: nonNegativeIntegerSchema.optional(),
		virtualCashOut: nonNegativeIntegerSchema.optional(),
		itemUsages: optionalItemUsagesSchema,
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

/**
 * Ownership guard for the room / currency links shared by the live cash-game
 * and live-tournament routers. A falsy value (undefined = omitted, null =
 * clear, "" = empty) skips validation; a provided id must exist AND belong to
 * the caller, else validateEntityOwnership throws FORBIDDEN.
 * Prevents IDOR on the money-ledger links (SA2-102).
 */
export async function validateLiveLinkOwnership(
	db: DbInstance,
	input: { currencyId?: string | null; roomId?: string | null },
	userId: string
) {
	if (input.roomId) {
		await validateEntityOwnership(db, "room", input.roomId, userId);
	}
	if (input.currencyId) {
		await validateEntityOwnership(db, "currency", input.currencyId, userId);
	}
}
/**
 * Validates every optional foreign-key filter at the resolver boundary. A
 * missing or foreign row must fail uniformly before an otherwise owner-scoped
 * query can turn it into an empty result (SA2-183).
 */
async function validateSessionFilterOwnership(
	db: DbInstance,
	input: { currencyId?: string; ringGameId?: string; roomId?: string },
	userId: string
): Promise<void> {
	if (input.roomId !== undefined) {
		await validateEntityOwnership(db, "room", input.roomId, userId);
	}
	if (input.currencyId !== undefined) {
		await validateEntityOwnership(db, "currency", input.currencyId, userId);
	}
	if (input.ringGameId !== undefined) {
		await validateEntityOwnership(db, "ringGame", input.ringGameId, userId);
	}
}

/**
 * Ownership guard for a set of tag ids linked to a session / player / etc.
 * Generic over any tag table exposing `id` + `userId` columns (session_tag,
 * player_tag, tournament_tag, …). Selects the caller-owned subset in a single
 * `WHERE id IN (…) AND userId = caller` query; if the distinct owned count
 * differs from the requested distinct count, at least one id is missing or
 * belongs to another user → FORBIDDEN. No-ops on empty / omitted ids so the
 * caller can pass `input.tagIds` directly. Prevents IDOR on tag links
 * (SA2-177).
 */
export async function validateTagsOwnership(
	db: DbInstance,
	table: SQLiteTable & { id: SQLiteColumn; userId: SQLiteColumn },
	ids: string[] | undefined,
	userId: string
): Promise<void> {
	if (!ids || ids.length === 0) {
		return;
	}
	const uniqueIds = [...new Set(ids)];
	const owned = await selectInChunks(
		uniqueIds,
		(chunk) =>
			db
				.select({ id: table.id })
				.from(table)
				.where(and(inArray(table.id, chunk), eq(table.userId, userId))),
		1
	);
	if (owned.length !== uniqueIds.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own one or more of these tags",
		});
	}
}

type ItemUsageInput = z.infer<typeof itemUsageInputSchema>;

/**
 * Ownership-check every itemId in the usage array (bulk-array rule: each id
 * validated before ANY write, uniform FORBIDDEN) and snapshot the usages from
 * the authoritative item rows — clients never dictate an item's value.
 * Editing re-snapshots at the item's CURRENT value (the chipPurchases
 * replacement behavior); untouched sessions keep their original snapshot.
 */
async function validateAndSnapshotItemUsages(
	db: DbInstance,
	usages: ItemUsageInput[] | undefined,
	userId: string
): Promise<SessionItemUsageInput[]> {
	if (!usages || usages.length === 0) {
		return [];
	}
	const uniqueIds = [...new Set(usages.map((u) => u.itemId))];
	const owned = await selectInChunks(
		uniqueIds,
		(chunk) =>
			db
				.select({
					id: item.id,
					name: item.name,
					unitValue: item.unitValue,
					currencyId: item.currencyId,
				})
				.from(item)
				.where(and(inArray(item.id, chunk), eq(item.userId, userId))),
		1
	);
	if (owned.length !== uniqueIds.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this item",
		});
	}
	const byId = new Map(owned.map((row) => [row.id, row]));
	return usages.map((usage) => {
		const ownedItem = byId.get(usage.itemId);
		return {
			itemId: usage.itemId,
			itemName: ownedItem?.name ?? "",
			unitValue: ownedItem?.unitValue ?? 0,
			currencyId: ownedItem?.currencyId ?? null,
			direction: usage.direction,
			count: usage.count,
		};
	});
}

/**
 * DELETE + chunked re-INSERT of a session's item-usage rows and its
 * session-generated item-ledger rows (one net-count row per item; net-zero
 * items get no row). Returned UN-executed so create/update commit them inside
 * one atomic batch (SA2-116).
 */
function buildSessionItemDataStatements(
	db: DbInstance,
	sessionId: string,
	usages: SessionItemUsageInput[],
	sessionDate: Date
): BatchStatement[] {
	const statements: BatchStatement[] = [
		db
			.delete(sessionItemUsage)
			.where(eq(sessionItemUsage.sessionId, sessionId)),
		db.delete(itemTransaction).where(eq(itemTransaction.sessionId, sessionId)),
	];

	const usageRows = usages.map((usage) => ({
		id: crypto.randomUUID(),
		sessionId,
		itemId: usage.itemId,
		direction: usage.direction,
		count: usage.count,
		itemName: usage.itemName,
		unitValue: usage.unitValue,
		currencyId: usage.currencyId,
	}));
	for (const chunk of chunkForInsert(usageRows, 8)) {
		statements.push(db.insert(sessionItemUsage).values(chunk));
	}

	const ledgerRows = [...computeNetItemCounts(usages)].map(
		([itemId, count]) => ({
			id: crypto.randomUUID(),
			itemId,
			sessionId,
			count,
			transactedAt: sessionDate,
		})
	);
	for (const chunk of chunkForInsert(ledgerRows, 5)) {
		statements.push(db.insert(itemTransaction).values(chunk));
	}

	return statements;
}

/** Per-session item usages for getById / list enrichment and stats, keyed by
 * session id. Mirrors {@link getSessionChipPurchaseMap}. */
export async function getSessionItemUsageMap(
	db: DbInstance,
	sessionIds: string[]
): Promise<Map<string, SessionItemUsageRow[]>> {
	const map = new Map<string, SessionItemUsageRow[]>();
	if (sessionIds.length === 0) {
		return map;
	}
	const rows = await selectInChunks(sessionIds, (chunk) =>
		db
			.select({
				sessionId: sessionItemUsage.sessionId,
				id: sessionItemUsage.id,
				itemId: sessionItemUsage.itemId,
				direction: sessionItemUsage.direction,
				count: sessionItemUsage.count,
				itemName: sessionItemUsage.itemName,
				unitValue: sessionItemUsage.unitValue,
				currencyId: sessionItemUsage.currencyId,
			})
			.from(sessionItemUsage)
			.where(inArray(sessionItemUsage.sessionId, chunk))
	);
	for (const r of rows) {
		const entry: SessionItemUsageRow = {
			id: r.id,
			itemId: r.itemId,
			direction: r.direction as "buy_in" | "cash_out",
			count: r.count,
			itemName: r.itemName,
			unitValue: r.unitValue,
			currencyId: r.currencyId,
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

export interface SessionItemUsageRow {
	count: number;
	currencyId: string | null;
	direction: "buy_in" | "cash_out";
	id: string;
	itemId: string | null;
	itemName: string;
	unitValue: number;
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
export function sessionOrderKeySql() {
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
 * non-integer / out-of-range timestamp, or empty id) so the caller treats it
 * as "no cursor" instead of crashing. Splits on the first separator only, so
 * ids containing `_` survive.
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
	const sortKey = new Date(ms);
	if (Number.isNaN(sortKey.getTime())) {
		return null;
	}
	return { id, sortKey };
}

/**
 * Build the composite-keyset WHERE condition for a session-list cursor, matching
 * the `(sessionOrderKey DESC, id DESC)` ordering: rows strictly after the cursor
 * in that order. Returns `undefined` for a missing / malformed cursor so the
 * caller starts from the beginning instead of filtering every row out — the
 * SA2-150 regression, where the old keyset ran a subquery on the raw cursor id,
 * and a since-deleted cursor row made that subquery return NULL (so
 * `started_at < NULL` dropped the whole page). The order key is stored in
 * seconds (sqlite "timestamp" mode), so the cursor's ms value is floored.
 */
export function sessionKeysetCondition(
	cursor: string | undefined
): SQL | undefined {
	if (!cursor) {
		return undefined;
	}
	const parsed = parseSessionCursor(cursor);
	if (!parsed) {
		return undefined;
	}
	const cursorSeconds = Math.floor(parsed.sortKey.getTime() / 1000);
	return sql`(${sessionOrderKeySql()} < ${cursorSeconds}) or (${sessionOrderKeySql()} = ${cursorSeconds} and ${gameSession.id} < ${parsed.id})`;
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
	const keyset = sessionKeysetCondition(filters.cursor);
	if (keyset) {
		paginationConditions.push(keyset);
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
function selectEnrichedSessionRows(db: DbInstance, userId: string) {
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
			// Pure-virtual amounts per detail table (a session has exactly one
			// detail row, so exactly one pair is non-null). Kept as plain columns
			// — no COALESCE — so mocked projections stay row-preserving.
			cashVirtualBuyIn: sessionCashDetail.virtualBuyIn,
			cashVirtualCashOut: sessionCashDetail.virtualCashOut,
			tournamentVirtualBuyIn: sessionTournamentDetail.virtualBuyIn,
			tournamentVirtualCashOut: sessionTournamentDetail.virtualCashOut,
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
			cashMixGames: sessionCashDetail.mixGames,
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
		.leftJoin(
			room,
			and(eq(room.id, gameSession.roomId), eq(room.userId, userId))
		)
		.leftJoin(
			currency,
			and(eq(currency.id, gameSession.currencyId), eq(currency.userId, userId))
		);
}

/**
 * Attaches chip purchases (+ their summed cost), profit/loss, the live-session
 * id discriminators, and tag links to raw session rows from
 * {@link selectEnrichedSessionRows}.
 */
async function enrichSessionRows<
	T extends Omit<ListItemRaw, "chipPurchaseCost"> & { id: string },
>(db: DbInstance, rows: T[], userId: string) {
	const detailSessionIds = rows.map((row) => row.id);
	const [chipPurchaseMap, blindLevelMap, itemUsageMap] = await Promise.all([
		getSessionChipPurchaseMap(db, detailSessionIds),
		getSessionBlindLevelMap(db, detailSessionIds),
		getSessionItemUsageMap(db, detailSessionIds),
	]);
	const withChipPurchases = rows.map((item) => {
		const chipPurchases = chipPurchaseMap.get(item.id) ?? [];
		return {
			...item,
			blindLevels: blindLevelMap.get(item.id) ?? [],
			chipPurchases,
			chipPurchaseCost: sumChipPurchaseCost(chipPurchases),
			itemUsages: itemUsageMap.get(item.id) ?? [],
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
				and(
					eq(sessionTag.id, sessionToSessionTag.sessionTagId),
					eq(sessionTag.userId, userId)
				)
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
	mixGames?: MixGameGroup[] | null;
	ringGameId?: string | null;
	ruleName?: string;
	tableSize?: number | null;
	variant?: string;
	virtualBuyIn?: number | null;
	virtualCashOut?: number | null;
}

function applyCashRuleScalarUpdates(
	cashUpdate: Partial<typeof sessionCashDetail.$inferInsert>,
	input: CashUpdateInput
): void {
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
}

async function applyCashDetailUpdate(
	db: DbInstance,
	sessionId: string,
	input: CashUpdateInput,
	userId: string
): Promise<void> {
	const [existingDetail] = await db
		.select()
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, sessionId));
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
	if (input.virtualBuyIn !== undefined) {
		cashUpdate.virtualBuyIn = input.virtualBuyIn ? input.virtualBuyIn : null;
	}
	if (input.virtualCashOut !== undefined) {
		cashUpdate.virtualCashOut = input.virtualCashOut
			? input.virtualCashOut
			: null;
	}

	// Snapshot field overrides — written to detail, never propagated to parent.
	applyCashRuleScalarUpdates(cashUpdate, input);

	if (input.ringGameId !== undefined) {
		cashUpdate.ringGameId = input.ringGameId;
	}
	if (input.ringGameId) {
		// Re-snapshot from the new parent, while letting explicit input fields
		// override.
		const snapshot = await resolveValidatedCashRuleSnapshot(db, input, userId);
		cashUpdate.ruleName = snapshot.ruleName;
		cashUpdate.variant = snapshot.variant;
		cashUpdate.mixGames = snapshot.mixGames;
		cashUpdate.blind1 = snapshot.blind1;
		cashUpdate.blind2 = snapshot.blind2;
		cashUpdate.blind3 = snapshot.blind3;
		cashUpdate.ante = snapshot.ante;
		cashUpdate.anteType = snapshot.anteType;
		cashUpdate.minBuyIn = snapshot.minBuyIn;
		cashUpdate.maxBuyIn = snapshot.maxBuyIn;
		cashUpdate.tableSize = snapshot.tableSize;
	} else {
		const selection = await reconcileCashRuleSelection(
			db,
			userId,
			existingDetail
				? {
						variant: existingDetail.variant,
						mixGames: existingDetail.mixGames ?? null,
					}
				: undefined,
			input
		);
		if (selection.shouldWriteMixGames) {
			cashUpdate.mixGames = selection.mixGames;
		}
		Object.assign(cashUpdate, cashMixFlatFieldClearPatch(selection.mixGames));
	}

	if (Object.keys(cashUpdate).length === 0) {
		return;
	}
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
		games?: LevelGameGroup[] | null;
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
	virtualBuyIn?: number | null;
	virtualCashOut?: number | null;
}

async function assertTournamentPlacementIntegrity(
	db: DbInstance,
	sessionId: string,
	input: TournamentUpdateInput
): Promise<void> {
	const changesPlacementState =
		input.beforeDeadline !== undefined ||
		input.placement !== undefined ||
		input.totalEntries !== undefined;
	if (!changesPlacementState || input.beforeDeadline === true) {
		return;
	}

	const [existing] = await db
		.select({
			beforeDeadline: sessionTournamentDetail.beforeDeadline,
			placement: sessionTournamentDetail.placement,
			totalEntries: sessionTournamentDetail.totalEntries,
		})
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, sessionId));

	const effectiveBeforeDeadline =
		input.beforeDeadline === undefined && existing?.beforeDeadline === true;
	if (effectiveBeforeDeadline) {
		return;
	}

	const placement =
		input.placement === undefined
			? (existing?.placement ?? null)
			: input.placement;
	const totalEntries =
		input.totalEntries === undefined
			? (existing?.totalEntries ?? null)
			: input.totalEntries;
	if (placement !== null && totalEntries !== null && placement > totalEntries) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Placement must be less than or equal to total entries",
		});
	}
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
	if (input.virtualBuyIn !== undefined) {
		tournUpdate.virtualBuyIn = input.virtualBuyIn ? input.virtualBuyIn : null;
	}
	if (input.virtualCashOut !== undefined) {
		tournUpdate.virtualCashOut = input.virtualCashOut
			? input.virtualCashOut
			: null;
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
	mixGames: MixGameGroup[] | null;
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
	mixGames?: MixGameGroup[] | null;
	ringGameId?: string | null;
	ruleName?: string;
	tableSize?: number | null;
	variant?: string;
}

interface CashRuleSelection {
	mixGames: MixGameGroup[] | null;
	variant: string;
}

interface ReconciledCashRuleSelection extends CashRuleSelection {
	shouldWriteMixGames: boolean;
}

interface CashMixFlatFieldClearPatch {
	ante: null;
	anteType: null;
	blind1: null;
	blind2: null;
	blind3: null;
}

export function cashMixFlatFieldClearPatch(
	mixGames: MixGameGroup[] | null
): Partial<CashMixFlatFieldClearPatch> {
	return mixGames === null
		? {}
		: {
				blind1: null,
				blind2: null,
				blind3: null,
				ante: null,
				anteType: null,
			};
}

function normalizedGameLabel(value: string): string {
	return value.trim().toLowerCase();
}

async function findOwnedNamedMix(
	db: DbInstance,
	userId: string,
	label: string
): Promise<{ games: string[]; label: string; userId: string } | undefined> {
	const rows = await db
		.select({
			games: gameMix.games,
			label: gameMix.label,
			userId: gameMix.userId,
		})
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	const normalized = normalizedGameLabel(label);
	return rows.find(
		(row) =>
			row.userId === userId && normalizedGameLabel(row.label) === normalized
	);
}

interface OwnedGameVariantRow {
	groupId: string;
	id: string;
	label: string;
	userId: string;
}

interface OwnedGameGroupRow {
	builtinKey: string | null;
	id: string;
	label: string;
	userId: string;
}

async function ownedGameVariantRows(
	db: DbInstance,
	userId: string
): Promise<OwnedGameVariantRow[]> {
	const rows = await db
		.select({
			groupId: gameVariant.groupId,
			id: gameVariant.id,
			label: gameVariant.label,
			userId: gameVariant.userId,
		})
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	return rows.filter((row) => row.userId === userId);
}

async function ownedGameGroupRows(
	db: DbInstance,
	userId: string
): Promise<OwnedGameGroupRow[]> {
	const rows = await db
		.select({
			builtinKey: gameGroup.builtinKey,
			id: gameGroup.id,
			label: gameGroup.label,
			userId: gameGroup.userId,
		})
		.from(gameGroup)
		.where(eq(gameGroup.userId, userId));
	return rows.filter((row) => row.userId === userId);
}

function mixVariantLabelSet(mixGames: MixGameGroup[] | null): Set<string> {
	return new Set(
		(mixGames ?? []).flatMap((group) => group.variants.map(normalizedGameLabel))
	);
}

function normalizedMixVariantBuckets(mixGames: MixGameGroup[]): string[][] {
	return mixGames.map((group) => group.variants.map(normalizedGameLabel));
}

function orderedBucketsEqual(left: string[][], right: string[][]): boolean {
	return (
		left.length === right.length &&
		left.every(
			(bucket, index) =>
				bucket.length === right[index]?.length &&
				bucket.every(
					(label, labelIndex) => label === right[index]?.[labelIndex]
				)
		)
	);
}

function hasSameFrozenMixStructure(
	left: MixGameGroup[] | null,
	right: MixGameGroup[] | null
): boolean {
	return (
		left !== null &&
		right !== null &&
		orderedBucketsEqual(
			normalizedMixVariantBuckets(left),
			normalizedMixVariantBuckets(right)
		)
	);
}

function throwInvalidMixReference(): never {
	throw new TRPCError({
		code: "BAD_REQUEST",
		message: "The mixed-game definition references an unavailable game master",
	});
}

async function assertLegacyMixVariantsOwned(
	db: DbInstance,
	userId: string,
	mixGames: MixGameGroup[],
	frozenMixGames: MixGameGroup[] | null
): Promise<void> {
	const frozenLabels = mixVariantLabelSet(frozenMixGames);
	const ownedLabels = new Set(
		(await ownedGameVariantRows(db, userId)).map((row) =>
			normalizedGameLabel(row.label)
		)
	);
	for (const label of mixVariantLabelSet(mixGames)) {
		if (!(frozenLabels.has(label) || ownedLabels.has(label))) {
			throwInvalidMixReference();
		}
	}
}

async function assertNamedMixComposition(
	db: DbInstance,
	userId: string,
	mix: { games: string[] },
	mixGames: MixGameGroup[]
): Promise<void> {
	const ownedVariants = await ownedGameVariantRows(db, userId);
	const variantById = new Map(ownedVariants.map((row) => [row.id, row]));
	const orderedVariants = mix.games.map((id) => variantById.get(id));
	if (orderedVariants.some((variant) => variant === undefined)) {
		throwInvalidMixReference();
	}

	const ownedGroups = await ownedGameGroupRows(db, userId);
	const groupById = new Map(ownedGroups.map((row) => [row.id, row]));
	const bucketsByGroupId = new Map<
		string,
		{ group: OwnedGameGroupRow; labels: string[] }
	>();
	for (const variant of orderedVariants) {
		if (!variant) {
			throwInvalidMixReference();
		}
		const group = groupById.get(variant.groupId);
		if (!group) {
			throwInvalidMixReference();
		}
		const existing = bucketsByGroupId.get(variant.groupId);
		if (existing) {
			existing.labels.push(normalizedGameLabel(variant.label));
		} else {
			bucketsByGroupId.set(variant.groupId, {
				group,
				labels: [normalizedGameLabel(variant.label)],
			});
		}
	}

	const expectedBuckets = [...bucketsByGroupId.values()]
		.sort((left, right) => {
			return compareCanonicalGameGroups(left.group, right.group);
		})
		.map((bucket) => bucket.labels);
	if (
		!orderedBucketsEqual(expectedBuckets, normalizedMixVariantBuckets(mixGames))
	) {
		throwInvalidMixReference();
	}
}

function isSameFrozenNamedMix(
	variant: string,
	currentVariant: string,
	mixGames: MixGameGroup[] | null,
	currentMixGames: MixGameGroup[] | null
): boolean {
	return (
		normalizedGameLabel(variant) === normalizedGameLabel(currentVariant) &&
		hasSameFrozenMixStructure(mixGames, currentMixGames)
	);
}

async function isValidMixedVariant(
	db: DbInstance,
	userId: string,
	variant: string,
	mixGames: MixGameGroup[] | null,
	currentVariant: string,
	currentMixGames: MixGameGroup[] | null
): Promise<boolean> {
	const normalizedVariant = normalizedGameLabel(variant);
	const sameVariant = normalizedVariant === normalizedGameLabel(currentVariant);
	if (normalizedVariant === MIX_VARIANT) {
		if (mixGames !== null) {
			await assertLegacyMixVariantsOwned(
				db,
				userId,
				mixGames,
				sameVariant ? currentMixGames : null
			);
		}
		return true;
	}
	const namedMix = await findOwnedNamedMix(db, userId, variant);
	if (!namedMix) {
		if (sameVariant && currentMixGames !== null) {
			if (mixGames === null) {
				return true;
			}
			if (
				isSameFrozenNamedMix(variant, currentVariant, mixGames, currentMixGames)
			) {
				return true;
			}
			throwInvalidMixReference();
		}
		return false;
	}
	if (mixGames !== null) {
		await assertNamedMixComposition(db, userId, namedMix, mixGames);
	}
	return true;
}

/**
 * Keep the frozen cash-rule discriminator and its optional mixed-game payload
 * coherent at every write boundary. Named mixes are labels of the caller's
 * game_mix rows; the legacy `mix` sentinel remains valid without a master row.
 * Existing snapshots are deliberately self-freezing, so re-submitting an
 * unchanged named mix still works after that master is renamed or deleted.
 */
export async function reconcileCashRuleSelection(
	db: DbInstance,
	userId: string,
	current: Partial<CashRuleSelection> | undefined,
	patch: { mixGames?: MixGameGroup[] | null; variant?: string }
): Promise<ReconciledCashRuleSelection> {
	const currentVariant = current?.variant ?? DEFAULT_VARIANT_LABEL;
	const currentMixGames = current?.mixGames ?? null;
	if (patch.variant === undefined && patch.mixGames === undefined) {
		return {
			variant: currentVariant,
			mixGames: currentMixGames,
			shouldWriteMixGames: false,
		};
	}
	const variant = patch.variant ?? currentVariant;
	const variantChanged =
		patch.variant !== undefined &&
		normalizedGameLabel(variant) !== normalizedGameLabel(currentVariant);
	let mixGames = variantChanged ? null : currentMixGames;
	if (patch.mixGames !== undefined) {
		mixGames = patch.mixGames;
	}

	const isMixedVariant = await isValidMixedVariant(
		db,
		userId,
		variant,
		mixGames,
		currentVariant,
		currentMixGames
	);

	if (isMixedVariant && mixGames === null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A mixed-game variant requires mixGames",
		});
	}
	if (!isMixedVariant && mixGames !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "mixGames can only be used with a mixed-game variant",
		});
	}

	return {
		variant,
		mixGames,
		shouldWriteMixGames:
			patch.mixGames !== undefined ||
			(variantChanged && currentMixGames !== null),
	};
}

function pick<T>(override: T | undefined, fallback: T): T {
	return override === undefined ? fallback : override;
}

function defaultCashSnapshot(input: CashRuleInput): CashRuleSnapshot {
	const snapshot: CashRuleSnapshot = {
		ruleName: input.ruleName ?? "Untitled",
		variant: input.variant ?? DEFAULT_VARIANT_LABEL,
		mixGames: input.mixGames ?? null,
		blind1: input.blind1 ?? null,
		blind2: input.blind2 ?? null,
		blind3: input.blind3 ?? null,
		ante: input.ante ?? null,
		anteType: input.anteType ?? null,
		minBuyIn: input.minBuyIn ?? null,
		maxBuyIn: input.maxBuyIn ?? null,
		tableSize: input.tableSize ?? null,
	};
	return { ...snapshot, ...cashMixFlatFieldClearPatch(snapshot.mixGames) };
}

function mergeCashSnapshotWithParent(
	input: CashRuleInput,
	rg: typeof ringGame.$inferSelect
): CashRuleSnapshot {
	const snapshot: CashRuleSnapshot = {
		ruleName: input.ruleName ?? rg.name,
		variant: input.variant ?? rg.variant,
		mixGames: pick(input.mixGames, rg.mixGames ?? null),
		blind1: pick(input.blind1, rg.blind1),
		blind2: pick(input.blind2, rg.blind2),
		blind3: pick(input.blind3, rg.blind3),
		ante: pick(input.ante, rg.ante),
		anteType: pick(input.anteType, rg.anteType),
		minBuyIn: pick(input.minBuyIn, rg.minBuyIn),
		maxBuyIn: pick(input.maxBuyIn, rg.maxBuyIn),
		tableSize: pick(input.tableSize, rg.tableSize),
	};
	return { ...snapshot, ...cashMixFlatFieldClearPatch(snapshot.mixGames) };
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

async function resolveValidatedCashRuleSnapshot(
	db: DbInstance,
	input: CashRuleInput,
	userId: string
): Promise<CashRuleSnapshot> {
	const [parent] = input.ringGameId
		? await db.select().from(ringGame).where(eq(ringGame.id, input.ringGameId))
		: [undefined];
	const selection = await reconcileCashRuleSelection(
		db,
		userId,
		parent
			? { variant: parent.variant, mixGames: parent.mixGames ?? null }
			: undefined,
		input
	);
	const normalizedInput = selection.shouldWriteMixGames
		? { ...input, mixGames: selection.mixGames }
		: input;
	return parent
		? mergeCashSnapshotWithParent(normalizedInput, parent)
		: defaultCashSnapshot(normalizedInput);
}

async function buildCashGameSessionDetailStatements(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof cashGameCreateSchema>,
	now: Date,
	userId: string
): Promise<BatchStatement[]> {
	const statements: BatchStatement[] = [];
	let ringGameId = input.ringGameId ?? null;
	const snapshot = await resolveValidatedCashRuleSnapshot(db, input, userId);

	if (!ringGameId) {
		ringGameId = crypto.randomUUID();
		// A mix game (or any rule with no blinds at all) has no single
		// blind1/blind2 pair to show, so `mix 0/0` is meaningless — fall back to
		// the display label alone (c11). `variantDisplayLabel` also maps the
		// "mix" pseudo-variant key to its "Mixed Game" display string.
		const displayLabel = variantDisplayLabel(snapshot.variant);
		const isBlindless =
			snapshot.mixGames !== null ||
			(snapshot.blind1 === null && snapshot.blind2 === null);
		const derivedName = isBlindless
			? displayLabel
			: `${displayLabel} ${snapshot.blind1 ?? 0}/${snapshot.blind2 ?? 0}`;
		statements.push(
			db.insert(ringGame).values({
				id: ringGameId,
				roomId: null,
				// Auto-generated snapshot row: anchor ownership on the creating user
				// (SA2-181) since it has no room to derive ownership from.
				userId,
				name: derivedName,
				variant: snapshot.variant,
				mixGames: snapshot.mixGames,
				blind1: snapshot.blind1,
				blind2: snapshot.blind2,
				blind3: snapshot.blind3,
				ante: snapshot.ante,
				anteType: snapshot.anteType,
				minBuyIn: null,
				maxBuyIn: null,
				tableSize: snapshot.tableSize,
				updatedAt: now,
			})
		);
		snapshot.ruleName = derivedName;
	}
	statements.push(
		db.insert(sessionCashDetail).values({
			sessionId,
			ringGameId,
			buyIn: input.buyIn,
			cashOut: input.cashOut,
			evCashOut: input.evCashOut ?? null,
			virtualBuyIn: input.virtualBuyIn ? input.virtualBuyIn : null,
			virtualCashOut: input.virtualCashOut ? input.virtualCashOut : null,
			ruleName: snapshot.ruleName,
			variant: snapshot.variant,
			mixGames: snapshot.mixGames,
			blind1: snapshot.blind1,
			blind2: snapshot.blind2,
			blind3: snapshot.blind3,
			ante: snapshot.ante,
			anteType: snapshot.anteType,
			minBuyIn: snapshot.minBuyIn,
			maxBuyIn: snapshot.maxBuyIn,
			tableSize: snapshot.tableSize,
		})
	);
	return statements;
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
		variant: input.variant ?? DEFAULT_VARIANT_LABEL,
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

async function buildTournamentSessionDetailStatements(
	db: DbInstance,
	sessionId: string,
	input: z.infer<typeof tournamentCreateSchema>
): Promise<BatchStatement[]> {
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
	const statements: BatchStatement[] = [
		db.insert(sessionTournamentDetail).values({
			sessionId,
			tournamentId: input.tournamentId ?? null,
			tournamentBuyIn: snapshot.tournamentBuyIn,
			entryFee: snapshot.entryFee,
			beforeDeadline: beforeDeadline ? true : null,
			placement: beforeDeadline ? null : (input.placement ?? null),
			totalEntries: beforeDeadline ? null : (input.totalEntries ?? null),
			prizeMoney: input.prizeMoney ?? null,
			bountyPrizes: input.bountyPrizes ?? null,
			virtualBuyIn: input.virtualBuyIn ? input.virtualBuyIn : null,
			virtualCashOut: input.virtualCashOut ? input.virtualCashOut : null,
			ruleName: snapshot.ruleName,
			variant: snapshot.variant,
			startingStack: snapshot.startingStack,
			bountyAmount: snapshot.bountyAmount,
			tableSize: snapshot.tableSize,
		}),
	];
	if (input.tournamentId) {
		statements.push(
			...(await buildTournamentStructureStatements(
				db,
				sessionId,
				input.tournamentId
			))
		);
	}
	// Allow callers to override the snapshotted structure with explicit
	// blind levels / chip purchases. This runs after the parent copy (still in
	// the same batch) so the explicit arrays win when both are supplied.
	if (input.blindLevels !== undefined) {
		statements.push(
			...buildSessionBlindLevelStatements(db, sessionId, input.blindLevels)
		);
	}
	if (input.chipPurchases !== undefined) {
		statements.push(
			...buildSessionChipPurchaseStatements(db, sessionId, input.chipPurchases)
		);
	}
	return statements;
}

/**
 * Read the parent tournament's blind levels + chip purchases and build the
 * INSERT statements that copy them onto a session. Returns the (possibly empty)
 * statement list UN-executed so callers can commit them inside a single batch
 * alongside any preceding DELETEs (SA2-116).
 */
async function buildTournamentStructureStatements(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<BatchStatement[]> {
	const statements: BatchStatement[] = [];

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
			games: l.games,
		}));
		// 10 columns/row since the games column => 10 rows per INSERT under
		// D1's 100 bound-param cap (SA2-115).
		for (const chunk of chunkForInsert(levelRows, 10)) {
			statements.push(db.insert(sessionBlindLevel).values(chunk));
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
			statements.push(db.insert(sessionChipPurchase).values(chunk));
		}
		// Every chip purchase starts with a result row (count 0) so the
		// result table always has a row to update.
		const resultRows = purchaseRows.map((r) => ({
			sessionChipPurchaseId: r.id,
			count: 0,
		}));
		for (const chunk of chunkForInsert(resultRows, 2)) {
			statements.push(db.insert(sessionChipPurchaseResult).values(chunk));
		}
	}

	return statements;
}

async function snapshotTournamentStructure(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<void> {
	await runBatch(
		db,
		await buildTournamentStructureStatements(db, sessionId, tournamentId)
	);
}

async function resnapshotTournamentStructure(
	db: DbInstance,
	sessionId: string,
	tournamentId: string
): Promise<void> {
	// Both DELETEs and the re-copied structure commit as one batch, so a failed
	// re-snapshot can no longer leave the session with its old structure wiped
	// and nothing written back (SA2-116).
	const statements: BatchStatement[] = [
		db
			.delete(sessionBlindLevel)
			.where(eq(sessionBlindLevel.sessionId, sessionId)),
		db
			.delete(sessionChipPurchase)
			.where(eq(sessionChipPurchase.sessionId, sessionId)),
		...(await buildTournamentStructureStatements(db, sessionId, tournamentId)),
	];
	await runBatch(db, statements);
}

export {
	buildTournamentStructureStatements,
	persistSessionChipPurchases,
	resnapshotTournamentStructure,
	resolveCashRuleSnapshot,
	resolveTournamentRuleSnapshot,
	snapshotTournamentStructure,
};

function buildSessionTagStatements(
	db: DbInstance,
	sessionId: string,
	tagIds: string[] | undefined
): BatchStatement[] {
	if (!(tagIds && tagIds.length > 0)) {
		return [];
	}
	const rows = tagIds.map((tagId) => ({ sessionId, sessionTagId: tagId }));
	return chunkForInsert(rows, 2).map((chunk) =>
		db.insert(sessionToSessionTag).values(chunk)
	);
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

async function buildCreateCurrencyTxStatements(
	db: DbInstance,
	id: string,
	input: CreateInput,
	sessionDate: Date,
	userId: string
): Promise<BatchStatement[]> {
	if (!input.currencyId) {
		return [];
	}
	const pl = _computeCreatePL(input);
	return await buildCurrencyTransactionStatements(
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

			// Validate every link + tag ownership BEFORE any write so the whole
			// create commits as a single atomic batch (SA2-116): the session row,
			// its type detail, tag links and currency-ledger row land together —
			// a mid-sequence failure can no longer leave an orphan session with no
			// detail/tags.
			await validateCreateLinks(ctx.db, input, userId);
			await validateTagsOwnership(ctx.db, sessionTag, input.tagIds, userId);
			const snapshotItemUsages = await validateAndSnapshotItemUsages(
				ctx.db,
				input.itemUsages,
				userId
			);

			const statements: BatchStatement[] = [
				ctx.db.insert(gameSession).values({
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
				}),
			];

			if (input.type === "cash_game") {
				statements.push(
					...(await buildCashGameSessionDetailStatements(
						ctx.db,
						id,
						input,
						now,
						userId
					))
				);
			} else {
				statements.push(
					...(await buildTournamentSessionDetailStatements(ctx.db, id, input))
				);
			}

			statements.push(...buildSessionTagStatements(ctx.db, id, input.tagIds));
			if (snapshotItemUsages.length > 0) {
				statements.push(
					...buildSessionItemDataStatements(
						ctx.db,
						id,
						snapshotItemUsages,
						sessionDate
					)
				);
			}
			statements.push(
				...(await buildCreateCurrencyTxStatements(
					ctx.db,
					id,
					input,
					sessionDate,
					userId
				))
			);

			await runBatch(ctx.db, statements);

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
			await validateSessionFilterOwnership(ctx.db, input, userId);
			const { paginationConditions } = buildSessionListConditions(
				userId,
				input
			);

			const data = await selectEnrichedSessionRows(ctx.db, userId)
				.where(and(...paginationConditions))
				.orderBy(desc(sessionOrderKeySql()), desc(gameSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const last = items.at(-1);
			const nextCursor =
				hasMore && last ? encodeSessionCursor(last) : undefined;

			const itemsWithTags = await enrichSessionRows(ctx.db, items, userId);

			const summary = await computeSummary(ctx.db, userId, input, input.type);

			return { items: itemsWithTags, nextCursor, summary };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			// Ownership guard — throws FORBIDDEN when the session is missing or
			// belongs to another user.
			await validateSessionOwnership(ctx.db, input.id, userId);

			const rows = await selectEnrichedSessionRows(ctx.db, userId).where(
				and(eq(gameSession.id, input.id), eq(gameSession.userId, userId))
			);
			const [enriched] = await enrichSessionRows(ctx.db, rows, userId);

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
			z
				.object({
					id: z.string(),
					sessionDate: z.number().optional(),
					roomId: z.string().min(1).nullable().optional(),
					ringGameId: z.string().min(1).nullable().optional(),
					tournamentId: z.string().min(1).nullable().optional(),
					currencyId: z.string().min(1).nullable().optional(),
					buyIn: nonNegativeIntegerSchema.optional(),
					cashOut: nonNegativeIntegerSchema.optional(),
					evCashOut: nullableNonNegativeIntegerSchema.optional(),
					tournamentBuyIn: nonNegativeIntegerSchema.optional(),
					entryFee: nonNegativeIntegerSchema.optional(),
					placement: z.number().int().min(1).nullable().optional(),
					totalEntries: z.number().int().min(1).nullable().optional(),
					beforeDeadline: z.boolean().nullable().optional(),
					prizeMoney: nullableNonNegativeIntegerSchema.optional(),
					bountyPrizes: nullableNonNegativeIntegerSchema.optional(),
					startingStack: nullableNonNegativeIntegerSchema.optional(),
					bountyAmount: nullableNonNegativeIntegerSchema.optional(),
					blindLevels: z.array(sessionBlindLevelInputSchema).optional(),
					chipPurchases: z.array(chipPurchaseInputSchema).optional(),
					startedAt: z.number().nullable().optional(),
					endedAt: z.number().nullable().optional(),
					breakMinutes: nullableNonNegativeIntegerSchema.optional(),
					memo: z.string().nullable().optional(),
					ruleName: z.string().optional(),
					variant: z.string().optional(),
					mixGames: mixGamesSchema.nullish(),
					blind1: nullableNonNegativeIntegerSchema.optional(),
					blind2: nullableNonNegativeIntegerSchema.optional(),
					blind3: nullableNonNegativeIntegerSchema.optional(),
					ante: nullableNonNegativeIntegerSchema.optional(),
					anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
					tableSize: nullableTableSizeSchema.optional(),
					minBuyIn: nullableNonNegativeIntegerSchema.optional(),
					maxBuyIn: nullableNonNegativeIntegerSchema.optional(),
					tagIds: optionalUniqueTagIdsSchema,
					virtualBuyIn: nullableNonNegativeIntegerSchema.optional(),
					virtualCashOut: nullableNonNegativeIntegerSchema.optional(),
					itemUsages: optionalItemUsagesSchema,
				})
				.refine(
					(data) =>
						data.beforeDeadline === true ||
						data.placement === undefined ||
						data.placement === null ||
						data.totalEntries === undefined ||
						data.totalEntries === null ||
						data.placement <= data.totalEntries,
					{
						message: "Placement must be less than or equal to total entries",
					}
				)
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);

			assertNoLiveLinkedRestrictedEdits(
				{ source: session.source, kind: session.kind },
				input
			);

			if (session.kind === "tournament") {
				await assertTournamentPlacementIntegrity(ctx.db, input.id, input);
			}
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

			if (input.tagIds !== undefined) {
				await validateTagsOwnership(ctx.db, sessionTag, input.tagIds, userId);
			}

			const snapshotItemUsages =
				input.itemUsages === undefined
					? undefined
					: await validateAndSnapshotItemUsages(
							ctx.db,
							input.itemUsages,
							userId
						);

			const sessionUpdateFields = buildSessionUpdateFields(input);
			await ctx.db
				.update(gameSession)
				.set(sessionUpdateFields)
				.where(eq(gameSession.id, input.id));

			if (session.kind === "cash_game") {
				await applyCashDetailUpdate(ctx.db, input.id, input, userId);
			} else {
				await applyTournamentDetailUpdate(ctx.db, input.id, input);
			}

			if (input.tagIds !== undefined) {
				// Replace the tag links atomically. A bare DELETE followed by
				// separately-awaited INSERTs auto-commits the DELETE, so a failed
				// re-insert would strand the session with no tags (SA2-116) — the
				// exact DELETE-then-reINSERT shape the create path already batches.
				const tagStatements: BatchStatement[] = [
					ctx.db
						.delete(sessionToSessionTag)
						.where(eq(sessionToSessionTag.sessionId, input.id)),
				];
				if (input.tagIds.length > 0) {
					const tagRows = input.tagIds.map((tagId) => ({
						sessionId: input.id,
						sessionTagId: tagId,
					}));
					for (const chunk of chunkForInsert(tagRows, 2)) {
						tagStatements.push(
							ctx.db.insert(sessionToSessionTag).values(chunk)
						);
					}
				}
				await runBatch(ctx.db, tagStatements);
			}

			if (snapshotItemUsages !== undefined) {
				// Replace the usage rows and the session's item-ledger rows
				// atomically (DELETE + re-INSERT in one batch, SA2-116).
				const effectiveSessionDate =
					input.sessionDate === undefined
						? session.sessionDate
						: new Date(input.sessionDate * 1000);
				await runBatch(
					ctx.db,
					buildSessionItemDataStatements(
						ctx.db,
						input.id,
						snapshotItemUsages,
						effectiveSessionDate
					)
				);
			} else if (input.sessionDate !== undefined) {
				// Keep session-generated ledger rows dated to the session even when
				// only the date changes (mirrors syncCurrencyTransaction's
				// transactedAt refresh below).
				await ctx.db
					.update(itemTransaction)
					.set({ transactedAt: new Date(input.sessionDate * 1000) })
					.where(eq(itemTransaction.sessionId, input.id));
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
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionFilterOwnership(ctx.db, input, userId);
			return fetchProfitLossSeries(ctx.db, userId, input);
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
