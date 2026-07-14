import {
	currency,
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { paginate } from "./_pagination";

const PAGE_SIZE = 10;
const dateOnlySchema = z.iso.date();

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

/**
 * Verifies the referenced transaction type belongs to the caller before it is
 * linked to a transaction. Without this a caller could attach another user's
 * transaction type id to their own transaction (read-IDOR, SA2-179). Mirrors
 * the currency-ownership check already used in create / update below.
 */
async function validateTransactionTypeOwnership(
	db: DbInstance,
	transactionTypeId: string,
	userId: string
) {
	const [found] = await db
		.select()
		.from(transactionType)
		.where(eq(transactionType.id, transactionTypeId));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this transaction type",
		});
	}
}

export const currencyTransactionRouter = router({
	listByCurrency: protectedProcedure
		.input(z.object({ currencyId: z.string(), cursor: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.currencyId));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			const conditions = [eq(currencyTransaction.currencyId, input.currencyId)];
			if (input.cursor) {
				const [cursor] = await ctx.db
					.select({
						id: currencyTransaction.id,
						transactedAt: currencyTransaction.transactedAt,
					})
					.from(currencyTransaction)
					.where(
						and(
							eq(currencyTransaction.id, input.cursor),
							eq(currencyTransaction.currencyId, input.currencyId)
						)
					);

				if (cursor) {
					conditions.push(
						sql`(${currencyTransaction.transactedAt}, ${currencyTransaction.id}) < (${cursor.transactedAt}, ${cursor.id})`
					);
				}
			}

			const data = await ctx.db
				.select({
					id: currencyTransaction.id,
					currencyId: currencyTransaction.currencyId,
					transactionTypeId: currencyTransaction.transactionTypeId,
					transactionTypeName: transactionType.name,
					sessionId: currencyTransaction.sessionId,
					sessionName: sql<
						string | null
					>`CASE WHEN ${gameSession.kind} = 'cash_game' THEN ${sessionCashDetail.ruleName} WHEN ${gameSession.kind} = 'tournament' THEN ${sessionTournamentDetail.ruleName} ELSE NULL END`,
					amount: currencyTransaction.amount,
					transactedAt: currencyTransaction.transactedAt,
					memo: currencyTransaction.memo,
					createdAt: currencyTransaction.createdAt,
				})
				.from(currencyTransaction)
				.innerJoin(
					transactionType,
					and(
						eq(transactionType.id, currencyTransaction.transactionTypeId),
						eq(transactionType.userId, userId)
					)
				)
				.leftJoin(
					gameSession,
					and(
						eq(gameSession.id, currencyTransaction.sessionId),
						eq(gameSession.userId, userId)
					)
				)
				.leftJoin(
					sessionCashDetail,
					eq(sessionCashDetail.sessionId, gameSession.id)
				)
				.leftJoin(
					sessionTournamentDetail,
					eq(sessionTournamentDetail.sessionId, gameSession.id)
				)
				.where(and(...conditions))
				.orderBy(
					desc(currencyTransaction.transactedAt),
					desc(currencyTransaction.id)
				)
				.limit(PAGE_SIZE + 1);

			return paginate(data, PAGE_SIZE);
		}),

	create: protectedProcedure
		.input(
			z.object({
				currencyId: z.string(),
				transactionTypeId: z.string(),
				amount: z.number().int(),
				transactedAt: dateOnlySchema,
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select()
				.from(currency)
				.where(eq(currency.id, input.currencyId));

			if (!found || found.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this currency",
				});
			}

			await validateTransactionTypeOwnership(
				ctx.db,
				input.transactionTypeId,
				userId
			);

			const id = crypto.randomUUID();
			await ctx.db.insert(currencyTransaction).values({
				id,
				currencyId: input.currencyId,
				transactionTypeId: input.transactionTypeId,
				amount: input.amount,
				transactedAt: new Date(input.transactedAt),
				memo: input.memo ?? null,
			});

			const [created] = await ctx.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				transactionTypeId: z.string().optional(),
				amount: z.number().int().optional(),
				transactedAt: dateOnlySchema.optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select({ currencyTransaction, currency })
				.from(currencyTransaction)
				.innerJoin(currency, eq(currency.id, currencyTransaction.currencyId))
				.where(eq(currencyTransaction.id, input.id));

			if (!found || found.currency.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction",
				});
			}

			if (found.currencyTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be edited. Edit the session instead.",
				});
			}

			const updateData: Partial<typeof found.currencyTransaction> = {};
			if (input.transactionTypeId !== undefined) {
				await validateTransactionTypeOwnership(
					ctx.db,
					input.transactionTypeId,
					userId
				);
				updateData.transactionTypeId = input.transactionTypeId;
			}
			if (input.amount !== undefined) {
				updateData.amount = input.amount;
			}
			if (input.transactedAt !== undefined) {
				updateData.transactedAt = new Date(input.transactedAt);
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(currencyTransaction)
				.set(updateData)
				.where(eq(currencyTransaction.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(currencyTransaction)
				.where(eq(currencyTransaction.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select({ currencyTransaction, currency })
				.from(currencyTransaction)
				.innerJoin(currency, eq(currency.id, currencyTransaction.currencyId))
				.where(eq(currencyTransaction.id, input.id));

			if (!found || found.currency.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction",
				});
			}

			if (found.currencyTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be deleted. Delete the session instead.",
				});
			}

			await ctx.db
				.delete(currencyTransaction)
				.where(eq(currencyTransaction.id, input.id));
			return { success: true };
		}),
});
