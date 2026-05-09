import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { variant } from "@sapphire2/db/schema/variant";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

export const variantRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		return ctx.db
			.select()
			.from(variant)
			.where(or(isNull(variant.userId), eq(variant.userId, userId)));
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				sortOrder: z.number().int().min(0).default(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [inserted] = await ctx.db
				.insert(variant)
				.values({
					userId,
					name: input.name,
					sortOrder: input.sortOrder,
					updatedAt: new Date(),
				})
				.returning();
			return inserted;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				name: z.string().min(1).optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(variant)
				.where(eq(variant.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Variant not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot modify a system variant",
				});
			}

			const update: Partial<typeof variant.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.name !== undefined) {
				update.name = input.name;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			await ctx.db
				.update(variant)
				.set(update)
				.where(and(eq(variant.id, input.id), eq(variant.userId, userId)));

			const [updated] = await ctx.db
				.select()
				.from(variant)
				.where(eq(variant.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(variant)
				.where(eq(variant.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Variant not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot delete a system variant",
				});
			}

			// Guard: check references in sessions
			const [cashRef] = await ctx.db
				.select({ sessionId: sessionCashDetail.sessionId })
				.from(sessionCashDetail)
				.where(eq(sessionCashDetail.variantId, input.id))
				.limit(1);

			if (cashRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Variant is in use by a session and cannot be deleted",
				});
			}

			const [tournRef] = await ctx.db
				.select({ sessionId: sessionTournamentDetail.sessionId })
				.from(sessionTournamentDetail)
				.where(eq(sessionTournamentDetail.variantId, input.id))
				.limit(1);

			if (tournRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Variant is in use by a session and cannot be deleted",
				});
			}

			await ctx.db
				.delete(variant)
				.where(and(eq(variant.id, input.id), eq(variant.userId, userId)));

			return { success: true };
		}),
});
