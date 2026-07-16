import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { room } from "@sapphire2/db/schema/room";
import {
	blindLevel,
	tournament,
	tournamentChipPurchase,
} from "@sapphire2/db/schema/tournament";
import { tournamentTag } from "@sapphire2/db/schema/tournament-tag";
import { levelGamesSchema } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { selectInChunks, validateEntityOwnership } from "./session";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

async function validateRoomOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	roomId: string,
	userId: string
) {
	const [found] = await db.select().from(room).where(eq(room.id, roomId));

	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this room",
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
			code: "FORBIDDEN",
			message: "You do not own this tournament",
		});
	}

	await validateRoomOwnership(db, found.roomId, userId);

	return found;
}

const nonNegativeIntegerSchema = z.number().int().min(0);
const tableSizeSchema = z.number().int().min(2).max(10);

const tournamentCreateNumericFields = {
	buyIn: nonNegativeIntegerSchema.optional(),
	entryFee: nonNegativeIntegerSchema.optional(),
	startingStack: nonNegativeIntegerSchema.optional(),
	bountyAmount: nonNegativeIntegerSchema.optional(),
	tableSize: tableSizeSchema.optional(),
};
const tournamentUpdateNumericFields = {
	buyIn: nonNegativeIntegerSchema.nullable().optional(),
	entryFee: nonNegativeIntegerSchema.nullable().optional(),
	startingStack: nonNegativeIntegerSchema.nullable().optional(),
	bountyAmount: nonNegativeIntegerSchema.nullable().optional(),
	tableSize: tableSizeSchema.nullable().optional(),
};

const chipPurchaseInputSchema = z.object({
	name: z.string().min(1),
	cost: nonNegativeIntegerSchema,
	chips: nonNegativeIntegerSchema,
});
const blindLevelInputSchema = z.object({
	isBreak: z.boolean(),
	blind1: nonNegativeIntegerSchema.nullable().optional(),
	blind2: nonNegativeIntegerSchema.nullable().optional(),
	blind3: nonNegativeIntegerSchema.nullable().optional(),
	ante: nonNegativeIntegerSchema.nullable().optional(),
	minutes: nonNegativeIntegerSchema.nullable().optional(),
	games: levelGamesSchema.nullish(),
});

export const tournamentCreateWithLevelsInputSchema = z.object({
	roomId: z.string(),
	name: z.string().min(1),
	variant: z.string().default(DEFAULT_VARIANT_LABEL),
	...tournamentCreateNumericFields,

	currencyId: z.string().min(1).optional(),
	memo: z.string().optional(),
	tags: z.array(z.string()).optional(),

	chipPurchases: z.array(chipPurchaseInputSchema).optional(),

	blindLevels: z.array(blindLevelInputSchema).optional(),
});

type TournamentCreateWithLevelsInput = z.infer<
	typeof tournamentCreateWithLevelsInputSchema
>;

export function buildTournamentCreateStatements(
	db: DbInstance,
	params: {
		id: string;
		input: TournamentCreateWithLevelsInput;
		now: Date;
	}
): [BatchStatement, ...BatchStatement[]] {
	return [
		db.insert(tournament).values({
			id: params.id,
			roomId: params.input.roomId,
			name: params.input.name,
			variant: params.input.variant,
			buyIn: params.input.buyIn ?? null,
			entryFee: params.input.entryFee ?? null,
			startingStack: params.input.startingStack ?? null,
			bountyAmount: params.input.bountyAmount ?? null,
			tableSize: params.input.tableSize ?? null,
			currencyId: params.input.currencyId ?? null,
			memo: params.input.memo ?? null,
			updatedAt: params.now,
		}),
		...(params.input.tags ?? []).map((name) =>
			db.insert(tournamentTag).values({
				id: crypto.randomUUID(),
				tournamentId: params.id,
				name,
			})
		),
		...(params.input.chipPurchases ?? []).map((purchase, sortOrder) =>
			db.insert(tournamentChipPurchase).values({
				id: crypto.randomUUID(),
				tournamentId: params.id,
				name: purchase.name,
				cost: purchase.cost,
				chips: purchase.chips,
				sortOrder,
			})
		),
		...(params.input.blindLevels ?? []).map((level, index) =>
			db.insert(blindLevel).values({
				id: crypto.randomUUID(),
				tournamentId: params.id,
				level: index + 1,
				isBreak: level.isBreak,
				blind1: level.blind1 ?? null,
				blind2: level.blind2 ?? null,
				blind3: level.blind3 ?? null,
				ante: level.ante ?? null,
				minutes: level.minutes ?? null,
				games: level.games ?? null,
			})
		),
	];
}

function bucketTournamentRows<Row extends { tournamentId: string }>(
	rows: Row[]
): Map<string, Row[]> {
	const map = new Map<string, Row[]>();
	for (const row of rows) {
		const bucket = map.get(row.tournamentId);
		if (bucket) {
			bucket.push(row);
		} else {
			map.set(row.tournamentId, [row]);
		}
	}
	return map;
}

async function getTournamentBlindLevels(
	db: DbInstance,
	tournamentIds: string[]
) {
	if (tournamentIds.length === 0) {
		return new Map<string, (typeof blindLevel.$inferSelect)[]>();
	}
	const rows = await selectInChunks(tournamentIds, (chunk) =>
		db.select().from(blindLevel).where(inArray(blindLevel.tournamentId, chunk))
	);
	return bucketTournamentRows(rows);
}

