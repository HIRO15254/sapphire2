import { pokerSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";

const PAGE_SIZE = 20;

async function validateSessionOwnership(
	db: Parameters<
		Parameters<typeof protectedProcedure.query>[0]
	>[0]["ctx"]["db"],
	sessionId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.id, sessionId));

	if (!found) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Session not found",
		});
	}

	if (found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this session",
		});
	}

	return found;
}

function computeCashGamePL(buyIn: number, cashOut: number): number {
	return cashOut - buyIn;
}

function computeTournamentPL(
	tournamentBuyIn: number | null,
	entryFee: number | null,
	rebuyCount: number | null,
	rebuyCost: number | null,
	addonCost: number | null,
	prizeMoney: number | null,
	bountyPrizes: number | null
): number {
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) +
		(entryFee ?? 0) +
		(rebuyCount ?? 0) * (rebuyCost ?? 0) +
		(addonCost ?? 0);
	return income - cost;
}

function computeProfitLoss(session: typeof pokerSession.$inferSelect): number {
	if (session.type === "cash_game") {
		return computeCashGamePL(session.buyIn ?? 0, session.cashOut ?? 0);
	}
	return computeTournamentPL(
		session.tournamentBuyIn,
		session.entryFee,
		session.rebuyCount,
		session.rebuyCost,
		session.addonCost,
		session.prizeMoney,
		session.bountyPrizes
	);
}

export { validateSessionOwnership, computeCashGamePL, computeTournamentPL };

const cashGameCreateSchema = z.object({
	type: z.literal("cash_game"),
	sessionDate: z.number(),
	buyIn: z.number().int().min(0),
	cashOut: z.number().int().min(0),
});

const tournamentCreateSchema = z.object({
	type: z.literal("tournament"),
	sessionDate: z.number(),
	tournamentBuyIn: z.number().int().min(0),
	entryFee: z.number().int().min(0),
	placement: z.number().int().min(1).optional(),
	totalEntries: z.number().int().min(1).optional(),
	prizeMoney: z.number().int().min(0).optional(),
	rebuyCount: z.number().int().min(0).optional(),
	rebuyCost: z.number().int().min(0).optional(),
	addonCost: z.number().int().min(0).optional(),
	bountyPrizes: z.number().int().min(0).optional(),
});

const createInputSchema = z
	.discriminatedUnion("type", [cashGameCreateSchema, tournamentCreateSchema])
	.refine(
		(data) => {
			if (
				data.type === "tournament" &&
				data.placement !== undefined &&
				data.totalEntries !== undefined
			) {
				return data.placement <= data.totalEntries;
			}
			return true;
		},
		{ message: "Placement must not exceed total entries" }
	);

