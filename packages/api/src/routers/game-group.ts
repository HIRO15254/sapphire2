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

export const gameGroupCreateInputSchema = z.object({
	label: labelSchema,
	blind1Label: blindLabelSchema,
	blind2Label: blindLabelSchema,
	blind3Label: blindLabelSchema,
});

export const gameGroupUpdateInputSchema = z.object({
	id: z.string(),
	label: labelSchema.optional(),
	blind1Label: blindLabelSchema,
	blind2Label: blindLabelSchema,
	blind3Label: blindLabelSchema,
});

export const gameGroupIdInputSchema = z.object({ id: z.string() });

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
		await seedDefaultGameData(ctx.db, userId);
		const reseeded = await ctx.db
			.select()
			.from(gameGroup)
			.where(eq(gameGroup.userId, userId));
		return [...reseeded].sort(compareGroups);
	}),

	create: protectedProcedure
		.input(gameGroupCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await assertGroupLabelAvailable(ctx.db, userId, input.label);

			const id = crypto.randomUUID();
			try {
				await ctx.db.insert(gameGroup).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					blind1Label: input.blind1Label ?? null,
					blind2Label: input.blind2Label ?? null,
					blind3Label: input.blind3Label ?? null,
					updatedAt: new Date(),
				});
			} catch (error) {
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
		.input(gameGroupUpdateInputSchema)
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
					.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));
			} catch (error) {
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
		.input(gameGroupIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);

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
