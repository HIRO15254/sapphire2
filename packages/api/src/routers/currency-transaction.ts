import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import { paginate } from "./_pagination";

const PAGE_SIZE = 10;

export const currencyTransactionRouter = router({
	listByCurrency: protectedProcedure
		.input(z.object({ currencyId: z.string(), cursor: z.string().optional() }))
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

			const conditions = [eq(currencyTransaction.currencyId, input.currencyId)];
			if (input.cursor) {
				// The cursor is the previous page's last row id, but rows are
				// ordered by transactedAt (desc). Comparing the (transactedAt, id)
				// tuple against the cursor row keeps paging aligned with the visible
				// order — comparing the random-UUID id alone skips/duplicates rows.
				conditions.push(
					sql`(${currencyTransaction.transactedAt}, ${currencyTransaction.id}) < (SELECT transacted_at, id FROM currency_transaction WHERE id = ${input.cursor})`
				);
			}

			const data = await ctx.db
				.select({
					id: currencyTransaction.id,
					currencyId: currencyTransaction.currencyId,
					transactionTypeId: currencyTransaction.transactionTypeId,
					transactionTypeName: transactionType.name,
					sessionId: currencyTransaction.sessionId,
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
				.where(and(...conditions))
				.orderBy(
					desc(currencyTransaction.transactedAt),
					desc(currencyTransaction.id)
				)
				.limit(PAGE_SIZE + 1);

			return paginate(data, PAGE_SIZE);
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

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				transactionTypeId: z.string().optional(),
				amount: z.number().int().optional(),
				transactedAt: z.string().optional(),
				memo: z.string().nullable().optional(),
			})
		)
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

			if (found.currencyTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be edited. Edit the session instead.",
				});
			}

			const updateData: Partial<typeof found.currencyTransaction> = {};
			if (input.transactionTypeId !== undefined) {
				updateData.transactionTypeId = input.transactionTypeId;
			}
			if (input.amount !== undefined) {
				updateData.amount = input.amount;
			}
			if (input.transactedAt !== undefined) {
				updateData.transactedAt = new Date(input.transactedAt);
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(currencyTransaction)
				.set(updateData)
				.where(eq(currencyTransaction.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.id, input.id));
			return updated;
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

			if (found.currencyTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be deleted. Delete the session instead.",
				});
			}

			await ctx.db
				.delete(currencyTransaction)
				.where(eq(currencyTransaction.id, input.id));
			return { success: true };
		}),
});
