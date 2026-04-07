import { TAG_COLOR_NAMES } from "@sapphire2/db/constants/player-tag-colors";
import { playerTag, playerToPlayerTag } from "@sapphire2/db/schema/player";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

const colorSchema = z.enum(TAG_COLOR_NAMES);

export const playerTagRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		return await ctx.db
			.select()
			.from(playerTag)
			.where(eq(playerTag.userId, userId));
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(50),
				color: colorSchema.default("gray"),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await ctx.db.insert(playerTag).values({
				id,
				userId,
				name: input.name,
				color: input.color,
				updatedAt: new Date(),
			});
			const [created] = await ctx.db
				.select()
				.from(playerTag)
				.where(eq(playerTag.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).max(50).optional(),
				color: colorSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(playerTag)
				.where(eq(playerTag.id, input.id));
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
				.update(playerTag)
				.set({
					...(input.name === undefined ? {} : { name: input.name }),
					...(input.color === undefined ? {} : { color: input.color }),
				})
				.where(eq(playerTag.id, input.id));
			const [updated] = await ctx.db
				.select()
				.from(playerTag)
				.where(eq(playerTag.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(playerTag)
				.where(eq(playerTag.id, input.id));
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
				.delete(playerToPlayerTag)
				.where(eq(playerToPlayerTag.playerTagId, input.id));
			await ctx.db.delete(playerTag).where(eq(playerTag.id, input.id));
			return { success: true };
		}),
});
