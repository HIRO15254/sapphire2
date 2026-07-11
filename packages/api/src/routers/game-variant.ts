import { GAME_VARIANTS } from "@sapphire2/db/constants/game-variants";
import { customGameVariant } from "@sapphire2/db/schema/custom-game-variant";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const labelSchema = z.string().trim().min(1).max(30);
const blindLabelSchema = z.string().trim().min(1).max(20).nullish();

/**
 * True when `label` (trimmed, case-insensitively) matches a preset's key,
 * label, or shortLabel. Pure and exported so it is directly unit-testable;
 * the db-backed half of the collision guard (checking the caller's existing
 * custom labels) lives in `assertLabelAvailable` below.
 */
export function isPresetCollision(label: string): boolean {
	const normalized = label.trim().toLowerCase();
	return Object.entries(GAME_VARIANTS).some(
		([key, def]) =>
			key.toLowerCase() === normalized ||
			def.label.toLowerCase() === normalized ||
			def.shortLabel.toLowerCase() === normalized
	);
}

async function assertLabelAvailable(
	db: Db,
	userId: string,
	label: string,
	excludeId?: string
): Promise<void> {
	if (isPresetCollision(label)) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "This label is already used by a preset variant",
		});
	}

	const normalized = label.trim().toLowerCase();
	const existing = await db
		.select()
		.from(customGameVariant)
		.where(eq(customGameVariant.userId, userId));

	const collides = existing.some(
		(row) =>
			row.id !== excludeId && row.label.trim().toLowerCase() === normalized
	);
	if (collides) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "You already have a custom variant with this label",
		});
	}
}

/**
 * Fetches the row by id; if it does not exist OR is owned by someone else,
 * throws a uniform FORBIDDEN. Never distinguishes "missing" from "owned by
 * another user" — that distinction is an existence oracle (SA2-183).
 */
async function validateCustomGameVariantOwnership(
	db: Db,
	id: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(customGameVariant)
		.where(eq(customGameVariant.id, id));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this custom game variant",
		});
	}

	return found;
}

export const gameVariantRouter = router({
	list: protectedProcedure.query(({ ctx }) => {
		const userId = ctx.session.user.id;
		return ctx.db
			.select()
			.from(customGameVariant)
			.where(eq(customGameVariant.userId, userId))
			.orderBy(asc(customGameVariant.label));
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
			await assertLabelAvailable(ctx.db, userId, input.label);

			const id = crypto.randomUUID();
			await ctx.db.insert(customGameVariant).values({
				id,
				userId,
				label: input.label,
				blind1Label: input.blind1Label ?? null,
				blind2Label: input.blind2Label ?? null,
				blind3Label: input.blind3Label ?? null,
				updatedAt: new Date(),
			});

			const [created] = await ctx.db
				.select()
				.from(customGameVariant)
				.where(eq(customGameVariant.id, id));
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
			const found = await validateCustomGameVariantOwnership(
				ctx.db,
				input.id,
				userId
			);

			if (input.label !== undefined) {
				await assertLabelAvailable(ctx.db, userId, input.label, input.id);
			}

			const updateData: Partial<typeof found> = {};
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
			updateData.updatedAt = new Date();

			await ctx.db
				.update(customGameVariant)
				.set(updateData)
				// Bind both id AND user_id so a foreign id can never be updated
				// via this procedure (write-IDOR, SA2-176).
				.where(
					and(
						eq(customGameVariant.id, input.id),
						eq(customGameVariant.userId, userId)
					)
				);

			const [updated] = await ctx.db
				.select()
				.from(customGameVariant)
				.where(eq(customGameVariant.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateCustomGameVariantOwnership(ctx.db, input.id, userId);

			// Variant columns elsewhere (ring_game.variant, session snapshots,
			// etc.) store the display label verbatim rather than a foreign key
			// into this table, so deleting a definition row here never corrupts
			// past sessions/games (self-freezing design).
			await ctx.db
				.delete(customGameVariant)
				.where(
					and(
						eq(customGameVariant.id, input.id),
						eq(customGameVariant.userId, userId)
					)
				);
			return { success: true };
		}),
});