async function getTournamentTags(db: DbInstance, tournamentIds: string[]) {
	if (tournamentIds.length === 0) {
		return new Map<string, (typeof tournamentTag.$inferSelect)[]>();
	}
	const rows = await selectInChunks(tournamentIds, (chunk) =>
		db
			.select()
			.from(tournamentTag)
			.where(inArray(tournamentTag.tournamentId, chunk))
	);
	return bucketTournamentRows(rows);
}

async function getTournamentChipPurchases(
	db: DbInstance,
	tournamentIds: string[]
) {
	if (tournamentIds.length === 0) {
		return new Map<string, (typeof tournamentChipPurchase.$inferSelect)[]>();
	}
	const rows = await selectInChunks(tournamentIds, (chunk) =>
		db
			.select()
			.from(tournamentChipPurchase)
			.where(inArray(tournamentChipPurchase.tournamentId, chunk))
			.orderBy(asc(tournamentChipPurchase.sortOrder))
	);
	return bucketTournamentRows(rows);
}

export const tournamentRouter = router({
	listByRoom: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				includeArchived: z.boolean().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRoomOwnership(ctx.db, input.roomId, userId);

			const condition = input.includeArchived
				? isNotNull(tournament.archivedAt)
				: isNull(tournament.archivedAt);

			const tournaments = await ctx.db
				.select()
				.from(tournament)
				.where(and(eq(tournament.roomId, input.roomId), condition));

			const tournamentIds = tournaments.map((t) => t.id);
			const [levelsByTournament, tagsByTournament, chipsByTournament] =
				await Promise.all([
					getTournamentBlindLevels(ctx.db, tournamentIds),
					getTournamentTags(ctx.db, tournamentIds),
					getTournamentChipPurchases(ctx.db, tournamentIds),
				]);

			const results = tournaments.map((t) => {
				const levels = levelsByTournament.get(t.id) ?? [];
				const tagRows = tagsByTournament.get(t.id) ?? [];
				const chipPurchaseRows = chipsByTournament.get(t.id) ?? [];
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
			});

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
				roomId: z.string(),
				name: z.string().min(1),
				variant: z.string().default(DEFAULT_VARIANT_LABEL),
				...tournamentCreateNumericFields,

				currencyId: z.string().min(1).optional(),
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRoomOwnership(ctx.db, input.roomId, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}

			const id = crypto.randomUUID();
			await ctx.db.insert(tournament).values({
				id,
				roomId: input.roomId,
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
				...tournamentUpdateNumericFields,

				currencyId: z.string().min(1).nullable().optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateTournamentOwnership(ctx.db, input.id, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}

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
		.input(tournamentCreateWithLevelsInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRoomOwnership(ctx.db, input.roomId, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}

			const id = crypto.randomUUID();
			// One atomic batch: the tournament row first (parent), then its tags /
			// chip purchases / blind levels. `Promise.all` ran these as parallel
			// auto-commits, so a partial failure could leave a tournament with only
			// some of its children (SA2-116).
			const statements = buildTournamentCreateStatements(ctx.db, {
				id,
				input,
				now: new Date(),
			});
			await ctx.db.batch(statements);

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
				...tournamentUpdateNumericFields,

				currencyId: z.string().min(1).nullable().optional(),
				memo: z.string().nullable().optional(),
				tags: z.array(z.string()).optional(),
				chipPurchases: z.array(chipPurchaseInputSchema).optional(),
				blindLevels: z.array(blindLevelInputSchema),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateTournamentOwnership(ctx.db, input.id, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}

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

			// One atomic batch: the tournament UPDATE first, then each
			// clear-and-reseed group. Previously a bare DELETE followed by a
			// separate `Promise.all(insert...)` ran as independent auto-commits, so
			// a failed re-INSERT could permanently wipe the tags / chip purchases /
			// blind structure — the headline data-loss this issue targets (SA2-116).
			// Mirrors createWithLevels above.
			const statements: [BatchStatement, ...BatchStatement[]] = [
				ctx.db
					.update(tournament)
					.set(updateData)
					.where(eq(tournament.id, input.id)),
			];

			if (input.tags !== undefined) {
				statements.push(
					ctx.db
						.delete(tournamentTag)
						.where(eq(tournamentTag.tournamentId, input.id)),
					...input.tags.map((name) =>
						ctx.db.insert(tournamentTag).values({
							id: crypto.randomUUID(),
							tournamentId: input.id,
							name,
						})
					)
				);
			}

			if (input.chipPurchases !== undefined) {
				statements.push(
					ctx.db
						.delete(tournamentChipPurchase)
						.where(eq(tournamentChipPurchase.tournamentId, input.id)),
					...input.chipPurchases.map((cp, i) =>
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

			statements.push(
				ctx.db.delete(blindLevel).where(eq(blindLevel.tournamentId, input.id)),
				...input.blindLevels.map((l, i) =>
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
						games: l.games ?? null,
					})
				)
			);

			await ctx.db.batch(statements);

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
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this tag",
				});
			}

			await validateTournamentOwnership(ctx.db, tag.tournamentId, userId);

			await ctx.db.delete(tournamentTag).where(eq(tournamentTag.id, input.id));
			return { success: true };
		}),
});
