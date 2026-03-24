import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { pokerSession } from "./session";

export const sessionTag = sqliteTable(
	"session_tag",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [index("sessionTag_userId_idx").on(table.userId)]
);

export const sessionToSessionTag = sqliteTable(
	"session_to_session_tag",
	{
		sessionId: text("session_id")
			.notNull()
			.references(() => pokerSession.id, { onDelete: "cascade" }),
		sessionTagId: text("session_tag_id")
			.notNull()
			.references(() => sessionTag.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.sessionId, table.sessionTagId] })]
);

export const sessionTagRelations = relations(sessionTag, ({ one, many }) => ({
	user: one(user, {
		fields: [sessionTag.userId],
		references: [user.id],
	}),
	sessionLinks: many(sessionToSessionTag),
}));

export const sessionToSessionTagRelations = relations(
	sessionToSessionTag,
	({ one }) => ({
		session: one(pokerSession, {
			fields: [sessionToSessionTag.sessionId],
			references: [pokerSession.id],
		}),
		tag: one(sessionTag, {
			fields: [sessionToSessionTag.sessionTagId],
			references: [sessionTag.id],
		}),
	})
);
