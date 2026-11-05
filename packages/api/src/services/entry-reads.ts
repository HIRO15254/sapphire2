import type { Database } from "@sapphire2/db";
import type {
	EntryKind,
	EntrySource,
	EntryStatus,
	PlaySessionEndState,
	PlaySessionStatus,
} from "@sapphire2/db/constants/entry";
import type { LedgerEffect, LedgerRole } from "@sapphire2/db/constants/ledger";
import { asset } from "@sapphire2/db/schema/asset";
import {
	entry,
	entryCash,
	entryTournament,
	playSession,
} from "@sapphire2/db/schema/entry";
import { entryTag, entryTagLink } from "@sapphire2/db/schema/entry-tag";
import { hand } from "@sapphire2/db/schema/hand";
import {
	assetRate,
	ledgerLine,
	userSetting,
} from "@sapphire2/db/schema/ledger";
import { room } from "@sapphire2/db/schema/room";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { selectInChunks } from "../lib/batch";
import type { CashRuleOutput } from "./cash-rules";
import { type EntryRuleOutput, hydrateEntryRules } from "./entry-rules";
import type { LineupMap } from "./game-lineup";
import { ruleLineupIds, type TournamentRuleOutput } from "./tournament-rule";
import {
	isPayment,
	type MissingRate,
	type ValuationAmounts,
	type ValuationAsset,
	type ValuationRate,
	valueEntries,
} from "./valuation";

const OWNER_SCOPED_CHUNK_EXTRA = 1;

export interface EntryListFilters {
	assetId?: string;
	dateFrom?: string;
	dateTo?: string;
	kind?: EntryKind;
	roomId?: string;
	source?: EntrySource;
	status?: EntryStatus;
}

export interface EntryLine {
	assetId: string;
	effect: LedgerEffect;
	entryId: string;
	eventId: string | null;
	id: string;
	occurredAt: Date;
	playSessionId: string | null;
	priceId: string | null;
	quantity: number;
	role: LedgerRole;
}

export interface EntryAmounts {
	buyIn: number;
	cashOut: number;
	profitLoss: number;
}

export interface AssetTotal extends EntryAmounts {
	assetId: string;
	effect: LedgerEffect;
	roleTotals: Partial<
		Record<LedgerRole, { lineCount: number; quantity: number }>
	>;
}

export interface EntryValuationOutput {
	baseAssetId: string | null;
	missingRates: { real: MissingRate[]; virtual: MissingRate[] };
	real: ValuationAmounts | null;
	virtual: ValuationAmounts | null;
}

export interface PlaySessionOutput {
	breakMinutes: number;
	clockStartedAt: Date | null;
	clockStartLevel: number | null;
	endedAt: Date | null;
	endStack: number | null;
	endState: PlaySessionEndState | null;
	id: string;
	label: string | null;
	localDate: string;
	seq: number;
	startedAt: Date | null;
	status: PlaySessionStatus;
}

interface EntryOutputBase {
	assetId: string | null;
	createdAt: Date;
	currentMasterRuleId: string | null;
	handCount: number;
	id: string;
	lines: EntryLine[];
	lineups: LineupMap;
	memo: string | null;
	playedOn: string;
	playMinutes: number;
	playSessions: PlaySessionOutput[];
	roomId: string | null;
	roomName: string | null;
	ruleDrift: boolean;
	ruleVersionId: string;
	source: EntrySource;
	status: EntryStatus;
	tags: { id: string; name: string }[];
	title: string | null;
	totals: AssetTotal[];
	updatedAt: Date;
	valuation: EntryValuationOutput;
}

export type EntryOutput = EntryOutputBase &
	(
		| {
				cash: { bigBlind: number | null; evDiff: number | null };
				kind: "cash";
				ringGameId: string | null;
				ruleVersion: CashRuleOutput;
				tournament: null;
				tournamentId: null;
		  }
		| {
				cash: null;
				kind: "tournament";
				ringGameId: null;
				ruleVersion: TournamentRuleOutput;
				tournament: {
					beforeDeadline: boolean;
					placement: number | null;
					totalEntries: number | null;
				};
				tournamentId: string | null;
		  }
	);

