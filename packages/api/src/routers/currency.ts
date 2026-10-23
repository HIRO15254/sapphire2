import { asset } from "@sapphire2/db/schema/asset";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { TRPCError } from "@trpc/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isAssetNameConflictError } from "../lib/db-errors";

async function runAssetNameWrite(write: () => Promise<unknown>) {
	try {
		await write();
	} catch (error) {
		if (isAssetNameConflictError(error)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "You already have a currency with this name",
			});
		}
		throw error;
	}
}

export const currencyRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const currencies = await ctx.db
			.select({
				id: asset.id,
				userId: asset.userId,
				name: asset.name,
				unit: asset.unit,
				description: asset.description,
				isFavorite: asset.isFavorite,
				createdAt: asset.createdAt,
				updatedAt: asset.updatedAt,
				balance: sql<number>`COALESCE(SUM(${currencyTransaction.amount}), 0)`,
			})
			.from(asset)
			.leftJoin(
				currencyTransaction,
				eq(currencyTransaction.currencyId, asset.id)
			)
			.where(eq(asset.userId, userId))
			.groupBy(asset.id)
			.orderBy(desc(asset.isFavorite), asc(asset.createdAt));

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
			await runAssetNameWrite(() =>
				ctx.db.insert(asset).values({
					id,
					userId,
					name: input.name,
					unit: input.unit ?? null,
					description: input.description ?? null,
					updatedAt: new Date(),
				})
			);
			const [created] = await ctx.db
				.select()
				.from(asset)
				.where(eq(asset.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
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
				.from(asset)
				.where(eq(asset.id, input.id));

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

			await runAssetNameWrite(() =>
				ctx.db
					.update(asset)
					.set({
						...(input.name === undefined ? {} : { name: input.name }),
						...(input.unit === undefined ? {} : { unit: input.unit }),
						...(input.description === undefined
							? {}
							: { description: input.description }),
						updatedAt: new Date(),
					})
					.where(eq(asset.id, input.id))
			);

			const [updated] = await ctx.db
				.select()
				.from(asset)
				.where(eq(asset.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(asset)
				.where(eq(asset.id, input.id));

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
			await ctx.db.delete(asset).where(eq(asset.id, input.id));
			return { success: true };
		}),

	toggleFavorite: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(asset)
				.where(eq(asset.id, input.id));

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
				.update(asset)
				.set({ isFavorite: !found.isFavorite, updatedAt: new Date() })
				.where(eq(asset.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(asset)
				.where(eq(asset.id, input.id));
			return updated;
		}),
});
