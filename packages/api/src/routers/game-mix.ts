import { DEFAULT_GAME_MIXES } from "@sapphire2/db/constants/game-variants";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { MAX_MIX_GROUPS } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	assertLabelNamespaceAvailable,
	compareBuiltinFirst,
	isUniqueConstraintViolation,
} from "./_game-masters";
import { validateEntityOwnership } from "./session";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const gamesSchema = z.array(z.string()).min(2).max(30);

// Canonical builtin display order (HORSE -> 8-Game -> 10-Game) — builtin
// mixes sort ahead of any user-created mix, which then sorts alphabetically
// by label (mirrors game-group.ts's compareGroups).
const BUILTIN_ORDER: Map<string, number> = new Map(
	DEFAULT_GAME_MIXES.map((m, index) => [m.key, index])
);

const compareMixes = compareBuiltinFirst(BUILTIN_ORDER);

/**
 * Ownership guard for the `games` array (ordered game_variant ids). Selects
 * the caller-owned subset (id + groupId) in a single `WHERE id IN (…) AND
 * userId = caller` query; if the owned count differs from the requested
 * count, at least one id is missing or belongs to another user → uniform
 * FORBIDDEN (SA2-177, SA2-183). Callers must reject duplicate ids before
 * calling this (see `assertNoDuplicateGames`) so the count comparison is
 * meaningful. `groupId` is returned so the caller can also bound the mix's
 * group span (see `assertGroupSpanWithinLimit`, c58).
 */
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

/**
 * A mix built from variants spanning more than `MAX_MIX_GROUPS` distinct game
 * groups can never be turned into a session's `mixGames` (that array is
 * itself capped at `MAX_MIX_GROUPS` groups via `mixGamesSchema` /
 * `levelGamesSchema`) — reject at the master-mix level instead of producing a
 * mix that silently truncates or fails later (c58). Shares the same limit
 * constant as those consumer schemas so the two cannot drift.
 */
function assertGroupSpanWithinLimit(rows: { groupId: string }[]): void {
	const distinctGroupCount = new Set(rows.map((r) => r.groupId)).size;
	if (distinctGroupCount > MAX_MIX_GROUPS) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `A mix cannot span more than ${MAX_MIX_GROUPS} game groups.`,
		});
	}
}

export const gameMixRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const rows = await ctx.db
			.select()
			.from(gameMix)
			.where(eq(gameMix.userId, userId));
		if (rows.length > 0) {
			return [...rows].sort(compareMixes);
		}
		// Zero-rows-account self-seed, same guard as gameGroup.list /
		// gameVariant.list — a legacy account that predates the auth-hook seed
		// still gets the builtin mixes on first read. Only reached when THIS
		// table is empty (c32); seedDefaultGameData still re-checks all three
		// tables itself (c09).
		await seedDefaultGameData(ctx.db, userId);
		const reseeded = await ctx.db
			.select()
			.from(gameMix)
			.where(eq(gameMix.userId, userId));
		return [...reseeded].sort(compareMixes);
	}),

	create: protectedProcedure
		.input(
			z.object({
				label: labelSchema,
				games: gamesSchema,
			})
		)
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
				await ctx.db.insert(gameMix).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					games: input.games,
					updatedAt: new Date(),
				});
			} catch (error) {
				// (user_id, label) unique-index backstop against the app-level
				// check above racing a concurrent identical-label insert (c14,
				// TOCTOU) — converted to the same CONFLICT the app-level check
				// throws.
				if (isUniqueConstraintViolation(error)) {
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
				.where(eq(gameMix.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				label: labelSchema.optional(),
				games: gamesSchema.optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"gameMix",
				input.id,
				userId
			);

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

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			if (input.games !== undefined) {
				updateData.games = input.games;
			}

			try {
				await ctx.db
					.update(gameMix)
					.set(updateData)
					// Bind both id AND user_id so a foreign id can never be updated via
					// this procedure (write-IDOR, SA2-176).
					.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			} catch (error) {
				// Same (user_id, label) unique-index backstop as create() above (c14).
				if (isUniqueConstraintViolation(error)) {
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
				.where(eq(gameMix.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameMix", input.id, userId);

			// `variant` columns elsewhere (ring_game.variant, session snapshots,
			// etc.) store the display label verbatim rather than a foreign key
			// into this table, so deleting a mix definition row here never
			// corrupts past sessions/games (self-freezing design, same as
			// gameVariant.delete) — a free deletion, no in-use guard needed.
			await ctx.db
				.delete(gameMix)
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));
			return { success: true };
		}),
});
