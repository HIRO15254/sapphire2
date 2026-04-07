import { currency, currencyTransaction } from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const currencyRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const currencies = await ctx.db
			.select({
				id: currency.id,
				userId: currency.userId,
				name: currency.name,
				unit: currency.unit,
				createdAt: currency.createdAt,
				updatedAt: currency.updatedAt,
				balance: sql<number>`COALESCE(SUM(${currencyTransaction.amount}), 0)`,
			})
			.from(currency)
			.leftJoin(
				currencyTransaction,
				eq(currencyTransaction.currencyId, currency.id)
			)
			.where(eq(currency.userId, userId))
			.groupBy(currency.id);

		return currencies;
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				unit: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(currency).values({
				id,
				userId,
				name: input.name,
				unit: input.unit ?? null,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				unit: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Currency not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			await ctx.db
				.update(currency)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.unit === undefined ? {} : { unit: input.unit }),
					updatedAt: new Date(),
				})
				.where(eq(currency.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Currency not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			await ctx.db.delete(currency).where(eq(currency.id, input.id));
			return { success: true };
		}),
});
