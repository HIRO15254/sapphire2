import { ringGame } from "@sapphire2/db/schema/ring-game";
import { ringGameBlindSet } from "@sapphire2/db/schema/ring-game-blind-set";
import { store } from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function validateStoreOwnership(
	db: DbInstance,
	storeId: string,
	userId: string
) {
	const [found] = await db.select().from(store).where(eq(store.id, storeId));

	if (!found) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this store",
		});
	}

	return found;
}

async function validateRingGameOwnership(
	db: DbInstance,
	ringGameId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(ringGame)
		.where(eq(ringGame.id, ringGameId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Ring game not found",
		});
	}

	if (found.storeId) {
		await validateStoreOwnership(db, found.storeId, userId);
	}

	return found;
}

async function validateBlindSetOwnership(
	db: DbInstance,
	blindSetId: number,
	userId: string
) {
	const [found] = await db
		.select()
		.from(ringGameBlindSet)
		.where(eq(ringGameBlindSet.id, blindSetId));

	if (!found) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Blind set not found" });
	}

	await validateRingGameOwnership(db, found.ringGameId, userId);
	return found;
}

export const ringGameRouter = router({
	listByStore: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				includeArchived: z.boolean().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateStoreOwnership(ctx.db, input.storeId, userId);

			const condition = input.includeArchived
				? isNotNull(ringGame.archivedAt)
				: isNull(ringGame.archivedAt);

			const games = await ctx.db
				.select()
				.from(ringGame)
				.where(and(eq(ringGame.storeId, input.storeId), condition));

			return Promise.all(
				games.map(async (rg) => {
					const blindSets = await ctx.db
						.select()
						.from(ringGameBlindSet)
						.where(eq(ringGameBlindSet.ringGameId, rg.id))
						.orderBy(asc(ringGameBlindSet.sortOrder));
					return { ...rg, blindSets };
				})
			);
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateRingGameOwnership(ctx.db, input.id, userId);

			const blindSets = await ctx.db
				.select()
				.from(ringGameBlindSet)
				.where(eq(ringGameBlindSet.ringGameId, input.id))
				.orderBy(asc(ringGameBlindSet.sortOrder));

			return { ...found, blindSets };
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				name: z.string().min(1),
				variantId: z.number().int().optional(),
				minBuyIn: z.number().int().optional(),
				maxBuyIn: z.number().int().optional(),
				tableSize: z.number().int().optional(),
				currencyId: z.string().optional(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateStoreOwnership(ctx.db, input.storeId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(ringGame).values({
				id,
				storeId: input.storeId,
				name: input.name,
				variantId: input.variantId ?? null,
				minBuyIn: input.minBuyIn ?? null,
				maxBuyIn: input.maxBuyIn ?? null,
				tableSize: input.tableSize ?? null,
				currencyId: input.currencyId ?? null,
				memo: input.memo ?? null,
				updatedAt: new Date(),
			});

			const [created] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, id));
			return { ...created, blindSets: [] };
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				variantId: z.number().int().nullable().optional(),
				minBuyIn: z.number().int().nullable().optional(),
				maxBuyIn: z.number().int().nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateRingGameOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.variantId !== undefined) {
				updateData.variantId = input.variantId;
			}
			if (input.minBuyIn !== undefined) {
				updateData.minBuyIn = input.minBuyIn;
			}
			if (input.maxBuyIn !== undefined) {
				updateData.maxBuyIn = input.maxBuyIn;
			}
			if (input.tableSize !== undefined) {
				updateData.tableSize = input.tableSize;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(ringGame)
				.set(updateData)
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));

			const blindSets = await ctx.db
				.select()
				.from(ringGameBlindSet)
				.where(eq(ringGameBlindSet.ringGameId, input.id))
				.orderBy(asc(ringGameBlindSet.sortOrder));

			return { ...updated, blindSets };
		}),

	archive: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(ringGame)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	restore: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(ringGame)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(ringGame).where(eq(ringGame.id, input.id));
			return { success: true };
		}),

	listBlindSets: protectedProcedure
		.input(z.object({ ringGameId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.ringGameId, userId);

			return ctx.db
				.select()
				.from(ringGameBlindSet)
				.where(eq(ringGameBlindSet.ringGameId, input.ringGameId))
				.orderBy(asc(ringGameBlindSet.sortOrder));
		}),

	addBlindSet: protectedProcedure
		.input(
			z.object({
				ringGameId: z.string(),
				limitFormatId: z.number().int().min(1),
				blind1: z.number().int().min(0),
				blind2: z.number().int().min(0),
				blind3: z.number().int().min(0).optional(),
				blind4: z.number().int().min(0).optional(),
				ante: z.number().int().min(0).optional(),
				anteType: z.enum(["none", "all", "bb"]).optional(),
				sortOrder: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.ringGameId, userId);

			const [inserted] = await ctx.db
				.insert(ringGameBlindSet)
				.values({
					ringGameId: input.ringGameId,
					limitFormatId: input.limitFormatId,
					blind1: input.blind1,
					blind2: input.blind2,
					blind3: input.blind3,
					blind4: input.blind4,
					ante: input.ante,
					anteType: input.anteType,
					sortOrder: input.sortOrder,
				})
				.returning();

			return inserted;
		}),

	updateBlindSet: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				limitFormatId: z.number().int().min(1).optional(),
				blind1: z.number().int().min(0).optional(),
				blind2: z.number().int().min(0).optional(),
				blind3: z.number().int().min(0).nullable().optional(),
				blind4: z.number().int().min(0).nullable().optional(),
				ante: z.number().int().min(0).nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateBlindSetOwnership(ctx.db, input.id, userId);

			const update: Partial<typeof found> = {};
			if (input.limitFormatId !== undefined) {
				update.limitFormatId = input.limitFormatId;
			}
			if (input.blind1 !== undefined) {
				update.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				update.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				update.blind3 = input.blind3;
			}
			if (input.blind4 !== undefined) {
				update.blind4 = input.blind4;
			}
			if (input.ante !== undefined) {
				update.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				update.anteType = input.anteType;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			if (Object.keys(update).length > 0) {
				await ctx.db
					.update(ringGameBlindSet)
					.set(update)
					.where(eq(ringGameBlindSet.id, input.id));
			}

			const [updated] = await ctx.db
				.select()
				.from(ringGameBlindSet)
				.where(eq(ringGameBlindSet.id, input.id));
			return updated;
		}),

	removeBlindSet: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateBlindSetOwnership(ctx.db, input.id, userId);

			await ctx.db
				.delete(ringGameBlindSet)
				.where(eq(ringGameBlindSet.id, input.id));
			return { success: true };
		}),
});
