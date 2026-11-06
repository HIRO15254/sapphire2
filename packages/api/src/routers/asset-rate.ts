import { ASSET_RATE_MAX_TERM } from "@sapphire2/db/constants/asset";
import { asset } from "@sapphire2/db/schema/asset";
import { assetRate } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import {
	and,
	asc,
	desc,
	eq,
	gt,
	lte,
	notExists,
	type SQL,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isAssetRateConflictError } from "../lib/db-errors";
import { instantSchema } from "../lib/instant";
import { validateEntityOwnership } from "../lib/ownership";
import { guardStatement, withWriteGuardConflict } from "../lib/write-guard";

const rateTerm = z.number().int().min(1).max(ASSET_RATE_MAX_TERM);

const rateColumns = {
	baseAssetId: assetRate.baseAssetId,
	createdAt: assetRate.createdAt,
	effectiveFrom: assetRate.effectiveFrom,
	id: assetRate.id,
	memo: assetRate.memo,
	quoteAssetId: assetRate.quoteAssetId,
	rateDen: assetRate.rateDen,
	rateNum: assetRate.rateNum,
};

export const assetRateIdInputSchema = z.object({ id: z.string().min(1) });

export const assetRateListInputSchema = z
	.object({
		baseAssetId: z.string().min(1).optional(),
		effectiveAt: instantSchema.optional(),
		quoteAssetId: z.string().min(1).optional(),
	})
	.optional();

export const assetRateCreateInputSchema = z
	.object({
		baseAssetId: z.string().min(1),
		effectiveFrom: instantSchema,
		memo: z.string().max(5000).optional(),
		quoteAssetId: z.string().min(1),
		rateDen: rateTerm,
		rateNum: rateTerm,
	})
	.refine((value) => value.baseAssetId !== value.quoteAssetId, {
		message: "A rate needs two different assets",
		path: ["quoteAssetId"],
	});

export const assetRateRouter = router({
	create: protectedProcedure
		.input(assetRateCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const base = await validateEntityOwnership(
				ctx.db,
				"asset",
				input.baseAssetId,
				userId
			);
			const quote = await validateEntityOwnership(
				ctx.db,
				"asset",
				input.quoteAssetId,
				userId
			);
			if (base.archivedAt !== null || quote.archivedAt !== null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "An archived asset cannot be newly selected for a rate",
				});
			}
			try {
				const [, , rows] = await withWriteGuardConflict(() =>
					ctx.db.batch([
						guardStatement(
							ctx.db,
							"rate_base_active",
							sql`EXISTS (SELECT 1 FROM ${asset} WHERE ${asset.id} = ${input.baseAssetId} AND ${asset.userId} = ${userId} AND ${asset.archivedAt} IS NULL)`
						),
						guardStatement(
							ctx.db,
							"rate_quote_active",
							sql`EXISTS (SELECT 1 FROM ${asset} WHERE ${asset.id} = ${input.quoteAssetId} AND ${asset.userId} = ${userId} AND ${asset.archivedAt} IS NULL)`
						),
						ctx.db
							.insert(assetRate)
							.values({
								baseAssetId: input.baseAssetId,
								effectiveFrom: new Date(input.effectiveFrom * 1000),
								id: crypto.randomUUID(),
								memo: input.memo ?? null,
								quoteAssetId: input.quoteAssetId,
								rateDen: input.rateDen,
								rateNum: input.rateNum,
								userId,
							})
							.returning(rateColumns),
					])
				);
				const [created] = rows;
				return created;
			} catch (error) {
				if (isAssetRateConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message:
							"A rate for this asset pair already starts at this time; delete it and create the corrected one",
					});
				}
				throw error;
			}
		}),

	delete: protectedProcedure
		.input(assetRateIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "assetRate", input.id, userId);
			await ctx.db
				.delete(assetRate)
				.where(and(eq(assetRate.id, input.id), eq(assetRate.userId, userId)));
			return { success: true as const };
		}),
	list: protectedProcedure
		.input(assetRateListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const conditions: SQL[] = [eq(assetRate.userId, userId)];
			for (const assetId of [input?.baseAssetId, input?.quoteAssetId]) {
				if (assetId !== undefined) {
					await validateEntityOwnership(ctx.db, "asset", assetId, userId);
				}
			}
			if (input?.baseAssetId !== undefined) {
				conditions.push(eq(assetRate.baseAssetId, input.baseAssetId));
			}
			if (input?.quoteAssetId !== undefined) {
				conditions.push(eq(assetRate.quoteAssetId, input.quoteAssetId));
			}
			if (input?.effectiveAt !== undefined) {
				const effectiveAt = new Date(input.effectiveAt * 1000);
				const newer = alias(assetRate, "newer");
				conditions.push(
					lte(assetRate.effectiveFrom, effectiveAt),
					notExists(
						ctx.db
							.select({ one: sql`1` })
							.from(newer)
							.where(
								and(
									eq(newer.userId, assetRate.userId),
									eq(newer.baseAssetId, assetRate.baseAssetId),
									eq(newer.quoteAssetId, assetRate.quoteAssetId),
									gt(newer.effectiveFrom, assetRate.effectiveFrom),
									lte(newer.effectiveFrom, effectiveAt)
								)
							)
					)
				);
			}
			return await ctx.db
				.select(rateColumns)
				.from(assetRate)
				.where(and(...conditions))
				.orderBy(
					asc(assetRate.baseAssetId),
					asc(assetRate.quoteAssetId),
					desc(assetRate.effectiveFrom)
				);
		}),
});
