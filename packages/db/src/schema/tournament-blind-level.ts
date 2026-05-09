import { relations } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	unique,
} from "drizzle-orm/sqlite-core";
import { tournament } from "./tournament";

export const tournamentBlindLevel = sqliteTable(
	"tournament_blind_level",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournament.id, { onDelete: "cascade" }),
		levelIndex: integer("level_index").notNull(),
		isBreak: integer("is_break", { mode: "boolean" }).notNull().default(false),
		minutes: integer("minutes"),
		sortOrder: integer("sort_order").notNull(),
	},
	(table) => [
		index("tournamentBlindLevel_tournamentId_idx").on(table.tournamentId),
		unique("tournamentBlindLevel_tournamentId_sortOrder_uniq").on(
			table.tournamentId,
			table.sortOrder
		),
	]
);

export const tournamentBlindLevelRelations = relations(
	tournamentBlindLevel,
	({ one }) => ({
		tournament: one(tournament, {
			fields: [tournamentBlindLevel.tournamentId],
			references: [tournament.id],
		}),
	})
);
