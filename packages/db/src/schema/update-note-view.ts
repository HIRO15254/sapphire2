import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";

export const updateNoteView = sqliteTable(
	"update_note_view",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		version: text("version").notNull(),
		viewedAt: integer("viewed_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [
		index("update_note_view_user_id_idx").on(table.userId),
		uniqueIndex("update_note_view_user_version_idx").on(
			table.userId,
			table.version
		),
	]
);

export const updateNoteViewRelations = relations(updateNoteView, ({ one }) => ({
	user: one(user, {
		fields: [updateNoteView.userId],
		references: [user.id],
	}),
}));