function entryRowQuery(db: Database) {
	return db
		.select({
			id: entry.id,
			kind: entry.kind,
			source: entry.source,
			status: entry.status,
			playedOn: entry.playedOn,
			title: entry.title,
			roomId: entry.roomId,
			roomName: room.name,
			assetId: entry.assetId,
			memo: entry.memo,
			createdAt: entry.createdAt,
			updatedAt: entry.updatedAt,
			ringGameId: entryCash.ringGameId,
			cashRuleId: entryCash.cashRuleId,
			evDiff: entryCash.evDiff,
			tournamentId: entryTournament.tournamentId,
			tournamentRuleId: entryTournament.tournamentRuleId,
			placement: entryTournament.placement,
			totalEntries: entryTournament.totalEntries,
			beforeDeadline: entryTournament.beforeDeadline,
		})
		.from(entry)
		.leftJoin(
			room,
			and(eq(room.id, entry.roomId), eq(room.userId, entry.userId))
		)
		.leftJoin(
			entryCash,
			and(eq(entryCash.entryId, entry.id), eq(entryCash.userId, entry.userId))
		)
		.leftJoin(
			entryTournament,
			and(
				eq(entryTournament.entryId, entry.id),
				eq(entryTournament.userId, entry.userId)
			)
		);
}

export interface EntryRow {
	assetId: string | null;
	beforeDeadline: boolean | null;
	cashRuleId: string | null;
	createdAt: Date;
	evDiff: number | null;
	id: string;
	kind: EntryKind;
	memo: string | null;
	placement: number | null;
	playedOn: string;
	ringGameId: string | null;
	roomId: string | null;
	roomName: string | null;
	source: EntrySource;
	status: EntryStatus;
	title: string | null;
	totalEntries: number | null;
	tournamentId: string | null;
	tournamentRuleId: string | null;
	updatedAt: Date;
}

export function entryFilterConditions(
	userId: string,
	filters: EntryListFilters
): SQL[] {
	const conditions: (SQL | undefined)[] = [
		eq(entry.userId, userId),
		filters.kind ? eq(entry.kind, filters.kind) : undefined,
		filters.status ? eq(entry.status, filters.status) : undefined,
		filters.source ? eq(entry.source, filters.source) : undefined,
		filters.roomId ? eq(entry.roomId, filters.roomId) : undefined,
		filters.dateFrom
			? sql`${entry.playedOn} >= ${filters.dateFrom}`
			: undefined,
		filters.dateTo ? sql`${entry.playedOn} <= ${filters.dateTo}` : undefined,
		filters.assetId
			? sql`EXISTS (SELECT 1 FROM ${ledgerLine} WHERE ${ledgerLine.entryId} = ${entry.id} AND ${ledgerLine.userId} = ${entry.userId} AND ${ledgerLine.assetId} = ${filters.assetId})`
			: undefined,
	];
	return conditions.filter((condition) => condition !== undefined);
}

export async function selectEntryPage(
	db: Database,
	userId: string,
	filters: EntryListFilters,
	options: { after?: { id: string; playedOn: string }; limit: number }
): Promise<EntryRow[]> {
	const after = options.after;
	return await entryRowQuery(db)
		.where(
			and(
				...entryFilterConditions(userId, filters),
				after
					? sql`(${entry.playedOn}, ${entry.id}) < (${after.playedOn}, ${after.id})`
					: undefined
			)
		)
		.orderBy(desc(entry.playedOn), desc(entry.id))
		.limit(options.limit);
}

async function selectEntryRows(
	db: Database,
	userId: string,
	ids: string[]
): Promise<EntryRow[]> {
	return await selectInChunks(
		ids,
		(chunk) =>
			entryRowQuery(db).where(
				and(eq(entry.userId, userId), inArray(entry.id, chunk))
			),
		OWNER_SCOPED_CHUNK_EXTRA
	);
}

