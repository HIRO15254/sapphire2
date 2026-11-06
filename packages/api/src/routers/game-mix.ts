import { DEFAULT_GAME_MIXES } from "@sapphire2/db/constants/game-variants";
import { gameLineup } from "@sapphire2/db/schema/game-lineup";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull, notExists, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { activeReferencesGuard } from "../lib/active-reference-guard";
import type { BatchStatement } from "../lib/batch";
import { insertChunks } from "../lib/batch";
import { validateEntityOwnership } from "../lib/ownership";
import { guardStatement, runGuardedBatch } from "../lib/write-guard";
import {
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
const gamesSchema = z.array(idSchema).min(2).max(30);

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
			archivedAt: gameVariant.archivedAt,
			groupId: gameVariant.groupId,
			id: gameVariant.id,
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

function groupSpanGuard(db: Db, userId: string, games: string[]) {
	return guardStatement(
		db,
		"mix group limit",
		sql`(
		SELECT COUNT(DISTINCT ${gameVariant.groupId}) FROM ${gameVariant}
		WHERE ${gameVariant.userId} = ${userId}
		AND ${inArray(gameVariant.id, games)}
	) <= ${MAX_MIX_GROUPS}`
	);
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

export const gameMixIdInputSchema = z.object({ id: idSchema });

export const gameMixCreateInputSchema = z.object({
	games: gamesSchema,
	label: labelSchema,
});

export const gameMixUpdateInputSchema = z.object({
	games: gamesSchema.optional(),
	id: idSchema,
	label: labelSchema.optional(),
});

export const gameMixRouter = router({
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
				groupSpanGuard(ctx.db, userId, input.games),
				activeReferencesGuard(ctx.db, gameVariant, input.games, userId),
				ctx.db.insert(gameMix).values({
					builtinKey: null,
					id,
					label: input.label,
					updatedAt: new Date(),
					userId,
				}),
			];
			statements.push(
				...insertChunks(mixMembershipRows(id, userId, input.games), (chunk) =>
					ctx.db.insert(gameMixVariant).values(chunk)
				)
			);
			await runLabelWrite(ctx.db, "game mix", userId, input.label, () =>
				runGuardedBatch(ctx.db, statements)
			);
			return await selectMix(ctx.db, userId, id);
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

	restore: protectedProcedure
		.input(gameMixIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);
			const restored = await ctx.db
				.update(gameMix)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(
					and(
						eq(gameMix.id, input.id),
						eq(gameMix.userId, userId),
						notExists(
							ctx.db
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
										eq(gameMixVariant.mixId, gameMix.id),
										eq(gameMixVariant.userId, gameMix.userId),
										isNotNull(gameVariant.archivedAt)
									)
								)
						)
					)
				)
				.returning({ id: gameMix.id });
			if (restored.length === 0) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"This game mix contains archived game variants; restore them first",
				});
			}
			return await selectMix(ctx.db, userId, input.id);
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
					.select({
						position: gameMixVariant.position,
						variantId: gameMixVariant.variantId,
					})
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
				const snapshot = JSON.stringify(current);
				statements.push(
					guardStatement(
						ctx.db,
						"mix membership snapshot",
						sql`
					(SELECT count(*) FROM ${gameMixVariant}
					 WHERE ${gameMixVariant.mixId} = ${input.id} AND ${gameMixVariant.userId} = ${userId}) = ${current.length}
					AND NOT EXISTS (
						SELECT 1 FROM json_each(${snapshot}) AS expected WHERE NOT EXISTS (
							SELECT 1 FROM ${gameMixVariant}
							WHERE ${gameMixVariant.mixId} = ${input.id}
							AND ${gameMixVariant.userId} = ${userId}
							AND ${gameMixVariant.variantId} = json_extract(expected.value, '$.variantId')
							AND ${gameMixVariant.position} = json_extract(expected.value, '$.position')
						)
					)
				`
					)
				);
				statements.push(groupSpanGuard(ctx.db, userId, input.games));
				statements.push(
					guardStatement(
						ctx.db,
						"active mix variants",
						sql`NOT EXISTS (
						SELECT 1 FROM json_each(${JSON.stringify(input.games)}) AS requested
						WHERE NOT EXISTS (
							SELECT 1 FROM ${gameVariant} WHERE ${gameVariant.id} = requested.value
							AND ${gameVariant.userId} = ${userId} AND ${gameVariant.archivedAt} IS NULL
						) AND NOT EXISTS (
							SELECT 1 FROM ${gameMixVariant} WHERE ${gameMixVariant.mixId} = ${input.id}
							AND ${gameMixVariant.userId} = ${userId} AND ${gameMixVariant.variantId} = requested.value
						)
					)`
					)
				);
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
				statements.push(
					...insertChunks(
						mixMembershipRows(input.id, userId, input.games),
						(chunk) => ctx.db.insert(gameMixVariant).values(chunk)
					)
				);
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
				runGuardedBatch(ctx.db, statements)
			);
			return await selectMix(ctx.db, userId, input.id);
		}),
});
