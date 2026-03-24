import {
	sessionTag,
	sessionToSessionTag,
} from "@sapphire2/db/schema/session-tag";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

export const sessionTagRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		return await ctx.db
			.select()
			.from(sessionTag)
			.where(eq(sessionTag.userId, userId));
	}),

	create: protectedProcedure
		.input(z.object({ name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(sessionTag).values({ id, userId, name: input.name });
			const [created] = await ctx.db
				.select()
				.from(sessionTag)
				.where(eq(sessionTag.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(z.object({ id: z.string(), name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(sessionTag)
				.where(eq(sessionTag.id, input.id));
			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found" });
			}
			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this tag",
				});
			}
			await ctx.db
				.update(sessionTag)
				.set({ name: input.name })
				.where(eq(sessionTag.id, input.id));
			const [updated] = await ctx.db
				.select()
				.from(sessionTag)
				.where(eq(sessionTag.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(sessionTag)
				.where(eq(sessionTag.id, input.id));
			if (!found) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found" });
			}
			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this tag",
				});
			}
			await ctx.db
				.delete(sessionToSessionTag)
				.where(eq(sessionToSessionTag.sessionTagId, input.id));
			await ctx.db.delete(sessionTag).where(eq(sessionTag.id, input.id));
			return { success: true };
		}),
});
