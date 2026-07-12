import {
	DEFAULT_GAME_MIXES,
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
} from "@sapphire2/db/constants/game-variants";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { seedDefaultGameData } from "../services/seed-game-data";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const gamesSchema = z.array(z.string()).min(2).max(30);

// A mix's label shares the game-variant select namespace client-side (the
// mix's label is stored verbatim as the `variant` string once selected), so
// the mix pseudo-variant mode key/label are reserved here too — mirrors
// RESERVED_LABELS in game-variant.ts.
const RESERVED_LABELS = new Set(
	[MIX_VARIANT, MIX_VARIANT_LABEL].map((s) => s.toLowerCase())
);

// Canonical builtin display order (HORSE -> 8-Game -> 10-Game) — builtin
// mixes sort ahead of any user-created mix, which then sorts alphabetically
// by label (mirrors game-group.ts's compareGroups).
const BUILTIN_ORDER: Map<string, number> = new Map(
	DEFAULT_GAME_MIXES.map((m, index) => [m.key, index])
);

function compareMixes(
	a: { builtinKey: string | null; label: string },
	b: { builtinKey: string | null; label: string }
): number {
	const aOrder = a.builtinKey ? BUILTIN_ORDER.get(a.builtinKey) : undefined;
	const bOrder = b.builtinKey ? BUILTIN_ORDER.get(b.builtinKey) : undefined;
	if (aOrder !== undefined && bOrder !== undefined) {
		return aOrder - bOrder;
	}
	if (aOrder !== undefined) {
		return -1;
	}
	if (bOrder !== undefined) {
		return 1;
	}
	return a.label.localeCompare(b.label);
}

/**
 * Fetches the row by id; if it does not exist OR is owned by someone else,
 * throws a uniform FORBIDDEN. Never distinguishes "missing" from "owned by
 * another user" — that distinction is an existence oracle (SA2-183).
 */
async function validateGameMixOwnership(db: Db, id: string, userId: string) {
	const [found] = await db.select().from(gameMix).where(eq(gameMix.id, id));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this mix",
		});
	}

	return found;
}

/**
 * Ownership guard for the `games` array (ordered game_variant ids). Selects
 * the caller-owned subset in a single `WHERE id IN (…) AND userId = caller`
 * query; if the owned count differs from the requested count, at least one
 * id is missing or belongs to another user → uniform FORBIDDEN (SA2-177,
 * SA2-183). Callers must reject duplicate ids before calling this (see
 * `assertNoDuplicateGames`) so the count comparison is meaningful.
 */
async function validateGamesOwnership(
	db: Db,
	ids: string[],
	userId: string
): Promise<void> {
	const owned = await db
		.select({ id: gameVariant.id })
		.from(gameVariant)
		.where(and(inArray(gameVariant.id, ids), eq(gameVariant.userId, userId)));

	if (owned.length !== ids.length) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own one or more of these game variants",
		});
	}
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
 * A mix's label is chosen from the same client-side select as a plain game
 * variant (both freeze into the same `variant` string once picked), so its
 * namespace spans BOTH the caller's mixes and the caller's variants, plus
 * the reserved mix-mode strings.
 */
async function assertMixLabelAvailable(
	db: Db,
	userId: string,
	label: string,
	excludeId?: string
): Promise<void> {
	const normalized = label.trim().toLowerCase();
	if (RESERVED_LABELS.has(normalized)) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "This label is reserved for the mix mode",
		});
	}

	const existingMixes = await db
		.select()
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	const collidesMix = existingMixes.some(
		(row) =>
			row.id !== excludeId && row.label.trim().toLowerCase() === normalized
	);
	if (collidesMix) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a mix with this label",
		});
	}

	const existingVariants = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	const collidesVariant = existingVariants.some(
		(row) => row.label.trim().toLowerCase() === normalized
	);
	if (collidesVariant) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a game variant with this label",
		});
	}
}

export const gameMixRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		// Zero-rows-account self-seed, same guard as gameGroup.list /
		// gameVariant.list — a legacy account that predates the auth-hook seed
		// still gets the builtin mixes on first read.
		await seedDefaultGameData(ctx.db, userId);

		const rows = await ctx.db
			.select()
			.from(gameMix)
			.where(eq(gameMix.userId, userId));
		return [...rows].sort(compareMixes);
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
			await validateGamesOwnership(ctx.db, input.games, userId);
			await assertMixLabelAvailable(ctx.db, userId, input.label);

			const id = crypto.randomUUID();
			await ctx.db.insert(gameMix).values({
				id,
				userId,
				builtinKey: null,
				label: input.label,
				games: input.games,
				updatedAt: new Date(),
			});

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
			const found = await validateGameMixOwnership(ctx.db, input.id, userId);

			if (input.games !== undefined) {
				assertNoDuplicateGames(input.games);
				await validateGamesOwnership(ctx.db, input.games, userId);
			}
			if (input.label !== undefined) {
				await assertMixLabelAvailable(ctx.db, userId, input.label, input.id);
			}

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			if (input.games !== undefined) {
				updateData.games = input.games;
			}

			await ctx.db
				.update(gameMix)
				.set(updateData)
				// Bind both id AND user_id so a foreign id can never be updated via
				// this procedure (write-IDOR, SA2-176).
				.where(and(eq(gameMix.id, input.id), eq(gameMix.userId, userId)));

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
			await validateGameMixOwnership(ctx.db, input.id, userId);

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
