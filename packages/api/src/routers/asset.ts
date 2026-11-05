import { ASSET_KINDS, ASSET_MAX_DECIMALS } from "@sapphire2/db/constants/asset";
import { asset } from "@sapphire2/db/schema/asset";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, isNull, not, or, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isAssetNameConflictError } from "../lib/db-errors";
import { validateEntityOwnership } from "../lib/ownership";
import { assetBalance } from "../services/ledger-reads";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const assetIsReferenced = sql<boolean>`(EXISTS (SELECT 1 FROM ledger_line WHERE ledger_line.asset_id = asset.id AND ledger_line.user_id = asset.user_id)
OR EXISTS (SELECT 1 FROM asset_rate WHERE asset_rate.user_id = asset.user_id AND (asset_rate.base_asset_id = asset.id OR asset_rate.quote_asset_id = asset.id))
OR EXISTS (SELECT 1 FROM entry WHERE entry.asset_id = asset.id AND entry.user_id = asset.user_id)
OR EXISTS (SELECT 1 FROM tournament_rule_price WHERE tournament_rule_price.asset_id = asset.id AND tournament_rule_price.user_id = asset.user_id)
OR EXISTS (SELECT 1 FROM user_setting WHERE user_setting.base_asset_id = asset.id AND user_setting.user_id = asset.user_id)
OR EXISTS (SELECT 1 FROM ring_game WHERE ring_game.default_asset_id = asset.id AND ring_game.user_id = asset.user_id)
OR EXISTS (SELECT 1 FROM tournament WHERE tournament.default_asset_id = asset.id AND tournament.user_id = asset.user_id))`;

const assetColumns = {
	id: asset.id,
	name: asset.name,
	unit: asset.unit,
	description: asset.description,
	kind: asset.kind,
	decimals: asset.decimals,
	archivedAt: asset.archivedAt,
	isFavorite: asset.isFavorite,
	balance: assetBalance,
	createdAt: asset.createdAt,
	updatedAt: asset.updatedAt,
};

async function selectAsset(db: Db, userId: string, id: string) {
	const [found] = await db
		.select(assetColumns)
		.from(asset)
		.where(and(eq(asset.id, id), eq(asset.userId, userId)));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this asset",
		});
	}
	return found;
}

async function runAssetNameWrite<T>(write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		if (isAssetNameConflictError(error)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "You already have an asset with this name",
			});
		}
		throw error;
	}
}

const assetName = z.string().trim().min(1).max(100);
const assetUnit = z.string().max(20);
const assetDescription = z.string().max(50_000);
const assetKind = z.enum(ASSET_KINDS);
const assetDecimals = z.number().int().min(0).max(ASSET_MAX_DECIMALS);

export const assetIdInputSchema = z.object({ id: z.string().min(1) });

export const assetListInputSchema = z
	.object({ includeArchived: z.boolean().optional() })
	.optional();

export const assetCreateInputSchema = z.object({
	name: assetName,
	unit: assetUnit.optional(),
	description: assetDescription.optional(),
	kind: assetKind,
	decimals: assetDecimals.default(0),
});

export const assetUpdateInputSchema = z.object({
	id: z.string().min(1),
	name: assetName.optional(),
	unit: assetUnit.nullable().optional(),
	description: assetDescription.nullable().optional(),
	kind: assetKind.optional(),
	decimals: assetDecimals.optional(),
});

export const assetRouter = router({
	list: protectedProcedure
		.input(assetListInputSchema)
		.query(({ ctx, input }) => {
			const userId = ctx.session.user.id;
			return ctx.db
				.select(assetColumns)
				.from(asset)
				.where(
					and(
						eq(asset.userId, userId),
						input?.includeArchived ? undefined : isNull(asset.archivedAt)
					)
				)
				.orderBy(desc(asset.isFavorite), asc(asset.createdAt), asc(asset.id));
		}),

	getById: protectedProcedure
		.input(assetIdInputSchema)
		.query(({ ctx, input }) =>
			selectAsset(ctx.db, ctx.session.user.id, input.id)
		),

	create: protectedProcedure
		.input(assetCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await runAssetNameWrite(() =>
				ctx.db.insert(asset).values({
					id,
					userId,
					name: input.name,
					unit: input.unit ?? null,
					description: input.description ?? null,
					kind: input.kind,
					decimals: input.decimals,
					updatedAt: new Date(),
				})
			);
			return await selectAsset(ctx.db, userId, id);
		}),

	update: protectedProcedure
		.input(assetUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "asset", input.id, userId);
			const updated = await runAssetNameWrite(() =>
				ctx.db
					.update(asset)
					.set({
						...(input.name === undefined ? {} : { name: input.name }),
						...(input.unit === undefined ? {} : { unit: input.unit }),
						...(input.description === undefined
							? {}
							: { description: input.description }),
						...(input.kind === undefined ? {} : { kind: input.kind }),
						...(input.decimals === undefined
							? {}
							: { decimals: input.decimals }),
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(asset.id, input.id),
							eq(asset.userId, userId),
							input.kind === undefined && input.decimals === undefined
								? undefined
								: or(
										and(
											input.kind === undefined
												? undefined
												: eq(asset.kind, input.kind),
											input.decimals === undefined
												? undefined
												: eq(asset.decimals, input.decimals)
										),
										not(assetIsReferenced)
									)
						)
					)
					.returning({ id: asset.id })
			);
			if (updated.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"Asset is in use, so its kind and decimals can no longer change",
				});
			}
			return await selectAsset(ctx.db, userId, input.id);
		}),

	archive: protectedProcedure
		.input(assetIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "asset", input.id, userId);
			const now = new Date();
			await ctx.db
				.update(asset)
				.set({ archivedAt: now, updatedAt: now })
				.where(and(eq(asset.id, input.id), eq(asset.userId, userId)));
			return await selectAsset(ctx.db, userId, input.id);
		}),

	restore: protectedProcedure
		.input(assetIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "asset", input.id, userId);
			await ctx.db
				.update(asset)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(asset.id, input.id), eq(asset.userId, userId)));
			return await selectAsset(ctx.db, userId, input.id);
		}),

	delete: protectedProcedure
		.input(assetIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "asset", input.id, userId);
			const deleted = await ctx.db
				.delete(asset)
				.where(
					and(
						eq(asset.id, input.id),
						eq(asset.userId, userId),
						not(assetIsReferenced)
					)
				)
				.returning({ id: asset.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Asset is in use; archive it instead",
				});
			}
			return { success: true as const };
		}),

	toggleFavorite: protectedProcedure
		.input(assetIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "asset", input.id, userId);
			await ctx.db
				.update(asset)
				.set({
					isFavorite: sql`NOT ${asset.isFavorite}`,
					updatedAt: new Date(),
				})
				.where(and(eq(asset.id, input.id), eq(asset.userId, userId)));
			return await selectAsset(ctx.db, userId, input.id);
		}),
});
