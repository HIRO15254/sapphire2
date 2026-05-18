import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { gameSession } from "./session";

export const sessionBlindLevel = sqliteTable(
	"session_blind_level",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		level: integer("level").notNull(),
		isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
		blind1: integer("blind1"),
		blind2: integer("blind2"),
		blind3: integer("blind3"),
		ante: integer("ante"),
		minutes: integer("minutes"),
	},
	(t) => [index("session_blind_level_session_idx").on(t.sessionId)]
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
