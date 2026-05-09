import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { limitFormat } from "./limit-format";
import { sessionBlindLevel } from "./session-blind-level";

export const sessionTournamentBlindSet = sqliteTable(
	"session_tournament_blind_set",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionBlindLevelId: integer("session_blind_level_id")
			.notNull()
			.references(() => sessionBlindLevel.id, { onDelete: "cascade" }),
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
		index("sessionTournamentBlindSet_levelId_idx").on(
			table.sessionBlindLevelId
		),
		unique("sessionTournamentBlindSet_levelId_sortOrder_uniq").on(
			table.sessionBlindLevelId,
			table.sortOrder
		),
	]
);

export const sessionTournamentBlindSetRelations = relations(
	sessionTournamentBlindSet,
	({ one }) => ({
		sessionBlindLevel: one(sessionBlindLevel, {
			fields: [sessionTournamentBlindSet.sessionBlindLevelId],
			references: [sessionBlindLevel.id],
		}),
		limitFormat: one(limitFormat, {
			fields: [sessionTournamentBlindSet.limitFormatId],
			references: [limitFormat.id],
		}),
	})
);
