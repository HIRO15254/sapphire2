import { store } from "@sapphire2/db/schema/store";
import {
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentBlindLevel } from "@sapphire2/db/schema/tournament-blind-level";
import { tournamentBlindSet } from "@sapphire2/db/schema/tournament-blind-set";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

async function validateStoreOwnership(
	db: DbInstance,
	storeId: string,
	userId: string
) {
	const [found] = await db.select().from(store).where(eq(store.id, storeId));

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
}

async function validateTournamentOwnership(
	db: DbInstance,
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

	await validateStoreOwnership(db, found.storeId, userId);

	return found;
}

async function validateBlindLevelOwnership(
	db: DbInstance,
	blindLevelId: number,
	userId: string
) {
	const [found] = await db
		.select()
		.from(tournamentBlindLevel)
		.where(eq(tournamentBlindLevel.id, blindLevelId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Blind level not found",
		});
	}

	await validateTournamentOwnership(db, found.tournamentId, userId);
	return found;
}

async function validateBlindSetOwnership(
	db: DbInstance,
	blindSetId: number,
	userId: string
) {
	const [found] = await db
		.select()
		.from(tournamentBlindSet)
		.where(eq(tournamentBlindSet.id, blindSetId));

	if (!found) {
		throw new TRPCError({ code: "NOT_FOUND", message: "Blind set not found" });
	}

	await validateBlindLevelOwnership(db, found.tournamentBlindLevelId, userId);
	return found;
}

