import { DEFAULT_TRANSACTION_TYPES } from "@sapphire2/db/constants";
import {
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const transactionTypeRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const existing = await ctx.db
			.select()
			.from(transactionType)
			.where(eq(transactionType.userId, userId));

		if (existing.length === 0) {
			const defaults = DEFAULT_TRANSACTION_TYPES.map((name) => ({
				id: crypto.randomUUID(),
				userId,
				name,
				updatedAt: new Date(),
			}));
			await ctx.db.insert(transactionType).values(defaults);
			return ctx.db
				.select()
				.from(transactionType)
				.where(eq(transactionType.userId, userId));
		}

		return existing;
	}),

	create: protectedProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(transactionType).values({
				id,
				userId,
				name: input.name,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db
				.select()
				.from(transactionType)
				.where(eq(transactionType.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(z.object({ id: z.string(), name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(transactionType)
				.where(eq(transactionType.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transaction type not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction type",
				});
			}

			await ctx.db
				.update(transactionType)
				.set({ name: input.name, updatedAt: new Date() })
				.where(eq(transactionType.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(transactionType)
				.where(eq(transactionType.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(transactionType)
				.where(eq(transactionType.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Transaction type not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction type",
				});
			}

			const inUse = await ctx.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.transactionTypeId, input.id));

			if (inUse.length > 0) {
				throw new TRPCError({
					code: "PRECONDITION_FAILED",
					message: "Cannot delete: type is in use by transactions",
				});
			}

			await ctx.db
				.delete(transactionType)
				.where(eq(transactionType.id, input.id));
			return { success: true };
		}),
});
