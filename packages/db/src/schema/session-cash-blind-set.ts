import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { limitFormat } from "./limit-format";
import { gameSession } from "./session";

export const sessionCashBlindSet = sqliteTable(
	"session_cash_blind_set",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id")
			.notNull()
			.references(() => gameSession.id, { onDelete: "cascade" }),
		limitFormatId: integer("limit_format_id")
			.notNull()
			.references(() => limitFormat.id, { onDelete: "restrict" }),
		blind1: integer("blind1").notNull(),
		blind2: integer("blind2").notNull(),
		blind3: integer("blind3"),
		blind4: integer("blind4"),
		ante: integer("ante"),
		anteType: text("ante_type"),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(table) => [
		index("sessionCashBlindSet_sessionId_idx").on(table.sessionId),
		unique("sessionCashBlindSet_sessionId_sortOrder_uniq").on(
			table.sessionId,
			table.sortOrder
		),
	]
);

export const sessionCashBlindSetRelations = relations(
	sessionCashBlindSet,
	({ one }) => ({
		session: one(gameSession, {
			fields: [sessionCashBlindSet.sessionId],
			references: [gameSession.id],
		}),
		limitFormat: one(limitFormat, {
			fields: [sessionCashBlindSet.limitFormatId],
			references: [limitFormat.id],
		}),
	})
);
