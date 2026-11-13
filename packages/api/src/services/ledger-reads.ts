import type { Database } from "@sapphire2/db";
import type { EntryKind, EntryStatus } from "@sapphire2/db/constants/entry";
import type { LedgerRole } from "@sapphire2/db/constants/ledger";
import { entry } from "@sapphire2/db/schema/entry";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { safeInteger } from "../lib/safe-integer";

export interface AssetHistoryRow {
	categoryId: string | null;
	counterpartAssetId: string | null;
	counterpartQuantity: number | null;
	entryId: string | null;
	entryKind: EntryKind | null;
	entryStatus: EntryStatus | null;
	id: string;
	memo: string | null;
	occurredAt: Date;
	quantity: number;
	role: LedgerRole | null;
	title: string | null;
	transferId: string | null;
}

const REAL = sql`${ledgerLine.effect} = 'real'`;

export const assetBalance =
	sql<number>`(SELECT COALESCE(SUM(ledger_line.quantity), 0) FROM ledger_line WHERE ledger_line.asset_id = asset.id AND ledger_line.user_id = asset.user_id AND ledger_line.effect = 'real')`.mapWith(
		safeInteger
	);

export async function selectAssetHistory(
	db: Database,
	userId: string,
	assetId: string,
	options: { cursor?: { id: string; occurredAt: Date }; limit: number }
): Promise<AssetHistoryRow[]> {
	const { cursor } = options;
	const before = (occurredAt: unknown, id: unknown) =>
		cursor
			? sql`(${occurredAt}, ${id}) < (${sql.param(cursor.occurredAt, ledgerLine.occurredAt)}, ${cursor.id})`
			: undefined;
	const firstOccurredAt = sql`MIN(${ledgerLine.occurredAt})`;
	const counterpart = (column: string) =>
		sql.raw(
			`(SELECT other.${column} FROM ledger_line AS other WHERE other.transfer_id = ledger_line.transfer_id AND other.user_id = ledger_line.user_id AND other.id <> ledger_line.id LIMIT 1)`
		);
	const walletLines = db
		.select({
			categoryId: ledgerLine.categoryId,
			counterpartAssetId: sql<string | null>`${counterpart("asset_id")}`.as(
				"counterpart_asset_id"
			),
			counterpartQuantity: sql<number | null>`${counterpart("quantity")}`.as(
				"counterpart_quantity"
			),
			entryId: sql<string | null>`NULL`.as("entry_id"),
			entryKind: sql<EntryKind | null>`NULL`.as("entry_kind"),
			entryStatus: sql<EntryStatus | null>`NULL`.as("entry_status"),
			id: ledgerLine.id,
			memo: ledgerLine.memo,
			occurredAt: ledgerLine.occurredAt,
			quantity: ledgerLine.quantity,
			role: sql<LedgerRole | null>`${ledgerLine.role}`.as("role"),
			title: sql<string | null>`NULL`.as("title"),
			transferId: ledgerLine.transferId,
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
			categoryId: sql<string | null>`NULL`.as("category_id"),
			counterpartAssetId: sql<string | null>`NULL`.as("counterpart_asset_id"),
			counterpartQuantity: sql<number | null>`NULL`.as("counterpart_quantity"),
			entryId: sql<string | null>`${ledgerLine.entryId}`.as("entry_id"),
			entryKind: sql<EntryKind | null>`MAX(${entry.kind})`.as("entry_kind"),
			entryStatus: sql<EntryStatus | null>`MAX(${entry.status})`.as(
				"entry_status"
			),
			id: sql<string>`${ledgerLine.entryId}`.as("id"),
			memo: sql<string | null>`NULL`.as("memo"),
			occurredAt: sql<Date>`${firstOccurredAt}`
				.mapWith(ledgerLine.occurredAt)
				.as("occurred_at"),
			quantity: sql<number>`SUM(${ledgerLine.quantity})`
				.mapWith(safeInteger)
				.as("quantity"),
			role: sql<LedgerRole | null>`NULL`.as("role"),
			title: sql<string | null>`MAX(${entry.title})`.as("title"),
			transferId: sql<string | null>`NULL`.as("transfer_id"),
		})
		.from(ledgerLine)
		.innerJoin(
			entry,
			and(eq(entry.id, ledgerLine.entryId), eq(entry.userId, ledgerLine.userId))
		)
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
	const rows = await walletLines
		.unionAll(entryTotals)
		.orderBy(desc(sql`occurred_at`), desc(sql`id`))
		.limit(options.limit);
	return rows.map((row) => ({
		...row,
		counterpartQuantity:
			row.counterpartQuantity === null
				? null
				: safeInteger(row.counterpartQuantity),
		quantity: safeInteger(row.quantity),
	}));
}
