import { relations, sql } from "drizzle-orm";
import {
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
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		memo: text("memo"),
		isFavorite: integer("is_favorite", { mode: "boolean" })
			.notNull()
			.default(false),
		latitude: real("latitude"),
		longitude: real("longitude"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("room_id_user_id_unique").on(table.id, table.userId),
		index("room_userId_idx").on(table.userId),
	]
);

export const roomRelations = relations(room, ({ one }) => ({
	user: one(user, {
		fields: [room.userId],
		references: [user.id],
	}),
}));
