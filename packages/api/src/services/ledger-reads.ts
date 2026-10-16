import type { Database } from "@sapphire2/db";
import type { LedgerRole } from "@sapphire2/db/constants/ledger";
import { currency } from "@sapphire2/db/schema/currency";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { D1_MAX_BOUND_PARAMS } from "../lib/batch";

export interface EntryRealTotals {
	assetId: string;
	buyIn: number;
	entryId: string;
	profitLoss: number;
	receipts: number;
}

export interface AssetBalance {
	assetId: string;
	balance: number;
}

export interface AssetHistoryRow {
	categoryId: string | null;
	entryId: string | null;
	id: string;
	memo: string | null;
	occurredAt: Date;
	quantity: number;
	role: LedgerRole | null;
	transferId: string | null;
}

const REAL = sql`${ledgerLine.effect} = 'real'`;

export async function selectEntryRealTotals(
	db: Database,
	userId: string,
	entryIds: readonly string[]
): Promise<EntryRealTotals[]> {
	const perChunk = D1_MAX_BOUND_PARAMS - 1;
	const rows: EntryRealTotals[] = [];
	for (let index = 0; index < entryIds.length; index += perChunk) {
		const chunk = entryIds.slice(index, index + perChunk);
		rows.push(
			...(await db
				.select({
					entryId: sql<string>`${ledgerLine.entryId}`,
					assetId: ledgerLine.assetId,
					profitLoss: sql<number>`SUM(${ledgerLine.quantity})`,
					buyIn: sql<number>`-SUM(MIN(${ledgerLine.quantity}, 0))`,
					receipts: sql<number>`SUM(MAX(${ledgerLine.quantity}, 0))`,
				})
				.from(ledgerLine)
				.innerJoin(
					currency,
					and(
						eq(currency.id, ledgerLine.assetId),
						eq(currency.userId, ledgerLine.userId),
						sql`${currency.kind} = 'currency'`
					)
				)
				.where(
					and(
						eq(ledgerLine.userId, userId),
						inArray(ledgerLine.entryId, chunk),
						REAL
					)
				)
				.groupBy(ledgerLine.entryId, ledgerLine.assetId))
		);
	}
	return rows;
}

export async function selectAssetBalances(
	db: Database,
	userId: string
): Promise<AssetBalance[]> {
	return await db
		.select({
			assetId: currency.id,
			balance: sql<number>`COALESCE(SUM(${ledgerLine.quantity}), 0)`,
		})
		.from(currency)
		.leftJoin(
			ledgerLine,
			and(
				eq(ledgerLine.assetId, currency.id),
				eq(ledgerLine.userId, currency.userId),
				REAL
			)
		)
		.where(eq(currency.userId, userId))
		.groupBy(currency.id);
}

export async function selectAssetHistory(
	db: Database,
	userId: string,
	assetId: string,
	options: { cursor?: { id: string; occurredAt: Date }; limit: number }
): Promise<AssetHistoryRow[]> {
	const cursor = options.cursor;
	const before = (occurredAt: unknown, id: unknown) =>
		cursor
			? sql`(${occurredAt}, ${id}) < (${sql.param(cursor.occurredAt, ledgerLine.occurredAt)}, ${cursor.id})`
			: undefined;
	const firstOccurredAt = sql`MIN(${ledgerLine.occurredAt})`;
	const walletLines = db
		.select({
			id: ledgerLine.id,
			entryId: sql<string | null>`NULL`.as("entry_id"),
			role: sql<LedgerRole | null>`${ledgerLine.role}`.as("role"),
			categoryId: ledgerLine.categoryId,
			transferId: ledgerLine.transferId,
			quantity: ledgerLine.quantity,
			occurredAt: ledgerLine.occurredAt,
			memo: ledgerLine.memo,
		})
		.from(ledgerLine)
		.where(
			and(
				eq(ledgerLine.userId, userId),
				eq(ledgerLine.assetId, assetId),
				isNull(ledgerLine.entryId),
				before(ledgerLine.occurredAt, ledgerLine.id)
			)
		);
	const entryTotals = db
		.select({
			id: sql<string>`${ledgerLine.entryId}`.as("id"),
			entryId: sql<string | null>`${ledgerLine.entryId}`.as("entry_id"),
			role: sql<LedgerRole | null>`NULL`.as("role"),
			categoryId: sql<string | null>`NULL`.as("category_id"),
			transferId: sql<string | null>`NULL`.as("transfer_id"),
			quantity: sql<number>`SUM(${ledgerLine.quantity})`.as("quantity"),
			occurredAt: sql<Date>`${firstOccurredAt}`
				.mapWith(ledgerLine.occurredAt)
				.as("occurred_at"),
			memo: sql<string | null>`NULL`.as("memo"),
		})
		.from(ledgerLine)
		.where(
			and(
				eq(ledgerLine.userId, userId),
				eq(ledgerLine.assetId, assetId),
				isNotNull(ledgerLine.entryId),
				REAL
			)
		)
		.groupBy(ledgerLine.entryId)
		.having(before(firstOccurredAt, ledgerLine.entryId));
	return await walletLines
		.unionAll(entryTotals)
		.orderBy(desc(sql`occurred_at`), desc(sql`id`))
		.limit(options.limit);
}
