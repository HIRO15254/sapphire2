import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";

export const sessionBlindLevel = sqliteTable(
	"session_blind_level",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		levelIndex: integer("level_index").notNull(),
		isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
		minutes: integer("minutes"),
		sortOrder: integer("sort_order").notNull(),
	},
	(table) => [
		index("sessionBlindLevel_sessionId_idx").on(table.sessionId),
		unique("sessionBlindLevel_sessionId_sortOrder_uniq").on(
			table.sessionId,
			table.sortOrder
		),
	]
);

export const sessionBlindLevelRelations = relations(
	sessionBlindLevel,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionBlindLevel.sessionId],
			references: [gameSession.id],
		}),
	})
);
