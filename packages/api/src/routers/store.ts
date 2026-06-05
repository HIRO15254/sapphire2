import { ringGame } from "@sapphire2/db/schema/ring-game";
import { store } from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const storeRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		// Active (non-archived) game counts via correlated subqueries so the list
		// card can show them without an N+1 query per store. Joining both child
		// tables at once would multiply rows and corrupt the counts.
		return ctx.db
			.select({
				id: store.id,
				userId: store.userId,
				name: store.name,
				memo: store.memo,
				createdAt: store.createdAt,
				updatedAt: store.updatedAt,
				ringGameCount: sql<number>`(SELECT COUNT(*) FROM ${ringGame} WHERE ${ringGame.storeId} = ${store.id} AND ${ringGame.archivedAt} IS NULL)`,
				tournamentCount: sql<number>`(SELECT COUNT(*) FROM ${tournament} WHERE ${tournament.storeId} = ${store.id} AND ${tournament.archivedAt} IS NULL)`,
			})
			.from(store)
			.where(eq(store.userId, userId));
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(store)
				.where(eq(store.id, input.id));

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
		}),

	create: protectedProcedure
		.input(z.object({ name: z.string().min(1), memo: z.string().optional() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(store).values({
				id,
				userId,
				name: input.name,
				memo: input.memo ?? null,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db
				.select()
				.from(store)
				.where(eq(store.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(store)
				.where(eq(store.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this store",
				});
			}

			await ctx.db
				.update(store)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.memo === undefined ? {} : { memo: input.memo }),
					updatedAt: new Date(),
				})
				.where(eq(store.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(store)
				.where(eq(store.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(store)
				.where(eq(store.id, input.id));

			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this store",
				});
			}

			await ctx.db.delete(store).where(eq(store.id, input.id));
			return { success: true };
		}),
});
