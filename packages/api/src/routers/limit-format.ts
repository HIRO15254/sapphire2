import { limitFormat } from "@sapphire2/db/schema/limit-format";
import { ringGameBlindSet } from "@sapphire2/db/schema/ring-game-blind-set";
import { sessionCashBlindSet } from "@sapphire2/db/schema/session-cash-blind-set";
import { sessionTournamentBlindSet } from "@sapphire2/db/schema/session-tournament-blind-set";
import { tournamentBlindSet } from "@sapphire2/db/schema/tournament-blind-set";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

export const limitFormatRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		return ctx.db
			.select()
			.from(limitFormat)
			.where(or(isNull(limitFormat.userId), eq(limitFormat.userId, userId)));
	}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1),
				blind1Label: z.string().min(1),
				blind2Label: z.string().min(1),
				blind3Label: z.string().optional(),
				blind4Label: z.string().optional(),
				sortOrder: z.number().int().min(0).default(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [inserted] = await ctx.db
				.insert(limitFormat)
				.values({
					userId,
					name: input.name,
					blind1Label: input.blind1Label,
					blind2Label: input.blind2Label,
					blind3Label: input.blind3Label ?? null,
					blind4Label: input.blind4Label ?? null,
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
				blind1Label: z.string().min(1).optional(),
				blind2Label: z.string().min(1).optional(),
				blind3Label: z.string().nullable().optional(),
				blind4Label: z.string().nullable().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(limitFormat)
				.where(eq(limitFormat.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Limit format not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot modify a system limit format",
				});
			}

			const update: Partial<typeof limitFormat.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.name !== undefined) {
				update.name = input.name;
			}
			if (input.blind1Label !== undefined) {
				update.blind1Label = input.blind1Label;
			}
			if (input.blind2Label !== undefined) {
				update.blind2Label = input.blind2Label;
			}
			if (input.blind3Label !== undefined) {
				update.blind3Label = input.blind3Label;
			}
			if (input.blind4Label !== undefined) {
				update.blind4Label = input.blind4Label;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			await ctx.db
				.update(limitFormat)
				.set(update)
				.where(
					and(eq(limitFormat.id, input.id), eq(limitFormat.userId, userId))
				);

			const [updated] = await ctx.db
				.select()
				.from(limitFormat)
				.where(eq(limitFormat.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(limitFormat)
				.where(eq(limitFormat.id, input.id));

			if (!found) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Limit format not found",
				});
			}

			if (found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Cannot delete a system limit format",
				});
			}

			// Guard: check references
			const [cashRef] = await ctx.db
				.select({ id: sessionCashBlindSet.id })
				.from(sessionCashBlindSet)
				.where(eq(sessionCashBlindSet.limitFormatId, input.id))
				.limit(1);

			if (cashRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Limit format is in use by a session and cannot be deleted",
				});
			}

			const [tournRef] = await ctx.db
				.select({ id: sessionTournamentBlindSet.id })
				.from(sessionTournamentBlindSet)
				.where(eq(sessionTournamentBlindSet.limitFormatId, input.id))
				.limit(1);

			if (tournRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Limit format is in use by a session and cannot be deleted",
				});
			}

			const [rgRef] = await ctx.db
				.select({ id: ringGameBlindSet.id })
				.from(ringGameBlindSet)
				.where(eq(ringGameBlindSet.limitFormatId, input.id))
				.limit(1);

			if (rgRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Limit format is in use by a ring game and cannot be deleted",
				});
			}

			const [tbsRef] = await ctx.db
				.select({ id: tournamentBlindSet.id })
				.from(tournamentBlindSet)
				.where(eq(tournamentBlindSet.limitFormatId, input.id))
				.limit(1);

			if (tbsRef) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Limit format is in use by a tournament and cannot be deleted",
				});
			}

			await ctx.db
				.delete(limitFormat)
				.where(
					and(eq(limitFormat.id, input.id), eq(limitFormat.userId, userId))
				);

			return { success: true };
		}),
});