export const tournamentRouter = router({
	listByStore: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				includeArchived: z.boolean().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateStoreOwnership(ctx.db, input.storeId, userId);

			const condition = input.includeArchived
				? isNotNull(tournament.archivedAt)
				: isNull(tournament.archivedAt);

			const tournaments = await ctx.db
				.select()
				.from(tournament)
				.where(and(eq(tournament.storeId, input.storeId), condition));

			const results = await Promise.all(
				tournaments.map(async (t) => {
					const [levelRows, tagRows, chipPurchaseRows] = await Promise.all([
						ctx.db
							.select()
							.from(tournamentBlindLevel)
							.where(eq(tournamentBlindLevel.tournamentId, t.id))
							.orderBy(asc(tournamentBlindLevel.sortOrder)),
						ctx.db
							.select()
							.from(tournamentTag)
							.where(eq(tournamentTag.tournamentId, t.id)),
						ctx.db
							.select()
							.from(tournamentChipPurchase)
							.where(eq(tournamentChipPurchase.tournamentId, t.id))
							.orderBy(asc(tournamentChipPurchase.sortOrder)),
					]);
					return {
						...t,
						blindLevelCount: levelRows.length,
						tags: tagRows.map((r) => ({ id: r.id, name: r.name })),
						chipPurchases: chipPurchaseRows.map((r) => ({
							id: r.id,
							name: r.name,
							cost: r.cost,
							chips: r.chips,
							sortOrder: r.sortOrder,
						})),
					};
				})
			);

			return results;
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateTournamentOwnership(ctx.db, input.id, userId);

			const [levelRows, tagRows, chipPurchaseRows] = await Promise.all([
				ctx.db
					.select()
					.from(tournamentBlindLevel)
					.where(eq(tournamentBlindLevel.tournamentId, input.id))
					.orderBy(asc(tournamentBlindLevel.sortOrder)),
				ctx.db
					.select()
					.from(tournamentTag)
					.where(eq(tournamentTag.tournamentId, input.id)),
				ctx.db
					.select()
					.from(tournamentChipPurchase)
					.where(eq(tournamentChipPurchase.tournamentId, input.id))
					.orderBy(asc(tournamentChipPurchase.sortOrder)),
			]);

			const blindLevels = await Promise.all(
				levelRows.map(async (level) => {
					const sets = await ctx.db
						.select()
						.from(tournamentBlindSet)
						.where(eq(tournamentBlindSet.tournamentBlindLevelId, level.id))
						.orderBy(asc(tournamentBlindSet.sortOrder));
					return { ...level, blindSets: sets };
				})
			);

			return {
				...found,
				blindLevels,
				tags: tagRows.map((r) => ({ id: r.id, name: r.name })),
				chipPurchases: chipPurchaseRows,
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				name: z.string().min(1),
				variantId: z.number().int().optional(),
				buyIn: z.number().int().optional(),
				entryFee: z.number().int().optional(),
				startingStack: z.number().int().optional(),
				bountyAmount: z.number().int().optional(),
				tableSize: z.number().int().optional(),
				currencyId: z.string().optional(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateStoreOwnership(ctx.db, input.storeId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(tournament).values({
				id,
				storeId: input.storeId,
				name: input.name,
				variantId: input.variantId ?? null,
				buyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
				startingStack: input.startingStack ?? null,
				bountyAmount: input.bountyAmount ?? null,
				tableSize: input.tableSize ?? null,
				currencyId: input.currencyId ?? null,
				memo: input.memo ?? null,
				updatedAt: new Date(),
			});

			const [created] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				variantId: z.number().int().nullable().optional(),
				buyIn: z.number().int().nullable().optional(),
				entryFee: z.number().int().nullable().optional(),
				startingStack: z.number().int().nullable().optional(),
				bountyAmount: z.number().int().nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateTournamentOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.variantId !== undefined) {
				updateData.variantId = input.variantId;
			}
			if (input.buyIn !== undefined) {
				updateData.buyIn = input.buyIn;
			}
			if (input.entryFee !== undefined) {
				updateData.entryFee = input.entryFee;
			}
			if (input.startingStack !== undefined) {
				updateData.startingStack = input.startingStack;
			}
			if (input.bountyAmount !== undefined) {
				updateData.bountyAmount = input.bountyAmount;
			}
			if (input.tableSize !== undefined) {
				updateData.tableSize = input.tableSize;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(tournament)
				.set(updateData)
				.where(eq(tournament.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, input.id));
			return updated;
		}),

	archive: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(tournament)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(tournament.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, input.id));
			return updated;
		}),

	restore: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(tournament)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(tournament.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(tournament).where(eq(tournament.id, input.id));
			return { success: true };
		}),

	addTag: protectedProcedure
		.input(z.object({ tournamentId: z.string(), name: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(tournamentTag).values({
				id,
				tournamentId: input.tournamentId,
				name: input.name,
			});

			const [created] = await ctx.db
				.select()
				.from(tournamentTag)
				.where(eq(tournamentTag.id, id));
			return created;
		}),

	removeTag: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const [tag] = await ctx.db
				.select()
				.from(tournamentTag)
				.where(eq(tournamentTag.id, input.id));

			if (!tag) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found" });
			}

			await validateTournamentOwnership(ctx.db, tag.tournamentId, userId);

			await ctx.db.delete(tournamentTag).where(eq(tournamentTag.id, input.id));
			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// Blind level CRUD
	// ---------------------------------------------------------------------------

	listBlindLevels: protectedProcedure
		.input(z.object({ tournamentId: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			const levels = await ctx.db
				.select()
				.from(tournamentBlindLevel)
				.where(eq(tournamentBlindLevel.tournamentId, input.tournamentId))
				.orderBy(asc(tournamentBlindLevel.sortOrder));

			return Promise.all(
				levels.map(async (level) => {
					const sets = await ctx.db
						.select()
						.from(tournamentBlindSet)
						.where(eq(tournamentBlindSet.tournamentBlindLevelId, level.id))
						.orderBy(asc(tournamentBlindSet.sortOrder));
					return { ...level, blindSets: sets };
				})
			);
		}),

	addBlindLevel: protectedProcedure
		.input(
			z.object({
				tournamentId: z.string(),
				levelIndex: z.number().int().min(0),
				isBreak: z.boolean(),
				minutes: z.number().int().min(1).optional(),
				sortOrder: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateTournamentOwnership(ctx.db, input.tournamentId, userId);

			const [inserted] = await ctx.db
				.insert(tournamentBlindLevel)
				.values({
					tournamentId: input.tournamentId,
					levelIndex: input.levelIndex,
					isBreak: input.isBreak,
					minutes: input.minutes,
					sortOrder: input.sortOrder,
				})
				.returning();

			return inserted;
		}),

	updateBlindLevel: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				levelIndex: z.number().int().min(0).optional(),
				isBreak: z.boolean().optional(),
				minutes: z.number().int().min(1).nullable().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateBlindLevelOwnership(ctx.db, input.id, userId);

			const update: Partial<typeof found> = {};
			if (input.levelIndex !== undefined) {
				update.levelIndex = input.levelIndex;
			}
			if (input.isBreak !== undefined) {
				update.isBreak = input.isBreak;
			}
			if (input.minutes !== undefined) {
				update.minutes = input.minutes;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			if (Object.keys(update).length > 0) {
				await ctx.db
					.update(tournamentBlindLevel)
					.set(update)
					.where(eq(tournamentBlindLevel.id, input.id));
			}

			const [updated] = await ctx.db
				.select()
				.from(tournamentBlindLevel)
				.where(eq(tournamentBlindLevel.id, input.id));
			return updated;
		}),

	removeBlindLevel: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateBlindLevelOwnership(ctx.db, input.id, userId);

			await ctx.db
				.delete(tournamentBlindLevel)
				.where(eq(tournamentBlindLevel.id, input.id));
			return { success: true };
		}),

	// ---------------------------------------------------------------------------
	// Blind set CRUD (under a tournament blind level)
	// ---------------------------------------------------------------------------

	addBlindSet: protectedProcedure
		.input(
			z.object({
				tournamentBlindLevelId: z.number().int(),
				limitFormatId: z.number().int().min(1),
				blind1: z.number().int().min(0),
				blind2: z.number().int().min(0),
				blind3: z.number().int().min(0).optional(),
				blind4: z.number().int().min(0).optional(),
				ante: z.number().int().min(0).optional(),
				anteType: z.enum(["none", "all", "bb"]).optional(),
				sortOrder: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateBlindLevelOwnership(
				ctx.db,
				input.tournamentBlindLevelId,
				userId
			);

			const [inserted] = await ctx.db
				.insert(tournamentBlindSet)
				.values({
					tournamentBlindLevelId: input.tournamentBlindLevelId,
					limitFormatId: input.limitFormatId,
					blind1: input.blind1,
					blind2: input.blind2,
					blind3: input.blind3,
					blind4: input.blind4,
					ante: input.ante,
					anteType: input.anteType,
					sortOrder: input.sortOrder,
				})
				.returning();

			return inserted;
		}),

	updateBlindSet: protectedProcedure
		.input(
			z.object({
				id: z.number().int(),
				limitFormatId: z.number().int().min(1).optional(),
				blind1: z.number().int().min(0).optional(),
				blind2: z.number().int().min(0).optional(),
				blind3: z.number().int().min(0).nullable().optional(),
				blind4: z.number().int().min(0).nullable().optional(),
				ante: z.number().int().min(0).nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateBlindSetOwnership(ctx.db, input.id, userId);

			const update: Partial<typeof found> = {};
			if (input.limitFormatId !== undefined) {
				update.limitFormatId = input.limitFormatId;
			}
			if (input.blind1 !== undefined) {
				update.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				update.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				update.blind3 = input.blind3;
			}
			if (input.blind4 !== undefined) {
				update.blind4 = input.blind4;
			}
			if (input.ante !== undefined) {
				update.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				update.anteType = input.anteType;
			}
			if (input.sortOrder !== undefined) {
				update.sortOrder = input.sortOrder;
			}

			if (Object.keys(update).length > 0) {
				await ctx.db
					.update(tournamentBlindSet)
					.set(update)
					.where(eq(tournamentBlindSet.id, input.id));
			}

			const [updated] = await ctx.db
				.select()
				.from(tournamentBlindSet)
				.where(eq(tournamentBlindSet.id, input.id));
			return updated;
		}),

	removeBlindSet: protectedProcedure
		.input(z.object({ id: z.number().int() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateBlindSetOwnership(ctx.db, input.id, userId);

			await ctx.db
				.delete(tournamentBlindSet)
				.where(eq(tournamentBlindSet.id, input.id));
			return { success: true };
		}),
});
