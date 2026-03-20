import { ringGame } from "@sapphire2/db/schema/ring-game";
import { store } from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

async function validateStoreOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
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
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
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

	await validateStoreOwnership(db, found.storeId, userId);

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

			return ctx.db
				.select()
				.from(ringGame)
				.where(and(eq(ringGame.storeId, input.storeId), condition));
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				name: z.string().min(1),
				variant: z.string().default("nlh"),
				blind1: z.number().int().optional(),
				blind2: z.number().int().optional(),
				blind3: z.number().int().optional(),
				ante: z.number().int().optional(),
				anteType: z.enum(["all", "bb"]).optional(),
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
				variant: input.variant,
				blind1: input.blind1 ?? null,
				blind2: input.blind2 ?? null,
				blind3: input.blind3 ?? null,
				ante: input.ante ?? null,
				anteType: input.anteType ?? null,
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
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				variant: z.string().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				anteType: z.enum(["all", "bb"]).nullable().optional(),
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
			if (input.variant !== undefined) {
				updateData.variant = input.variant;
			}
			if (input.blind1 !== undefined) {
				updateData.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				updateData.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				updateData.blind3 = input.blind3;
			}
			if (input.ante !== undefined) {
				updateData.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				updateData.anteType = input.anteType;
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
			return updated;
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
});
