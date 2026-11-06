import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameLineupVariant } from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { hand } from "@sapphire2/db/schema/hand";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, exists, isNull, max, notExists, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferenceGuard } from "../lib/active-reference-guard";
import { validateEntityOwnership } from "../lib/ownership";
import {
	changedRowsGuardStatement,
	guardStatement,
	runGuardedBatch,
} from "../lib/write-guard";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	type Db,
	gameMasterListInputSchema,
	runLabelWrite,
} from "./_game-masters";

const labelSchema = z.string().trim().min(1).max(30);
const shortLabelSchema = z.string().trim().min(1).max(15).nullish();

async function nextSortOrder(db: Db, userId: string): Promise<number> {
	const [row] = await db
		.select({ maxSort: max(gameVariant.sortOrder) })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	return row?.maxSort == null ? 0 : row.maxSort + 1;
}

async function selectVariant(db: Db, userId: string, id: string) {
	const [found] = await db
		.select()
		.from(gameVariant)
		.where(and(eq(gameVariant.id, id), eq(gameVariant.userId, userId)));
	return found;
}

function selectOwnedVariants(db: Db, userId: string) {
	return db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId))
		.orderBy(asc(gameVariant.sortOrder), asc(gameVariant.label));
}

async function assertActiveGroup(
	db: Db,
	userId: string,
	groupId: string
): Promise<void> {
	const group = await validateEntityOwnership(db, "gameGroup", groupId, userId);
	if (group.archivedAt !== null) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "An archived game group cannot be selected; restore it first",
		});
	}
}

export const gameVariantListInputSchema = gameMasterListInputSchema();

export const gameVariantIdInputSchema = z.object({ id: idSchema });

export const gameVariantCreateInputSchema = z.object({
	groupId: idSchema,
	label: labelSchema,
	shortLabel: shortLabelSchema,
});

export const gameVariantUpdateInputSchema = z.object({
	groupId: idSchema.optional(),
	id: idSchema,
	label: labelSchema.optional(),
	shortLabel: shortLabelSchema,
	sortOrder: z.number().int().min(0).optional(),
});

