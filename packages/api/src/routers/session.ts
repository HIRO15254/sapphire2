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
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionBlindLevel } from "@sapphire2/db/schema/session-blind-level";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
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
import {
	type BatchStatement,
	chunkForInsert,
	D1_MAX_BOUND_PARAMS,
	runBatch,
} from "../lib/batch";
import { optionalUniqueTagIdsSchema } from "../lib/tag-ids";
import { listOwnedGameMixes } from "../services/game-mix";
import { ensureSessionResultTypeId } from "../services/session-result-type";
import { sessionEventOrderBy } from "../utils/session-event-time";
import { compareBuiltinFirst } from "./_game-masters";

const PAGE_SIZE = 20;

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

function computeCashGamePL(
	buyIn: number,
	cashOut: number,
	chipRemoveTotal = 0
): number {
	return cashOut + chipRemoveTotal - buyIn;
}

export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number
): number;
export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number | null
): number | null;
export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number | null
): number | null {
	return evCashOut ?? cashOut;
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

export { chunkForInsert } from "../lib/batch";

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

function sumChipPurchaseCost(
	purchases: { cost: number; count: number }[]
): number {
	return purchases.reduce((acc, p) => acc + p.cost * p.count, 0);
}

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
	entityType:
		| "currency"
		| "gameGroup"
		| "gameMix"
		| "gameVariant"
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

const nonNegativeIntegerSchema = z.number().int().min(0);
const nullableNonNegativeIntegerSchema = nonNegativeIntegerSchema.nullable();
const tableSizeSchema = z.number().int().min(2).max(10);
const nullableTableSizeSchema = tableSizeSchema.nullable();

const sessionBlindLevelInputSchema = z.object({
	isBreak: z.boolean(),
	blind1: nullableNonNegativeIntegerSchema.optional(),
	blind2: nullableNonNegativeIntegerSchema.optional(),
	blind3: nullableNonNegativeIntegerSchema.optional(),
	ante: nullableNonNegativeIntegerSchema.optional(),
	minutes: nullableNonNegativeIntegerSchema.optional(),
	games: levelGamesSchema.nullish(),
});

export const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: nonNegativeIntegerSchema,
	cashOut: nonNegativeIntegerSchema,
	evCashOut: nonNegativeIntegerSchema.optional(),
	roomId: z.string().min(1).optional(),
	ringGameId: z.string().min(1).optional(),
	currencyId: z.string().min(1).optional(),
	ruleName: z.string().min(1).optional(),
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
});

const chipPurchaseInputSchema = z.object({
	name: z.string().min(1),
	cost: nonNegativeIntegerSchema,
	chips: nonNegativeIntegerSchema,
	count: nonNegativeIntegerSchema.default(0),
});

export const tournamentCreateSchema = z
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

export const sessionListInputSchema = z.object({
	cursor: z.string().optional(),
	type: z.enum(["cash_game", "tournament"]).optional(),
	roomId: z.string().optional(),
	currencyId: z.string().optional(),
	dateFrom: z.number().optional(),
	dateTo: z.number().optional(),
});

export const sessionGetByIdInputSchema = z.object({ id: z.string() });

export const sessionUpdateInputSchema = z
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
	);

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
	chipRemoveTotal: number | null;
	entryFee: number | null;
	evCashOut: number | null;
	placement: number | null;
	prizeMoney: number | null;
	totalEntries: number | null;
	type: string;
}

