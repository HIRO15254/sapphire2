import { store } from "@sapphire2/db/schema/store";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const storeRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		return ctx.db.select().from(store).where(eq(store.userId, userId));
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