export function groupBy<Row>(
	rows: Row[],
	key: (row: Row) => string
): Map<string, Row[]> {
	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		const group = groups.get(key(row));
		if (group) {
			group.push(row);
		} else {
			groups.set(key(row), [row]);
		}
	}
	return groups;
}

function nativeTotals(lines: EntryLine[]): AssetTotal[] {
	const totals = new Map<string, AssetTotal>();
	for (const line of lines) {
		const key = `${line.assetId}|${line.effect}`;
		let total = totals.get(key);
		if (!total) {
			total = {
				assetId: line.assetId,
				effect: line.effect,
				roleTotals: {},
				buyIn: 0,
				cashOut: 0,
				profitLoss: 0,
			};
			totals.set(key, total);
		}
		const role = total.roleTotals[line.role] ?? { quantity: 0, lineCount: 0 };
		role.quantity += line.quantity;
		role.lineCount += 1;
		total.roleTotals[line.role] = role;
		total.profitLoss += line.quantity;
		if (isPayment(line.quantity)) {
			total.buyIn -= line.quantity;
		} else {
			total.cashOut += line.quantity;
		}
	}
	return [...totals.values()].sort(
		(a, b) =>
			a.assetId.localeCompare(b.assetId) || a.effect.localeCompare(b.effect)
	);
}

interface ValuationContext {
	assets: ValuationAsset[];
	baseAssetId: string | null;
	rates: ValuationRate[];
}

export async function loadValuationTables(
	db: Database,
	userId: string
): Promise<{ assets: ValuationAsset[]; rates: ValuationRate[] }> {
	const assets = await db
		.select({ id: asset.id, kind: asset.kind })
		.from(asset)
		.where(eq(asset.userId, userId));
	const rates = await db
		.select({
			id: assetRate.id,
			baseAssetId: assetRate.baseAssetId,
			quoteAssetId: assetRate.quoteAssetId,
			rateNum: assetRate.rateNum,
			rateDen: assetRate.rateDen,
			effectiveFrom: assetRate.effectiveFrom,
		})
		.from(assetRate)
		.where(eq(assetRate.userId, userId));
	return { assets, rates };
}

export async function selectBaseAssetId(
	db: Database,
	userId: string
): Promise<string | null> {
	const [setting] = await db
		.select({ baseAssetId: userSetting.baseAssetId })
		.from(userSetting)
		.where(eq(userSetting.userId, userId));
	return setting?.baseAssetId ?? null;
}

async function loadValuationContext(
	db: Database,
	userId: string
): Promise<ValuationContext> {
	const baseAssetId = await selectBaseAssetId(db, userId);
	if (baseAssetId === null) {
		return { assets: [], baseAssetId, rates: [] };
	}
	return { baseAssetId, ...(await loadValuationTables(db, userId)) };
}

const ZERO_AMOUNTS: ValuationAmounts = { buyIn: 0, cashOut: 0, profitLoss: 0 };

function entryValuation(
	context: ValuationContext,
	entryId: string,
	lines: EntryLine[]
): EntryValuationOutput {
	if (context.baseAssetId === null) {
		return {
			baseAssetId: null,
			real: null,
			virtual: null,
			missingRates: { real: [], virtual: [] },
		};
	}
	const result = valueEntries({
		assets: context.assets,
		baseAssetId: context.baseAssetId,
		rates: context.rates,
		lines: lines.map((line) => ({
			entryId,
			assetId: line.assetId,
			quantity: line.quantity,
			effect: line.effect,
			occurredAt: line.occurredAt,
		})),
	});
	const valued = result.entries.get(entryId);
	return {
		baseAssetId: context.baseAssetId,
		real: valued ? valued.real : ZERO_AMOUNTS,
		virtual: valued ? valued.virtual : ZERO_AMOUNTS,
		missingRates: valued?.missingRates ?? { real: [], virtual: [] },
	};
}