function computeSessionPLFromRow(s: SummarySessionRow): number {
	if (s.type === "cash_game" && s.buyIn !== null && s.cashOut !== null) {
		return computeCashGamePL(s.buyIn, s.cashOut, s.chipRemoveTotal ?? 0);
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
		recordedEvCount: number;
	},
	update: (ev: {
		totalEvProfitLoss: number;
		totalEvDiff: number;
		recordedEvCount: number;
	}) => void
) {
	if (s.type !== "cash_game" || s.buyIn === null) {
		return;
	}
	const evCashOut = resolveEvCashOut(s.evCashOut, s.cashOut);
	if (evCashOut === null) {
		return;
	}
	const evPl = evCashOut + (s.chipRemoveTotal ?? 0) - s.buyIn;
	update({
		totalEvProfitLoss: current.totalEvProfitLoss + evPl,
		totalEvDiff: current.totalEvDiff + (evPl - pl),
		recordedEvCount: current.recordedEvCount + (s.evCashOut === null ? 0 : 1),
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
	let recordedEvCount = 0;

	for (const s of allSessions) {
		const pl = computeSessionPLFromRow(s);
		totalProfitLoss += pl;
		if (pl > 0) {
			winCount++;
		}

		accumulateEvMetrics(
			s,
			pl,
			{ totalEvProfitLoss, totalEvDiff, recordedEvCount },
			(ev) => {
				totalEvProfitLoss = ev.totalEvProfitLoss;
				totalEvDiff = ev.totalEvDiff;
				recordedEvCount = ev.recordedEvCount;
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
		recordedEvCount,
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
			chipRemoveTotal: sessionCashDetail.chipRemoveTotal,
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
		totalEvProfitLoss: agg.recordedEvCount > 0 ? agg.totalEvProfitLoss : null,
		totalEvDiff: agg.recordedEvCount > 0 ? agg.totalEvDiff : null,
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

interface ListFilters {
	currencyId?: string;
	cursor?: string;
	dateFrom?: number;
	dateTo?: number;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

export function sessionOrderKeySql() {
	return sql`coalesce(${gameSession.startedAt}, ${gameSession.sessionDate})`;
}

export function encodeSessionCursor(row: {
	id: string;
	sessionDate: Date;
	startedAt: Date | null;
}): string {
	const sortKey = row.startedAt ?? row.sessionDate;
	return `${sortKey.getTime()}_${row.id}`;
}

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
	chipRemoveTotal: number | null;
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
	chipRemoveTotal: number | null;
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
	const chipRemoveTotal = r.chipRemoveTotal ?? 0;
	const evCashOut = resolveEvCashOut(r.evCashOut, r.cashOut);
	return {
		profitLoss: computeCashGamePL(r.buyIn, r.cashOut, chipRemoveTotal),
		evProfitLoss: computeCashGamePL(r.buyIn, evCashOut, chipRemoveTotal),
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
			chipRemoveTotal: sessionCashDetail.chipRemoveTotal,
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
		sortKey: Math.floor((r.startedAt ?? r.sessionDate).getTime() / 1000),
		profitLoss,
		evProfitLoss: cashStats.evProfitLoss,
		evRecorded: r.type === "cash_game" && r.evCashOut !== null,
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
		const chipRemoveTotal = item.chipRemoveTotal ?? 0;
		profitLoss = computeCashGamePL(item.buyIn, item.cashOut, chipRemoveTotal);
		const evCashOut = resolveEvCashOut(item.evCashOut, item.cashOut);
		evProfitLoss = evCashOut + chipRemoveTotal - item.buyIn;
		evDiff = evProfitLoss - profitLoss;
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
			chipRemoveTotal: sessionCashDetail.chipRemoveTotal,
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
			cashVariant: sessionCashDetail.variant,
			cashMixGames: sessionCashDetail.mixGames,
			cashBlind1: sessionCashDetail.blind1,
			cashBlind3: sessionCashDetail.blind3,
			cashAnte: sessionCashDetail.ante,
			cashAnteType: sessionCashDetail.anteType,
			cashMinBuyIn: sessionCashDetail.minBuyIn,
			cashMaxBuyIn: sessionCashDetail.maxBuyIn,
			cashTableSize: sessionCashDetail.tableSize,
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

async function enrichSessionRows<
	T extends Omit<ListItemRaw, "chipPurchaseCost"> & { id: string },
>(db: DbInstance, rows: T[], userId: string) {
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

	applyCashRuleScalarUpdates(cashUpdate, input);

	if (input.ringGameId !== undefined) {
		cashUpdate.ringGameId = input.ringGameId;
	}
	if (input.ringGameId) {
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

	if (input.tournamentId) {
		await resnapshotTournamentStructure(db, sessionId, input.tournamentId);
	}

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
	const rows = await listOwnedGameMixes(db, userId);
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
	cashDetail:
		| {
				buyIn: number | null;
				cashOut: number | null;
				chipRemoveTotal: number | null;
		  }
		| undefined,
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
		return computeCashGamePL(
			cashDetail.buyIn,
			cashDetail.cashOut,
			cashDetail.chipRemoveTotal ?? 0
		);
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
			await validateTagsOwnership(ctx.db, sessionTag, input.tagIds, userId);

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
		.input(sessionListInputSchema)
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
		.input(sessionGetByIdInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
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
		.input(sessionUpdateInputSchema)
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
