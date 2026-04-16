import { store } from "@sapphire2/db/schema/store";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

async function validateStoreOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
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

	await validateStoreOwnership(db, found.storeId, userId);

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
					const [levels, tagRows, chipPurchaseRows] = await Promise.all([
						ctx.db
							.select()
							.from(blindLevel)
							.where(eq(blindLevel.tournamentId, t.id)),
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
						blindLevelCount: levels.length,
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

			const [levels, tagRows] = await Promise.all([
				ctx.db
					.select()
					.from(blindLevel)
					.where(eq(blindLevel.tournamentId, input.id))
					.orderBy(asc(blindLevel.level)),
				ctx.db
					.select()
					.from(tournamentTag)
					.where(eq(tournamentTag.tournamentId, input.id)),
			]);

			return {
				...found,
				blindLevels: levels,
				tags: tagRows.map((r) => ({ id: r.id, name: r.name })),
			};
		}),

	create: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				name: z.string().min(1),
				variant: z.string().default("nlh"),
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
				variant: input.variant,
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
				variant: z.string().optional(),
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
			if (input.variant !== undefined) {
				updateData.variant = input.variant;
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

	createWithLevels: protectedProcedure
		.input(
			z.object({
				storeId: z.string(),
				name: z.string().min(1),
				variant: z.string().default("nlh"),
				buyIn: z.number().int().optional(),
				entryFee: z.number().int().optional(),
				startingStack: z.number().int().optional(),
				bountyAmount: z.number().int().optional(),
				tableSize: z.number().int().optional(),
				currencyId: z.string().optional(),
				memo: z.string().optional(),
				tags: z.array(z.string()).optional(),
				chipPurchases: z
					.array(
						z.object({
							name: z.string(),
							cost: z.number().int(),
							chips: z.number().int(),
						})
					)
					.optional(),
				blindLevels: z
					.array(
						z.object({
							isBreak: z.boolean(),
							blind1: z.number().int().nullable().optional(),
							blind2: z.number().int().nullable().optional(),
							blind3: z.number().int().nullable().optional(),
							ante: z.number().int().nullable().optional(),
							minutes: z.number().int().nullable().optional(),
						})
					)
					.optional(),
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
				variant: input.variant,
				buyIn: input.buyIn ?? null,
				entryFee: input.entryFee ?? null,
				startingStack: input.startingStack ?? null,
				bountyAmount: input.bountyAmount ?? null,
				tableSize: input.tableSize ?? null,
				currencyId: input.currencyId ?? null,
				memo: input.memo ?? null,
				updatedAt: new Date(),
			});

			await Promise.all([
				...(input.tags ?? []).map((name) =>
					ctx.db
						.insert(tournamentTag)
						.values({ id: crypto.randomUUID(), tournamentId: id, name })
				),
				...(input.chipPurchases ?? []).map((cp, i) =>
					ctx.db.insert(tournamentChipPurchase).values({
						id: crypto.randomUUID(),
						tournamentId: id,
						name: cp.name,
						cost: cp.cost,
						chips: cp.chips,
						sortOrder: i,
					})
				),
				...(input.blindLevels ?? []).map((l, i) =>
					ctx.db.insert(blindLevel).values({
						id: crypto.randomUUID(),
						tournamentId: id,
						level: i + 1,
						isBreak: l.isBreak,
						blind1: l.blind1 ?? null,
						blind2: l.blind2 ?? null,
						blind3: l.blind3 ?? null,
						ante: l.ante ?? null,
						minutes: l.minutes ?? null,
					})
				),
			]);

			const [created] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, id));
			return created;
		}),

	updateWithLevels: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				variant: z.string().optional(),
				buyIn: z.number().int().nullable().optional(),
				entryFee: z.number().int().nullable().optional(),
				startingStack: z.number().int().nullable().optional(),
				bountyAmount: z.number().int().nullable().optional(),
				tableSize: z.number().int().nullable().optional(),
				currencyId: z.string().nullable().optional(),
				memo: z.string().nullable().optional(),
				tags: z.array(z.string()).optional(),
				chipPurchases: z
					.array(
						z.object({
							name: z.string(),
							cost: z.number().int(),
							chips: z.number().int(),
						})
					)
					.optional(),
				blindLevels: z.array(
					z.object({
						isBreak: z.boolean(),
						blind1: z.number().int().nullable().optional(),
						blind2: z.number().int().nullable().optional(),
						blind3: z.number().int().nullable().optional(),
						ante: z.number().int().nullable().optional(),
						minutes: z.number().int().nullable().optional(),
					})
				),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateTournamentOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.variant !== undefined) {
				updateData.variant = input.variant;
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

			if (input.tags !== undefined) {
				await ctx.db
					.delete(tournamentTag)
					.where(eq(tournamentTag.tournamentId, input.id));
				await Promise.all(
					input.tags.map((name) =>
						ctx.db.insert(tournamentTag).values({
							id: crypto.randomUUID(),
							tournamentId: input.id,
							name,
						})
					)
				);
			}

			if (input.chipPurchases !== undefined) {
				await ctx.db
					.delete(tournamentChipPurchase)
					.where(eq(tournamentChipPurchase.tournamentId, input.id));
				await Promise.all(
					input.chipPurchases.map((cp, i) =>
						ctx.db.insert(tournamentChipPurchase).values({
							id: crypto.randomUUID(),
							tournamentId: input.id,
							name: cp.name,
							cost: cp.cost,
							chips: cp.chips,
							sortOrder: i,
						})
					)
				);
			}

			await ctx.db
				.delete(blindLevel)
				.where(eq(blindLevel.tournamentId, input.id));
			await Promise.all(
				input.blindLevels.map((l, i) =>
					ctx.db.insert(blindLevel).values({
						id: crypto.randomUUID(),
						tournamentId: input.id,
						level: i + 1,
						isBreak: l.isBreak,
						blind1: l.blind1 ?? null,
						blind2: l.blind2 ?? null,
						blind3: l.blind3 ?? null,
						ante: l.ante ?? null,
						minutes: l.minutes ?? null,
					})
				)
			);

			const [updated] = await ctx.db
				.select()
				.from(tournament)
				.where(eq(tournament.id, input.id));
			return updated;
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
});
