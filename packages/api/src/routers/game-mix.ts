import { DEFAULT_GAME_MIXES } from "@sapphire2/db/constants/game-variants";
import { gameMix, gameMixVariant } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import type { BatchStatement } from "../lib/batch";
import { runBatch } from "../lib/batch";
import { isLabelConflictError } from "../lib/db-errors";
import {
	chunkMembershipRows,
	hydrateOwnedGameMixes,
	listOwnedGameMixes,
} from "../services/game-mix";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	assertLabelNamespaceAvailable,
	compareBuiltinFirst,
} from "./_game-masters";
import { validateEntityOwnership } from "./session";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

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
): Promise<{ groupId: string; id: string }[]> {
	const owned = await db
		.select({ id: gameVariant.id, groupId: gameVariant.groupId })
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
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const rows = await listOwnedGameMixes(ctx.db, userId);
		if (rows.length > 0) {
			return [...rows].sort(compareMixes);
		}
		await seedDefaultGameData(ctx.db, userId);
		const reseeded = await listOwnedGameMixes(ctx.db, userId);
		return [...reseeded].sort(compareMixes);
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
			assertGroupSpanWithinLimit(ownedGames);
			await assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
				self: "mix",
			});

			const id = crypto.randomUUID();
			try {
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
				const rows = mixMembershipRows(id, userId, input.games);
				for (const chunk of chunkMembershipRows(rows)) {
					statements.push(ctx.db.insert(gameMixVariant).values(chunk));
				}
				statements.push(
					ctx.db
						.update(gameMix)
						.set({ games: input.games })
						.where(and(eq(gameMix.id, id), eq(gameMix.userId, userId)))
				);
				await runBatch(ctx.db, statements);
			} catch (error) {
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a mix with this label",
					});
				}
				throw error;
			}

			const [created] = await ctx.db
				.select()
				.from(gameMix)
				.where(and(eq(gameMix.id, id), eq(gameMix.userId, userId)));
			return created ? { ...created, games: input.games } : created;
		}),

	update: protectedProcedure
		.input(gameMixUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);

			if (input.games !== undefined) {
				assertNoDuplicateGames(input.games);
				const ownedGames = await validateGamesOwnership(
					ctx.db,
					input.games,
					userId
				);
				assertGroupSpanWithinLimit(ownedGames);
			}
			if (input.label !== undefined) {
				await assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
					self: "mix",
					excludeId: input.id,
				});
			}

			const updateData: Partial<typeof gameMix.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.label !== undefined) {
				updateData.label = input.label;
			}

			try {
				const statements: BatchStatement[] = [];
				if (input.games !== undefined) {
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
					const rows = mixMembershipRows(input.id, userId, input.games);
					for (const chunk of chunkMembershipRows(rows)) {
						statements.push(ctx.db.insert(gameMixVariant).values(chunk));
					}
					updateData.games = input.games;
				}
				statements.push(
					ctx.db
						.update(gameMix)
						.set(updateData)
						.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)))
				);
				await runBatch(ctx.db, statements);
			} catch (error) {
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a mix with this label",
					});
				}
				throw error;
			}

			const [updated] = await ctx.db
				.select()
				.from(gameMix)
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			if (!updated) {
				return updated;
			}
			if (input.games !== undefined) {
				return { ...updated, games: input.games };
			}
			const [hydrated] = await hydrateOwnedGameMixes(ctx.db, userId, [updated]);
			return hydrated;
		}),

	delete: protectedProcedure
		.input(gameMixIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);

			await ctx.db
				.delete(gameMix)
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			return { success: true };
		}),
});
