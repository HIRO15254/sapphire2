import { pokerSession } from "@sapphire2/db/schema/session";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, lt } from "drizzle-orm";
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

export { validateSessionOwnership, computeCashGamePL, computeTournamentPL };

export const sessionRouter = router({
	create: protectedProcedure
		.input(
			z.object({
				type: z.literal("cash_game"),
				sessionDate: z.number(),
				buyIn: z.number().int().min(0),
				cashOut: z.number().int().min(0),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			const now = new Date();
			await ctx.db.insert(pokerSession).values({
				id,
				userId,
				type: input.type,
				sessionDate: new Date(input.sessionDate * 1000),
				buyIn: input.buyIn,
				cashOut: input.cashOut,
				updatedAt: now,
			});

			const [created] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, id));
			return created;
		}),

	list: protectedProcedure
		.input(z.object({ cursor: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const conditions = [eq(pokerSession.userId, userId)];
			if (input.cursor) {
				conditions.push(lt(pokerSession.id, input.cursor));
			}

			const data = await ctx.db
				.select({
					id: pokerSession.id,
					type: pokerSession.type,
					sessionDate: pokerSession.sessionDate,
					buyIn: pokerSession.buyIn,
					cashOut: pokerSession.cashOut,
					createdAt: pokerSession.createdAt,
				})
				.from(pokerSession)
				.where(and(...conditions))
				.orderBy(desc(pokerSession.sessionDate), desc(pokerSession.id))
				.limit(PAGE_SIZE + 1);

			const hasMore = data.length > PAGE_SIZE;
			const items = hasMore ? data.slice(0, PAGE_SIZE) : data;
			const nextCursor = hasMore ? items.at(-1)?.id : undefined;

			const itemsWithPL = items.map((item) => ({
				...item,
				profitLoss:
					item.type === "cash_game" &&
					item.buyIn !== null &&
					item.cashOut !== null
						? computeCashGamePL(item.buyIn, item.cashOut)
						: null,
			}));

			return { items: itemsWithPL, nextCursor };
		}),

	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const session = await validateSessionOwnership(ctx.db, input.id, userId);
			return session;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				sessionDate: z.number().optional(),
				buyIn: z.number().int().min(0).optional(),
				cashOut: z.number().int().min(0).optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateSessionOwnership(ctx.db, input.id, userId);

			const updateData: Partial<typeof pokerSession.$inferInsert> = {
				updatedAt: new Date(),
			};
			if (input.sessionDate !== undefined) {
				updateData.sessionDate = new Date(input.sessionDate * 1000);
			}
			if (input.buyIn !== undefined) {
				updateData.buyIn = input.buyIn;
			}
			if (input.cashOut !== undefined) {
				updateData.cashOut = input.cashOut;
			}

			await ctx.db
				.update(pokerSession)
				.set(updateData)
				.where(eq(pokerSession.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(pokerSession)
				.where(eq(pokerSession.id, input.id));
			return updated;
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
