import { DEFAULT_GAME_GROUPS } from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { seedDefaultGameData } from "../services/seed-game-data";

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

function compareGroups(
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

/** Same uniform-FORBIDDEN ownership contract used across the mix-game routers (SA2-183). */
async function validateGameGroupOwnership(db: Db, id: string, userId: string) {
	const [found] = await db.select().from(gameGroup).where(eq(gameGroup.id, id));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game group",
		});
	}

	return found;
}

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
		// Both masters are per-user rows now (mix-game rework); a fully-empty
		// account (no groups, no variants) is seeded on first read so legacy
		// accounts that predate the auth-hook seed still get the builtin list.
		await seedDefaultGameData(ctx.db, userId);

		const rows = await ctx.db
			.select()
			.from(gameGroup)
			.where(eq(gameGroup.userId, userId));
		return [...rows].sort(compareGroups);
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
			const found = await validateGameGroupOwnership(ctx.db, input.id, userId);

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

			await ctx.db
				.update(gameGroup)
				.set(updateData)
				// Bind both id AND user_id so a foreign id can never be updated via
				// this procedure (write-IDOR, SA2-176).
				.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));

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
			await validateGameGroupOwnership(ctx.db, input.id, userId);

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
