import { store } from "@sapphire2/db/schema/store";
import { blindLevel, tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

async function validateTournamentOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	tournamentId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(tournament)
		.where(eq(tournament.id, tournamentId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Tournament not found",
		});
	}

	const [foundStore] = await db
		.select()
		.from(store)
		.where(eq(store.id, found.storeId));

	if (!foundStore) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Store not found" });
	}

	if (foundStore.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this store",
		});
	}

	return found;
}

async function validateBlindLevelOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	blindLevelId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(blindLevel)
		.where(eq(blindLevel.id, blindLevelId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Blind level not found",
		});
	}

	await validateTournamentOwnership(db, found.tournamentId, userId);

	return found;
}

export const blindLevelRouter = router({
	listByTournament: protectedProcedure
		.input(z.object({ tournamentId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			return ctx.db
				.select()
				.from(blindLevel)
				.where(eq(blindLevel.tournamentId, input.tournamentId))
				.orderBy(asc(blindLevel.level));
		}),

	create: protectedProcedure
		.input(
			z.object({
				tournamentId: z.string(),
				level: z.number().int(),
				isBreak: z.boolean().optional(),
				blind1: z.number().int().optional(),
				blind2: z.number().int().optional(),
				blind3: z.number().int().optional(),
				ante: z.number().int().optional(),
				minutes: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(blindLevel).values({
				id,
				tournamentId: input.tournamentId,
				level: input.level,
				isBreak: input.isBreak ?? false,
				blind1: input.blind1 ?? null,
				blind2: input.blind2 ?? null,
				blind3: input.blind3 ?? null,
				ante: input.ante ?? null,
				minutes: input.minutes ?? null,
			});

			const [created] = await ctx.db
				.select()
				.from(blindLevel)
				.where(eq(blindLevel.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				level: z.number().int().optional(),
				isBreak: z.boolean().optional(),
				blind1: z.number().int().nullable().optional(),
				blind2: z.number().int().nullable().optional(),
				blind3: z.number().int().nullable().optional(),
				ante: z.number().int().nullable().optional(),
				minutes: z.number().int().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateBlindLevelOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof found> = {};
			if (input.level !== undefined) {
				updateData.level = input.level;
			}
			if (input.isBreak !== undefined) {
				updateData.isBreak = input.isBreak;
			}
			if (input.blind1 !== undefined) {
				updateData.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				updateData.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				updateData.blind3 = input.blind3;
			}
			if (input.ante !== undefined) {
				updateData.ante = input.ante;
			}
			if (input.minutes !== undefined) {
				updateData.minutes = input.minutes;
			}

			await ctx.db
				.update(blindLevel)
				.set(updateData)
				.where(eq(blindLevel.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(blindLevel)
				.where(eq(blindLevel.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateBlindLevelOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(blindLevel).where(eq(blindLevel.id, input.id));
			return { success: true };
		}),

	reorder: protectedProcedure
		.input(
			z.object({
				tournamentId: z.string(),
				levelIds: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			await Promise.all(
				input.levelIds.map((id, index) =>
					ctx.db
						.update(blindLevel)
						.set({ level: index + 1 })
						.where(eq(blindLevel.id, id))
				)
			);

			return ctx.db
				.select()
				.from(blindLevel)
				.where(eq(blindLevel.tournamentId, input.tournamentId))
				.orderBy(asc(blindLevel.level));
		}),
});
