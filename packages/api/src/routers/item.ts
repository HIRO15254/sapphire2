import { currency } from "@sapphire2/db/schema/currency";
import { item, itemTransaction } from "@sapphire2/db/schema/item";
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

/** Uniform FORBIDDEN whether the currency is missing or foreign (SA2-183). */
async function validateCurrencyOwnership(
	db: DbInstance,
	currencyId: string,
	userId: string
): Promise<void> {
	const [found] = await db
		.select()
		.from(currency)
		.where(eq(currency.id, currencyId));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this currency",
		});
	}
}

async function validateItemOwnership(
	db: DbInstance,
	itemId: string,
	userId: string
): Promise<void> {
	const [found] = await db.select().from(item).where(eq(item.id, itemId));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this item",
		});
	}
}

export const itemRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const items = await ctx.db
			.select({
				id: item.id,
				userId: item.userId,
				name: item.name,
				currencyId: item.currencyId,
				currencyName: currency.name,
				currencyUnit: currency.unit,
				unitValue: item.unitValue,
				description: item.description,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				holdings: sql<number>`COALESCE(SUM(${itemTransaction.count}), 0)`,
			})
			.from(item)
			.leftJoin(itemTransaction, eq(itemTransaction.itemId, item.id))
			.leftJoin(currency, eq(currency.id, item.currencyId))
			.where(eq(item.userId, userId))
			.groupBy(item.id)
			.orderBy(asc(item.createdAt));

		return items;
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				currencyId: z.string(),
				unitValue: z.number().int().min(0),
				description: z.string().max(50_000).optional().nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateCurrencyOwnership(ctx.db, input.currencyId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(item).values({
				id,
				userId,
				name: input.name,
				currencyId: input.currencyId,
				unitValue: input.unitValue,
				description: input.description ?? null,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db.select().from(item).where(eq(item.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				currencyId: z.string().optional(),
				// Changing the value only affects FUTURE usages — historical
				// session_item_usage rows keep their frozen snapshot.
				unitValue: z.number().int().min(0).optional(),
				description: z.string().max(50_000).optional().nullable(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateItemOwnership(ctx.db, input.id, userId);

			if (input.currencyId !== undefined) {
				await validateCurrencyOwnership(ctx.db, input.currencyId, userId);
			}

			await ctx.db
				.update(item)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.currencyId === undefined
						? {}
						: { currencyId: input.currencyId }),
					...(input.unitValue === undefined
						? {}
						: { unitValue: input.unitValue }),
					...(input.description === undefined
						? {}
						: { description: input.description }),
					updatedAt: new Date(),
				})
				.where(eq(item.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(item)
				.where(eq(item.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateItemOwnership(ctx.db, input.id, userId);

			// itemTransaction.itemId cascades — guard instead of silently wiping
			// ledger history (the SA2-165 class of hazard).
			const [transaction] = await ctx.db
				.select({ id: itemTransaction.id })
				.from(itemTransaction)
				.where(eq(itemTransaction.itemId, input.id))
				.limit(1);
			if (transaction) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Item cannot be deleted while it has transactions",
				});
			}

			await ctx.db.delete(item).where(eq(item.id, input.id));
			return { success: true };
		}),
});
