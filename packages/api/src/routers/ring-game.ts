import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { mixGamesSchema } from "@sapphire2/db/schemas/game";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import {
	cashMixFlatFieldClearPatch,
	reconcileCashRuleSelection,
	validateEntityOwnership,
} from "./session";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

type BatchStatement = Parameters<DbInstance["batch"]>[0][number];

function validateRoomOwnership(db: DbInstance, roomId: string, userId: string) {
	return validateEntityOwnership(db, "room", roomId, userId);
}

function validateRingGameOwnership(
	db: DbInstance,
	ringGameId: string,
	userId: string
) {
	return validateEntityOwnership(db, "ringGame", ringGameId, userId);
}

const nonNegativeIntegerSchema = z.number().int().min(0);
const tableSizeSchema = z.number().int().min(2).max(10);

export const ringGameCreateInputSchema = z.object({
	roomId: z.string(),
	name: z.string().min(1),
	variant: z.string().default(DEFAULT_VARIANT_LABEL),
	mixGames: mixGamesSchema.nullish(),
	blind1: nonNegativeIntegerSchema.optional(),
	blind2: nonNegativeIntegerSchema.optional(),
	blind3: nonNegativeIntegerSchema.optional(),
	ante: nonNegativeIntegerSchema.optional(),
	anteType: z.enum(["none", "all", "bb"]).optional(),
	minBuyIn: nonNegativeIntegerSchema.optional(),
	maxBuyIn: nonNegativeIntegerSchema.optional(),
	tableSize: tableSizeSchema.optional(),
	currencyId: z.string().min(1).optional(),
	memo: z.string().optional(),
});

type RingGameCreateInput = z.infer<typeof ringGameCreateInputSchema>;

export function buildRingGameCreateStatement(
	db: DbInstance,
	params: {
		id: string;
		input: RingGameCreateInput;
		mixGames: NonNullable<RingGameCreateInput["mixGames"]> | null;
		now: Date;
		userId: string;
		variant: string;
	}
): BatchStatement {
	const frozenFlatFields = cashMixFlatFieldClearPatch(params.mixGames);
	return db.insert(ringGame).values({
		id: params.id,
		roomId: params.input.roomId,
		userId: params.userId,
		name: params.input.name,
		variant: params.variant,
		mixGames: params.mixGames,
		blind1: params.input.blind1 ?? null,
		blind2: params.input.blind2 ?? null,
		blind3: params.input.blind3 ?? null,
		ante: params.input.ante ?? null,
		anteType: params.input.anteType ?? null,
		...frozenFlatFields,
		minBuyIn: params.input.minBuyIn ?? null,
		maxBuyIn: params.input.maxBuyIn ?? null,
		tableSize: params.input.tableSize ?? null,
		currencyId: params.input.currencyId ?? null,
		memo: params.input.memo ?? null,
		updatedAt: params.now,
	});
}

export const ringGameRouter = router({
	listByRoom: protectedProcedure
		.input(
			z.object({
				roomId: z.string(),
				includeArchived: z.boolean().optional(),
			})
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRoomOwnership(ctx.db, input.roomId, userId);

			const condition = input.includeArchived
				? isNotNull(ringGame.archivedAt)
				: isNull(ringGame.archivedAt);

			return ctx.db
				.select()
				.from(ringGame)
				.where(and(eq(ringGame.roomId, input.roomId), condition));
		}),

	create: protectedProcedure
		.input(ringGameCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRoomOwnership(ctx.db, input.roomId, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}
			const selection = await reconcileCashRuleSelection(
				ctx.db,
				userId,
				undefined,
				input
			);

			const id = crypto.randomUUID();
			await buildRingGameCreateStatement(ctx.db, {
				id,
				input,
				userId,
				mixGames: selection.mixGames,
				variant: selection.variant,
				now: new Date(),
			});

			const [created] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				name: z.string().min(1).optional(),
				variant: z.string().optional(),
				mixGames: mixGamesSchema.nullish(),
				blind1: nonNegativeIntegerSchema.nullable().optional(),
				blind2: nonNegativeIntegerSchema.nullable().optional(),
				blind3: nonNegativeIntegerSchema.nullable().optional(),
				ante: nonNegativeIntegerSchema.nullable().optional(),
				anteType: z.enum(["none", "all", "bb"]).nullable().optional(),
				minBuyIn: nonNegativeIntegerSchema.nullable().optional(),
				maxBuyIn: nonNegativeIntegerSchema.nullable().optional(),
				tableSize: tableSizeSchema.nullable().optional(),
				currencyId: z.string().min(1).nullable().optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateRingGameOwnership(ctx.db, input.id, userId);
			if (input.currencyId) {
				await validateEntityOwnership(
					ctx.db,
					"currency",
					input.currencyId,
					userId
				);
			}
			const selection = await reconcileCashRuleSelection(
				ctx.db,
				userId,
				{
					variant: found.variant,
					mixGames: found.mixGames ?? null,
				},
				input
			);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };
			if (input.name !== undefined) {
				updateData.name = input.name;
			}
			if (input.variant !== undefined) {
				updateData.variant = input.variant;
			}
			if (selection.shouldWriteMixGames) {
				updateData.mixGames = selection.mixGames;
			}
			if (input.blind1 !== undefined) {
				updateData.blind1 = input.blind1;
			}
			if (input.blind2 !== undefined) {
				updateData.blind2 = input.blind2;
			}
			if (input.blind3 !== undefined) {
				updateData.blind3 = input.blind3;
			}
			if (input.ante !== undefined) {
				updateData.ante = input.ante;
			}
			if (input.anteType !== undefined) {
				updateData.anteType = input.anteType;
			}
			if (input.minBuyIn !== undefined) {
				updateData.minBuyIn = input.minBuyIn;
			}
			if (input.maxBuyIn !== undefined) {
				updateData.maxBuyIn = input.maxBuyIn;
			}
			if (input.tableSize !== undefined) {
				updateData.tableSize = input.tableSize;
			}
			if (input.currencyId !== undefined) {
				updateData.currencyId = input.currencyId;
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}
			Object.assign(updateData, cashMixFlatFieldClearPatch(selection.mixGames));

			await ctx.db
				.update(ringGame)
				.set(updateData)
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	archive: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(ringGame)
				.set({ archivedAt: new Date(), updatedAt: new Date() })
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	restore: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db
				.update(ringGame)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(eq(ringGame.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(ringGame).where(eq(ringGame.id, input.id));
			return { success: true };
		}),
});
