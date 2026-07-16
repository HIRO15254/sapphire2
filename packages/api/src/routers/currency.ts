import { currency, currencyTransaction } from "@sapphire2/db/schema/currency";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import z from "zod";
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
				description: currency.description,
				isFavorite: currency.isFavorite,
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
			.groupBy(currency.id)
			.orderBy(desc(currency.isFavorite), asc(currency.createdAt));

		return currencies;
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				unit: z
					.string()
					.max(4)
					.regex(/^[\x20-\x7e]*$/)
					.optional(),
				description: z.string().max(50_000).optional().nullable(),
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
				description: input.description ?? null,
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
				// Nullable so an explicit `null` clears the unit. `undefined`
				// (key omitted) still means "leave unchanged".
				unit: z
					.string()
					.max(4)
					.regex(/^[\x20-\x7e]*$/)
					.nullable()
					.optional(),
				description: z.string().max(50_000).optional().nullable(),
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
					code: "FORBIDDEN",
					message: "You do not own this currency",
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
					...(input.description === undefined
						? {}
						: { description: input.description }),
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
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			const [transaction] = await ctx.db
				.select({ id: currencyTransaction.id })
				.from(currencyTransaction)
				.where(eq(currencyTransaction.currencyId, input.id))
				.limit(1);
			if (transaction) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Currency cannot be deleted while it has transactions",
				});
			}
			await ctx.db.delete(currency).where(eq(currency.id, input.id));
			return { success: true };
		}),

	toggleFavorite: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
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
				.set({ isFavorite: !found.isFavorite, updatedAt: new Date() })
				.where(eq(currency.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.id));
			return updated;
		}),
});
