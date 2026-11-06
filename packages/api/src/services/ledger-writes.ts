import type { Database } from "@sapphire2/db";
import { isLedgerWalletRole } from "@sapphire2/db/constants/ledger";
import { ledgerCategory, ledgerLine } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import type { BatchStatement } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import { runGuardedBatch } from "../lib/write-guard";

export interface AdjustmentInput {
	assetId: string;
	categoryId: string | null;
	memo: string | null;
	occurredAt: Date;
	quantity: number;
}

export interface ExchangeInput {
	categoryId: string | null;
	from: { assetId: string; quantity: number };
	memo: string | null;
	occurredAt: Date;
	to: { assetId: string; quantity: number };
}

export interface WalletLinePatch {
	categoryId?: string | null;
	memo?: string | null;
	occurredAt?: Date;
	quantity?: number;
}

export const walletLineColumns = {
	assetId: ledgerLine.assetId,
	categoryId: ledgerLine.categoryId,
	effect: ledgerLine.effect,
	entryId: ledgerLine.entryId,
	id: ledgerLine.id,
	memo: ledgerLine.memo,
	occurredAt: ledgerLine.occurredAt,
	quantity: ledgerLine.quantity,
	role: ledgerLine.role,
	transferId: ledgerLine.transferId,
};

export function selectWalletLines(
	db: Database,
	userId: string,
	scope: { id: string } | { transferId: string }
) {
	return db
		.select(walletLineColumns)
		.from(ledgerLine)
		.where(
			and(
				eq(ledgerLine.userId, userId),
				"id" in scope
					? eq(ledgerLine.id, scope.id)
					: eq(ledgerLine.transferId, scope.transferId)
			)
		)
		.orderBy(asc(ledgerLine.quantity));
}

export async function assertSelectableAssets(
	db: Database,
	userId: string,
	assetIds: readonly string[]
): Promise<void> {
	const found = await Promise.all(
		assetIds.map((assetId) =>
			validateEntityOwnership(db, "asset", assetId, userId)
		)
	);
	if (found.some(({ archivedAt }) => archivedAt !== null)) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An archived asset cannot be selected; restore it first",
		});
	}
}

export async function assertSelectableCategory(
	db: Database,
	userId: string,
	categoryId: string | null,
	currentCategoryId: string | null
): Promise<void> {
	if (categoryId === null || categoryId === currentCategoryId) {
		return;
	}
	const found = await validateEntityOwnership(
		db,
		"ledgerCategory",
		categoryId,
		userId
	);
	if (found.archivedAt !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An archived category cannot be selected; restore it first",
		});
	}
}

export function manualLineOccurredAt(
	startedAt: Date | null,
	localDate: string
): Date {
	return startedAt ?? new Date(`${localDate}T12:00:00.000Z`);
}

export function buildAdjustmentStatements(
	db: Database,
	userId: string,
	input: AdjustmentInput,
	now: Date
): { id: string; statements: BatchStatement[] } {
	const id = crypto.randomUUID();
	return {
		id,
		statements: [
			db.insert(ledgerLine).values({
				assetId: input.assetId,
				categoryId: input.categoryId,
				createdAt: now,
				effect: "real",
				id,
				memo: input.memo,
				occurredAt: input.occurredAt,
				quantity: input.quantity,
				role: "adjustment",
				updatedAt: now,
				userId,
			}),
		],
	};
}

export function buildExchangeStatements(
	db: Database,
	userId: string,
	input: ExchangeInput,
	now: Date
): { ids: [string, string]; statements: BatchStatement[]; transferId: string } {
	if (input.from.assetId === input.to.assetId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An exchange moves value between two different assets",
		});
	}
	const transferId = crypto.randomUUID();
	const ids: [string, string] = [crypto.randomUUID(), crypto.randomUUID()];
	const shared = {
		categoryId: input.categoryId,
		createdAt: now,
		effect: "real" as const,
		memo: input.memo,
		occurredAt: input.occurredAt,
		role: "exchange" as const,
		transferId,
		updatedAt: now,
		userId,
	};
	return {
		ids,
		statements: [
			db.insert(ledgerLine).values([
				{
					...shared,
					assetId: input.from.assetId,
					id: ids[0],
					quantity: -input.from.quantity,
				},
				{
					...shared,
					assetId: input.to.assetId,
					id: ids[1],
					quantity: input.to.quantity,
				},
			]),
		],
		transferId,
	};
}

async function loadWalletLine(
	db: Database,
	userId: string,
	id: string,
	action: "edited" | "deleted"
) {
	const [found] = await db
		.select({
			categoryId: ledgerLine.categoryId,
			id: ledgerLine.id,
			quantity: ledgerLine.quantity,
			role: ledgerLine.role,
			transferId: ledgerLine.transferId,
		})
		.from(ledgerLine)
		.where(and(eq(ledgerLine.id, id), eq(ledgerLine.userId, userId)));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this transaction",
		});
	}
	if (!isLedgerWalletRole(found.role)) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message:
				action === "edited"
					? "Entry money cannot be edited from the wallet. Edit the entry instead."
					: "Entry money cannot be deleted from the wallet. Delete the entry instead.",
		});
	}
	return found;
}

export async function updateWalletLine(
	db: Database,
	userId: string,
	id: string,
	patch: WalletLinePatch,
	now: Date
): Promise<{ id: string } | { transferId: string }> {
	const found = await loadWalletLine(db, userId, id, "edited");
	if (patch.categoryId !== undefined) {
		await assertSelectableCategory(
			db,
			userId,
			patch.categoryId,
			found.categoryId
		);
	}
	const { quantity, ...shared } = patch;
	const statements: BatchStatement[] = [];
	if (patch.categoryId && patch.categoryId !== found.categoryId) {
		statements.push(
			activeReferenceGuard(db, ledgerCategory, patch.categoryId, userId)
		);
	}
	if (found.role === "exchange" && found.transferId !== null) {
		if (quantity !== undefined && quantity > 0 !== found.quantity > 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "An exchange keeps one outgoing and one incoming line",
			});
		}
		statements.push(
			db
				.update(ledgerLine)
				.set({ ...shared, updatedAt: now })
				.where(
					and(
						eq(ledgerLine.transferId, found.transferId),
						eq(ledgerLine.userId, userId)
					)
				)
		);
	}
	statements.push(
		db
			.update(ledgerLine)
			.set({
				...(found.role === "exchange" ? {} : shared),
				...(quantity === undefined ? {} : { quantity }),
				updatedAt: now,
			})
			.where(and(eq(ledgerLine.id, found.id), eq(ledgerLine.userId, userId)))
	);
	await runGuardedBatch(db, statements);
	return found.transferId === null
		? { id: found.id }
		: { transferId: found.transferId };
}

export async function deleteWalletLine(
	db: Database,
	userId: string,
	id: string
): Promise<void> {
	const found = await loadWalletLine(db, userId, id, "deleted");
	await db
		.delete(ledgerLine)
		.where(
			and(
				eq(ledgerLine.userId, userId),
				found.role === "exchange" && found.transferId !== null
					? eq(ledgerLine.transferId, found.transferId)
					: eq(ledgerLine.id, found.id)
			)
		);
}
