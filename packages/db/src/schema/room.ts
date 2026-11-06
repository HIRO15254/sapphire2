import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const room = sqliteTable(
	"room",
	{
		archivedAt: integer("archived_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		id: text("id").primaryKey(),
		isFavorite: integer("is_favorite", { mode: "boolean" })
			.notNull()
			.default(false),
		latitude: real("latitude"),
		longitude: real("longitude"),
		memo: text("memo"),
		name: text("name").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("room_id_user_id_unique").on(table.id, table.userId),
		index("room_userId_idx").on(table.userId),
		check("room_is_favorite_check", sql`${table.isFavorite} IN (0, 1)`),
		check(
			"room_coordinates_pair_check",
			sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`
		),
	]
);
