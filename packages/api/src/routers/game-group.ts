import { DEFAULT_GAME_GROUPS } from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameLineupGroup } from "@sapphire2/db/schema/game-lineup";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, notExists } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { validateEntityOwnership } from "../lib/ownership";
import { seedDefaultGameData } from "../services/seed-game-data";
import {
	compareBuiltinFirst,
	type Db,
	gameMasterListInputSchema,
	runLabelWrite,
} from "./_game-masters";

const labelSchema = z.string().trim().min(1).max(30);
const blindLabelSchema = z.string().trim().min(1).max(20).nullish();

const BUILTIN_ORDER: Map<string, number> = new Map(
	DEFAULT_GAME_GROUPS.map((g, index) => [g.key, index])
);

const compareGroups = compareBuiltinFirst(BUILTIN_ORDER);

async function selectGroup(db: Db, userId: string, id: string) {
	const [found] = await db
		.select()
		.from(gameGroup)
		.where(and(eq(gameGroup.id, id), eq(gameGroup.userId, userId)));
	return found;
}

export const gameGroupListInputSchema = gameMasterListInputSchema();

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
	list: protectedProcedure
		.input(gameGroupListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await seedDefaultGameData(ctx.db, userId);
			const rows = await ctx.db
				.select()
				.from(gameGroup)
				.where(eq(gameGroup.userId, userId));
			return rows
				.filter((row) => input?.includeArchived || row.archivedAt === null)
				.sort(compareGroups);
		}),

	create: protectedProcedure
		.input(gameGroupCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await runLabelWrite(ctx.db, "game group", userId, input.label, () =>
				ctx.db.insert(gameGroup).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					blind1Label: input.blind1Label ?? null,
					blind2Label: input.blind2Label ?? null,
					blind3Label: input.blind3Label ?? null,
					updatedAt: new Date(),
				})
			);
			return await selectGroup(ctx.db, userId, id);
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

			await runLabelWrite(ctx.db, "game group", userId, input.label, () =>
				ctx.db
					.update(gameGroup)
					.set(updateData)
					.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)))
			);
			return await selectGroup(ctx.db, userId, input.id);
		}),

	archive: protectedProcedure
		.input(gameGroupIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);
			const [activeVariant] = await ctx.db
				.select({ id: gameVariant.id })
				.from(gameVariant)
				.where(
					and(
						eq(gameVariant.groupId, input.id),
						eq(gameVariant.userId, userId),
						isNull(gameVariant.archivedAt)
					)
				)
				.limit(1);
			if (activeVariant) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This game group still has active game variants; archive them first",
				});
			}
			const now = new Date();
			await ctx.db
				.update(gameGroup)
				.set({ archivedAt: now, updatedAt: now })
				.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));
			return await selectGroup(ctx.db, userId, input.id);
		}),

	restore: protectedProcedure
		.input(gameGroupIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);
			await ctx.db
				.update(gameGroup)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(and(eq(gameGroup.id, input.id), eq(gameGroup.userId, userId)));
			return await selectGroup(ctx.db, userId, input.id);
		}),

	delete: protectedProcedure
		.input(gameGroupIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);
			const deleted = await ctx.db
				.delete(gameGroup)
				.where(
					and(
						eq(gameGroup.id, input.id),
						eq(gameGroup.userId, userId),
						notExists(
							ctx.db
								.select({ id: gameVariant.id })
								.from(gameVariant)
								.where(
									and(
										eq(gameVariant.groupId, gameGroup.id),
										eq(gameVariant.userId, gameGroup.userId)
									)
								)
						),
						notExists(
							ctx.db
								.select({ id: gameLineupGroup.id })
								.from(gameLineupGroup)
								.where(
									and(
										eq(gameLineupGroup.gameGroupId, gameGroup.id),
										eq(gameLineupGroup.userId, gameGroup.userId)
									)
								)
						)
					)
				)
				.returning({ id: gameGroup.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This game group is in use; archive it instead",
				});
			}
			return { success: true as const };
		}),
});
