import { DEFAULT_GAME_MIXES } from "@sapphire2/db/constants/game-variants";
import { gameLineup } from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull, notExists } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import type { BatchStatement } from "../lib/batch";
import { runBatch } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import {
	chunkMembershipRows,
	type GameMixWithGames,
	gameMixColumns,
	hydrateOwnedGameMixes,
	listOwnedGameMixes,
} from "../services/game-mix";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	compareBuiltinFirst,
	type Db,
	gameMasterListInputSchema,
	runLabelWrite,
} from "./_game-masters";

const labelSchema = z.string().trim().min(1).max(30);
const gamesSchema = z.array(z.string()).min(2).max(30);

const BUILTIN_ORDER: Map<string, number> = new Map(
	DEFAULT_GAME_MIXES.map((m, index) => [m.key, index])
);

const compareMixes = compareBuiltinFirst(BUILTIN_ORDER);

async function validateGamesOwnership(
	db: Db,
	ids: string[],
	userId: string
): Promise<{ archivedAt: Date | null; groupId: string; id: string }[]> {
	const owned = await db
		.select({
			id: gameVariant.id,
			groupId: gameVariant.groupId,
			archivedAt: gameVariant.archivedAt,
		})
		.from(gameVariant)
		.where(and(inArray(gameVariant.id, ids), eq(gameVariant.userId, userId)));

	if (owned.length !== ids.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own one or more of these game variants",
		});
	}
	return owned;
}

function assertNoDuplicateGames(ids: string[]): void {
	if (new Set(ids).size !== ids.length) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "A mix cannot reference the same game variant twice",
		});
	}
}

function assertNoNewArchivedGames(
	owned: { archivedAt: Date | null; id: string }[],
	kept: Set<string>
): void {
	if (owned.some((row) => row.archivedAt !== null && !kept.has(row.id))) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message:
				"An archived game variant cannot be added to a mix; restore it first",
		});
	}
}

function mixMembershipRows(
	mixId: string,
	userId: string,
	games: string[]
): (typeof gameMixVariant.$inferInsert)[] {
	return games.map((variantId, position) => ({
		mixId,
		position,
		userId,
		variantId,
	}));
}

function assertGroupSpanWithinLimit(rows: { groupId: string }[]): void {
	const distinctGroupCount = new Set(rows.map((r) => r.groupId)).size;
	if (distinctGroupCount > MAX_MIX_GROUPS) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `A mix cannot span more than ${MAX_MIX_GROUPS} game groups.`,
		});
	}
}

async function selectMix(
	db: Db,
	userId: string,
	id: string
): Promise<GameMixWithGames | undefined> {
	const rows = await db
		.select(gameMixColumns)
		.from(gameMix)
		.where(and(eq(gameMix.id, id), eq(gameMix.userId, userId)));
	const [hydrated] = await hydrateOwnedGameMixes(db, userId, rows);
	return hydrated;
}

export const gameMixListInputSchema = gameMasterListInputSchema();

export const gameMixIdInputSchema = z.object({ id: z.string() });

export const gameMixCreateInputSchema = z.object({
	label: labelSchema,
	games: gamesSchema,
});

export const gameMixUpdateInputSchema = z.object({
	id: z.string(),
	label: labelSchema.optional(),
	games: gamesSchema.optional(),
});

