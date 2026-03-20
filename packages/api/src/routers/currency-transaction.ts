import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const currencyTransactionRouter = router({
	listByCurrency: protectedProcedure
		.input(z.object({ currencyId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.currencyId));

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

			return ctx.db
				.select({
					id: currencyTransaction.id,
					currencyId: currencyTransaction.currencyId,
					transactionTypeId: currencyTransaction.transactionTypeId,
					transactionTypeName: transactionType.name,
					amount: currencyTransaction.amount,
					transactedAt: currencyTransaction.transactedAt,
					memo: currencyTransaction.memo,
					createdAt: currencyTransaction.createdAt,
				})
				.from(currencyTransaction)
				.innerJoin(
					transactionType,
					eq(transactionType.id, currencyTransaction.transactionTypeId)
				)
				.where(eq(currencyTransaction.currencyId, input.currencyId))
				.orderBy(desc(currencyTransaction.transactedAt));
		}),

	create: protectedProcedure
		.input(
			z.object({
				currencyId: z.string(),
				transactionTypeId: z.string(),
				amount: z.number().int(),
				transactedAt: z.string(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.currencyId));

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

			const id = crypto.randomUUID();
			await ctx.db.insert(currencyTransaction).values({
				id,
				currencyId: input.currencyId,
				transactionTypeId: input.transactionTypeId,
				amount: input.amount,
				transactedAt: new Date(input.transactedAt),
				memo: input.memo ?? null,
			});

			const [created] = await ctx.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.id, id));
			return created;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select({ currencyTransaction, currency })
				.from(currencyTransaction)
				.innerJoin(currency, eq(currency.id, currencyTransaction.currencyId))
				.where(eq(currencyTransaction.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transaction not found",
				});
			}

			if (found.currency.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction",
				});
			}

			await ctx.db
				.delete(currencyTransaction)
				.where(eq(currencyTransaction.id, input.id));
			return { success: true };
		}),
});
