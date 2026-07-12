import {
	MIX_VARIANT,
	MIX_VARIANT_LABEL,
} from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameMix } from "@sapphire2/db/schema/game-mix";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { seedDefaultGameData } from "../services/seed-game-data";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const shortLabelSchema = z.string().trim().min(1).max(15).nullish();

// The mix pseudo-variant is a MODE, not a per-user row — its key and display
// label are reserved so a real game-variant row can never collide with it.
const RESERVED_LABELS = new Set(
	[MIX_VARIANT, MIX_VARIANT_LABEL].map((s) => s.toLowerCase())
);

/**
 * Fetches the row by id; if it does not exist OR is owned by someone else,
 * throws a uniform FORBIDDEN. Never distinguishes "missing" from "owned by
 * another user" — that distinction is an existence oracle (SA2-183).
 */
async function validateGameVariantOwnership(
	db: Db,
	id: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.id, id));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this game variant",
		});
	}

	return found;
}

/** Same uniform-FORBIDDEN ownership contract as {@link validateGameVariantOwnership}. */
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

async function assertLabelAvailable(
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

	const existing = await db
		.select()
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));

	const collides = existing.some(
		(row) =>
			row.id !== excludeId && row.label.trim().toLowerCase() === normalized
	);
	if (collides) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a game variant with this label",
		});
	}

	// A named mix's label is chosen from the same client-side select as a
	// plain game variant (both freeze into the same `variant` string once
	// picked), so the two namespaces must never collide (see game-mix.ts's
	// assertMixLabelAvailable for the mirror-image check).
	const existingMixes = await db
		.select()
		.from(gameMix)
		.where(eq(gameMix.userId, userId));
	const collidesMix = existingMixes.some(
		(row) => row.label.trim().toLowerCase() === normalized
	);
	if (collidesMix) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a mix with this label",
		});
	}
}

async function nextSortOrder(db: Db, userId: string): Promise<number> {
	const rows = await db
		.select({ sortOrder: gameVariant.sortOrder })
		.from(gameVariant)
		.where(eq(gameVariant.userId, userId));
	const maxSortOrder = rows.reduce((max, r) => Math.max(max, r.sortOrder), -1);
	return maxSortOrder + 1;
}

export const gameVariantRouter = router({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		// Both masters are per-user rows now (mix-game rework); a fully-empty
		// account (no groups, no variants) is seeded on first read so legacy
		// accounts that predate the auth-hook seed still get the builtin list.
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
			await validateGameGroupOwnership(ctx.db, input.groupId, userId);
			await assertLabelAvailable(ctx.db, userId, input.label);

			const id = crypto.randomUUID();
			const sortOrder = await nextSortOrder(ctx.db, userId);
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
			const found = await validateGameVariantOwnership(
				ctx.db,
				input.id,
				userId
			);

			if (input.groupId !== undefined) {
				await validateGameGroupOwnership(ctx.db, input.groupId, userId);
			}
			if (input.label !== undefined) {
				await assertLabelAvailable(ctx.db, userId, input.label, input.id);
			}

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

			await ctx.db
				.update(gameVariant)
				.set(updateData)
				// Bind both id AND user_id so a foreign id can never be updated via
				// this procedure (write-IDOR, SA2-176).
				.where(
					and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
				);

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
			await validateGameVariantOwnership(ctx.db, input.id, userId);

			// `variant` columns elsewhere (ring_game.variant, session snapshots,
			// etc.) store the display label verbatim rather than a foreign key
			// into this table, so deleting a definition row here never corrupts
			// past sessions/games (self-freezing design) — a free deletion, no
			// in-use guard needed (contrast gameGroup.delete, which DOES need one
			// since variants FK-reference groups with onDelete: "restrict").
			await ctx.db
				.delete(gameVariant)
				.where(
					and(eq(gameVariant.id, input.id), eq(gameVariant.userId, userId))
				);
			return { success: true };
		}),
});
