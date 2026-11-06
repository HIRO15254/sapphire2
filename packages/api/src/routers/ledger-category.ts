import { ledgerCategory, ledgerLine } from "@sapphire2/db/schema/ledger";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull, notExists, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isLedgerCategoryNameConflictError } from "../lib/db-errors";
import { validateEntityOwnership } from "../lib/ownership";

type Db = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

const categoryColumns = {
	archivedAt: ledgerCategory.archivedAt,
	createdAt: ledgerCategory.createdAt,
	id: ledgerCategory.id,
	name: ledgerCategory.name,
	updatedAt: ledgerCategory.updatedAt,
};

async function selectCategory(db: Db, userId: string, id: string) {
	const [found] = await db
		.select(categoryColumns)
		.from(ledgerCategory)
		.where(and(eq(ledgerCategory.id, id), eq(ledgerCategory.userId, userId)));
	if (!found) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You do not own this category",
		});
	}
	return found;
}

async function runCategoryNameWrite<T>(write: () => Promise<T>): Promise<T> {
	try {
		return await write();
	} catch (error) {
		if (isLedgerCategoryNameConflictError(error)) {
			// biome-ignore lint/style/useErrorCause: TRPCError receives the original error in its cause option.
			throw new TRPCError({
				cause: error,
				code: "CONFLICT",
				message: "You already have a category with this name",
			});
		}
		throw error;
	}
}

const categoryName = z.string().trim().min(1).max(100);

export const ledgerCategoryIdInputSchema = z.object({ id: z.string().min(1) });

export const ledgerCategoryListInputSchema = z
	.object({ includeArchived: z.boolean().optional() })
	.optional();

export const ledgerCategoryCreateInputSchema = z.object({ name: categoryName });

export const ledgerCategoryUpdateInputSchema = z.object({
	id: z.string().min(1),
	name: categoryName,
});

export const ledgerCategoryRouter = router({
	archive: protectedProcedure
		.input(ledgerCategoryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ledgerCategory", input.id, userId);
			const now = new Date();
			await ctx.db
				.update(ledgerCategory)
				.set({ archivedAt: now, updatedAt: now })
				.where(
					and(
						eq(ledgerCategory.id, input.id),
						eq(ledgerCategory.userId, userId)
					)
				);
			return await selectCategory(ctx.db, userId, input.id);
		}),

	create: protectedProcedure
		.input(ledgerCategoryCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const id = crypto.randomUUID();
			await runCategoryNameWrite(() =>
				ctx.db.insert(ledgerCategory).values({
					id,
					name: input.name,
					updatedAt: new Date(),
					userId,
				})
			);
			return await selectCategory(ctx.db, userId, id);
		}),

	delete: protectedProcedure
		.input(ledgerCategoryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ledgerCategory", input.id, userId);
			const deleted = await ctx.db
				.delete(ledgerCategory)
				.where(
					and(
						eq(ledgerCategory.id, input.id),
						eq(ledgerCategory.userId, userId),
						notExists(
							ctx.db
								.select({ id: ledgerLine.id })
								.from(ledgerLine)
								.where(
									and(
										eq(ledgerLine.categoryId, ledgerCategory.id),
										eq(ledgerLine.userId, ledgerCategory.userId)
									)
								)
						)
					)
				)
				.returning({ id: ledgerCategory.id });
			if (deleted.length === 0) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "Category is in use; archive it instead",
				});
			}
			return { success: true as const };
		}),
	list: protectedProcedure
		.input(ledgerCategoryListInputSchema)
		.query(({ ctx, input }) =>
			ctx.db
				.select(categoryColumns)
				.from(ledgerCategory)
				.where(
					and(
						eq(ledgerCategory.userId, ctx.session.user.id),
						input?.includeArchived
							? undefined
							: isNull(ledgerCategory.archivedAt)
					)
				)
				.orderBy(
					asc(sql`lower(${ledgerCategory.name})`),
					asc(ledgerCategory.id)
				)
		),

	restore: protectedProcedure
		.input(ledgerCategoryIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ledgerCategory", input.id, userId);
			await ctx.db
				.update(ledgerCategory)
				.set({ archivedAt: null, updatedAt: new Date() })
				.where(
					and(
						eq(ledgerCategory.id, input.id),
						eq(ledgerCategory.userId, userId)
					)
				);
			return await selectCategory(ctx.db, userId, input.id);
		}),

	update: protectedProcedure
		.input(ledgerCategoryUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			await validateEntityOwnership(ctx.db, "ledgerCategory", input.id, userId);
			await runCategoryNameWrite(() =>
				ctx.db
					.update(ledgerCategory)
					.set({ name: input.name, updatedAt: new Date() })
					.where(
						and(
							eq(ledgerCategory.id, input.id),
							eq(ledgerCategory.userId, userId)
						)
					)
			);
			return await selectCategory(ctx.db, userId, input.id);
		}),
});
