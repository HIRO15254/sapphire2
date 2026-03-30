import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { liveCashGameSession } from "./live-cash-game-session";
import { liveTournamentSession } from "./live-tournament-session";

export const sessionEvent = sqliteTable(
	"session_event",
	{
		id: text("id").primaryKey(),
		liveCashGameSessionId: text("live_cash_game_session_id").references(
			() => liveCashGameSession.id,
			{ onDelete: "cascade" }
		),
		liveTournamentSessionId: text("live_tournament_session_id").references(
			() => liveTournamentSession.id,
			{ onDelete: "cascade" }
		),
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
		index("sessionEvent_liveCashGameSessionId_idx").on(
			table.liveCashGameSessionId
		),
		index("sessionEvent_liveTournamentSessionId_idx").on(
			table.liveTournamentSessionId
		),
		index("sessionEvent_eventType_idx").on(table.eventType),
	]
);

export const sessionEventRelations = relations(sessionEvent, ({ one }) => ({
	liveCashGameSession: one(liveCashGameSession, {
		fields: [sessionEvent.liveCashGameSessionId],
		references: [liveCashGameSession.id],
	}),
	liveTournamentSession: one(liveTournamentSession, {
		fields: [sessionEvent.liveTournamentSessionId],
		references: [liveTournamentSession.id],
	}),
}));
