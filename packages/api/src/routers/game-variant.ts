import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, max } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	assertLabelNamespaceAvailable,
	isUniqueConstraintViolation,
} from "./_game-masters";
import { validateEntityOwnership } from "./session";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const shortLabelSchema = z.string().trim().min(1).max(15).nullish();

async function nextSortOrder(db: Db, userId: string): Promise<number> {
	const [row] = await db
		.select({ maxSort: max(gameVariant.sortOrder) })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	return row?.maxSort == null ? 0 : row.maxSort + 1;
}

export const gameVariantRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const rows = await ctx.db
			.select()
			.from(gameVariant)
			.where(eq(gameVariant.userId, userId))
			.orderBy(asc(gameVariant.sortOrder), asc(gameVariant.label));
		if (rows.length > 0) {
			return rows;
		}
		// Both masters are per-user rows now (mix-game rework); a fully-empty
		// account (no groups, no variants, no mixes) is seeded on first read so
		// legacy accounts that predate the auth-hook seed still get the builtin
		// list. Only reached when THIS table is empty (c32) — seedDefaultGameData
		// still re-checks all three tables itself (c09) so a caller who deleted
		// only their variants (but kept a group/mix) is correctly left empty.
		await seedDefaultGameData(ctx.db, userId);
		return ctx.db
			.select()
			.from(gameVariant)
			.where(eq(gameVariant.userId, userId))
			.orderBy(asc(gameVariant.sortOrder), asc(gameVariant.label));
	}),

	create: protectedProcedure
		.input(
			z.object({
				label: labelSchema,
				shortLabel: shortLabelSchema,
				groupId: z.string(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			// Independent guards (group ownership vs. label-namespace collision) —
			// run concurrently (c35).
			await Promise.all([
				validateEntityOwnership(ctx.db, "gameGroup", input.groupId, userId),
				assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
					self: "variant",
				}),
			]);

			const id = crypto.randomUUID();
			const sortOrder = await nextSortOrder(ctx.db, userId);
			try {
				await ctx.db.insert(gameVariant).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					shortLabel: input.shortLabel ?? null,
					groupId: input.groupId,
					sortOrder,
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
						message: "You already have a game variant with this label",
					});
				}
				throw error;
			}

			const [created] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				label: labelSchema.optional(),
				shortLabel: shortLabelSchema,
				groupId: z.string().optional(),
				sortOrder: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"gameVariant",
				input.id,
				userId
			);

			// Independent guards — run concurrently when both are present (c35).
			const guards: Promise<unknown>[] = [];
			if (input.groupId !== undefined) {
				guards.push(
					validateEntityOwnership(ctx.db, "gameGroup", input.groupId, userId)
				);
			}
			if (input.label !== undefined) {
				guards.push(
					assertLabelNamespaceAvailable(ctx.db, userId, input.label, {
						self: "variant",
						excludeId: input.id,
					})
				);
			}
			await Promise.all(guards);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			if (input.shortLabel !== undefined) {
				updateData.shortLabel = input.shortLabel;
			}
			if (input.groupId !== undefined) {
				updateData.groupId = input.groupId;
			}
			if (input.sortOrder !== undefined) {
				updateData.sortOrder = input.sortOrder;
			}

			try {
				await ctx.db
					.update(gameVariant)
					.set(updateData)
					// Bind both id AND user_id so a foreign id can never be updated via
					// this procedure (write-IDOR, SA2-176).
					.where(
						and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
					);
			} catch (error) {
				// Same (user_id, label) unique-index backstop as create() above (c14).
				if (isUniqueConstraintViolation(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a game variant with this label",
					});
				}
				throw error;
			}

			const [updated] = await ctx.db
				.select()
				.from(gameVariant)
				.where(eq(gameVariant.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameVariant", input.id, userId);

			// A variant referenced by one of the caller's own mixes cannot be
			// deleted out from under it — game_mix.games stores game_variant ids,
			// but with no FK (it's a JSON array), so this app-level check is the
			// only guard (c07). Contrast the free deletion below it protects: once
			// a variant is unreferenced, `variant` columns elsewhere (ring_game
			// .variant, session snapshots, etc.) store the display label verbatim
			// rather than a foreign key into this table, so deleting the
			// definition row never corrupts past sessions/games (self-freezing
			// design).
			const mixes = await ctx.db
				.select({ games: gameMix.games })
				.from(gameMix)
				.where(eq(gameMix.userId, userId));
			const inUse = mixes.some((m) => m.games.includes(input.id));
			if (inUse) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This variant is used by a game mix. Remove it from the mix first.",
				});
			}

			await ctx.db
				.delete(gameVariant)
				.where(
					and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
				);
			return { success: true };
		}),
});