export const sessionRouter = router({
	create: protectedProcedure
		.input(createInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();

			const baseValues = {
				id,
				userId,
				type: input.type,
				sessionDate: new Date(input.sessionDate),
				updatedAt: new Date(),
			};

			if (input.type === "cash_game") {
				await ctx.db.insert(pokerSession).values({
					...baseValues,
					buyIn: input.buyIn,
					cashOut: input.cashOut,
				});
			} else {
				await ctx.db.insert(pokerSession).values({
					...baseValues,
					tournamentBuyIn: input.tournamentBuyIn,
					entryFee: input.entryFee,
					placement: input.placement ?? null,
					totalEntries: input.totalEntries ?? null,
					prizeMoney: input.prizeMoney ?? null,
					rebuyCount: input.rebuyCount ?? null,
					rebuyCost: input.rebuyCost ?? null,
					addonCost: input.addonCost ?? null,
					bountyPrizes: input.bountyPrizes ?? null,
				});
			}

			const [created] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, id));
			return { ...created, profitLoss: computeProfitLoss(created) };
		}),

	list: protectedProcedure
		.input(
			z
				.object({
					cursor: z.string().optional(),
				})
				.optional()
		)
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const cursor = input?.cursor;

			const conditions = [eq(pokerSession.userId, userId)];

			if (cursor) {
				const [cursorSession] = await ctx.db
					.select()
					.from(pokerSession)
					.where(eq(pokerSession.id, cursor));

				if (cursorSession) {
					const cursorCondition = or(
						lt(pokerSession.sessionDate, cursorSession.sessionDate),
						and(
							eq(pokerSession.sessionDate, cursorSession.sessionDate),
							lt(pokerSession.id, cursorSession.id)
						)
					);
					if (cursorCondition) {
						conditions.push(cursorCondition);
					}
				}
			}

			const rows = await ctx.db
				.select()
				.from(pokerSession)
				.where(and(...conditions))
				.orderBy(desc(pokerSession.sessionDate), desc(pokerSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = rows.length > PAGE_SIZE;
			const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

			const itemsWithPL = items.map((session) => ({
				...session,
				profitLoss: computeProfitLoss(session),
			}));

			return {
				items: itemsWithPL,
				nextCursor: hasMore ? items.at(-1)?.id : undefined,
			};
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateSessionOwnership(ctx.db, input.id, userId);
			return { ...found, profitLoss: computeProfitLoss(found) };
		}),

	update: protectedProcedure
		.input(
			z
				.object({
					id: z.string(),
					sessionDate: z.number().optional(),
					buyIn: z.number().int().min(0).optional(),
					cashOut: z.number().int().min(0).optional(),
					tournamentBuyIn: z.number().int().min(0).optional(),
					entryFee: z.number().int().min(0).optional(),
					placement: z.number().int().min(1).nullable().optional(),
					totalEntries: z.number().int().min(1).nullable().optional(),
					prizeMoney: z.number().int().min(0).nullable().optional(),
					rebuyCount: z.number().int().min(0).nullable().optional(),
					rebuyCost: z.number().int().min(0).nullable().optional(),
					addonCost: z.number().int().min(0).nullable().optional(),
					bountyPrizes: z.number().int().min(0).nullable().optional(),
					memo: z.string().nullable().optional(),
				})
				.refine(
					(data) => {
						if (
							data.placement !== undefined &&
							data.placement !== null &&
							data.totalEntries !== undefined &&
							data.totalEntries !== null
						) {
							return data.placement <= data.totalEntries;
						}
						return true;
					},
					{ message: "Placement must not exceed total entries" }
				)
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const found = await validateSessionOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof found> = { updatedAt: new Date() };

			if (input.sessionDate !== undefined) {
				updateData.sessionDate = new Date(input.sessionDate);
			}
			if (input.buyIn !== undefined) {
				updateData.buyIn = input.buyIn;
			}
			if (input.cashOut !== undefined) {
				updateData.cashOut = input.cashOut;
			}
			if (input.tournamentBuyIn !== undefined) {
				updateData.tournamentBuyIn = input.tournamentBuyIn;
			}
			if (input.entryFee !== undefined) {
				updateData.entryFee = input.entryFee;
			}
			if (input.placement !== undefined) {
				updateData.placement = input.placement;
			}
			if (input.totalEntries !== undefined) {
				updateData.totalEntries = input.totalEntries;
			}
			if (input.prizeMoney !== undefined) {
				updateData.prizeMoney = input.prizeMoney;
			}
			if (input.rebuyCount !== undefined) {
				updateData.rebuyCount = input.rebuyCount;
			}
			if (input.rebuyCost !== undefined) {
				updateData.rebuyCost = input.rebuyCost;
			}
			if (input.addonCost !== undefined) {
				updateData.addonCost = input.addonCost;
			}
			if (input.bountyPrizes !== undefined) {
				updateData.bountyPrizes = input.bountyPrizes;
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(pokerSession)
				.set(updateData)
				.where(eq(pokerSession.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, input.id));
			return { ...updated, profitLoss: computeProfitLoss(updated) };
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionOwnership(ctx.db, input.id, userId);

			await ctx.db.delete(pokerSession).where(eq(pokerSession.id, input.id));
			return { success: true };
		}),
});
