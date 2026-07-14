import { DEFAULT_GAME_GROUPS } from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isLabelConflictError } from "../lib/db-errors";
import { seedDefaultGameData } from "../services/seed-game-data";
import { compareBuiltinFirst } from "./_game-masters";
import { validateEntityOwnership } from "./session";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const blindLabelSchema = z.string().trim().min(1).max(20).nullish();

// Canonical builtin display order (limit -> stud -> bigbet, structure-sheet
// convention) — builtin groups sort ahead of any user-created group, which
// then sorts alphabetically by label.
const BUILTIN_ORDER: Map<string, number> = new Map(
	DEFAULT_GAME_GROUPS.map((g, index) => [g.key, index])
);

const compareGroups = compareBuiltinFirst(BUILTIN_ORDER);

async function assertGroupLabelAvailable(
	db: Db,
	userId: string,
	label: string,
	excludeId?: string
): Promise<void> {
	const normalized = label.trim().toLowerCase();
	const existing = await db
		.select()
		.from(gameGroup)
		.where(eq(gameGroup.userId, userId));

	const collides = existing.some(
		(row) =>
			row.id !== excludeId && row.label.trim().toLowerCase() === normalized
	);
	if (collides) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a game group with this label",
		});
	}
}

export const gameGroupRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const rows = await ctx.db
			.select()
			.from(gameGroup)
			.where(eq(gameGroup.userId, userId));
		if (rows.length > 0) {
			return [...rows].sort(compareGroups);
		}
		// Both masters are per-user rows now (mix-game rework); a fully-empty
		// account (no groups, no variants, no mixes) is seeded on first read so
		// legacy accounts that predate the auth-hook seed still get the builtin
		// list. Only reached when THIS table is empty (c32); seedDefaultGameData
		// still re-checks all three tables itself (c09) so a caller who deleted
		// only their groups (but kept a variant/mix) is correctly left empty.
		await seedDefaultGameData(ctx.db, userId);
		const reseeded = await ctx.db
			.select()
			.from(gameGroup)
			.where(eq(gameGroup.userId, userId));
		return [...reseeded].sort(compareGroups);
	}),

	create: protectedProcedure
		.input(
			z.object({
				label: labelSchema,
				blind1Label: blindLabelSchema,
				blind2Label: blindLabelSchema,
				blind3Label: blindLabelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await assertGroupLabelAvailable(ctx.db, userId, input.label);

			const id = crypto.randomUUID();
			try {
				await ctx.db.insert(gameGroup).values({
					id,
					userId,
					// User-created groups never carry a builtinKey — only the 3 seeded
					// rows do, and builtinKey is immutable (not part of this input).
					builtinKey: null,
					label: input.label,
					blind1Label: input.blind1Label ?? null,
					blind2Label: input.blind2Label ?? null,
					blind3Label: input.blind3Label ?? null,
					updatedAt: new Date(),
				});
			} catch (error) {
				// Backstop against the app-level check above racing a concurrent
				// identical-label insert (c14, TOCTOU). The DB guard that fires is
				// the migration-0041 BEFORE trigger (not the unique index — SQLite
				// runs the trigger first), so isLabelConflictError matches its abort
				// message too — converted to the same CONFLICT the app-level check
				// throws.
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a game group with this label",
					});
				}
				throw error;
			}

			const [created] = await ctx.db
				.select()
				.from(gameGroup)
				.where(eq(gameGroup.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				label: labelSchema.optional(),
				blind1Label: blindLabelSchema,
				blind2Label: blindLabelSchema,
				blind3Label: blindLabelSchema,
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateEntityOwnership(
				ctx.db,
				"gameGroup",
				input.id,
				userId
			);

			if (input.label !== undefined) {
				await assertGroupLabelAvailable(ctx.db, userId, input.label, input.id);
			}

			// builtinKey is intentionally not in the input schema (immutable) — a
			// seeded row's builtinKey survives label/blind-label edits unchanged.
			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.label !== undefined) {
				updateData.label = input.label;
			}
			if (input.blind1Label !== undefined) {
				updateData.blind1Label = input.blind1Label;
			}
			if (input.blind2Label !== undefined) {
				updateData.blind2Label = input.blind2Label;
			}
			if (input.blind3Label !== undefined) {
				updateData.blind3Label = input.blind3Label;
			}

			try {
				await ctx.db
					.update(gameGroup)
					.set(updateData)
					// Bind both id AND user_id so a foreign id can never be updated via
					// this procedure (write-IDOR, SA2-176).
					.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));
			} catch (error) {
				// Same label-collision backstop as create() above (c14) — matches
				// both the unique index and the 0041 trigger abort message.
				if (isLabelConflictError(error)) {
					throw new TRPCError({
						code: "CONFLICT",
						message: "You already have a game group with this label",
					});
				}
				throw error;
			}

			const [updated] = await ctx.db
				.select()
				.from(gameGroup)
				.where(eq(gameGroup.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);

			// A group in use by one of the caller's own game variants cannot be
			// deleted out from under it — explicit count check before the delete,
			// backed by the gameVariant.groupId FK's onDelete: "restrict" (SA2-165).
			const [inUse] = await ctx.db
				.select({ id: gameVariant.id })
				.from(gameVariant)
				.where(
					and(eq(gameVariant.groupId, input.id), eq(gameVariant.userId, userId))
				)
				.limit(1);
			if (inUse) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This group is used by one or more game variants",
				});
			}

			await ctx.db
				.delete(gameGroup)
				.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));
			return { success: true };
		}),
});