export const gameVariantRouter = router({
	archive: protectedProcedure
		.input(gameVariantIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameVariant", input.id, userId);
			const now = new Date();
			const updated = await ctx.db
				.update(gameVariant)
				.set({ archivedAt: now, updatedAt: now })
				.where(
					and(
						eq(gameVariant.id, input.id),
						eq(gameVariant.userId, userId),
						notExists(
							ctx.db
								.select({ id: gameMix.id })
								.from(gameMixVariant)
								.innerJoin(
									gameMix,
									and(
										eq(gameMix.id, gameMixVariant.mixId),
										eq(gameMix.userId, gameMixVariant.userId)
									)
								)
								.where(
									and(
										eq(gameMixVariant.variantId, gameVariant.id),
										eq(gameMixVariant.userId, gameVariant.userId),
										isNull(gameMix.archivedAt)
									)
								)
						)
					)
				)
				.returning({ id: gameVariant.id });
			if (updated.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This game variant is used by an active game mix; remove it from the mix or archive the mix first",
				});
			}
			return await selectVariant(ctx.db, userId, input.id);
		}),

	create: protectedProcedure
		.input(gameVariantCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await assertActiveGroup(ctx.db, userId, input.groupId);

			const id = crypto.randomUUID();
			const sortOrder = await nextSortOrder(ctx.db, userId);
			await runLabelWrite(ctx.db, "game variant", userId, input.label, () =>
				runGuardedBatch(ctx.db, [
					activeReferenceGuard(ctx.db, gameGroup, input.groupId, userId),
					ctx.db.insert(gameVariant).values({
						builtinKey: null,
						groupId: input.groupId,
						id,
						label: input.label,
						shortLabel: input.shortLabel ?? null,
						sortOrder,
						updatedAt: new Date(),
						userId,
					}),
				])
			);
			return await selectVariant(ctx.db, userId, id);
		}),

	delete: protectedProcedure
		.input(gameVariantIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameVariant", input.id, userId);
			const deleted = await ctx.db
				.delete(gameVariant)
				.where(
					and(
						eq(gameVariant.id, input.id),
						eq(gameVariant.userId, userId),
						notExists(
							ctx.db
								.select({ variantId: gameMixVariant.variantId })
								.from(gameMixVariant)
								.where(
									and(
										eq(gameMixVariant.variantId, gameVariant.id),
										eq(gameMixVariant.userId, gameVariant.userId)
									)
								)
						),
						notExists(
							ctx.db
								.select({ variantId: gameLineupVariant.variantId })
								.from(gameLineupVariant)
								.where(
									and(
										eq(gameLineupVariant.variantId, gameVariant.id),
										eq(gameLineupVariant.userId, gameVariant.userId)
									)
								)
						),
						notExists(
							ctx.db
								.select({ id: hand.id })
								.from(hand)
								.where(
									and(
										eq(hand.variantId, gameVariant.id),
										eq(hand.userId, gameVariant.userId)
									)
								)
						)
					)
				)
				.returning({ id: gameVariant.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This game variant is in use; archive it instead",
				});
			}
			return { success: true as const };
		}),
	list: protectedProcedure
		.input(gameVariantListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			let rows = await selectOwnedVariants(ctx.db, userId);
			if (rows.length === 0) {
				await seedDefaultGameData(ctx.db, userId);
				rows = await selectOwnedVariants(ctx.db, userId);
			}
			return rows.filter(
				(row) => input?.includeArchived || row.archivedAt === null
			);
		}),

	restore: protectedProcedure
		.input(gameVariantIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"gameVariant",
				input.id,
				userId
			);
			const group = await validateEntityOwnership(
				ctx.db,
				"gameGroup",
				found.groupId,
				userId
			);
			if (group.archivedAt !== null) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This game variant's group is archived; restore it first",
				});
			}
			const restored = await ctx.db
				.update(gameVariant)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(
					and(
						eq(gameVariant.id, input.id),
						eq(gameVariant.userId, userId),
						exists(
							ctx.db
								.select({ id: gameGroup.id })
								.from(gameGroup)
								.where(
									and(
										eq(gameGroup.id, gameVariant.groupId),
										eq(gameGroup.userId, gameVariant.userId),
										isNull(gameGroup.archivedAt)
									)
								)
						)
					)
				)
				.returning({ id: gameVariant.id });
			if (restored.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "This game variant's group is archived; restore it first",
				});
			}
			return await selectVariant(ctx.db, userId, input.id);
		}),

	update: protectedProcedure
		.input(gameVariantUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"gameVariant",
				input.id,
				userId
			);
			if (input.groupId !== undefined && input.groupId !== found.groupId) {
				await assertActiveGroup(ctx.db, userId, input.groupId);
				const affected = await ctx.db
					.select({ label: gameMix.label })
					.from(gameMix)
					.innerJoin(
						gameMixVariant,
						and(
							eq(gameMixVariant.mixId, gameMix.id),
							eq(gameMixVariant.userId, gameMix.userId)
						)
					)
					.innerJoin(
						gameVariant,
						and(
							eq(gameVariant.id, gameMixVariant.variantId),
							eq(gameVariant.userId, gameMixVariant.userId)
						)
					)
					.where(
						and(
							eq(gameMix.userId, userId),
							sql`${gameMix.id} IN (
						SELECT mix_id FROM game_mix_variant
						WHERE user_id = ${userId} AND variant_id = ${input.id}
					)`
						)
					)
					.groupBy(gameMix.id, gameMix.label)
					.having(sql`COUNT(DISTINCT CASE WHEN ${gameMixVariant.variantId} = ${input.id}
						THEN ${input.groupId} ELSE ${gameVariant.groupId} END) > ${MAX_MIX_GROUPS}`);
				if (affected.length > 0) {
					throw new TRPCError({
						code: "CONFLICT",
						message: `Moving this variant would exceed ${MAX_MIX_GROUPS} game groups in: ${affected.map((mix) => mix.label).join(", ")}`,
					});
				}
			}

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			if (input.shortLabel !== undefined) {
				updateData.shortLabel = input.shortLabel;
			}
			if (input.groupId !== undefined) {
				updateData.groupId = input.groupId;
			}
			if (input.sortOrder !== undefined) {
				updateData.sortOrder = input.sortOrder;
			}

			await runLabelWrite(ctx.db, "game variant", userId, input.label, () =>
				runGuardedBatch(ctx.db, [
					...(input.groupId !== undefined && input.groupId !== found.groupId
						? [
								activeReferenceGuard(ctx.db, gameGroup, input.groupId, userId),
								guardStatement(
									ctx.db,
									"mix group limit",
									sql`NOT EXISTS (
									SELECT 1 FROM game_mix_variant AS member
									JOIN game_variant AS variant ON variant.id = member.variant_id
										AND variant.user_id = member.user_id
									WHERE member.user_id = ${userId}
										AND member.mix_id IN (
											SELECT mix_id FROM game_mix_variant
											WHERE user_id = ${userId} AND variant_id = ${input.id}
										)
									GROUP BY member.mix_id
									HAVING COUNT(DISTINCT CASE WHEN member.variant_id = ${input.id}
										THEN ${input.groupId} ELSE variant.group_id END) > ${MAX_MIX_GROUPS}
								)`
								),
							]
						: []),
					ctx.db
						.update(gameVariant)
						.set(updateData)
						.where(
							and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
						),
					changedRowsGuardStatement(ctx.db, "game-variant-update"),
				])
			);
			return await selectVariant(ctx.db, userId, input.id);
		}),
});
