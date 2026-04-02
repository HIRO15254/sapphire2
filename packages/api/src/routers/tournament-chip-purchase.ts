import { store } from "@sapphire2/db/schema/store";
import {
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
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

async function validateChipPurchaseOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	chipPurchaseId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(tournamentChipPurchase)
		.where(eq(tournamentChipPurchase.id, chipPurchaseId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Chip purchase not found",
		});
	}

	await validateTournamentOwnership(db, found.tournamentId, userId);

	return found;
}

export const tournamentChipPurchaseRouter = router({
	listByTournament: protectedProcedure
		.input(z.object({ tournamentId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			return ctx.db
				.select()
				.from(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.tournamentId, input.tournamentId))
				.orderBy(asc(tournamentChipPurchase.sortOrder));
		}),

	create: protectedProcedure
		.input(
			z.object({
				tournamentId: z.string(),
				name: z.string().min(1),
				cost: z.number().int(),
				chips: z.number().int(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			const existing = await ctx.db
				.select()
				.from(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.tournamentId, input.tournamentId))
				.orderBy(asc(tournamentChipPurchase.sortOrder));

			const sortOrder = existing.length;
			const id = crypto.randomUUID();

			await ctx.db.insert(tournamentChipPurchase).values({
				id,
				tournamentId: input.tournamentId,
				name: input.name,
				cost: input.cost,
				chips: input.chips,
				sortOrder,
			});

			const [created] = await ctx.db
				.select()
				.from(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				cost: z.number().int().optional(),
				chips: z.number().int().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateChipPurchaseOwnership(
				ctx.db,
				input.id,
				userId
			);

			const updateData: Partial<typeof found> = {};
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.cost !== undefined) {
				updateData.cost = input.cost;
			}
			if (input.chips !== undefined) {
				updateData.chips = input.chips;
			}

			await ctx.db
				.update(tournamentChipPurchase)
				.set(updateData)
				.where(eq(tournamentChipPurchase.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateChipPurchaseOwnership(ctx.db, input.id, userId);

			await ctx.db
				.delete(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.id, input.id));
			return { success: true };
		}),

	reorder: protectedProcedure
		.input(
			z.object({
				tournamentId: z.string(),
				ids: z.array(z.string()),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			await Promise.all(
				input.ids.map((id, index) =>
					ctx.db
						.update(tournamentChipPurchase)
						.set({ sortOrder: index })
						.where(eq(tournamentChipPurchase.id, id))
				)
			);

			return ctx.db
				.select()
				.from(tournamentChipPurchase)
				.where(eq(tournamentChipPurchase.tournamentId, input.tournamentId))
				.orderBy(asc(tournamentChipPurchase.sortOrder));
		}),
});
