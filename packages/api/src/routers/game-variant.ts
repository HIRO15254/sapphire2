import { gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isLabelConflictError } from "../lib/db-errors";
import { seedDefaultGameData } from "../services/seed-game-data";
import { assertLabelNamespaceAvailable } from "./_game-masters";
import { validateEntityOwnership } from "./session";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const shortLabelSchema = z.string().trim().min(1).max(15).nullish();

async function nextSortOrder(db: Db, userId: string): Promise<number> {
	const [row] = await db
		.select({ maxSort: max(gameVariant.sortOrder) })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	return row?.maxSort == null ? 0 : row.maxSort + 1;
}

export const gameVariantIdInputSchema = z.object({ id: z.string() });

export const gameVariantCreateInputSchema = z.object({
	label: labelSchema,
	shortLabel: shortLabelSchema,
	groupId: z.string(),
});

export const gameVariantUpdateInputSchema = z.object({
	id: z.string(),
	label: labelSchema.optional(),
	shortLabel: shortLabelSchema,
	groupId: z.string().optional(),
	sortOrder: z.number().int().min(0).optional(),
});

export const gameVariantRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const rows = await ctx.db
			.select()
			.from(gameVariant)
			.where(eq(gameVariant.userId, userId))
			.orderBy(asc(gameVariant.sortOrder), asc(gameVariant.label));
		if (rows.length > 0) {
			return rows;
		}
		await seedDefaultGameData(ctx.db, userId);
		return ctx.db
			.select()
			.from(gameVariant)
			.where(eq(gameVariant.userId, userId))
			.orderBy(asc(gameVariant.sortOrder), asc(gameVariant.label));
	}),

	create: protectedProcedure
		.input(gameVariantCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await Promise.all([
				validateEntityOwnership(ctx.db, "gameGroup", input.groupId, userId),
				assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
					self: "variant",
				}),
			]);

			const id = crypto.randomUUID();
			const sortOrder = await nextSortOrder(ctx.db, userId);
			try {
				await ctx.db.insert(gameVariant).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					shortLabel: input.shortLabel ?? null,
					groupId: input.groupId,
					sortOrder,
					updatedAt: new Date(),
				});
			} catch (error) {
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a game variant with this label",
					});
				}
				throw error;
			}

			const [created] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, id));
			return created;
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

			const guards: Promise<unknown>[] = [];
			if (input.groupId !== undefined) {
				guards.push(
					validateEntityOwnership(ctx.db, "gameGroup", input.groupId, userId)
				);
			}
			if (input.label !== undefined) {
				guards.push(
					assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
						self: "variant",
						excludeId: input.id,
					})
				);
			}
			await Promise.all(guards);

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

			try {
				await ctx.db
					.update(gameVariant)
					.set(updateData)
					.where(
						and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
					);
			} catch (error) {
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a game variant with this label",
					});
				}
				throw error;
			}

			const [updated] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(gameVariantIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameVariant", input.id, userId);

			const [inUse] = await ctx.db
				.select({ variantId: gameMixVariant.variantId })
				.from(gameMixVariant)
				.where(
					and(
						eq(gameMixVariant.variantId, input.id),
						eq(gameMixVariant.userId, userId)
					)
				)
				.limit(1);
			if (inUse) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This variant is used by a game mix. Remove it from the mix first.",
				});
			}

			await ctx.db
				.delete(gameVariant)
				.where(
					and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
				);
			return { success: true };
		}),
});
