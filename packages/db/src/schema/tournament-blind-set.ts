import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { limitFormat } from "./limit-format";
import { tournamentBlindLevel } from "./tournament-blind-level";

export const tournamentBlindSet = sqliteTable(
	"tournament_blind_set",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		tournamentBlindLevelId: integer("tournament_blind_level_id")
			.notNull()
			.references(() => tournamentBlindLevel.id, { onDelete: "cascade" }),
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
		index("tournamentBlindSet_levelId_idx").on(table.tournamentBlindLevelId),
		unique("tournamentBlindSet_levelId_sortOrder_uniq").on(
			table.tournamentBlindLevelId,
			table.sortOrder
		),
	]
);

export const tournamentBlindSetRelations = relations(
	tournamentBlindSet,
	({ one }) => ({
		blindLevel: one(tournamentBlindLevel, {
			fields: [tournamentBlindSet.tournamentBlindLevelId],
			references: [tournamentBlindLevel.id],
		}),
		limitFormat: one(limitFormat, {
			fields: [tournamentBlindSet.limitFormatId],
			references: [limitFormat.id],
		}),
	})
);
