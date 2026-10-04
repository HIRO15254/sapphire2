import { DEFAULT_VARIANT_LABEL } from "@sapphire2/db/constants/game-variants";
import { ringGame } from "@sapphire2/db/schema/ring-game";
import { mixGamesSchema } from "@sapphire2/db/schemas/game";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
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

function buyInRangeOrdered(value: {
	minBuyIn?: number | null;
	maxBuyIn?: number | null;
}): boolean {
	return (
		value.minBuyIn == null ||
		value.maxBuyIn == null ||
		value.minBuyIn <= value.maxBuyIn
	);
}

const BUY_IN_RANGE_ISSUE = {
	message: "Minimum buy-in must not exceed maximum buy-in",
	path: ["maxBuyIn"],
};

export const ringGameCreateInputSchema = z
	.object({
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
		houseRules: z.string().optional(),
	})
	.refine(buyInRangeOrdered, BUY_IN_RANGE_ISSUE);

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
		houseRules: params.input.houseRules ?? null,
		updatedAt: params.now,
	});
}

export const ringGameListByRoomInputSchema = z.object({
	roomId: z.string(),
	includeArchived: z.boolean().optional(),
});

export const ringGameIdInputSchema = z.object({ id: z.string() });

export const ringGameUpdateInputSchema = z
	.object({
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
		houseRules: z.string().nullable().optional(),
	})
	.refine(buyInRangeOrdered, BUY_IN_RANGE_ISSUE);

async function writeRingGameUpdate(
	db: DbInstance,
	{
		input,
		existing,
		userId,
		updateData,
	}: {
		input: z.infer<typeof ringGameUpdateInputSchema>;
		existing: typeof ringGame.$inferSelect;
		userId: string;
		updateData: Partial<typeof ringGame.$inferSelect>;
	}
) {
	if (
		!buyInRangeOrdered({
			minBuyIn:
				input.minBuyIn === undefined ? existing.minBuyIn : input.minBuyIn,
			maxBuyIn:
				input.maxBuyIn === undefined ? existing.maxBuyIn : input.maxBuyIn,
		})
	) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: BUY_IN_RANGE_ISSUE.message,
		});
	}
	const updateStatement = db.update(ringGame).set(updateData);
	const condition = and(eq(ringGame.id, input.id), eq(ringGame.userId, userId));
	if (input.minBuyIn !== undefined || input.maxBuyIn !== undefined) {
		const minBuyIn =
			input.minBuyIn === undefined ? ringGame.minBuyIn : input.minBuyIn;
		const maxBuyIn =
			input.maxBuyIn === undefined ? ringGame.maxBuyIn : input.maxBuyIn;
		const result = await updateStatement.where(
			and(
				condition,
				sql`(${minBuyIn} IS NULL OR ${maxBuyIn} IS NULL OR ${minBuyIn} <= ${maxBuyIn})`
			)
		);
		if (result.meta.changes === 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: BUY_IN_RANGE_ISSUE.message,
			});
		}
	} else {
		await updateStatement.where(condition);
	}
}

export const ringGameRouter = router({
	listByRoom: protectedProcedure
		.input(ringGameListByRoomInputSchema)
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
		.input(ringGameUpdateInputSchema)
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
			if (input.houseRules !== undefined) {
				updateData.houseRules = input.houseRules;
			}
			Object.assign(updateData, cashMixFlatFieldClearPatch(selection.mixGames));

			await writeRingGameUpdate(ctx.db, {
				input,
				existing: found,
				userId,
				updateData,
			});

			const [updated] = await ctx.db
				.select()
				.from(ringGame)
				.where(eq(ringGame.id, input.id));
			return updated;
		}),

	archive: protectedProcedure
		.input(ringGameIdInputSchema)
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
		.input(ringGameIdInputSchema)
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
		.input(ringGameIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateRingGameOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(ringGame).where(eq(ringGame.id, input.id));
			return { success: true };
		}),
});
