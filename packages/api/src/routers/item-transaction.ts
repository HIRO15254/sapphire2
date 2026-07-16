import { item, itemTransaction } from "@sapphire2/db/schema/item";
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

// Signed count: positive gains items, negative spends them. Zero is rejected
// to avoid storing no-op rows (deviation from the .min(0) default is the
// point of the field — the ledger is a signed delta, like
// currency_transaction.amount).
const signedCountSchema = z
	.number()
	.int()
	.refine((n) => n !== 0, { message: "count must be non-zero" });

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

/** Uniform FORBIDDEN whether the item is missing or foreign (SA2-183). */
async function validateItemOwnership(
	db: DbInstance,
	itemId: string,
	userId: string
): Promise<void> {
	const [found] = await db.select().from(item).where(eq(item.id, itemId));

	if (!found || found.userId !== userId) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this item",
		});
	}
}

export const itemTransactionRouter = router({
	listByItem: protectedProcedure
		.input(z.object({ itemId: z.string(), cursor: z.string().optional() }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateItemOwnership(ctx.db, input.itemId, userId);

			const conditions = [eq(itemTransaction.itemId, input.itemId)];
			if (input.cursor) {
				// The cursor lookup carries the same item scope as the outer query
				// so it cannot become an existence oracle for other users' rows
				// (SA2-182); a deleted cursor row simply restarts from the top
				// (SA2-150).
				const [cursor] = await ctx.db
					.select({
						id: itemTransaction.id,
						transactedAt: itemTransaction.transactedAt,
					})
					.from(itemTransaction)
					.where(
						and(
							eq(itemTransaction.id, input.cursor),
							eq(itemTransaction.itemId, input.itemId)
						)
					);

				if (cursor) {
					conditions.push(
						sql`(${itemTransaction.transactedAt}, ${itemTransaction.id}) < (${cursor.transactedAt}, ${cursor.id})`
					);
				}
			}

			const data = await ctx.db
				.select({
					id: itemTransaction.id,
					itemId: itemTransaction.itemId,
					sessionId: itemTransaction.sessionId,
					sessionName: sql<
						string | null
					>`CASE WHEN ${gameSession.kind} = 'cash_game' THEN ${sessionCashDetail.ruleName} WHEN ${gameSession.kind} = 'tournament' THEN ${sessionTournamentDetail.ruleName} ELSE NULL END`,
					count: itemTransaction.count,
					transactedAt: itemTransaction.transactedAt,
					memo: itemTransaction.memo,
					createdAt: itemTransaction.createdAt,
				})
				.from(itemTransaction)
				.leftJoin(
					gameSession,
					and(
						eq(gameSession.id, itemTransaction.sessionId),
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
				.orderBy(desc(itemTransaction.transactedAt), desc(itemTransaction.id))
				.limit(PAGE_SIZE + 1);

			return paginate(data, PAGE_SIZE);
		}),

	create: protectedProcedure
		.input(
			z.object({
				itemId: z.string(),
				count: signedCountSchema,
				transactedAt: dateOnlySchema,
				memo: z.string().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateItemOwnership(ctx.db, input.itemId, userId);

			const id = crypto.randomUUID();
			await ctx.db.insert(itemTransaction).values({
				id,
				itemId: input.itemId,
				count: input.count,
				transactedAt: new Date(input.transactedAt),
				memo: input.memo ?? null,
			});

			const [created] = await ctx.db
				.select()
				.from(itemTransaction)
				.where(eq(itemTransaction.id, id));
			return created;
		}),

	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				count: signedCountSchema.optional(),
				transactedAt: dateOnlySchema.optional(),
				memo: z.string().nullable().optional(),
			})
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select({ itemTransaction, item })
				.from(itemTransaction)
				.innerJoin(item, eq(item.id, itemTransaction.itemId))
				.where(eq(itemTransaction.id, input.id));

			if (!found || found.item.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction",
				});
			}

			if (found.itemTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be edited. Edit the session instead.",
				});
			}

			const updateData: Partial<typeof found.itemTransaction> = {};
			if (input.count !== undefined) {
				updateData.count = input.count;
			}
			if (input.transactedAt !== undefined) {
				updateData.transactedAt = new Date(input.transactedAt);
			}
			if (input.memo !== undefined) {
				updateData.memo = input.memo;
			}

			await ctx.db
				.update(itemTransaction)
				.set(updateData)
				.where(eq(itemTransaction.id, input.id));

			const [updated] = await ctx.db
				.select()
				.from(itemTransaction)
				.where(eq(itemTransaction.id, input.id));
			return updated;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const [found] = await ctx.db
				.select({ itemTransaction, item })
				.from(itemTransaction)
				.innerJoin(item, eq(item.id, itemTransaction.itemId))
				.where(eq(itemTransaction.id, input.id));

			if (!found || found.item.userId !== userId) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You do not own this transaction",
				});
			}

			if (found.itemTransaction.sessionId !== null) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message:
						"Session-generated transactions cannot be deleted. Delete the session instead.",
				});
			}

			await ctx.db
				.delete(itemTransaction)
				.where(eq(itemTransaction.id, input.id));
			return { success: true };
		}),
});
