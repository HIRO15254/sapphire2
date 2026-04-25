import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";

export const sessionEvent = sqliteTable(
	"session_event",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		eventType: text("event_type").notNull(),
		occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
		sortOrder: integer("sort_order").notNull(),
		payload: text("payload").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("sessionEvent_sessionId_idx").on(table.sessionId),
		index("sessionEvent_eventType_idx").on(table.eventType),
	]
);

export const sessionEventRelations = relations(sessionEvent, ({ one }) => ({
	session: one(gameSession, {
		fields: [sessionEvent.sessionId],
		references: [gameSession.id],
	}),
}));
