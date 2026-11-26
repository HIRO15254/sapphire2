import { isLedgerWalletRole } from "@sapphire2/db/constants/ledger";
import {
	ledgerQuantitySchema,
	signedLedgerQuantitySchema,
} from "@sapphire2/db/constants/play-event-payloads";
import { asset } from "@sapphire2/db/schema/asset";
import { ledgerCategory } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { instantSchema } from "../lib/instant";
import { validateEntityOwnership } from "../lib/ownership";
import { runGuardedBatch } from "../lib/write-guard";
import {
	type AssetHistoryRow,
	selectAssetHistory,
} from "../services/ledger-reads";
import {
	assertSelectableAssets,
	assertSelectableCategory,
	buildAdjustmentStatements,
	buildExchangeStatements,
	deleteWalletLine,
	selectWalletLines,
	updateWalletLine,
} from "../services/ledger-writes";

const DEFAULT_LEDGER_PAGE_SIZE = 20;
const MAX_LEDGER_PAGE_SIZE = 100;

const ledgerMemo = z.string().max(5000);

function fromInstant(seconds: number): Date {
	return new Date(seconds * 1000);
}

const ledgerCursorSchema = z.object({
	assetId: z.string(),
	id: z.string(),
	occurredAt: z.number().int().min(-8_640_000_000_000).max(8_640_000_000_000),
});

export const ledgerIdInputSchema = z.object({ id: z.string().min(1) });

export const ledgerListByAssetInputSchema = z.object({
	assetId: z.string().min(1),
	cursor: z.string().optional(),
	limit: z
		.number()
		.int()
		.min(1)
		.max(MAX_LEDGER_PAGE_SIZE)
		.default(DEFAULT_LEDGER_PAGE_SIZE),
});

export const ledgerCreateAdjustmentInputSchema = z.object({
	assetId: z.string().min(1),
	categoryId: z.string().min(1).optional(),
	memo: ledgerMemo.optional(),
	occurredAt: instantSchema,
	quantity: signedLedgerQuantitySchema,
});

const exchangeLeg = z.object({
	assetId: z.string().min(1),
	quantity: ledgerQuantitySchema,
});

export const ledgerCreateExchangeInputSchema = z
	.object({
		categoryId: z.string().min(1).optional(),
		from: exchangeLeg,
		memo: ledgerMemo.optional(),
		occurredAt: instantSchema,
		to: exchangeLeg,
	})
	.refine((value) => value.from.assetId !== value.to.assetId, {
		message: "An exchange moves value between two different assets",
		path: ["to", "assetId"],
	});

export const ledgerUpdateInputSchema = z.object({
	categoryId: z.string().min(1).nullable().optional(),
	id: z.string().min(1),
	memo: ledgerMemo.nullable().optional(),
	occurredAt: instantSchema.optional(),
	quantity: signedLedgerQuantitySchema.optional(),
});

function toHistoryItem(assetId: string, row: AssetHistoryRow) {
	if (row.entryId === null && isLedgerWalletRole(row.role)) {
		return {
			counterpart:
				row.counterpartAssetId === null || row.counterpartQuantity === null
					? null
					: {
							assetId: row.counterpartAssetId,
							quantity: row.counterpartQuantity,
						},
			kind: "wallet" as const,
			line: {
				assetId,
				categoryId: row.categoryId,
				effect: "real" as const,
				entryId: null,
				id: row.id,
				memo: row.memo,
				occurredAt: row.occurredAt,
				quantity: row.quantity,
				role: row.role,
				transferId: row.transferId,
			},
		};
	}
	return {
		assetId,
		entryId: row.id,
		entryKind: row.entryKind,
		id: row.id,
		isOpen: row.entryStatus === "open",
		kind: "entry" as const,
		occurredAt: row.occurredAt,
		quantity: row.quantity,
		title: row.title,
	};
}

export const ledgerRouter = router({
	createAdjustment: protectedProcedure
		.input(ledgerCreateAdjustmentInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const categoryId = input.categoryId ?? null;
			await assertSelectableAssets(ctx.db, userId, [input.assetId]);
			await assertSelectableCategory(ctx.db, userId, categoryId, null);
			const { id, statements } = buildAdjustmentStatements(
				ctx.db,
				userId,
				{
					assetId: input.assetId,
					categoryId,
					memo: input.memo ?? null,
					occurredAt: fromInstant(input.occurredAt),
					quantity: input.quantity,
				},
				new Date()
			);
			await runGuardedBatch(ctx.db, [
				activeReferenceGuard(ctx.db, asset, input.assetId, userId),
				...(categoryId
					? [activeReferenceGuard(ctx.db, ledgerCategory, categoryId, userId)]
					: []),
				...statements,
			]);
			const [line] = await selectWalletLines(ctx.db, userId, { id });
			return line;
		}),

	createExchange: protectedProcedure
		.input(ledgerCreateExchangeInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const categoryId = input.categoryId ?? null;
			await assertSelectableAssets(ctx.db, userId, [
				input.from.assetId,
				input.to.assetId,
			]);
			await assertSelectableCategory(ctx.db, userId, categoryId, null);
			const { transferId, statements } = buildExchangeStatements(
				ctx.db,
				userId,
				{
					categoryId,
					from: input.from,
					memo: input.memo ?? null,
					occurredAt: fromInstant(input.occurredAt),
					to: input.to,
				},
				new Date()
			);
			await runGuardedBatch(ctx.db, [
				activeReferenceGuard(ctx.db, asset, input.from.assetId, userId),
				activeReferenceGuard(ctx.db, asset, input.to.assetId, userId),
				...(categoryId
					? [activeReferenceGuard(ctx.db, ledgerCategory, categoryId, userId)]
					: []),
				...statements,
			]);
			const lines = await selectWalletLines(ctx.db, userId, { transferId });
			return { lines, transferId };
		}),

	delete: protectedProcedure
		.input(ledgerIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			await deleteWalletLine(ctx.db, ctx.session.user.id, input.id);
			return { success: true as const };
		}),
	listByAsset: protectedProcedure
		.input(ledgerListByAssetInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const cursor =
				input.cursor === undefined
					? undefined
					: decodeCursor(input.cursor, ledgerCursorSchema);
			if (cursor && cursor.assetId !== input.assetId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "This cursor belongs to another asset history",
				});
			}
			await validateEntityOwnership(ctx.db, "asset", input.assetId, userId);
			const rows = await selectAssetHistory(ctx.db, userId, input.assetId, {
				cursor: cursor && {
					id: cursor.id,
					occurredAt: fromInstant(cursor.occurredAt),
				},
				limit: input.limit + 1,
			});
			const page = rows.slice(0, input.limit);
			const boundary = rows.length > input.limit ? page.at(-1) : undefined;
			return {
				items: page.map((row) => toHistoryItem(input.assetId, row)),
				nextCursor: boundary
					? encodeCursor({
							assetId: input.assetId,
							id: boundary.id,
							occurredAt: Math.floor(boundary.occurredAt.getTime() / 1000),
						})
					: null,
			};
		}),

	update: protectedProcedure
		.input(ledgerUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const scope = await updateWalletLine(
				ctx.db,
				userId,
				input.id,
				{
					categoryId: input.categoryId,
					memo: input.memo,
					occurredAt:
						input.occurredAt === undefined
							? undefined
							: fromInstant(input.occurredAt),
					quantity: input.quantity,
				},
				new Date()
			);
			return { lines: await selectWalletLines(ctx.db, userId, scope) };
		}),
});
