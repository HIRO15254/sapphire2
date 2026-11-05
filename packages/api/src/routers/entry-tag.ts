import { entryTag } from "@sapphire2/db/schema/entry-tag";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, sql } from "drizzle-orm";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { isEntryTagNameConflictError } from "../lib/db-errors";

const nameSchema = z.string().trim().min(1).max(50);
export const entryTagCreateInputSchema = z.object({ name: nameSchema });
export const entryTagUpdateInputSchema = z.object({
	id: z.string(),
	name: nameSchema,
});
export const entryTagIdInputSchema = z.object({ id: z.string() });

const tagSelection = {
	id: entryTag.id,
	name: entryTag.name,
	position: entryTag.sortOrder,
	createdAt: entryTag.createdAt,
	updatedAt: entryTag.updatedAt,
};

function forbidden(): never {
	throw new TRPCError({
		code: "FORBIDDEN",
		message: "You do not own this tag",
	});
}

function handleConflict(error: unknown): never {
	if (isEntryTagNameConflictError(error)) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "A tag with this name already exists",
			cause: error,
		});
	}
	throw error;
}

export const entryTagRouter = router({
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db
			.select(tagSelection)
			.from(entryTag)
			.where(eq(entryTag.userId, ctx.session.user.id))
			.orderBy(asc(entryTag.sortOrder), asc(entryTag.id))
	),
	create: protectedProcedure
		.input(entryTagCreateInputSchema)
		.mutation(async ({ ctx, input }) => {
			const id = crypto.randomUUID();
			const userId = ctx.session.user.id;
			try {
				await ctx.db.run(sql`INSERT INTO entry_tag (id, user_id, name, sort_order, created_at, updated_at)
				SELECT ${id}, ${userId}, ${input.name}, COALESCE(MAX(sort_order), -1) + 1, unixepoch(), unixepoch()
				FROM entry_tag WHERE user_id = ${userId}`);
			} catch (error) {
				handleConflict(error);
			}
			const [created] = await ctx.db
				.select(tagSelection)
				.from(entryTag)
				.where(and(eq(entryTag.id, id), eq(entryTag.userId, userId)));
			if (!created) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
			}
			return created;
		}),
	update: protectedProcedure
		.input(entryTagUpdateInputSchema)
		.mutation(async ({ ctx, input }) => {
			try {
				const [updated] = await ctx.db
					.update(entryTag)
					.set({ name: input.name })
					.where(
						and(
							eq(entryTag.id, input.id),
							eq(entryTag.userId, ctx.session.user.id)
						)
					)
					.returning(tagSelection);
				if (!updated) {
					return forbidden();
				}
				return updated;
			} catch (error) {
				handleConflict(error);
			}
		}),
	delete: protectedProcedure
		.input(entryTagIdInputSchema)
		.mutation(async ({ ctx, input }) => {
			const [deleted] = await ctx.db
				.delete(entryTag)
				.where(
					and(
						eq(entryTag.id, input.id),
						eq(entryTag.userId, ctx.session.user.id)
					)
				)
				.returning({ id: entryTag.id });
			if (!deleted) {
				return forbidden();
			}
			return { success: true };
		}),
});