export const gameMixRouter = router({
	list: protectedProcedure
		.input(gameMixListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			let rows = await listOwnedGameMixes(ctx.db, userId);
			if (rows.length === 0) {
				await seedDefaultGameData(ctx.db, userId);
				rows = await listOwnedGameMixes(ctx.db, userId);
			}
			return rows
				.filter((row) => input?.includeArchived || row.archivedAt === null)
				.sort(compareMixes);
		}),

	create: protectedProcedure
		.input(gameMixCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			assertNoDuplicateGames(input.games);
			const ownedGames = await validateGamesOwnership(
				ctx.db,
				input.games,
				userId
			);
			assertNoNewArchivedGames(ownedGames, new Set());
			assertGroupSpanWithinLimit(ownedGames);

			const id = crypto.randomUUID();
			const statements: BatchStatement[] = [
				ctx.db.insert(gameMix).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					games: [],
					updatedAt: new Date(),
				}),
			];
			for (const chunk of chunkMembershipRows(
				mixMembershipRows(id, userId, input.games)
			)) {
				statements.push(ctx.db.insert(gameMixVariant).values(chunk));
			}
			await runLabelWrite(ctx.db, "game mix", userId, input.label, () =>
				runBatch(ctx.db, statements)
			);
			return await selectMix(ctx.db, userId, id);
		}),

	update: protectedProcedure
		.input(gameMixUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);

			const statements: BatchStatement[] = [];
			if (input.games !== undefined) {
				assertNoDuplicateGames(input.games);
				const ownedGames = await validateGamesOwnership(
					ctx.db,
					input.games,
					userId
				);
				const current = await ctx.db
					.select({ variantId: gameMixVariant.variantId })
					.from(gameMixVariant)
					.where(
						and(
							eq(gameMixVariant.mixId, input.id),
							eq(gameMixVariant.userId, userId)
						)
					);
				assertNoNewArchivedGames(
					ownedGames,
					new Set(current.map((row) => row.variantId))
				);
				assertGroupSpanWithinLimit(ownedGames);
				statements.push(
					ctx.db
						.delete(gameMixVariant)
						.where(
							and(
								eq(gameMixVariant.mixId, input.id),
								eq(gameMixVariant.userId, userId)
							)
						)
				);
				for (const chunk of chunkMembershipRows(
					mixMembershipRows(input.id, userId, input.games)
				)) {
					statements.push(ctx.db.insert(gameMixVariant).values(chunk));
				}
			}

			const updateData: Partial<typeof gameMix.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			statements.push(
				ctx.db
					.update(gameMix)
					.set(updateData)
					.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)))
			);
			await runLabelWrite(ctx.db, "game mix", userId, input.label, () =>
				runBatch(ctx.db, statements)
			);
			return await selectMix(ctx.db, userId, input.id);
		}),

	archive: protectedProcedure
		.input(gameMixIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);
			const now = new Date();
			await ctx.db
				.update(gameMix)
				.set({ archivedAt: now, updatedAt: now })
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			return await selectMix(ctx.db, userId, input.id);
		}),

	restore: protectedProcedure
		.input(gameMixIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);
			const [archivedMember] = await ctx.db
				.select({ id: gameVariant.id })
				.from(gameMixVariant)
				.innerJoin(
					gameVariant,
					and(
						eq(gameVariant.id, gameMixVariant.variantId),
						eq(gameVariant.userId, gameMixVariant.userId)
					)
				)
				.where(
					and(
						eq(gameMixVariant.mixId, input.id),
						eq(gameMixVariant.userId, userId),
						isNotNull(gameVariant.archivedAt)
					)
				)
				.limit(1);
			if (archivedMember) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This game mix contains archived game variants; restore them first",
				});
			}
			await ctx.db
				.update(gameMix)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			return await selectMix(ctx.db, userId, input.id);
		}),

	delete: protectedProcedure
		.input(gameMixIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);
			const deleted = await ctx.db
				.delete(gameMix)
				.where(
					and(
						eq(gameMix.id, input.id),
						eq(gameMix.userId, userId),
						notExists(
							ctx.db
								.select({ id: gameLineup.id })
								.from(gameLineup)
								.where(
									and(
										eq(gameLineup.gameMixId, gameMix.id),
										eq(gameLineup.userId, gameMix.userId)
									)
								)
						)
					)
				)
				.returning({ id: gameMix.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This game mix is in use; archive it instead",
				});
			}
			return { success: true as const };
		}),
});
