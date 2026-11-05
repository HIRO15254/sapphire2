import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { tournament } from "./tournament";

export const legacyTournamentTag = sqliteTable(
	"tournament_tag",
	{
		id: text("id").primaryKey(),
		tournamentId: text("tournament_id")
			.notNull()
			.references(() => tournament.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.default(sql`(unixepoch())`)
			.notNull(),
	},
	(table) => [index("tournamentTag_tournamentId_idx").on(table.tournamentId)]
);

export const legacyTournamentTagRelations = relations(
	legacyTournamentTag,
	({ one }) => ({
		tournament: one(tournament, {
			fields: [legacyTournamentTag.tournamentId],
			references: [tournament.id],
		}),
	})
);
