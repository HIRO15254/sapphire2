import { sql } from "drizzle-orm";
import {
	type AnySQLiteColumn,
	foreignKey,
	index,
	integer,
	primaryKey,
	type SQLiteColumnBuilderBase,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

interface OwnedTarget {
	id: AnySQLiteColumn;
	userId: AnySQLiteColumn;
}

function targetIdColumn(name: string) {
	return text(name).notNull();
}

type TargetIdColumns<TKind extends string> = Record<
	`${TKind}Id`,
	ReturnType<typeof targetIdColumn>
>;

export interface TagTablesOptions<
	TTagColumns extends Record<string, SQLiteColumnBuilderBase>,
	TLinkColumns extends Record<string, SQLiteColumnBuilderBase>,
> {
	linkColumns?: TLinkColumns;
	tagColumns?: TTagColumns;
}

export function defineTagTables<
	TKind extends string,
	TTagColumns extends Record<string, SQLiteColumnBuilderBase> = Record<
		never,
		never
	>,
	TLinkColumns extends Record<string, SQLiteColumnBuilderBase> = Record<
		never,
		never
	>,
>(
	kind: TKind,
	target: () => OwnedTarget,
	options: TagTablesOptions<TTagColumns, TLinkColumns> = {}
) {
	const tagTableName = `${kind}_tag` as `${TKind}_tag`;
	const linkTableName = `${kind}_tag_link` as `${TKind}_tag_link`;
	const targetKey = `${kind}Id` as `${TKind}Id`;

	const tag = sqliteTable(
		tagTableName,
		{
			createdAt: integer("created_at", { mode: "timestamp" })
				.default(sql`(unixepoch())`)
				.notNull(),
			id: text("id").primaryKey(),
			name: text("name").notNull(),
			sortOrder: integer("sort_order").notNull().default(0),
			updatedAt: integer("updated_at", { mode: "timestamp" })
				.$onUpdate(() => /* @__PURE__ */ new Date())
				.notNull(),
			userId: text("user_id")
				.notNull()
				.references(() => user.id, { onDelete: "cascade" }),
			...(options.tagColumns as TTagColumns),
		},
		(t) => [
			uniqueIndex(`${kind}_tag_id_user_id_unique`).on(t.id, t.userId),
			uniqueIndex(`${kind}_tag_name_uq`).on(
				t.userId,
				sql`lower(trim(${t.name}))`
			),
		]
	);

	const targetColumns = {
		[targetKey]: targetIdColumn(`${kind}_id`),
	} as TargetIdColumns<TKind>;

	const link = sqliteTable(
		linkTableName,
		{
			userId: text("user_id")
				.notNull()
				.references(() => user.id, { onDelete: "cascade" }),
			...targetColumns,
			tagId: text("tag_id").notNull(),
			...(options.linkColumns as TLinkColumns),
		},
		(t) => {
			const targetId = (t as unknown as Record<string, AnySQLiteColumn>)[
				targetKey
			] as AnySQLiteColumn;
			const owner = target();
			return [
				primaryKey({ columns: [targetId, t.tagId] }),
				index(`${linkTableName}_tag_idx`).on(t.tagId),
				foreignKey({
					columns: [targetId, t.userId],
					foreignColumns: [owner.id, owner.userId],
					name: `${linkTableName}_${kind}_owner_fk`,
				}).onDelete("cascade"),
				foreignKey({
					columns: [t.tagId, t.userId],
					foreignColumns: [tag.id, tag.userId],
					name: `${linkTableName}_tag_owner_fk`,
				}).onDelete("cascade"),
			];
		}
	);

	return { link, tag };
}
