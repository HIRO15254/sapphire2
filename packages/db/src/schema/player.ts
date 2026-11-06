import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { defineTagTables } from "./tag-tables";

export const player = sqliteTable(
	"player",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		memo: text("memo"),
		isTemporary: integer("is_temporary", { mode: "boolean" })
			.notNull()
			.default(false),
		isSelf: integer("is_self", { mode: "boolean" }).notNull().default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("player_id_user_id_unique").on(table.id, table.userId),
		index("player_userId_idx").on(table.userId),
		uniqueIndex("player_self_uq")
			.on(table.userId)
			.where(sql`${table.isSelf} = 1`),
		check("player_is_self_check", sql`${table.isSelf} IN (0, 1)`),
	]
);

export const { tag: playerTag, link: playerTagLink } = defineTagTables(
	"player",
	() => player,
	{
		tagColumns: { color: text("color").notNull().default("gray") },
		linkColumns: { position: integer("position").notNull().default(0) },
	}
);
