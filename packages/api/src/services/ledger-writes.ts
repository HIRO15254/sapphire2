import type { Database } from "@sapphire2/db";
import {
	isLedgerWalletRole,
	LEDGER_ENTRY_ROLES_BY_KIND,
	type LedgerEffect,
	type LedgerRole,
	signedLedgerQuantity,
} from "@sapphire2/db/constants/ledger";
import { paymentsSchema } from "@sapphire2/db/constants/play-event-payloads";
import { ledgerLine } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { type BatchStatement, chunkForInsert, runBatch } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";

export const manualPaymentsSchema = {
	cash: paymentsSchema(LEDGER_ENTRY_ROLES_BY_KIND.cash),
	tournament: paymentsSchema(LEDGER_ENTRY_ROLES_BY_KIND.tournament),
};

export interface ManualPayment {
	assetId: string;
	effect: LedgerEffect;
	quantity: number;
	role: LedgerRole;
}

export type ManualEntryMoney =
	| {
			kind: "cash";
			buyIn: number | null;
			cashOut: number | null;
			chipRemoveTotal: number | null;
	  }
	| {
			kind: "tournament";
			bountyPrizes: number | null;
			buyIn: number | null;
			chipPurchases: readonly { cost: number; count: number }[];
			entryFee: number | null;
			prizeMoney: number | null;
	  };

export interface ManualLineScope {
	entryId: string;
	occurredAt: Date;
	playSessionId: string;
	userId: string;
}

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
	id: ledgerLine.id,
	assetId: ledgerLine.assetId,
	role: ledgerLine.role,
	quantity: ledgerLine.quantity,
	effect: ledgerLine.effect,
	categoryId: ledgerLine.categoryId,
	entryId: ledgerLine.entryId,
	transferId: ledgerLine.transferId,
	occurredAt: ledgerLine.occurredAt,
	memo: ledgerLine.memo,
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

export function manualMoneyPayments(
	assetId: string,
	money: ManualEntryMoney
): ManualPayment[] {
	const amounts: [LedgerRole, number | null][] =
		money.kind === "cash"
			? [
					["buy_in", money.buyIn],
					["chip_remove", money.chipRemoveTotal],
					["cash_out", money.cashOut],
				]
			: [
					["buy_in", money.buyIn],
					["fee", money.entryFee],
					...money.chipPurchases.flatMap(({ cost, count }) =>
						Array.from({ length: count }, (): [LedgerRole, number] => [
							"chip_purchase",
							cost,
						])
					),
					["prize", money.prizeMoney],
					["bounty", money.bountyPrizes],
				];
	return amounts.flatMap(([role, quantity]) =>
		quantity !== null && quantity > 0
			? [{ assetId, quantity, role, effect: "real" as const }]
			: []
	);
}

export function buildManualLineStatements(
	db: Database,
	scope: ManualLineScope,
	payments: readonly ManualPayment[],
	now: Date
): BatchStatement[] {
	const nextIndexByRole: Partial<Record<LedgerRole, number>> = {};
	const rows = payments.map((payment) => {
		const n = nextIndexByRole[payment.role] ?? 0;
		nextIndexByRole[payment.role] = n + 1;
		return {
			id: `m:${scope.entryId}:${payment.role}:${n}`,
			userId: scope.userId,
			assetId: payment.assetId,
			quantity: signedLedgerQuantity(payment.role, payment.quantity),
			role: payment.role,
			effect: payment.effect,
			entryId: scope.entryId,
			playSessionId: scope.playSessionId,
			occurredAt: scope.occurredAt,
			createdAt: now,
			updatedAt: now,
		};
	});
	const statements: BatchStatement[] = [
		db
			.delete(ledgerLine)
			.where(
				and(
					eq(ledgerLine.entryId, scope.entryId),
					eq(ledgerLine.userId, scope.userId),
					isNull(ledgerLine.sourceEventId)
				)
			),
	];
	for (const chunk of chunkForInsert(rows, Object.keys(rows[0] ?? {}).length)) {
		statements.push(db.insert(ledgerLine).values(chunk));
	}
	return statements;
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
				id,
				userId,
				assetId: input.assetId,
				quantity: input.quantity,
				role: "adjustment",
				effect: "real",
				categoryId: input.categoryId,
				occurredAt: input.occurredAt,
				memo: input.memo,
				createdAt: now,
				updatedAt: now,
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
		userId,
		role: "exchange" as const,
		effect: "real" as const,
		categoryId: input.categoryId,
		transferId,
		occurredAt: input.occurredAt,
		memo: input.memo,
		createdAt: now,
		updatedAt: now,
	};
	return {
		ids,
		transferId,
		statements: [
			db.insert(ledgerLine).values([
				{
					...shared,
					id: ids[0],
					assetId: input.from.assetId,
					quantity: -input.from.quantity,
				},
				{
					...shared,
					id: ids[1],
					assetId: input.to.assetId,
					quantity: input.to.quantity,
				},
			]),
		],
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
			id: ledgerLine.id,
			role: ledgerLine.role,
			quantity: ledgerLine.quantity,
			categoryId: ledgerLine.categoryId,
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
	await runBatch(db, statements);
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
