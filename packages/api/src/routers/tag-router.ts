import type { TagColor } from "@sapphire2/db/constants/player-tag-colors";
import { idSchema } from "@sapphire2/db/schemas/id";
import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, getTableColumns, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import z from "zod";
import { protectedProcedure, router } from "../index";
import { runBatch } from "../lib/batch";
import { isUniqueIndexConflictError } from "../lib/db-errors";
import { validateTagsOwnership } from "../lib/ownership";

export const MAX_TAGS_PER_KIND = 500;

type TagTable = SQLiteTable & {
	createdAt: SQLiteColumn;
	id: SQLiteColumn;
	name: SQLiteColumn;
	sortOrder: SQLiteColumn;
	updatedAt: SQLiteColumn;
	userId: SQLiteColumn;
};

type Database = Parameters<typeof runBatch>[0];

export interface Tag {
	createdAt: Date;
	id: string;
	name: string;
	position: number;
	updatedAt: Date;
}

interface TagWriteInput {
	color?: TagColor;
	name?: string;
}

export const tagNameSchema = z.string().trim().min(1).max(50);

export const tagCreateInputSchema = z.object({ name: tagNameSchema });

export const tagUpdateInputSchema = z.object({
	id: idSchema,
	name: tagNameSchema,
});

export const tagIdInputSchema = z.object({ id: idSchema });

export const tagReorderInputSchema = z.object({
	ids: z
		.array(z.string().min(1))
		.max(MAX_TAGS_PER_KIND)
		.refine((ids) => new Set(ids).size === ids.length, {
			message: "ids must not repeat a tag",
		}),
});

export function tagSelection(table: TagTable) {
	return {
		id: table.id,
		name: table.name,
		position: table.sortOrder,
		createdAt: table.createdAt,
		updatedAt: table.updatedAt,
	};
}

function forbidden(): never {
	throw new TRPCError({
		code: "FORBIDDEN",
		message: "You do not own this tag",
	});
}

export function createTagRouter<
	TTag extends Tag,
	TCreate extends z.ZodType<{ name: string } & TagWriteInput>,
	TUpdate extends z.ZodType<{ id: string } & TagWriteInput>,
>(config: {
	createInputSchema: TCreate;
	extraColumns?: (keyof TagWriteInput)[];
	nameIndex: string;
	selection: Record<keyof TTag, SQLiteColumn>;
	table: TagTable;
	updateInputSchema: TUpdate;
}) {
	const { selection, table } = config;
	const columns = getTableColumns(table);
	const extraValues = (input: TagWriteInput) =>
		(config.extraColumns ?? []).flatMap((key) => {
			const value = input[key];
			return value === undefined ? [] : [[key, value] as const];
		});
	const handleConflict = (error: unknown): never => {
		if (isUniqueIndexConflictError(error, config.nameIndex)) {
			throw new TRPCError({
				code: "CONFLICT",
				message: "A tag with this name already exists",
				cause: error,
			});
		}
		throw error;
	};
	const listTags = async (db: Database, userId: string) =>
		(await db
			.select(selection)
			.from(table)
			.where(eq(table.userId, userId))
			.orderBy(asc(table.sortOrder), asc(table.id))) as TTag[];

	return router({
		list: protectedProcedure.query(({ ctx }) =>
			listTags(ctx.db, ctx.session.user.id)
		),
		create: protectedProcedure
			.input(config.createInputSchema)
			.mutation(async ({ ctx, input }) => {
				const id = crypto.randomUUID();
				const userId = ctx.session.user.id;
				const extras = extraValues(input);
				const insertColumns = [
					"id",
					"user_id",
					"name",
					"sort_order",
					"created_at",
					"updated_at",
					...extras.map(([key]) => columns[key]?.name ?? key),
				].map((name) => sql.identifier(name));
				const insertValues = [
					sql`${id}`,
					sql`${userId}`,
					sql`${input.name}`,
					sql`next_order`,
					sql`unixepoch()`,
					sql`unixepoch()`,
					...extras.map(([, value]) => sql`${value}`),
				];
				let inserted = 0;
				try {
					const result = await ctx.db.run(
						sql`INSERT INTO ${table} (${sql.join(insertColumns, sql`, `)})
						SELECT ${sql.join(insertValues, sql`, `)}
						FROM (SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order, count(*) AS total FROM ${table} WHERE user_id = ${userId})
						WHERE total < ${MAX_TAGS_PER_KIND}`
					);
					inserted = result.meta.changes;
				} catch (error) {
					handleConflict(error);
				}
				if (inserted === 0) {
					throw new TRPCError({
						code: "PRECONDITION_FAILED",
						message: `At most ${MAX_TAGS_PER_KIND} tags of one kind are allowed`,
					});
				}
				const [created] = await ctx.db
					.select(selection)
					.from(table)
					.where(and(eq(table.id, id), eq(table.userId, userId)));
				if (!created) {
					throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
				}
				return created as TTag;
			}),
		update: protectedProcedure
			.input(config.updateInputSchema)
			.mutation(async ({ ctx, input }) => {
				const values: Record<string, unknown> = Object.fromEntries(
					extraValues(input)
				);
				if (input.name !== undefined) {
					values.name = input.name;
				}
				try {
					const [updated] = (await ctx.db
						.update(table)
						.set(values)
						.where(
							and(eq(table.id, input.id), eq(table.userId, ctx.session.user.id))
						)
						.returning(selection)) as TTag[];
					if (!updated) {
						return forbidden();
					}
					return updated;
				} catch (error) {
					return handleConflict(error);
				}
			}),
		delete: protectedProcedure
			.input(tagIdInputSchema)
			.mutation(async ({ ctx, input }) => {
				const [deleted] = await ctx.db
					.delete(table)
					.where(
						and(eq(table.id, input.id), eq(table.userId, ctx.session.user.id))
					)
					.returning({ id: table.id });
				if (!deleted) {
					return forbidden();
				}
				return { success: true as const };
			}),
		reorder: protectedProcedure
			.input(tagReorderInputSchema)
			.mutation(async ({ ctx, input }) => {
				const userId = ctx.session.user.id;
				await validateTagsOwnership(ctx.db, table, input.ids, userId);
				const [owned] = await ctx.db
					.select({ total: count() })
					.from(table)
					.where(eq(table.userId, userId));
				if (owned?.total !== input.ids.length) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "ids must list every tag of this kind exactly once",
					});
				}
				await runBatch(
					ctx.db,
					input.ids.map((id, position) =>
						ctx.db
							.update(table)
							.set({ sortOrder: position })
							.where(and(eq(table.id, id), eq(table.userId, userId)))
					)
				);
				return listTags(ctx.db, userId);
			}),
	});
}
