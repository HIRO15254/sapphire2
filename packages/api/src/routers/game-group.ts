import { DEFAULT_GAME_GROUPS } from "@sapphire2/db/constants/game-variants";
import { gameGroup } from "@sapphire2/db/schema/game-group";
import { gameLineupGroup } from "@sapphire2/db/schema/game-lineup";
import { gameVariant } from "@sapphire2/db/schema/game-variant";
import {
	cashRuleStake,
	tournamentRuleLevelStake,
} from "@sapphire2/db/schema/rule";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull, notExists } from "drizzle-orm";
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
const BLIND_FIELDS = [1, 2, 3] as const;
type BlindField = (typeof BLIND_FIELDS)[number];

interface BlindState {
	blind1Label: string | null;
	blind1Required: boolean;
	blind2Label: string | null;
	blind2Required: boolean;
	blind3Label: string | null;
	blind3Required: boolean;
}

function assertRequiredFieldsLabeled(state: BlindState): void {
	for (const field of BLIND_FIELDS) {
		if (
			state[`blind${field}Required`] &&
			state[`blind${field}Label`] === null
		) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Blind ${field} needs a label to be required`,
			});
		}
	}
}

const STAKE_TABLES = [cashRuleStake, tournamentRuleLevelStake] as const;

function noStoredStakeValues(db: Db, groupId: string, field: BlindField) {
	return STAKE_TABLES.map((stake) =>
		notExists(
			db
				.select({ id: gameLineupGroup.id })
				.from(stake)
				.innerJoin(
					gameLineupGroup,
					and(
						eq(gameLineupGroup.id, stake.lineupGroupId),
						eq(gameLineupGroup.userId, stake.userId)
					)
				)
				.where(
					and(
						eq(gameLineupGroup.gameGroupId, groupId),
						eq(gameLineupGroup.userId, gameGroup.userId),
						isNotNull(stake[`blind${field}`])
					)
				)
		)
	);
}

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
	blind1Required: z.boolean().optional(),
	blind2Required: z.boolean().optional(),
	blind3Required: z.boolean().optional(),
});

export const gameGroupUpdateInputSchema = z.object({
	id: idSchema,
	label: labelSchema.optional(),
	blind1Label: blindLabelSchema,
	blind2Label: blindLabelSchema,
	blind3Label: blindLabelSchema,
	blind1Required: z.boolean().optional(),
	blind2Required: z.boolean().optional(),
	blind3Required: z.boolean().optional(),
});

export const gameGroupIdInputSchema = z.object({ id: idSchema });

export const gameGroupRouter = router({
	list: protectedProcedure
		.input(gameGroupListInputSchema)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			let rows = await ctx.db
				.select()
				.from(gameGroup)
				.where(eq(gameGroup.userId, userId));
			if (rows.length === 0) {
				await seedDefaultGameData(ctx.db, userId);
				rows = await ctx.db
					.select()
					.from(gameGroup)
					.where(eq(gameGroup.userId, userId));
			}
			return rows
				.filter((row) => input?.includeArchived || row.archivedAt === null)
				.sort(compareGroups);
		}),

	create: protectedProcedure
		.input(gameGroupCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			const blinds: BlindState = {
				blind1Label: input.blind1Label ?? null,
				blind1Required: input.blind1Required ?? false,
				blind2Label: input.blind2Label ?? null,
				blind2Required: input.blind2Required ?? false,
				blind3Label: input.blind3Label ?? null,
				blind3Required: input.blind3Required ?? false,
			};
			assertRequiredFieldsLabeled(blinds);
			await runLabelWrite(ctx.db, "game group", userId, input.label, () =>
				ctx.db.insert(gameGroup).values({
					id,
					userId,
					builtinKey: null,
					label: input.label,
					...blinds,
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

			const blinds: BlindState = {
				blind1Label:
					input.blind1Label === undefined
						? found.blind1Label
						: input.blind1Label,
				blind1Required: input.blind1Required ?? found.blind1Required,
				blind2Label:
					input.blind2Label === undefined
						? found.blind2Label
						: input.blind2Label,
				blind2Required: input.blind2Required ?? found.blind2Required,
				blind3Label:
					input.blind3Label === undefined
						? found.blind3Label
						: input.blind3Label,
				blind3Required: input.blind3Required ?? found.blind3Required,
			};
			assertRequiredFieldsLabeled(blinds);
			const clearedFields = BLIND_FIELDS.filter(
				(field) =>
					found[`blind${field}Label`] !== null &&
					blinds[`blind${field}Label`] === null
			);

			const updated = await runLabelWrite(
				ctx.db,
				"game group",
				userId,
				input.label,
				() =>
					ctx.db
						.update(gameGroup)
						.set({
							...(input.label === undefined ? {} : { label: input.label }),
							...blinds,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(gameGroup.id, input.id),
								eq(gameGroup.userId, userId),
								...clearedFields.flatMap((field) =>
									noStoredStakeValues(ctx.db, input.id, field)
								)
							)
						)
						.returning({ id: gameGroup.id })
			);
			if (updated.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"Saved stakes still have a value in a blind field whose label you are removing; clear those values first",
				});
			}
			return await selectGroup(ctx.db, userId, input.id);
		}),

	archive: protectedProcedure
		.input(gameGroupIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "gameGroup", input.id, userId);
			const now = new Date();
			const updated = await ctx.db
				.update(gameGroup)
				.set({ archivedAt: now, updatedAt: now })
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
										eq(gameVariant.userId, gameGroup.userId),
										isNull(gameVariant.archivedAt)
									)
								)
						)
					)
				)
				.returning({ id: gameGroup.id });
			if (updated.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message:
						"This game group still has active game variants; archive them first",
				});
			}
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