export function playMinutes(
	plays: Pick<PlaySessionOutput, "breakMinutes" | "endedAt" | "startedAt">[]
): number {
	let seconds = 0;
	for (const play of plays) {
		if (play.startedAt && play.endedAt) {
			seconds +=
				(play.endedAt.getTime() - play.startedAt.getTime()) / 1000 -
				60 * play.breakMinutes;
		}
	}
	return seconds / 60;
}

export function cashBigBlind(rule: CashRuleOutput): number | null {
	const [only, ...rest] = rule.stakes;
	if (!only || rest.length > 0) {
		return null;
	}
	return only.blind2 !== null && only.blind2 > 0 ? only.blind2 : null;
}

function entryLineups(rule: EntryRuleOutput, all: LineupMap): LineupMap {
	const ids =
		rule.kind === "cash"
			? [rule.ruleVersion.lineupId]
			: ruleLineupIds(rule.ruleVersion);
	const lineups: LineupMap = {};
	for (const id of ids) {
		const lineup = all[id];
		if (lineup) {
			lineups[id] = lineup;
		}
	}
	return lineups;
}

function missingDetail(): never {
	throw new TRPCError({
		code: "INTERNAL_SERVER_ERROR",
		message: "Entry is missing its kind detail",
	});
}

export async function hydrateEntries(
	db: Database,
	userId: string,
	rows: EntryRow[]
): Promise<EntryOutput[]> {
	if (rows.length === 0) {
		return [];
	}
	const ids = rows.map((row) => row.id);
	const plays = await selectEntryPlaySessions(db, userId, ids);
	const handsByEntry = await countEntryHands(db, userId, ids);
	const lineRows = await selectEntryLines(db, userId, ids);
	const tagRows = await selectInChunks(
		ids,
		(chunk) =>
			db
				.select({
					entryId: entryTagLink.entryId,
					id: entryTag.id,
					name: entryTag.name,
				})
				.from(entryTagLink)
				.innerJoin(
					entryTag,
					and(
						eq(entryTag.id, entryTagLink.tagId),
						eq(entryTag.userId, entryTagLink.userId)
					)
				)
				.where(
					and(
						eq(entryTagLink.userId, userId),
						inArray(entryTagLink.entryId, chunk)
					)
				)
				.orderBy(asc(entryTag.sortOrder), asc(entryTag.id)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	const rules = await hydrateEntryRules(
		db,
		userId,
		rows.map((row) =>
			row.kind === "cash"
				? {
						entryId: row.id,
						kind: "cash" as const,
						masterId: row.ringGameId,
						ruleVersionId: row.cashRuleId ?? missingDetail(),
					}
				: {
						entryId: row.id,
						kind: "tournament" as const,
						masterId: row.tournamentId,
						ruleVersionId: row.tournamentRuleId ?? missingDetail(),
					}
		)
	);
	const valuationContext = await loadValuationContext(db, userId);
	const playsByEntry = groupBy(plays, (play) => play.entryId);
	const linesByEntry = groupBy(lineRows, (line) => line.entryId);
	const tagsByEntry = groupBy(tagRows, (tag) => tag.entryId);
	return rows.map((row) => {
		const rule = rules.entries.get(row.id) ?? missingDetail();
		const entryPlays: PlaySessionOutput[] = (
			playsByEntry.get(row.id) ?? []
		).map((play) => ({
			id: play.id,
			seq: play.seq,
			label: play.label,
			localDate: play.localDate,
			startedAt: play.startedAt,
			endedAt: play.endedAt,
			breakMinutes: play.breakMinutes,
			status: play.status,
			endState: play.endState,
			endStack: play.endStack,
			clockStartedAt: play.clockStartedAt,
			clockStartLevel: play.clockStartLevel,
		}));
		const lines = linesByEntry.get(row.id) ?? [];
		const base: EntryOutputBase = {
			id: row.id,
			source: row.source,
			status: row.status,
			playedOn: row.playedOn,
			title: row.title,
			roomId: row.roomId,
			roomName: row.roomName,
			assetId: row.assetId,
			memo: row.memo,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			playSessions: entryPlays,
			playMinutes: playMinutes(entryPlays),
			handCount: handsByEntry.get(row.id) ?? 0,
			tags: (tagsByEntry.get(row.id) ?? []).map(({ id, name }) => ({
				id,
				name,
			})),
			ruleVersionId: rule.ruleVersionId,
			currentMasterRuleId: rule.currentMasterRuleId,
			ruleDrift: rule.ruleDrift,
			lineups: entryLineups(rule, rules.lineups),
			lines,
			totals: nativeTotals(lines),
			valuation: entryValuation(valuationContext, row.id, lines),
		};
		if (rule.kind === "cash") {
			return {
				...base,
				kind: "cash",
				ringGameId: row.ringGameId,
				tournamentId: null,
				ruleVersion: rule.ruleVersion,
				cash: { evDiff: row.evDiff, bigBlind: cashBigBlind(rule.ruleVersion) },
				tournament: null,
			};
		}
		return {
			...base,
			kind: "tournament",
			ringGameId: null,
			tournamentId: row.tournamentId,
			ruleVersion: rule.ruleVersion,
			cash: null,
			tournament: {
				placement: row.placement,
				totalEntries: row.totalEntries,
				beforeDeadline: row.beforeDeadline ?? false,
			},
		};
	});
}

export async function selectEntryPlaySessions(
	db: Database,
	userId: string,
	entryIds: string[]
) {
	return await selectInChunks(
		entryIds,
		(chunk) =>
			db
				.select()
				.from(playSession)
				.where(
					and(
						eq(playSession.userId, userId),
						inArray(playSession.entryId, chunk)
					)
				)
				.orderBy(asc(playSession.entryId), asc(playSession.seq)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
}

export async function countEntryHands(
	db: Database,
	userId: string,
	entryIds: string[]
): Promise<Map<string, number>> {
	const rows = await selectInChunks(
		entryIds,
		(chunk) =>
			db
				.select({ entryId: playSession.entryId, hands: count(hand.id) })
				.from(hand)
				.innerJoin(
					playSession,
					and(
						eq(playSession.id, hand.playSessionId),
						eq(playSession.userId, hand.userId)
					)
				)
				.where(
					and(eq(hand.userId, userId), inArray(playSession.entryId, chunk))
				)
				.groupBy(playSession.entryId),
		OWNER_SCOPED_CHUNK_EXTRA
	);
	return new Map(rows.map((row) => [row.entryId, row.hands] as const));
}

export async function selectEntryLines(
	db: Database,
	userId: string,
	entryIds: string[]
): Promise<EntryLine[]> {
	return await selectInChunks(
		entryIds,
		(chunk) =>
			db
				.select({
					id: ledgerLine.id,
					entryId: sql<string>`${ledgerLine.entryId}`,
					playSessionId: ledgerLine.playSessionId,
					eventId: ledgerLine.sourceEventId,
					assetId: ledgerLine.assetId,
					role: ledgerLine.role,
					effect: ledgerLine.effect,
					quantity: ledgerLine.quantity,
					occurredAt: ledgerLine.occurredAt,
					priceId: ledgerLine.priceId,
				})
				.from(ledgerLine)
				.where(
					and(eq(ledgerLine.userId, userId), inArray(ledgerLine.entryId, chunk))
				)
				.orderBy(asc(ledgerLine.occurredAt), asc(ledgerLine.id)),
		OWNER_SCOPED_CHUNK_EXTRA
	);
}

export async function getEntry(
	db: Database,
	userId: string,
	id: string
): Promise<EntryOutput> {
	const rows = await selectEntryRows(db, userId, [id]);
	const [output] = await hydrateEntries(db, userId, rows);
	if (!output) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Entry unavailable",
		});
	}
	return output;
}
